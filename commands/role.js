const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Manages roles within the server.')
        .setDMPermission(false) // Commands cannot be used in DMs

        // Subcommand: info
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Displays information about a specific role.')
                .addRoleOption(option =>
                    option
                        .setName('target_role')
                        .setDescription('The role to get info about.')
                        .setRequired(true)))

        // Subcommand: all (add role to all users and bots)
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('Adds a role to all members (including bots) in the server.')
                .addRoleOption(option =>
                    option
                        .setName('target_role')
                        .setDescription('The role to add to all members.')
                        .setRequired(true)))

        // Subcommand: removeall (remove role from all users and bots)
        .addSubcommand(subcommand =>
            subcommand
                .setName('removeall')
                .setDescription('Removes a role from all members (including bots) in the server.')
                .addRoleOption(option =>
                    option
                        .setName('target_role')
                        .setDescription('The role to remove from all members.')
                        .setRequired(true)))

        // Subcommand: add (add role to specific user)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adds a role to a specific user.')
                .addRoleOption(option =>
                    option
                        .setName('target_role')
                        .setDescription('The role to add.')
                        .setRequired(true))
                .addUserOption(option =>
                    option
                        .setName('target_user')
                        .setDescription('The user to add the role to.')
                        .setRequired(true)))

        // Subcommand: remove (remove role from specific user)
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Removes a role from a specific user.')
                .addRoleOption(option =>
                    option
                        .setName('target_role')
                        .setDescription('The role to remove.')
                        .setRequired(true))
                .addUserOption(option =>
                    option
                        .setName('target_user')
                        .setDescription('The user to remove the role from.')
                        .setRequired(true)))

        // Subcommand: name (change role name)
        .addSubcommand(subcommand =>
            subcommand
                .setName('name')
                .setDescription('Changes the name of a role.')
                .addRoleOption(option =>
                    option
                        .setName('target_role')
                        .setDescription('The role to rename.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('new_name')
                        .setDescription('The new name for the role.')
                        .setRequired(true)))

        // Subcommand: delete
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Deletes a role from the server.')
                .addRoleOption(option =>
                    option
                        .setName('target_role')
                        .setDescription('The role to delete.')
                        .setRequired(true)))

        // Subcommand: color
        .addSubcommand(subcommand =>
            subcommand
                .setName('color')
                .setDescription('Changes the color of a role.')
                .addRoleOption(option =>
                    option
                        .setName('target_role')
                        .setDescription('The role to change the color of.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('hex_color')
                        .setDescription('The new color in HEX format (e.g., #FF0000).')
                        .setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); // Always defer for moderation/management commands

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const botMember = guild.members.me; // The bot's own member object

        if (!guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        // Helper function for user permission checks
        const checkUserPermission = (permissionFlag, commandName) => {
            if (!interaction.member.permissions.has(permissionFlag)) {
                interaction.editReply(`You do not have permission to use the \`/role ${commandName}\` command. (Requires: ${PermissionsBitField.Flags[permissionFlag].replace(/_/g, ' ')})`);
                return false;
            }
            return true;
        };

        // Helper function for bot hierarchy check against a role
        const checkBotHierarchyForRole = (action, targetRole) => {
            if (botMember.roles.highest.position <= targetRole.position) {
                 interaction.editReply(`I cannot ${action} the role \`${targetRole.name}\` because my highest role is not above it.`);
                 return false;
            }
            return true;
        };

        // Helper function for user hierarchy check against a role
        const checkUserHierarchyForRole = (action, targetRole) => {
            if (interaction.member.roles.highest.position <= targetRole.position && interaction.user.id !== guild.ownerId) {
                interaction.editReply(`You cannot ${action} the role \`${targetRole.name}\` because your highest role is not above it.`);
                return false;
            }
            return true;
        };

        // Helper function for bot hierarchy check against a target member (for add/remove)
        const checkBotHierarchyForMember = (action, targetMember) => {
            if (botMember.roles.highest.position <= targetMember.roles.highest.position && targetMember.id !== guild.ownerId) {
                interaction.editReply(`I cannot ${action} roles for ${targetMember.user.tag} because their highest role is higher than or equal to my highest role.`);
                return false;
            }
            return true;
        };

        // Helper function for user hierarchy check against a target member (for add/remove)
        const checkUserHierarchyForMember = (action, targetMember) => {
            if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && interaction.user.id !== guild.ownerId) {
                interaction.editReply(`You cannot ${action} roles for ${targetMember.user.tag} because their highest role is higher than or equal to your highest role.`);
                return false;
            }
            return true;
        };

        switch (subcommand) {
            case 'info': {
                const targetRole = interaction.options.getRole('target_role');
                if (!targetRole) {
                    return interaction.editReply('That role could not be found.');
                }

                const infoEmbed = new EmbedBuilder()
                    .setColor(targetRole.color || 0x0099FF) // Use role color, default blue
                    .setTitle(`Role Info: ${targetRole.name}`)
                    .addFields(
                        { name: 'ID', value: targetRole.id, inline: true },
                        { name: 'Name', value: targetRole.name, inline: true },
                        { name: 'Color (HEX)', value: targetRole.hexColor, inline: true },
                        { name: 'Hoisted', value: targetRole.hoist ? 'Yes' : 'No', inline: true }, // Displayed separately in member list
                        { name: 'Mentionable', value: targetRole.mentionable ? 'Yes' : 'No', inline: true },
                        { name: 'Managed by Bot/Discord', value: targetRole.managed ? 'Yes' : 'No', inline: true }, // Managed by integration/bot
                        { name: 'Position', value: targetRole.position.toString(), inline: true },
                        { name: 'Members with Role', value: targetRole.members.size.toString(), inline: true },
                        { name: 'Created At', value: `<t:${Math.floor(targetRole.createdTimestamp / 1000)}:F>`, inline: false }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [infoEmbed] });
                break;
            }

            case 'all': {
                const targetRole = interaction.options.getRole('target_role');
                if (!targetRole) {
                    return interaction.editReply('That role could not be found.');
                }

                if (!checkUserPermission(PermissionsBitField.Flags.ManageRoles, 'all')) return;
                if (!checkUserHierarchyForRole('add role to all users', targetRole)) return; // User must be above role
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    return interaction.editReply('I do not have the "Manage Roles" permission.');
                }
                if (!checkBotHierarchyForRole('add', targetRole)) return; // Bot must be above role it's adding

                if (targetRole.managed) {
                    return interaction.editReply(`I cannot manage the role \`${targetRole.name}\` as it is managed by an integration.`);
                }
                if (targetRole.id === guild.roles.everyone.id) {
                    return interaction.editReply('I cannot add the `@everyone` role to everyone.');
                }

                let addedCount = 0;
                let skippedCount = 0;
                await guild.members.fetch(); // Ensure cache is populated with all members
                for (const member of guild.members.cache.values()) {
                    // Skip members already having the role
                    if (member.roles.cache.has(targetRole.id)) {
                        skippedCount++;
                        continue;
                    }
                    // Check if bot can assign role to this specific member (hierarchy)
                    if (botMember.roles.highest.position <= member.roles.highest.position && member.id !== guild.ownerId) {
                         skippedCount++; // Cannot manage this member
                         continue;
                    }
                     // Check if user can manage this specific member (hierarchy)
                    if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.user.id !== guild.ownerId) {
                         skippedCount++; // User cannot manage this member
                         continue;
                    }
                    try {
                        await member.roles.add(targetRole, `Added by ${interaction.user.tag} via /role all`);
                        addedCount++;
                    } catch (error) {
                        console.error(`Failed to add role to ${member.user.tag}:`, error);
                        skippedCount++;
                    }
                }
                await interaction.editReply(`Successfully added role \`${targetRole.name}\` to ${addedCount} members. Skipped ${skippedCount} (already had role or higher role).`);
                break;
            }

            case 'removeall': {
                const targetRole = interaction.options.getRole('target_role');
                if (!targetRole) {
                    return interaction.editReply('That role could not be found.');
                }

                if (!checkUserPermission(PermissionsBitField.Flags.ManageRoles, 'removeall')) return;
                if (!checkUserHierarchyForRole('remove role from all users', targetRole)) return; // User must be above role
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    return interaction.editReply('I do not have the "Manage Roles" permission.');
                }
                if (!checkBotHierarchyForRole('remove', targetRole)) return; // Bot must be above role it's removing

                if (targetRole.managed) {
                    return interaction.editReply(`I cannot manage the role \`${targetRole.name}\` as it is managed by an integration.`);
                }
                if (targetRole.id === guild.roles.everyone.id) {
                    return interaction.editReply('I cannot remove the `@everyone` role from everyone.');
                }

                let removedCount = 0;
                let skippedCount = 0;
                await guild.members.fetch(); // Ensure cache is populated with all members
                for (const member of guild.members.cache.values()) {
                    // Skip members not having the role
                    if (!member.roles.cache.has(targetRole.id)) {
                        skippedCount++;
                        continue;
                    }
                    // Check if bot can manage this specific member (hierarchy)
                    if (botMember.roles.highest.position <= member.roles.highest.position && member.id !== guild.ownerId) {
                         skippedCount++; // Cannot manage this member
                         continue;
                    }
                    // Check if user can manage this specific member (hierarchy)
                    if (interaction.member.roles.highest.position <= member.roles.highest.position && interaction.user.id !== guild.ownerId) {
                         skippedCount++; // User cannot manage this member
                         continue;
                    }
                    try {
                        await member.roles.remove(targetRole, `Removed by ${interaction.user.tag} via /role removeall`);
                        removedCount++;
                    } catch (error) {
                        console.error(`Failed to remove role from ${member.user.tag}:`, error);
                        skippedCount++;
                    }
                }
                await interaction.editReply(`Successfully removed role \`${targetRole.name}\` from ${removedCount} members. Skipped ${skippedCount} (didn't have role or higher role).`);
                break;
            }

            case 'add': {
                const targetRole = interaction.options.getRole('target_role');
                const targetUser = interaction.options.getUser('target_user');
                const targetMember = targetUser ? guild.members.cache.get(targetUser.id) : null;

                if (!targetRole || !targetUser || !targetMember) {
                    return interaction.editReply('Could not find the specified role or user.');
                }

                if (!checkUserPermission(PermissionsBitField.Flags.ManageRoles, 'add')) return;
                if (!checkUserHierarchyForRole('add role to', targetRole)) return;
                if (!checkUserHierarchyForMember('add role to', targetMember)) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    return interaction.editReply('I do not have the "Manage Roles" permission.');
                }
                if (!checkBotHierarchyForRole('add', targetRole)) return;
                if (!checkBotHierarchyForMember('add role to', targetMember)) return;
                
                if (targetRole.managed) {
                    return interaction.editReply(`I cannot manage the role \`${targetRole.name}\` as it is managed by an integration.`);
                }
                 if (targetRole.id === guild.roles.everyone.id) {
                    return interaction.editReply('You cannot manually add the `@everyone` role.');
                }
                if (targetMember.roles.cache.has(targetRole.id)) {
                    return interaction.editReply(`${targetUser.tag} already has the \`${targetRole.name}\` role.`);
                }

                try {
                    await targetMember.roles.add(targetRole, `Added by ${interaction.user.tag} via /role add`);
                    await interaction.editReply(`Successfully added role \`${targetRole.name}\` to ${targetUser.tag}.`);
                } catch (error) {
                    console.error('Error adding role:', error);
                    await interaction.editReply(`Failed to add role to ${targetUser.tag}. Make sure I have the necessary permissions and role hierarchy.`);
                }
                break;
            }

            case 'remove': {
                const targetRole = interaction.options.getRole('target_role');
                const targetUser = interaction.options.getUser('target_user');
                const targetMember = targetUser ? guild.members.cache.get(targetUser.id) : null;

                if (!targetRole || !targetUser || !targetMember) {
                    return interaction.editReply('Could not find the specified role or user.');
                }

                if (!checkUserPermission(PermissionsBitField.Flags.ManageRoles, 'remove')) return;
                if (!checkUserHierarchyForRole('remove role from', targetRole)) return;
                if (!checkUserHierarchyForMember('remove role from', targetMember)) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    return interaction.editReply('I do not have the "Manage Roles" permission.');
                }
                if (!checkBotHierarchyForRole('remove', targetRole)) return;
                if (!checkBotHierarchyForMember('remove role from', targetMember)) return;
                
                if (targetRole.managed) {
                    return interaction.editReply(`I cannot manage the role \`${targetRole.name}\` as it is managed by an integration.`);
                }
                 if (targetRole.id === guild.roles.everyone.id) {
                    return interaction.editReply('You cannot manually remove the `@everyone` role.');
                }
                if (!targetMember.roles.cache.has(targetRole.id)) {
                    return interaction.editReply(`${targetUser.tag} does not have the \`${targetRole.name}\` role.`);
                }

                try {
                    await targetMember.roles.remove(targetRole, `Removed by ${interaction.user.tag} via /role remove`);
                    await interaction.editReply(`Successfully removed role \`${targetRole.name}\` from ${targetUser.tag}.`);
                } catch (error) {
                    console.error('Error removing role:', error);
                    await interaction.editReply(`Failed to remove role from ${targetUser.tag}. Make sure I have the necessary permissions and role hierarchy.`);
                }
                break;
            }

            case 'name': {
                const targetRole = interaction.options.getRole('target_role');
                const newName = interaction.options.getString('new_name');

                if (!targetRole) {
                    return interaction.editReply('That role could not be found.');
                }

                if (!checkUserPermission(PermissionsBitField.Flags.ManageRoles, 'name')) return;
                if (!checkUserHierarchyForRole('rename', targetRole)) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    return interaction.editReply('I do not have the "Manage Roles" permission.');
                }
                if (!checkBotHierarchyForRole('rename', targetRole)) return;
                if (targetRole.managed) {
                    return interaction.editReply(`I cannot manage the role \`${targetRole.name}\` as it is managed by an integration.`);
                }
                if (targetRole.id === guild.roles.everyone.id) {
                    return interaction.editReply('You cannot rename the `@everyone` role.');
                }


                try {
                    const oldName = targetRole.name;
                    await targetRole.setName(newName, `Renamed by ${interaction.user.tag} via /role name`);
                    await interaction.editReply(`Successfully renamed role \`${oldName}\` to \`${newName}\`.`);
                } catch (error) {
                    console.error('Error renaming role:', error);
                    await interaction.editReply(`Failed to rename role. Make sure the new name is valid and I have the necessary permissions.`);
                }
                break;
            }

            case 'delete': {
                const targetRole = interaction.options.getRole('target_role');

                if (!targetRole) {
                    return interaction.editReply('That role could not be found.');
                }

                if (!checkUserPermission(PermissionsBitField.Flags.ManageRoles, 'delete')) return;
                if (!checkUserHierarchyForRole('delete', targetRole)) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    return interaction.editReply('I do not have the "Manage Roles" permission.');
                }
                if (!checkBotHierarchyForRole('delete', targetRole)) return;
                if (targetRole.managed) {
                    return interaction.editReply(`I cannot delete the role \`${targetRole.name}\` as it is managed by an integration.`);
                }
                if (targetRole.id === guild.roles.everyone.id) {
                    return interaction.editReply('You cannot delete the `@everyone` role.');
                }
                if (targetRole.id === botMember.roles.highest.id) {
                     return interaction.editReply('I cannot delete my own highest role.');
                }

                try {
                    const roleName = targetRole.name;
                    await targetRole.delete(`Deleted by ${interaction.user.tag} via /role delete`);
                    await interaction.editReply(`Successfully deleted role \`${roleName}\`.`);
                } catch (error) {
                    console.error('Error deleting role:', error);
                    await interaction.editReply(`Failed to delete role. Make sure I have the necessary permissions and hierarchy.`);
                }
                break;
            }

            case 'color': {
                const targetRole = interaction.options.getRole('target_role');
                const hexColor = interaction.options.getString('hex_color');

                if (!targetRole) {
                    return interaction.editReply('That role could not be found.');
                }

                // Validate hex color (simple check)
                if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexColor)) {
                    return interaction.editReply('Invalid HEX color format. Please use a format like `#FF0000` or `#F00`.');
                }

                if (!checkUserPermission(PermissionsBitField.Flags.ManageRoles, 'color')) return;
                if (!checkUserHierarchyForRole('change color of', targetRole)) return;
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    return interaction.editReply('I do not have the "Manage Roles" permission.');
                }
                if (!checkBotHierarchyForRole('change color of', targetRole)) return;
                if (targetRole.managed) {
                    return interaction.editReply(`I cannot manage the role \`${targetRole.name}\` as it is managed by an integration.`);
                }
                if (targetRole.id === guild.roles.everyone.id) {
                    return interaction.editReply('You cannot change the color of the `@everyone` role.');
                }

                try {
                    const oldColor = targetRole.hexColor;
                    await targetRole.setColor(hexColor, `Color changed by ${interaction.user.tag} via /role color`);
                    await interaction.editReply(`Successfully changed color of role \`${targetRole.name}\` from \`${oldColor}\` to \`${hexColor}\`.`);
                } catch (error) {
                    console.error('Error changing role color:', error);
                    await interaction.editReply(`Failed to change role color. Make sure the color is valid and I have the necessary permissions.`);
                }
                break;
            }
        }
    },
};