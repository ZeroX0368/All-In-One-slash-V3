const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Performs administrative actions.')
        .setDMPermission(false) // Commands cannot be used in DMs

        // Subcommand: ban
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Bans a user from the server.')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('The user to ban.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for the ban.')
                        .setRequired(false)))

        // Subcommand: kick
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Kicks a user from the server.')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('The user to kick.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for the kick.')
                        .setRequired(false)))

        // Subcommand: mute (using timeout)
        .addSubcommand(subcommand =>
            subcommand
                .setName('mute')
                .setDescription('Mutes (timeouts) a user in the server for a specified duration.')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('The user to mute.')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option
                        .setName('duration')
                        .setDescription('Duration of the mute in minutes (default 60 minutes, max 28 days).')
                        .setMinValue(1)
                        .setMaxValue(40320) // 28 days in minutes
                        .setRequired(false))
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for the mute.')
                        .setRequired(false)))

        // Subcommand: unmute (clears timeout)
        .addSubcommand(subcommand =>
            subcommand
                .setName('unmute')
                .setDescription('Unmutes (clears timeout) a user in the server.')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('The user to unmute.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for the unmute.')
                        .setRequired(false)))

        // Subcommand: unban
        .addSubcommand(subcommand =>
            subcommand
                .setName('unban')
                .setDescription('Unbans a user from the server by ID.')
                .addStringOption(option => // User ID is a string
                    option
                        .setName('userid')
                        .setDescription('The ID of the user to unban.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for the unban.')
                        .setRequired(false)))

        // Subcommand: setnick
        .addSubcommand(subcommand =>
            subcommand
                .setName('setnick')
                .setDescription('Sets or removes a user\'s nickname.')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('The user to change nickname for.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('nickname')
                        .setDescription('The new nickname (leave blank to remove).')
                        .setRequired(false))),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); // Always defer for moderation commands

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('target'); // User object for target
        const targetMember = targetUser ? interaction.guild.members.cache.get(targetUser.id) : null; // Member object for target
        const reason = interaction.options.getString('reason') || 'No reason provided.';

        if (!interaction.guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        // Common permission checks for the bot itself (before checking the user)
        const botMember = interaction.guild.members.me;

        // Helper function for user permission checks
        const checkUserPermission = (permissionFlag, commandName) => {
            if (!interaction.member.permissions.has(permissionFlag)) {
                interaction.editReply(`You do not have permission to use the \`/admin ${commandName}\` command. (Requires: ${PermissionsBitField.Flags[permissionFlag].replace(/_/g, ' ')})`);
                return false;
            }
            return true;
        };

        // Helper function for bot hierarchy check
        const checkBotHierarchy = (action, targetMember) => {
            if (targetMember && targetMember.manageable === false) {
                 interaction.editReply(`I cannot ${action} ${targetUser.tag} because their highest role is higher than or equal to my highest role.`);
                 return false;
            }
            return true;
        };

        // Helper function for user hierarchy check
        const checkUserHierarchy = (action, targetMember) => {
            if (targetMember && interaction.member.roles.highest.position <= targetMember.roles.highest.position && interaction.user.id !== interaction.guild.ownerId) {
                interaction.editReply(`You cannot ${action} ${targetUser.tag} because their highest role is higher than or equal to your highest role.`);
                return false;
            }
            return true;
        };


        switch (subcommand) {
            case 'ban': {
                if (!checkUserPermission(PermissionsBitField.Flags.BanMembers, 'ban')) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                    return interaction.editReply('I do not have the "Ban Members" permission.');
                }
                if (!targetMember) {
                    return interaction.editReply('That user is not in this server or could not be found.');
                }
                if (!checkUserHierarchy('ban', targetMember)) return;
                if (!checkBotHierarchy('ban', targetMember)) return;
                if (targetUser.id === interaction.user.id) {
                    return interaction.editReply('You cannot ban yourself.');
                }
                if (targetUser.id === interaction.client.user.id) {
                    return interaction.editReply('I cannot ban myself.');
                }
                if (targetUser.id === interaction.guild.ownerId) {
                    return interaction.editReply('You cannot ban the server owner.');
                }

                try {
                    await targetMember.ban({ reason: reason });
                    await interaction.editReply(`Successfully banned ${targetUser.tag}. Reason: ${reason}`);
                } catch (error) {
                    console.error('Error banning user:', error);
                    await interaction.editReply(`Failed to ban ${targetUser.tag}. Make sure I have the necessary permissions and role hierarchy.`);
                }
                break;
            }

            case 'kick': {
                if (!checkUserPermission(PermissionsBitField.Flags.KickMembers, 'kick')) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                    return interaction.editReply('I do not have the "Kick Members" permission.');
                }
                if (!targetMember) {
                    return interaction.editReply('That user is not in this server or could not be found.');
                }
                if (!checkUserHierarchy('kick', targetMember)) return;
                if (!checkBotHierarchy('kick', targetMember)) return;
                if (targetUser.id === interaction.user.id) {
                    return interaction.editReply('You cannot kick yourself.');
                }
                if (targetUser.id === interaction.client.user.id) {
                    return interaction.editReply('I cannot kick myself.');
                }
                if (targetUser.id === interaction.guild.ownerId) {
                    return interaction.editReply('You cannot kick the server owner.');
                }

                try {
                    await targetMember.kick(reason);
                    await interaction.editReply(`Successfully kicked ${targetUser.tag}. Reason: ${reason}`);
                } catch (error) {
                    console.error('Error kicking user:', error);
                    await interaction.editReply(`Failed to kick ${targetUser.tag}. Make sure I have the necessary permissions and role hierarchy.`);
                }
                break;
            }

            case 'mute': {
                const durationMinutes = interaction.options.getInteger('duration') || 60; // Default 60 minutes
                const durationMs = durationMinutes * 60 * 1000; // Convert to milliseconds
                const maxDurationMs = 28 * 24 * 60 * 60 * 1000; // 28 days in milliseconds

                if (durationMs > maxDurationMs) {
                    return interaction.editReply('The duration cannot exceed 28 days.');
                }

                if (!checkUserPermission(PermissionsBitField.Flags.ModerateMembers, 'mute')) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                    return interaction.editReply('I do not have the "Moderate Members" (Timeout) permission.');
                }
                if (!targetMember) {
                    return interaction.editReply('That user is not in this server or could not be found.');
                }
                if (!checkUserHierarchy('mute', targetMember)) return;
                if (!checkBotHierarchy('mute', targetMember)) return;
                if (targetUser.id === interaction.user.id) {
                    return interaction.editReply('You cannot mute yourself.');
                }
                if (targetUser.id === interaction.client.user.id) {
                    return interaction.editReply('I cannot mute myself.');
                }
                if (targetUser.id === interaction.guild.ownerId) {
                    return interaction.editReply('You cannot mute the server owner.');
                }
                if (targetMember.communicationDisabledUntil) { // Check if already timed out
                    return interaction.editReply(`${targetUser.tag} is already muted.`);
                }

                try {
                    await targetMember.timeout(durationMs, reason);
                    await interaction.editReply(`Successfully muted ${targetUser.tag} for ${durationMinutes} minutes. Reason: ${reason}`);
                } catch (error) {
                    console.error('Error muting user:', error);
                    await interaction.editReply(`Failed to mute ${targetUser.tag}. Make sure I have the necessary permissions and role hierarchy.`);
                }
                break;
            }

            case 'unmute': {
                if (!checkUserPermission(PermissionsBitField.Flags.ModerateMembers, 'unmute')) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                    return interaction.editReply('I do not have the "Moderate Members" (Timeout) permission.');
                }
                if (!targetMember) {
                    return interaction.editReply('That user is not in this server or could not be found.');
                }
                if (!checkUserHierarchy('unmute', targetMember)) return;
                if (!checkBotHierarchy('unmute', targetMember)) return;
                if (!targetMember.communicationDisabledUntil) { // Check if not timed out
                    return interaction.editReply(`${targetUser.tag} is not currently muted.`);
                }

                try {
                    await targetMember.timeout(null, reason); // Pass null to clear timeout
                    await interaction.editReply(`Successfully unmuted ${targetUser.tag}. Reason: ${reason}`);
                } catch (error) {
                    console.error('Error unmuting user:', error);
                    await interaction.editReply(`Failed to unmute ${targetUser.tag}. Make sure I have the necessary permissions and role hierarchy.`);
                }
                break;
            }

            case 'unban': {
                const userId = interaction.options.getString('userid');
                if (!checkUserPermission(PermissionsBitField.Flags.BanMembers, 'unban')) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
                    return interaction.editReply('I do not have the "Ban Members" permission.');
                }

                try {
                    // Fetch ban list to ensure user is banned and get their User object
                    const ban = await interaction.guild.bans.fetch(userId);
                    if (!ban) {
                        return interaction.editReply(`User with ID \`${userId}\` is not currently banned.`);
                    }

                    await interaction.guild.members.unban(userId, reason);
                    await interaction.editReply(`Successfully unbanned ${ban.user.tag} (ID: ${userId}). Reason: ${reason}`);
                } catch (error) {
                    if (error.code === 10026) { // Unknown Ban
                        return interaction.editReply(`User with ID \`${userId}\` is not currently banned.`);
                    }
                    console.error('Error unbanning user:', error);
                    await interaction.editReply(`Failed to unban user with ID \`${userId}\`. Make sure the ID is correct and I have the "Ban Members" permission.`);
                }
                break;
            }

            case 'setnick': {
                const nickname = interaction.options.getString('nickname') || null; // Null to remove nickname
                if (!checkUserPermission(PermissionsBitField.Flags.ManageNicknames, 'setnick')) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
                    return interaction.editReply('I do not have the "Manage Nicknames" permission.');
                }
                if (!targetMember) {
                    return interaction.editReply('That user is not in this server or could not be found.');
                }
                if (!checkUserHierarchy('change nickname for', targetMember)) return; // User's role vs target's
                if (targetMember.id === interaction.client.user.id && nickname !== null) {
                    // Bot changing its own nickname is allowed, but ensure it has permission
                    if (!botMember.permissions.has(PermissionsBitField.Flags.ChangeNickname)) {
                         return interaction.editReply('I do not have the "Change Nickname" permission to change my own nickname.');
                    }
                } else if (!checkBotHierarchy('change nickname for', targetMember)) {
                    return; // Message handled by helper
                }


                try {
                    const oldNick = targetMember.nickname || targetUser.username;
                    await targetMember.setNickname(nickname, reason); // nickname can be null
                    const newNick = nickname || targetUser.username;
                    if (nickname === null) {
                        await interaction.editReply(`Successfully removed nickname for ${targetUser.tag}. Was: \`${oldNick}\`. Reason: ${reason}`);
                    } else {
                        await interaction.editReply(`Successfully set nickname for ${targetUser.tag} from \`${oldNick}\` to \`${newNick}\`. Reason: ${reason}`);
                    }
                } catch (error) {
                    console.error('Error setting nickname:', error);
                    await interaction.editReply(`Failed to set nickname for ${targetUser.tag}. Make sure I have the necessary permissions, role hierarchy, and the nickname is valid (max 32 characters).`);
                }
                break;
            }
        }
    },
};