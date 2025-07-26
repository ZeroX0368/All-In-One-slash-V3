const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Manages channels within the server.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels) // Require Manage Channels permission
        .setDMPermission(false) // Commands cannot be used in DMs
        .addSubcommand(subcommand =>
            subcommand
                .setName('unhideall')
                .setDescription('Unhides all text and voice channels for @everyone.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('hideall')
                .setDescription('Hides all text and voice channels from @everyone.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unlockall')
                .setDescription('Unlocks all text channels by allowing @everyone to send messages.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('lockall')
                .setDescription('Locks all text channels by preventing @everyone from sending messages.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clone')
                .setDescription('Clones an existing channel.')
                .addChannelOption(option =>
                    option
                        .setName('target')
                        .setDescription('The channel to clone.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('new_name')
                        .setDescription('The name for the new cloned channel (optional).')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Deletes a specified channel.')
                .addChannelOption(option =>
                    option
                        .setName('target')
                        .setDescription('The channel to delete.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Displays information about a channel.')
                .addChannelOption(option =>
                    option
                        .setName('target')
                        .setDescription('The channel to get info about (defaults to current channel).')
                        .setRequired(false))),

    async execute(interaction) {
        // Defer reply for commands that might take time or involve multiple operations
        await interaction.deferReply({ ephemeral: true });

        // Basic permission check (in addition to setDefaultMemberPermissions)
        // Ensure the user has manage channels permission in the guild
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return interaction.editReply({ content: 'You do not have permission to use this command (Manage Channels required).', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const everyoneRole = guild.roles.everyone;

        if (!guild) {
            return interaction.editReply('This command can only be used in a server.');
        }

        switch (subcommand) {
            case 'unhideall': {
                let successCount = 0;
                for (const [id, channel] of guild.channels.cache) {
                    if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildStageVoice) {
                        try {
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                ViewChannel: true,
                            });
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to unhide channel ${channel.name}:`, error);
                        }
                    }
                }
                await interaction.editReply(`Successfully unhid ${successCount} channels.`);
                break;
            }

            case 'hideall': {
                let successCount = 0;
                for (const [id, channel] of guild.channels.cache) {
                    if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildStageVoice) {
                        try {
                            // Ensure the command channel itself is not hidden if you want to send the reply
                            if (channel.id === interaction.channel.id) {
                                continue; // Skip hiding the current channel for the reply
                            }
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                ViewChannel: false,
                            });
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to hide channel ${channel.name}:`, error);
                        }
                    }
                }
                await interaction.editReply(`Successfully hid ${successCount} channels. (Note: The command channel might not be hidden for this reply to be visible)`);
                break;
            }

            case 'unlockall': {
                let successCount = 0;
                for (const [id, channel] of guild.channels.cache) {
                    if (channel.type === ChannelType.GuildText) { // Only applies to text channels
                        try {
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                SendMessages: true,
                            });
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to unlock channel ${channel.name}:`, error);
                        }
                    }
                }
                await interaction.editReply(`Successfully unlocked ${successCount} text channels.`);
                break;
            }

            case 'lockall': {
                let successCount = 0;
                for (const [id, channel] of guild.channels.cache) {
                    if (channel.type === ChannelType.GuildText) { // Only applies to text channels
                        try {
                            // Ensure the command channel itself is not locked if you want to send the reply
                            if (channel.id === interaction.channel.id) {
                                continue; // Skip locking the current channel for the reply
                            }
                            await channel.permissionOverwrites.edit(everyoneRole, {
                                SendMessages: false,
                            });
                            successCount++;
                        } catch (error) {
                            console.error(`Failed to lock channel ${channel.name}:`, error);
                        }
                    }
                }
                await interaction.editReply(`Successfully locked ${successCount} text channels. (Note: The command channel might not be locked for this reply to be visible)`);
                break;
            }

            case 'clone': {
                const targetChannel = interaction.options.getChannel('target');
                const newName = interaction.options.getString('new_name') || targetChannel.name;

                if (!targetChannel) {
                    return interaction.editReply('Please provide a valid channel to clone.');
                }
                if (targetChannel.guild.id !== guild.id) {
                    return interaction.editReply('You can only clone channels within this server.');
                }

                try {
                    const clonedChannel = await targetChannel.clone({
                        name: newName,
                        reason: `Cloned by ${interaction.user.tag}`
                    });
                    await interaction.editReply(`Successfully cloned #${targetChannel.name} to #${clonedChannel.name}.`);
                } catch (error) {
                    console.error('Error cloning channel:', error);
                    await interaction.editReply('Failed to clone the channel. Make sure I have the "Manage Channels" permission and that the channel type is cloneable.');
                }
                break;
            }

            case 'delete': {
                const targetChannel = interaction.options.getChannel('target');

                if (!targetChannel) {
                    return interaction.editReply('Please provide a valid channel to delete.');
                }
                if (targetChannel.guild.id !== guild.id) {
                    return interaction.editReply('You can only delete channels within this server.');
                }
                if (targetChannel.id === interaction.channel.id) {
                    return interaction.editReply('I cannot delete the channel where this command was used!');
                }

                try {
                    const channelName = targetChannel.name;
                    await targetChannel.delete(`Requested by ${interaction.user.tag}`);
                    await interaction.editReply(`Successfully deleted channel #${channelName}.`);
                } catch (error) {
                    console.error('Error deleting channel:', error);
                    await interaction.editReply('Failed to delete the channel. Make sure I have the "Manage Channels" permission.');
                }
                break;
            }

            case 'info': {
                const targetChannel = interaction.options.getChannel('target') || interaction.channel;

                if (!targetChannel) {
                    return interaction.editReply('Could not find that channel.');
                }

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`Channel Info: #${targetChannel.name}`)
                    .addFields(
                        { name: 'ID', value: targetChannel.id, inline: true },
                        { name: 'Type', value: ChannelType[targetChannel.type].replace('Guild', ''), inline: true }, // Removes 'Guild' prefix
                        { name: 'Created At', value: `<t:${Math.floor(targetChannel.createdTimestamp / 1000)}:F>`, inline: false },
                        { name: 'Category', value: targetChannel.parent ? targetChannel.parent.name : 'None', inline: true }
                    );

                // Add type-specific fields
                if (targetChannel.type === ChannelType.GuildText) {
                    embed.addFields(
                        { name: 'Topic', value: targetChannel.topic || 'None', inline: false },
                        { name: 'NSFW', value: targetChannel.nsfw ? 'Yes' : 'No', inline: true },
                        { name: 'Slowmode', value: targetChannel.rateLimitPerUser ? `${targetChannel.rateLimitPerUser} seconds` : 'Off', inline: true }
                    );
                } else if (targetChannel.type === ChannelType.GuildVoice) {
                    embed.addFields(
                        { name: 'User Limit', value: targetChannel.userLimit ? targetChannel.userLimit.toString() : 'Unlimited', inline: true },
                        { name: 'Bitrate', value: `${targetChannel.bitrate / 1000} kbps`, inline: true }
                    );
                }

                await interaction.editReply({ embeds: [embed] });
                break;
            }
        }
    },
};