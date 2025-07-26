
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField } = require('discord.js');

// Constants for pagination
const ITEMS_PER_PAGE = 10; // How many items to show per embed page

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('Lists various entities in the server.')
        .setDMPermission(false) // Cannot be used in DMs
        .addSubcommand(subcommand =>
            subcommand
                .setName('bots')
                .setDescription('Lists all bot accounts in the server.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('boosters')
                .setDescription('Lists all server boosters.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bans')
                .setDescription('Lists all banned members.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('inrole')
                .setDescription('Lists members in a specific role.')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to list members for.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('emojis')
                .setDescription('Lists server emojis with IDs.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('roles')
                .setDescription('Lists server roles with IDs.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('admins')
                .setDescription('Lists server administrators.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('invoice')
                .setDescription('Lists users in your current voice channel.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('moderators')
                .setDescription('Lists server moderators.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('early')
                .setDescription('Lists members with Early Supporter badge.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('activedeveloper')
                .setDescription('Lists members with Active Developer badge.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('createdat')
                .setDescription('Lists account creation dates of all users.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('joinedat')
                .setDescription('Lists guild join dates of all users.')),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            const guild = interaction.guild;

            if (!guild) {
                return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            }

            // Defer reply immediately to prevent timeout
            try {
                await interaction.deferReply();
            } catch (error) {
                console.error('Failed to defer reply:', error);
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
                }
                return;
            }

            switch (subcommand) {
            case 'bots': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return this.safeEditReply(interaction, 'You need the "View Channel" permission to use this command.');
                }

                let allBots;
                try {
                    await guild.members.fetch();
                    allBots = guild.members.cache.filter(member => member.user.bot).sort((a, b) => a.user.username.localeCompare(b.user.username));
                } catch (error) {
                    console.error('Error fetching guild members:', error);
                    return this.safeEditReply(interaction, 'Failed to fetch server members. Make sure I have the "View Members" intent and permissions.');
                }

                if (allBots.size === 0) {
                    return this.safeEditReply(interaction, 'No bots found in this server.');
                }

                await this.createPaginatedEmbed(interaction, Array.from(allBots.values()), 'bots', `Bots in ${guild.name}`, (bot, index) => 
                    `\`${index + 1}.\` <@${bot.id}> (${bot.user.tag})`
                );
                break;
            }

            case 'boosters': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interaction.editReply('You need the "View Channel" permission to use this command.');
                }

                try {
                    await guild.members.fetch();
                    const boosters = guild.members.cache.filter(member => member.premiumSince).sort((a, b) => b.premiumSince - a.premiumSince);
                    
                    if (boosters.size === 0) {
                        return this.safeEditReply(interaction, 'No server boosters found.');
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(boosters.values()), 'boosters', `Server Boosters in ${guild.name}`, (member, index) => 
                        `\`${index + 1}.\` <@${member.id}> - Boosting since <t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>`
                    );
                } catch (error) {
                    console.error('Error fetching boosters:', error);
                    return this.safeEditReply(interaction, 'Failed to fetch server boosters.');
                }
                break;
            }

            case 'bans': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                    return interaction.editReply('You need the "Ban Members" permission to use this command.');
                }

                if (!guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                    return interaction.editReply('I do not have the "Ban Members" permission to fetch the ban list.');
                }

                try {
                    const bannedUsers = await guild.bans.fetch();
                    
                    if (bannedUsers.size === 0) {
                        return interaction.editReply('No banned users found in this server.');
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(bannedUsers.values()), 'bans', `Banned Users in ${guild.name}`, (ban, index) => 
                        `\`${index + 1}.\` ${ban.user.tag} (${ban.user.id})${ban.reason ? `\n   Reason: ${ban.reason}` : ''}`
                    );
                } catch (error) {
                    console.error('Error fetching bans:', error);
                    return interaction.editReply('Failed to fetch ban list.');
                }
                break;
            }

            case 'inrole': {
                const role = interaction.options.getRole('role');
                
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interaction.editReply('You need the "View Channel" permission to use this command.');
                }

                try {
                    await guild.members.fetch();
                    const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(role.id)).sort((a, b) => a.user.username.localeCompare(b.user.username));
                    
                    if (membersWithRole.size === 0) {
                        return interaction.editReply(`No members found with the role ${role.name}.`);
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(membersWithRole.values()), 'inrole', `Members with ${role.name} role`, (member, index) => 
                        `\`${index + 1}.\` <@${member.id}> (${member.user.tag})`
                    );
                } catch (error) {
                    console.error('Error fetching members with role:', error);
                    return interaction.editReply('Failed to fetch members with the specified role.');
                }
                break;
            }

            case 'emojis': {
                const emojis = guild.emojis.cache.sort((a, b) => a.name.localeCompare(b.name));
                
                if (emojis.size === 0) {
                    return interaction.editReply('No custom emojis found in this server.');
                }

                await this.createPaginatedEmbed(interaction, Array.from(emojis.values()), 'emojis', `Custom Emojis in ${guild.name}`, (emoji, index) => 
                    `\`${index + 1}.\` ${emoji} \`:${emoji.name}:\` (ID: ${emoji.id})`
                );
                break;
            }

            case 'roles': {
                const roles = guild.roles.cache.filter(role => role.name !== '@everyone').sort((a, b) => b.position - a.position);
                
                if (roles.size === 0) {
                    return interaction.editReply('No roles found in this server.');
                }

                await this.createPaginatedEmbed(interaction, Array.from(roles.values()), 'roles', `Roles in ${guild.name}`, (role, index) => 
                    `\`${index + 1}.\` <@&${role.id}> (ID: ${role.id}) - ${role.members.size} members`
                );
                break;
            }

            case 'admins': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interaction.editReply('You need the "View Channel" permission to use this command.');
                }

                try {
                    await guild.members.fetch();
                    const admins = guild.members.cache.filter(member => 
                        member.permissions.has(PermissionsBitField.Flags.Administrator)
                    ).sort((a, b) => a.user.username.localeCompare(b.user.username));
                    
                    if (admins.size === 0) {
                        return interaction.editReply('No administrators found in this server.');
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(admins.values()), 'admins', `Administrators in ${guild.name}`, (admin, index) => 
                        `\`${index + 1}.\` <@${admin.id}> (${admin.user.tag})`
                    );
                } catch (error) {
                    console.error('Error fetching administrators:', error);
                    return interaction.editReply('Failed to fetch administrators.');
                }
                break;
            }

            case 'invoice': {
                const member = guild.members.cache.get(interaction.user.id);
                const voiceChannel = member?.voice?.channel;
                
                if (!voiceChannel) {
                    return interaction.editReply('You are not currently in a voice channel.');
                }

                const voiceMembers = voiceChannel.members.filter(member => !member.user.bot).sort((a, b) => a.user.username.localeCompare(b.user.username));
                
                if (voiceMembers.size === 0) {
                    return interaction.editReply('No users found in your current voice channel.');
                }

                await this.createPaginatedEmbed(interaction, Array.from(voiceMembers.values()), 'invoice', `Users in ${voiceChannel.name}`, (member, index) => 
                    `\`${index + 1}.\` <@${member.id}> (${member.user.tag})`
                );
                break;
            }

            case 'moderators': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interaction.editReply('You need the "View Channel" permission to use this command.');
                }

                try {
                    await guild.members.fetch();
                    const moderators = guild.members.cache.filter(member => 
                        member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
                        member.permissions.has(PermissionsBitField.Flags.BanMembers) ||
                        member.permissions.has(PermissionsBitField.Flags.KickMembers)
                    ).sort((a, b) => a.user.username.localeCompare(b.user.username));
                    
                    if (moderators.size === 0) {
                        return interaction.editReply('No moderators found in this server.');
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(moderators.values()), 'moderators', `Moderators in ${guild.name}`, (mod, index) => 
                        `\`${index + 1}.\` <@${mod.id}> (${mod.user.tag})`
                    );
                } catch (error) {
                    console.error('Error fetching moderators:', error);
                    return interaction.editReply('Failed to fetch moderators.');
                }
                break;
            }

            case 'early': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interaction.editReply('You need the "View Channel" permission to use this command.');
                }

                try {
                    await guild.members.fetch();
                    const earlySupporter = guild.members.cache.filter(member => 
                        member.user.flags && member.user.flags.has('HypeSquadOnlineHouse1') || 
                        member.user.flags && member.user.flags.has('EarlySupporter')
                    ).sort((a, b) => a.user.username.localeCompare(b.user.username));
                    
                    if (earlySupporter.size === 0) {
                        return interaction.editReply('No Early Supporters found in this server.');
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(earlySupporter.values()), 'early', `Early Supporters in ${guild.name}`, (member, index) => 
                        `\`${index + 1}.\` <@${member.id}> (${member.user.tag})`
                    );
                } catch (error) {
                    console.error('Error fetching early supporters:', error);
                    return interaction.editReply('Failed to fetch Early Supporters.');
                }
                break;
            }

            case 'activedeveloper': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interaction.editReply('You need the "View Channel" permission to use this command.');
                }

                try {
                    await guild.members.fetch();
                    const activeDevelopers = guild.members.cache.filter(member => 
                        member.user.flags && member.user.flags.has('ActiveDeveloper')
                    ).sort((a, b) => a.user.username.localeCompare(b.user.username));
                    
                    if (activeDevelopers.size === 0) {
                        return interaction.editReply('No Active Developers found in this server.');
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(activeDevelopers.values()), 'activedeveloper', `Active Developers in ${guild.name}`, (member, index) => 
                        `\`${index + 1}.\` <@${member.id}> (${member.user.tag})`
                    );
                } catch (error) {
                    console.error('Error fetching active developers:', error);
                    return interaction.editReply('Failed to fetch Active Developers.');
                }
                break;
            }

            case 'createdat': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interaction.editReply('You need the "View Channel" permission to use this command.');
                }

                try {
                    await guild.members.fetch();
                    const members = guild.members.cache.filter(member => !member.user.bot).sort((a, b) => a.user.createdAt - b.user.createdAt);
                    
                    if (members.size === 0) {
                        return interaction.editReply('No users found in this server.');
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(members.values()), 'createdat', `Account Creation Dates in ${guild.name}`, (member, index) => 
                        `\`${index + 1}.\` <@${member.id}> - Created <t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>`
                    );
                } catch (error) {
                    console.error('Error fetching creation dates:', error);
                    return interaction.editReply('Failed to fetch account creation dates.');
                }
                break;
            }

            case 'joinedat': {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ViewChannel)) {
                    return interaction.editReply('You need the "View Channel" permission to use this command.');
                }

                try {
                    await guild.members.fetch();
                    const members = guild.members.cache.filter(member => !member.user.bot).sort((a, b) => a.joinedAt - b.joinedAt);
                    
                    if (members.size === 0) {
                        return interaction.editReply('No users found in this server.');
                    }

                    await this.createPaginatedEmbed(interaction, Array.from(members.values()), 'joinedat', `Guild Join Dates in ${guild.name}`, (member, index) => 
                        `\`${index + 1}.\` <@${member.id}> - Joined <t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
                    );
                } catch (error) {
                    console.error('Error fetching join dates:', error);
                    return interaction.editReply('Failed to fetch guild join dates.');
                }
                break;
            }
            }
        } catch (error) {
            console.error('Error in list command:', error);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply('An error occurred while processing your request.');
                } else {
                    await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
                }
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
    },

    // Helper method to safely edit replies
    safeEditReply(interaction, content) {
        try {
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply(content);
            } else {
                return interaction.reply({ content, ephemeral: true });
            }
        } catch (error) {
            console.error('Failed to send reply:', error);
        }
    },

    async createPaginatedEmbed(interaction, items, type, title, formatFunction) {
        const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
        let currentPage = 0;

        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const itemsOnPage = items.slice(start, end);

            const embed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`${title} (${items.length})`)
                .setDescription(
                    itemsOnPage.map((item, index) =>
                        formatFunction(item, start + index)
                    ).join('\n')
                )
                .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
                .setTimestamp();

            return embed;
        };

        const getActionRow = (page) => {
            const firstButton = new ButtonBuilder()
                .setCustomId(`first_${type}_page`)
                .setEmoji('<:rewind1:1396907328283873486>')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0);

            const prevButton = new ButtonBuilder()
                .setCustomId(`prev_${type}_page`)
                .setEmoji('<:next:1396907441807167528>')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0);

            const nextButton = new ButtonBuilder()
                .setCustomId(`next_${type}_page`)
                .setEmoji('<:icons_next:1396907563504636026>')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages - 1);

            const lastButton = new ButtonBuilder()
                .setCustomId(`last_${type}_page`)
                .setEmoji('<:forward:1396907680769245284>')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1);

            const stopButton = new ButtonBuilder()
                .setCustomId(`stop_${type}_page`)
                .setEmoji('<:delete:1396907789112053821>')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(false);

            return new ActionRowBuilder().addComponents(firstButton, prevButton, stopButton, nextButton, lastButton);
        };

        const initialEmbed = generateEmbed(currentPage);
        const initialRow = getActionRow(currentPage);

        let reply;
        try {
            reply = await interaction.editReply({
                embeds: [initialEmbed],
                components: totalPages > 1 ? [initialRow] : [],
                fetchReply: true
            });
        } catch (error) {
            console.error('Failed to send paginated embed:', error);
            return this.safeEditReply(interaction, 'Failed to display results due to an error.');
        }

        if (totalPages > 1) {
            const collector = reply.createMessageComponentCollector({
                filter: i => i.customId.startsWith(`first_${type}_page`) || 
                           i.customId.startsWith(`prev_${type}_page`) || 
                           i.customId.startsWith(`next_${type}_page`) || 
                           i.customId.startsWith(`last_${type}_page`) || 
                           i.customId.startsWith(`stop_${type}_page`),
                time: 60 * 1000,
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'You can only control your own pagination.', ephemeral: true });
                }

                if (i.customId === `first_${type}_page`) {
                    currentPage = 0;
                } else if (i.customId === `next_${type}_page`) {
                    currentPage++;
                } else if (i.customId === `prev_${type}_page`) {
                    currentPage--;
                } else if (i.customId === `last_${type}_page`) {
                    currentPage = totalPages - 1;
                } else if (i.customId === `stop_${type}_page`) {
                    collector.stop();
                    const disabledRow = getActionRow(currentPage);
                    disabledRow.components.forEach(button => button.setDisabled(true));
                    return i.update({ components: [disabledRow] });
                }

                const newEmbed = generateEmbed(currentPage);
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
                    console.error('Error disabling buttons:', error);
                }
            });
        }
    },
};
