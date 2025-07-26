const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField } = require('discord.js');

// Pagination constant
const BANS_PER_PAGE = 10; // Number of bans to display per page

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('Provides information about the server.')
        .setDMPermission(false) // Cannot be used in DMs

        // Subcommand: banlist
        .addSubcommand(subcommand =>
            subcommand
                .setName('banlist')
                .setDescription('Displays the server\'s ban list (users and bots).'))

        // New Subcommand: unbanall
        .addSubcommand(subcommand =>
            subcommand
                .setName('unbanall')
                .setDescription('Unbans all users and bots from the server. Requires confirmation.')),

    async execute(interaction) {
        await interaction.deferReply(); // Defer the reply, as fetching bans/unbanning can take time

        const guild = interaction.guild;

        if (!guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'banlist') {
            // Permission check: User needs Ban Members permission
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.editReply('You do not have permission to view the ban list. (Requires: `Ban Members`)');
            }

            // Bot permission check: Bot needs Ban Members permission
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.editReply('I do not have the "Ban Members" permission, so I cannot fetch the ban list.');
            }

            let bannedUsers;
            try {
                bannedUsers = await guild.bans.fetch(); // Fetch all bans
            } catch (error) {
                console.error('Error fetching ban list:', error);
                return interaction.editReply('An error occurred while fetching the ban list. Please try again later.');
            }

            if (bannedUsers.size === 0) {
                return interaction.editReply('There are no users or bots currently banned in this server.');
            }

            // Convert Collection to an array for pagination
            const bannedArray = Array.from(bannedUsers.values());
            const totalPages = Math.ceil(bannedArray.length / BANS_PER_PAGE);
            let currentPage = 0;

            const generateBanlistEmbed = (page) => {
                const start = page * BANS_PER_PAGE;
                const end = start + BANS_PER_PAGE;
                const bansOnPage = bannedArray.slice(start, end);

                const description = bansOnPage.map((ban, index) => {
                    const userTag = ban.user.tag;
                    const userId = ban.user.id;
                    const banReason = ban.reason ? `Reason: ${ban.reason}` : 'No reason provided.';
                    return `\`${start + index + 1}.\` **${userTag}** (\`${userId}\`)\n> ${banReason}`;
                }).join('\n\n'); // Use double newline for better readability between entries

                const embed = new EmbedBuilder()
                    .setColor(0xFF0000) // Red color for bans
                    .setTitle(`Server Ban List (${bannedUsers.size} total)`)
                    .setDescription(description || 'No banned users on this page.')
                    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
                    .setTimestamp();

                return embed;
            };

            const getActionRow = (page) => {
                const prevButton = new ButtonBuilder()
                    .setCustomId('prev_banlist_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0);

                const nextButton = new ButtonBuilder()
                    .setCustomId('next_banlist_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === totalPages - 1);

                return new ActionRowBuilder().addComponents(prevButton, nextButton);
            };

            const initialEmbed = generateBanlistEmbed(currentPage);
            const initialRow = getActionRow(currentPage);

            const reply = await interaction.editReply({
                embeds: [initialEmbed],
                components: [initialRow],
                fetchReply: true // Important: make sure we get the message object
            });

            const collector = reply.createMessageComponentCollector({
                filter: i => i.customId === 'prev_banlist_page' || i.customId === 'next_banlist_page',
                time: 60 * 1000, // 60 seconds to interact
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'You can only control your own pagination.', ephemeral: true });
                }

                if (i.customId === 'next_banlist_page') {
                    currentPage++;
                } else if (i.customId === 'prev_banlist_page') {
                    currentPage--;
                }

                const newEmbed = generateBanlistEmbed(currentPage);
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
                    console.error('Error disabling buttons for banlist:', error);
                }
            });
        } else if (subcommand === 'unbanall') {
            // Permission check: User needs Administrator permission
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return interaction.editReply('🚫 You do not have permission to use this command. (Requires: `Administrator`)');
            }

            // Bot permission check: Bot needs Ban Members permission
            if (!guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                return interaction.editReply('🚫 I do not have the "Ban Members" permission, so I cannot unban members.');
            }

            let bannedUsers;
            try {
                bannedUsers = await guild.bans.fetch();
            } catch (error) {
                console.error('Error fetching ban list for unbanall:', error);
                return interaction.editReply('An error occurred while fetching the ban list. Cannot proceed with unbanall.');
            }

            if (bannedUsers.size === 0) {
                return interaction.editReply('There are no users or bots currently banned in this server to unban.');
            }

            const confirmEmbed = new EmbedBuilder()
                .setColor(0xFFA500) // Orange for warning
                .setTitle('⚠️ Confirm Unban All')
                .setDescription(`Are you sure you want to unban **ALL** ${bannedUsers.size} users and bots from this server?\n\n**This action cannot be undone!**`)
                .setTimestamp();

            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_unbanall')
                .setLabel('Yes, Unban All')
                .setStyle(ButtonStyle.Danger); // Red for a dangerous action

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_unbanall')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary); // Grey for a safe action

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            const reply = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [row],
                fetchReply: true
            });

            const collector = reply.createMessageComponentCollector({
                filter: i => i.customId === 'confirm_unbanall' || i.customId === 'cancel_unbanall',
                time: 30 * 1000, // 30 seconds to respond
                max: 1, // Only collect one interaction
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'You can only interact with your own confirmation.', ephemeral: true });
                }

                if (i.customId === 'confirm_unbanall') {
                    await i.update({ content: 'Unbanning all users...', embeds: [], components: [] });

                    let unbannedCount = 0;
                    let failedCount = 0;
                    const unbannedList = [];
                    const failedList = [];

                    for (const ban of bannedUsers.values()) {
                        try {
                            await guild.bans.remove(ban.user.id, `Unbanned by ${interaction.user.tag} via /server unbanall`);
                            unbannedCount++;
                            unbannedList.push(`${ban.user.tag} (\`${ban.user.id}\`)`);
                        } catch (error) {
                            console.error(`Failed to unban ${ban.user.tag} (${ban.user.id}):`, error);
                            failedCount++;
                            failedList.push(`${ban.user.tag} (\`${ban.user.id}\`)`);
                        }
                    }

                    const resultEmbed = new EmbedBuilder()
                        .setColor(0x00FF00) // Green for success
                        .setTitle('✅ Unban All Complete')
                        .setDescription(`Attempted to unban ${bannedUsers.size} users/bots.`)
                        .addFields(
                            { name: 'Successfully Unbanned', value: `${unbannedCount}`, inline: true },
                            { name: 'Failed to Unban', value: `${failedCount}`, inline: true }
                        )
                        .setTimestamp();

                    if (unbannedList.length > 0 && unbannedList.length <= 10) { // Limit detailed list for embed size
                        resultEmbed.addFields({ name: 'Unbanned:', value: unbannedList.join('\n') });
                    }
                    if (failedList.length > 0 && failedList.length <= 10) {
                        resultEmbed.addFields({ name: 'Failed:', value: failedList.join('\n') });
                    }
                     if (unbannedList.length > 10) {
                        resultEmbed.addFields({ name: 'Unbanned (partial list):', value: unbannedList.slice(0, 10).join('\n') + `\n...and ${unbannedList.length - 10} more.` });
                    }
                    if (failedList.length > 10) {
                        resultEmbed.addFields({ name: 'Failed (partial list):', value: failedList.slice(0, 10).join('\n') + `\n...and ${failedList.length - 10} more.` });
                    }
                    if (unbannedCount === 0 && failedCount === 0) {
                        resultEmbed.setDescription('No users were found in the ban list to unban.');
                    }


                    await interaction.followUp({ embeds: [resultEmbed], ephemeral: false }); // Follow up with a public message
                } else if (i.customId === 'cancel_unbanall') {
                    await i.update({ content: 'Unban all operation cancelled.', embeds: [], components: [] });
                }
            });

            collector.on('end', async (collected) => {
                if (collected.size === 0) { // If no interaction was collected within the time limit
                    try {
                        await reply.edit({ content: 'Unban all confirmation timed out.', embeds: [], components: [] });
                    } catch (error) {
                        console.error('Error updating confirmation message on timeout:', error);
                    }
                }
            });
        }
    },
};