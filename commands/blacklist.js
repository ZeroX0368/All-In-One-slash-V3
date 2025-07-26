const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load ownerId from config.json
const { ownerId } = require('../config.json');

// Path to the blacklist file
const BLACKLIST_FILE = path.join(__dirname, '../blacklist.json');

// Pagination constant
const SERVERS_PER_PAGE = 10;

// Function to read blacklist from file
function readBlacklist() {
    try {
        const data = fs.readFileSync(BLACKLIST_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File does not exist, create it with an empty array
            fs.writeFileSync(BLACKLIST_FILE, '[]', 'utf8');
            return [];
        }
        console.error('Error reading blacklist file:', error);
        return [];
    }
}

// Function to write blacklist to file
function writeBlacklist(blacklist) {
    try {
        fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklist, null, 4), 'utf8');
    } catch (error) {
        console.error('Error writing blacklist file:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manages the bot\'s server blacklist (Owner Only).')
        .setDMPermission(true) // Can be used in DMs by the owner

        // Subcommand: list
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Displays all currently blacklisted servers.'))

        // Subcommand: server
        .addSubcommand(subcommand =>
            subcommand
                .setName('server')
                .setDescription('Blacklist a server from using bot commands.')
                .addStringOption(option =>
                    option
                        .setName('serverid')
                        .setDescription('The ID of the server to blacklist.')
                        .setRequired(true)))

        // Subcommand: remove
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a server from the blacklist.')
                .addStringOption(option =>
                    option
                        .setName('serverid')
                        .setDescription('The ID of the server to remove from blacklist.')
                        .setRequired(true))),

    async execute(interaction) {
        // Owner Only Check
        if (interaction.user.id !== ownerId) {
            return interaction.reply({ content: '🚫 You are not the bot owner.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true }); // Defer reply, always ephemeral for owner commands

        const subcommand = interaction.options.getSubcommand();
        let currentBlacklist = readBlacklist(); // Always read fresh blacklist

        switch (subcommand) {
            case 'list': {
                if (currentBlacklist.length === 0) {
                    return interaction.editReply('There are no servers currently blacklisted.');
                }

                const totalPages = Math.ceil(currentBlacklist.length / SERVERS_PER_PAGE);
                let currentPage = 0;

                const generateBlacklistEmbed = async (page) => {
                    const start = page * SERVERS_PER_PAGE;
                    const end = start + SERVERS_PER_PAGE;
                    const serversOnPage = currentBlacklist.slice(start, end);

                    const description = [];
                    for (const serverId of serversOnPage) {
                        try {
                            const guild = await interaction.client.guilds.fetch(serverId).catch(() => null); // Fetch guild by ID
                            if (guild) {
                                description.push(`\`${serverId}\` - **${guild.name}** (Members: ${guild.memberCount})`);
                            } else {
                                description.push(`\`${serverId}\` - *Unknown Server (Bot not in guild or invalid ID)*`);
                            }
                        } catch (error) {
                            console.error(`Error fetching guild ${serverId}:`, error);
                            description.push(`\`${serverId}\` - *Error fetching server info*`);
                        }
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0xFFA500) // Orange color
                        .setTitle('Blacklisted Servers')
                        .setDescription(description.join('\n') || 'No servers on this page.')
                        .setFooter({ text: `Page ${page + 1} of ${totalPages} | Total: ${currentBlacklist.length}` })
                        .setTimestamp();

                    return embed;
                };

                const getActionRow = (page) => {
                    const prevButton = new ButtonBuilder()
                        .setCustomId('prev_blacklist_page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0);

                    const nextButton = new ButtonBuilder()
                        .setCustomId('next_blacklist_page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages - 1);

                    return new ActionRowBuilder().addComponents(prevButton, nextButton);
                };

                const initialEmbed = await generateBlacklistEmbed(currentPage);
                const initialRow = getActionRow(currentPage);

                const reply = await interaction.editReply({
                    embeds: [initialEmbed],
                    components: [initialRow],
                    fetchReply: true // Important: make sure we get the message object
                });

                const collector = reply.createMessageComponentCollector({
                    filter: i => i.customId === 'prev_blacklist_page' || i.customId === 'next_blacklist_page',
                    time: 90 * 1000, // 90 seconds to interact
                });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        return i.reply({ content: 'You can only control your own pagination.', ephemeral: true });
                    }

                    if (i.customId === 'next_blacklist_page') {
                        currentPage++;
                    } else if (i.customId === 'prev_blacklist_page') {
                        currentPage--;
                    }

                    const newEmbed = await generateBlacklistEmbed(currentPage);
                    const newRow = getActionRow(currentPage);

                    await i.update({
                        embeds: [newEmbed],
                        components: [newRow],
                    });
                });

                collector.on('end', async () => {
                    const disabledRow = getActionRow(currentPage);
                    disabledRow.components.forEach(button => button.setDisabled(true));
                    try {
                        await reply.edit({ components: [disabledRow] });
                    } catch (error) {
                        console.error('Error disabling buttons for blacklist list:', error);
                    }
                });

                break;
            }

            case 'server': {
                const serverId = interaction.options.getString('serverid');

                if (!/^\d{17,19}$/.test(serverId)) { // Basic ID validation
                    return interaction.editReply('Invalid Server ID format. Please provide a valid Discord Server ID.');
                }

                if (currentBlacklist.includes(serverId)) {
                    return interaction.editReply(`Server \`${serverId}\` is already blacklisted.`);
                }

                // Attempt to fetch guild to get its name for confirmation
                let guildName = serverId; // Default to ID if not found
                try {
                    const guild = await interaction.client.guilds.fetch(serverId).catch(() => null);
                    if (guild) {
                        guildName = guild.name;
                    }
                } catch (error) {
                    console.warn(`Could not fetch guild name for ID ${serverId}:`, error.message);
                }

                currentBlacklist.push(serverId);
                writeBlacklist(currentBlacklist);
                await interaction.editReply(`Successfully blacklisted server: **${guildName}** (\`${serverId}\`). Members in this server can no longer use bot commands.`);
                break;
            }

            case 'remove': {
                const serverId = interaction.options.getString('serverid');

                if (!/^\d{17,19}$/.test(serverId)) { // Basic ID validation
                    return interaction.editReply('Invalid Server ID format. Please provide a valid Discord Server ID.');
                }

                if (!currentBlacklist.includes(serverId)) {
                    return interaction.editReply(`Server \`${serverId}\` is not currently blacklisted.`);
                }

                // Attempt to fetch guild to get its name for confirmation
                let guildName = serverId; // Default to ID if not found
                try {
                    const guild = await interaction.client.guilds.fetch(serverId).catch(() => null);
                    if (guild) {
                        guildName = guild.name;
                    }
                } catch (error) {
                    console.warn(`Could not fetch guild name for ID ${serverId}:`, error.message);
                }

                currentBlacklist = currentBlacklist.filter(id => id !== serverId);
                writeBlacklist(currentBlacklist);
                await interaction.editReply(`Successfully removed server **${guildName}** (\`${serverId}\`) from the blacklist. Members in this server can now use bot commands again.`);
                break;
            }
        }
    },
};