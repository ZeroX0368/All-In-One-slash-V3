
const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Path to the reaction roles config file
const reactionRolesPath = path.join(__dirname, '..', 'reactionroles.json');

// Helper function to read reaction roles config
function readReactionRolesConfig() {
    try {
        if (!fs.existsSync(reactionRolesPath)) {
            return {};
        }
        const data = fs.readFileSync(reactionRolesPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading reaction roles config:', error);
        return {};
    }
}

// Helper function to write reaction roles config
function writeReactionRolesConfig(config) {
    try {
        fs.writeFileSync(reactionRolesPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error writing reaction roles config:', error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Manages reaction roles in the server.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a reaction role to a message.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel where the message is located.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('message-id')
                        .setDescription('The ID of the message to add reaction role to.')
                        .setRequired(true))
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to assign when reacted.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('The emoji to react with (Unicode emoji or custom emoji).')
                        .setRequired(true)))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a reaction role from a message.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel where the message is located.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('message-id')
                        .setDescription('The ID of the message to remove reaction role from.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('The emoji to remove reaction role for.')
                        .setRequired(true)))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all reaction roles in the server.')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const botMember = guild.members.me;

        // Check bot permissions
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.editReply('I do not have the "Manage Roles" permission.');
        }

        if (!botMember.permissions.has(PermissionsBitField.Flags.AddReactions)) {
            return interaction.editReply('I do not have the "Add Reactions" permission.');
        }

        // Check user permissions
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return interaction.editReply('You do not have the "Manage Roles" permission.');
        }

        let config = readReactionRolesConfig();
        if (!config[guild.id]) {
            config[guild.id] = {};
        }

        switch (subcommand) {
            case 'add': {
                const channel = interaction.options.getChannel('channel');
                const messageId = interaction.options.getString('message-id');
                const role = interaction.options.getRole('role');
                const emojiInput = interaction.options.getString('emoji');

                // Validate channel type
                if (channel.type !== 0) { // Text channel
                    return interaction.editReply('Please select a text channel.');
                }

                // Check if bot can manage the role
                if (botMember.roles.highest.position <= role.position) {
                    return interaction.editReply(`I cannot manage the role \`${role.name}\` because my highest role is not above it.`);
                }

                // Check if user can manage the role
                if (interaction.member.roles.highest.position <= role.position && interaction.user.id !== guild.ownerId) {
                    return interaction.editReply(`You cannot assign the role \`${role.name}\` because your highest role is not above it.`);
                }

                if (role.managed) {
                    return interaction.editReply(`I cannot manage the role \`${role.name}\` as it is managed by an integration.`);
                }

                if (role.id === guild.roles.everyone.id) {
                    return interaction.editReply('You cannot use the @everyone role for reaction roles.');
                }

                try {
                    // Fetch the message
                    const message = await channel.messages.fetch(messageId);
                    
                    // Parse emoji (handle both Unicode and custom emojis)
                    let emojiToUse = emojiInput;
                    const customEmojiMatch = emojiInput.match(/<(a)?:(\w+):(\d+)>/);
                    if (customEmojiMatch) {
                        const emojiId = customEmojiMatch[3];
                        const customEmoji = guild.emojis.cache.get(emojiId);
                        if (!customEmoji) {
                            return interaction.editReply('Custom emoji not found in this server.');
                        }
                        emojiToUse = customEmoji;
                    }

                    // Add reaction to message
                    await message.react(emojiToUse);

                    // Store in config
                    if (!config[guild.id][messageId]) {
                        config[guild.id][messageId] = {
                            channelId: channel.id,
                            reactions: {}
                        };
                    }

                    const emojiKey = customEmojiMatch ? customEmojiMatch[3] : emojiInput;
                    config[guild.id][messageId].reactions[emojiKey] = {
                        roleId: role.id,
                        emoji: emojiInput
                    };

                    writeReactionRolesConfig(config);

                    await interaction.editReply(`Successfully added reaction role! Users can now react with ${emojiInput} to get the \`${role.name}\` role.`);

                } catch (error) {
                    console.error('Error adding reaction role:', error);
                    if (error.code === 10008) {
                        return interaction.editReply('Message not found. Please check the message ID and channel.');
                    } else if (error.code === 50013) {
                        return interaction.editReply('I do not have permission to add reactions to that message.');
                    } else if (error.code === 10014) {
                        return interaction.editReply('Invalid emoji. Please use a valid Unicode emoji or custom emoji from this server.');
                    }
                    return interaction.editReply('Failed to add reaction role. Please check the message ID and try again.');
                }
                break;
            }

            case 'remove': {
                const channel = interaction.options.getChannel('channel');
                const messageId = interaction.options.getString('message-id');
                const emojiInput = interaction.options.getString('emoji');

                if (!config[guild.id] || Object.keys(config[guild.id]).length === 0) {
                    return interaction.editReply('No reaction roles found for this server.');
                }

                try {
                    // Remove all bot reactions from all messages in this server
                    for (const [msgId, data] of Object.entries(config[guild.id])) {
                        try {
                            const msgChannel = guild.channels.cache.get(data.channelId);
                            if (msgChannel) {
                                const message = await msgChannel.messages.fetch(msgId);
                                for (const [emojiKey, reactionData] of Object.entries(data.reactions)) {
                                    const reaction = message.reactions.cache.get(emojiKey) || 
                                                   message.reactions.cache.find(r => r.emoji.name === reactionData.emoji || r.emoji.id === emojiKey);
                                    if (reaction) {
                                        await reaction.users.remove(interaction.client.user);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(`Error removing reactions from message ${msgId}:`, error);
                        }
                    }

                    // Clear all reaction roles for this server
                    config[guild.id] = {};
                    writeReactionRolesConfig(config);

                    await interaction.editReply(`Successfully removed all reaction roles from this server.`);

                } catch (error) {
                    console.error('Error removing reaction roles:', error);
                    return interaction.editReply('Failed to remove reaction roles.');
                }
                break;
            }

            case 'list': {
                if (!config[guild.id] || Object.keys(config[guild.id]).length === 0) {
                    return interaction.editReply('No reaction roles found in this server.');
                }

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🎭 Reaction Roles')
                    .setDescription('**Emoji ➜ Role** mapping for all reaction roles in this server:')
                    .setTimestamp()
                    .setFooter({ text: `Server: ${guild.name}`, iconURL: guild.iconURL() });

                let fieldCount = 0;
                let totalReactions = 0;
                
                for (const [messageId, data] of Object.entries(config[guild.id])) {
                    if (fieldCount >= 25) break; // Discord embed field limit

                    const channel = guild.channels.cache.get(data.channelId);
                    const channelName = channel ? `#${channel.name}` : 'Unknown Channel';
                    
                    let reactionList = '';
                    for (const [emojiKey, reactionData] of Object.entries(data.reactions)) {
                        const role = guild.roles.cache.get(reactionData.roleId);
                        if (role) {
                            reactionList += `${reactionData.emoji} ➜ <@&${role.id}>\n`;
                            totalReactions++;
                        } else {
                            reactionList += `${reactionData.emoji} ➜ \`Deleted Role\`\n`;
                        }
                    }

                    if (reactionList) {
                        embed.addFields({
                            name: `📍 ${channelName}`,
                            value: reactionList + `\n*Message ID: \`${messageId}\`*`,
                            inline: true
                        });
                        fieldCount++;
                    }
                }

                if (fieldCount === 0) {
                    return interaction.editReply('No valid reaction roles found in this server.');
                }

                // Update description with total count
                embed.setDescription(`**Emoji ➜ Role** mapping for all reaction roles in this server:\n*Total: ${totalReactions} reaction role(s)*`);

                await interaction.editReply({ embeds: [embed] });
                break;
            }
        }
    },
};
