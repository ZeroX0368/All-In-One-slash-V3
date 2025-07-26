const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Determine the path to afk.json relative to this command file
// Assumes afk.json is in the parent directory (your bot's root)
const AFK_FILE = path.join(__dirname, '../afk.json');

// --- Helper Functions for AFK Data Management ---

/**
 * Reads the AFK data from afk.json.
 * If the file doesn't exist or is malformed, it initializes it.
 * @returns {object} The AFK data object with a 'users' array.
 */
function readAfkData() {
    try {
        const data = fs.readFileSync(AFK_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        // Ensure 'users' is an array, otherwise return default structure
        return Array.isArray(parsedData.users) ? parsedData : { users: [] };
    } catch (error) {
        // If file not found (ENOENT) or JSON is invalid (SyntaxError),
        // create a new default structure and write it.
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            const defaultAfk = { users: [] };
            fs.writeFileSync(AFK_FILE, JSON.stringify(defaultAfk, null, 4), 'utf8');
            return defaultAfk;
        }
        console.error('Error reading afk.json:', error);
        return { users: [] }; // Return empty state on critical read error
    }
}

/**
 * Writes the given AFK data object to afk.json.
 * @param {object} data The AFK data object to write.
 */
function writeAfkData(data) {
    try {
        fs.writeFileSync(AFK_FILE, JSON.stringify(data, null, 4), 'utf8');
    } catch (error) {
        console.error('Error writing afk.json:', error);
    }
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param {number} ms The duration in milliseconds.
 * @returns {string} Formatted duration (e.g., "1 day, 2 hours, 30 minutes").
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    // Only include hours if there are days or if hours > 0
    if (hours % 24 > 0 || (days === 0 && hours > 0)) parts.push(`${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`);
    // Only include minutes if there are hours or days, or if minutes > 0
    if (minutes % 60 > 0 || (hours === 0 && minutes > 0 && days === 0)) parts.push(`${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`);
    
    // If all are zero, or just seconds are left, show "less than a minute"
    if (parts.length === 0) parts.push(`less than a minute`);
    
    return parts.join(', ');
}

// --- Command Definition ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Manages your AFK status.')
        .setDMPermission(false) // AFK status is typically guild-specific

        // Subcommand: set your AFK status
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your AFK status with an optional reason.')
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('The reason for your AFK status.')
                        .setRequired(false))) // Reason is optional

        // Subcommand: list all AFK users
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all currently AFK users.')),

    // --- Command Execution Logic ---
    async execute(interaction) {
        // Defer reply: shows "Bot is thinking..."
        // Ephemeral for 'set' (personal confirmation) and 'list' (might be a long list)
        await interaction.deferReply({ ephemeral: false });

        const subcommand = interaction.options.getSubcommand();
        const afkData = readAfkData(); // Get current AFK data
        const userId = interaction.user.id; // ID of the user who ran the command

        switch (subcommand) {
            case 'set': {
                const reason = interaction.options.getString('reason') || 'No reason provided.';

                const existingAfkIndex = afkData.users.findIndex(u => u.id === userId);

                if (existingAfkIndex !== -1) {
                    // User is already AFK, update their reason and timestamp
                    afkData.users[existingAfkIndex].reason = reason;
                    afkData.users[existingAfkIndex].timestamp = new Date().toISOString(); // Update timestamp
                    writeAfkData(afkData);
                    await interaction.editReply(`✅ Your AFK status has been updated to: \`${reason}\``);
                } else {
                    // User is not AFK, add them to the list
                    afkData.users.push({
                        id: userId,
                        reason: reason,
                        timestamp: new Date().toISOString() // Store current time as ISO string
                    });
                    writeAfkData(afkData);
                    await interaction.editReply(`✅ You are now AFK: \`${reason}\`. I will notify others who mention you.`);
                }
                break;
            }

            case 'list': {
                if (afkData.users.length === 0) {
                    return interaction.editReply('There are currently no users marked as AFK.');
                }

                // Sort AFK users by who went AFK earliest (oldest first)
                afkData.users.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                // Constants for pagination
                const USERS_PER_PAGE = 10;
                const totalPages = Math.ceil(afkData.users.length / USERS_PER_PAGE);
                let currentPage = 0; // Start at the first page (index 0)

                /**
                 * Generates the Embed for a given page of AFK users.
                 * @param {number} page The current page number (0-indexed).
                 * @returns {Promise<EmbedBuilder>} The generated embed.
                 */
                const generateAfkListEmbed = async (page) => {
                    const start = page * USERS_PER_PAGE;
                    const end = start + USERS_PER_PAGE;
                    const usersOnPage = afkData.users.slice(start, end);

                    const description = [];
                    for (const afkUser of usersOnPage) {
                        let userTag = `<@${afkUser.id}>`; // Fallback to mention if user tag can't be fetched
                        try {
                            // Fetch user to get their current tag, especially if they left/rejoined
                            const user = await interaction.client.users.fetch(afkUser.id).catch(() => null);
                            if (user) {
                                userTag = user.tag; // Use user.tag (e.g., "Username#1234")
                            }
                        } catch (error) {
                            console.warn(`Could not fetch user tag for ID ${afkUser.id}:`, error.message);
                        }
                        const duration = formatDuration(Date.now() - new Date(afkUser.timestamp).getTime());
                        description.push(`**${userTag}** (AFK for ${duration})\n> Reason: \`${afkUser.reason}\``);
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0xFFA500) // Orange color for AFK status
                        .setTitle('Currently AFK Users')
                        .setDescription(description.join('\n\n') || 'No AFK users on this page.')
                        .setFooter({ text: `Page ${page + 1} of ${totalPages} | Total AFK: ${afkData.users.length}` })
                        .setTimestamp();

                    return embed;
                };

                /**
                 * Creates the action row with pagination buttons.
                 * @param {number} page The current page number.
                 * @returns {ActionRowBuilder} The action row with enabled/disabled buttons.
                 */
                const getActionRow = (page) => {
                    const prevButton = new ButtonBuilder()
                        .setCustomId('afk_prev_page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0); // Disable if on the first page

                    const nextButton = new ButtonBuilder()
                        .setCustomId('afk_next_page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages - 1); // Disable if on the last page

                    return new ActionRowBuilder().addComponents(prevButton, nextButton);
                };

                // Send the initial embed and buttons
                const initialEmbed = await generateAfkListEmbed(currentPage);
                const initialRow = getActionRow(currentPage);

                const reply = await interaction.editReply({
                    embeds: [initialEmbed],
                    components: [initialRow],
                    fetchReply: true // Important: needed to create a collector on this message
                });

                // Create a collector to listen for button interactions
                const collector = reply.createMessageComponentCollector({
                    filter: i => i.customId === 'afk_prev_page' || i.customId === 'afk_next_page',
                    time: 90 * 1000, // Collector lasts for 90 seconds
                });

                collector.on('collect', async i => {
                    // Ensure only the user who triggered the command can interact with buttons
                    if (i.user.id !== interaction.user.id) {
                        return i.reply({ content: 'You can only control your own pagination.', ephemeral: true });
                    }

                    if (i.customId === 'afk_next_page') {
                        currentPage++;
                    } else if (i.customId === 'afk_prev_page') {
                        currentPage--;
                    }

                    const newEmbed = await generateAfkListEmbed(currentPage);
                    const newRow = getActionRow(currentPage);

                    await i.update({
                        embeds: [newEmbed],
                        components: [newRow],
                    });
                });

                collector.on('end', async () => {
                    // When collector ends (timeout or manual stop), disable buttons
                    const disabledRow = getActionRow(currentPage);
                    disabledRow.components.forEach(button => button.setDisabled(true)); // Ensure all are disabled
                    try {
                        await reply.edit({ components: [disabledRow] });
                    } catch (error) {
                        console.error('Error disabling buttons for AFK list:', error);
                    }
                });
                break;
            }
        }
    },
};