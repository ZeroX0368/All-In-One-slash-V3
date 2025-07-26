
const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const AUTOMOD_FILE = path.join(__dirname, '../automod.json');

// Helper Functions
function readAutomodConfig() {
    try {
        const data = fs.readFileSync(AUTOMOD_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        return typeof parsedData.guilds === 'object' && parsedData.guilds !== null ? parsedData : { guilds: {} };
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            const defaultConfig = { guilds: {} };
            fs.writeFileSync(AUTOMOD_FILE, JSON.stringify(defaultConfig, null, 4), 'utf8');
            return defaultConfig;
        }
        console.error('Error reading automod.json:', error);
        return { guilds: {} };
    }
}

function writeAutomodConfig(config) {
    try {
        fs.writeFileSync(AUTOMOD_FILE, JSON.stringify(config, null, 4), 'utf8');
    } catch (error) {
        console.error('Error writing automod.json:', error);
    }
}

function getGuildAutomodSettings(config, guildId) {
    if (!config.guilds[guildId]) {
        config.guilds[guildId] = {
            addbot: { enabled: false, action: 'ban' },
            antilink: { enabled: false, action: 'timeout' },
            antispam: { enabled: false, action: 'timeout', messageLimit: 5, timeWindow: 10000 },
            image: { enabled: false, action: 'timeout' },
            whitelist: [],
            logChannel: null
        };
    }
    return config.guilds[guildId];
}

function isWhitelisted(settings, userId) {
    return settings.whitelist.some(entry => entry.userId === userId);
}

// Check if user is on cooldown for automod actions
function isOnCooldown(userId, action) {
    const key = `${userId}_${action}`;
    const cooldownTime = automodCooldowns.get(key);
    if (cooldownTime && Date.now() - cooldownTime < 3000) { // 3 second cooldown
        return true;
    }
    automodCooldowns.set(key, Date.now());
    return false;
}

// URL detection regex
const urlRegex = /(https?:\/\/[^\s]+)/gi;

// Message tracking for spam detection
const messageTracker = new Map();

// Cooldown tracking for automod notifications
const automodCooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Automoderation system commands.')
        .setDMPermission(false)
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('addbot')
                .setDescription('Toggle prevention of bot additions to server.')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable bot addition prevention.')
                        .setRequired(true)))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('antilink')
                .setDescription('Toggle automatic link deletion.')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable link deletion.')
                        .setRequired(true)))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('antispam')
                .setDescription('Toggle anti-spam protection.')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable anti-spam.')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option
                        .setName('messages')
                        .setDescription('Number of messages before triggering (default: 5).')
                        .setMinValue(2)
                        .setMaxValue(20)
                        .setRequired(false))
                .addIntegerOption(option =>
                    option
                        .setName('seconds')
                        .setDescription('Time window in seconds (default: 10).')
                        .setMinValue(5)
                        .setMaxValue(60)
                        .setRequired(false)))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('image')
                .setDescription('Toggle NSFW image detection.')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Enable or disable NSFW image detection.')
                        .setRequired(true)))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Configure automod actions.')
                .addStringOption(option =>
                    option
                        .setName('module')
                        .setDescription('Which module to configure.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Add Bot', value: 'addbot' },
                            { name: 'Anti Link', value: 'antilink' },
                            { name: 'Anti Spam', value: 'antispam' },
                            { name: 'NSFW Images', value: 'image' }
                        ))
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Action to take when triggered.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Timeout', value: 'timeout' },
                            { name: 'Ban', value: 'ban' },
                            { name: 'Kick', value: 'kick' }
                        )))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('whitelist')
                .setDescription('Add a member to automod whitelist.')
                .addUserOption(option =>
                    option
                        .setName('member')
                        .setDescription('Member to whitelist.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for whitelisting.')
                        .setRequired(false)))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('unwhitelist')
                .setDescription('Remove a member from automod whitelist.')
                .addUserOption(option =>
                    option
                        .setName('member')
                        .setDescription('Member to remove from whitelist.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Reason for removing from whitelist.')
                        .setRequired(false)))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View current automod configuration.'))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset all automod settings for this server.'))
        
        .addSubcommand(subcommand =>
            subcommand
                .setName('log')
                .setDescription('Set the channel for automod logs.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to send automod logs to.')
                        .setRequired(true)
                        .addChannelTypes(0))), // Text channel only

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // User permission check
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.editReply('❌ You need Administrator permissions to use automod commands.');
        }

        // Bot permission check
        const botMember = interaction.guild.members.me;
        const requiredPermissions = [
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.ModerateMembers,
            PermissionsBitField.Flags.KickMembers,
            PermissionsBitField.Flags.BanMembers,
            PermissionsBitField.Flags.ViewAuditLog
        ];

        const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm));
        if (missingPermissions.length > 0) {
            const permNames = missingPermissions.map(perm => {
                switch(perm) {
                    case PermissionsBitField.Flags.ManageMessages: return 'Manage Messages';
                    case PermissionsBitField.Flags.ModerateMembers: return 'Timeout Members';
                    case PermissionsBitField.Flags.KickMembers: return 'Kick Members';
                    case PermissionsBitField.Flags.BanMembers: return 'Ban Members';
                    case PermissionsBitField.Flags.ViewAuditLog: return 'View Audit Log';
                    default: return perm.toString();
                }
            });
            return interaction.editReply(`❌ Bot is missing required permissions: ${permNames.join(', ')}`);
        }

        const subcommand = interaction.options.getSubcommand();
        const config = readAutomodConfig();
        const settings = getGuildAutomodSettings(config, interaction.guild.id);

        switch (subcommand) {
            case 'addbot': {
                const enabled = interaction.options.getBoolean('enabled');
                settings.addbot.enabled = enabled;
                writeAutomodConfig(config);

                const embed = new EmbedBuilder()
                    .setColor(enabled ? 0x00FF00 : 0xFF0000)
                    .setTitle('🤖 Bot Addition Protection')
                    .setDescription(`Bot addition prevention has been **${enabled ? 'enabled' : 'disabled'}**.`)
                    .addFields({ name: 'Action', value: settings.addbot.action, inline: true })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'antilink': {
                const enabled = interaction.options.getBoolean('enabled');
                settings.antilink.enabled = enabled;
                writeAutomodConfig(config);

                const embed = new EmbedBuilder()
                    .setColor(enabled ? 0x00FF00 : 0xFF0000)
                    .setTitle('🔗 Anti-Link Protection')
                    .setDescription(`Link deletion has been **${enabled ? 'enabled' : 'disabled'}**.`)
                    .addFields({ name: 'Action', value: settings.antilink.action, inline: true })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'antispam': {
                const enabled = interaction.options.getBoolean('enabled');
                const messages = interaction.options.getInteger('messages') || 5;
                const seconds = interaction.options.getInteger('seconds') || 10;

                settings.antispam.enabled = enabled;
                settings.antispam.messageLimit = messages;
                settings.antispam.timeWindow = seconds * 1000;
                writeAutomodConfig(config);

                const embed = new EmbedBuilder()
                    .setColor(enabled ? 0x00FF00 : 0xFF0000)
                    .setTitle('⚡ Anti-Spam Protection')
                    .setDescription(`Anti-spam has been **${enabled ? 'enabled' : 'disabled'}**.`)
                    .addFields(
                        { name: 'Message Limit', value: `${messages}`, inline: true },
                        { name: 'Time Window', value: `${seconds}s`, inline: true },
                        { name: 'Action', value: settings.antispam.action, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'image': {
                const enabled = interaction.options.getBoolean('enabled');
                settings.image.enabled = enabled;
                writeAutomodConfig(config);

                const embed = new EmbedBuilder()
                    .setColor(enabled ? 0x00FF00 : 0xFF0000)
                    .setTitle('🖼️ NSFW Image Detection')
                    .setDescription(`NSFW image detection has been **${enabled ? 'enabled' : 'disabled'}**.`)
                    .addFields({ name: 'Action', value: settings.image.action, inline: true })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'config': {
                const module = interaction.options.getString('module');
                const action = interaction.options.getString('action');

                settings[module].action = action;
                writeAutomodConfig(config);

                const moduleNames = {
                    addbot: 'Bot Addition Protection',
                    antilink: 'Anti-Link Protection',
                    antispam: 'Anti-Spam Protection',
                    image: 'NSFW Image Detection'
                };

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('⚙️ Automod Configuration Updated')
                    .setDescription(`${moduleNames[module]} action set to **${action}**.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'whitelist': {
                const member = interaction.options.getUser('member');
                const reason = interaction.options.getString('reason') || 'No reason provided';

                if (isWhitelisted(settings, member.id)) {
                    return interaction.editReply(`${member.tag} is already whitelisted.`);
                }

                settings.whitelist.push({
                    userId: member.id,
                    username: member.tag,
                    reason: reason,
                    addedBy: interaction.user.id,
                    timestamp: new Date().toISOString()
                });

                writeAutomodConfig(config);

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Member Whitelisted')
                    .setDescription(`${member.tag} has been added to the automod whitelist.`)
                    .addFields({ name: 'Reason', value: reason })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'unwhitelist': {
                const member = interaction.options.getUser('member');
                const reason = interaction.options.getString('reason') || 'No reason provided';

                const index = settings.whitelist.findIndex(entry => entry.userId === member.id);
                if (index === -1) {
                    return interaction.editReply(`${member.tag} is not whitelisted.`);
                }

                settings.whitelist.splice(index, 1);
                writeAutomodConfig(config);

                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Member Removed from Whitelist')
                    .setDescription(`${member.tag} has been removed from the automod whitelist.`)
                    .addFields({ name: 'Reason', value: reason })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'status': {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('🛡️ Automod Status')
                    .setDescription('Current automoderation configuration:')
                    .addFields(
                        {
                            name: '🤖 Bot Addition Protection',
                            value: `${settings.addbot.enabled ? '✅ Enabled' : '❌ Disabled'} (${settings.addbot.action})`,
                            inline: true
                        },
                        {
                            name: '🔗 Anti-Link',
                            value: `${settings.antilink.enabled ? '✅ Enabled' : '❌ Disabled'} (${settings.antilink.action})`,
                            inline: true
                        },
                        {
                            name: '⚡ Anti-Spam',
                            value: `${settings.antispam.enabled ? '✅ Enabled' : '❌ Disabled'} (${settings.antispam.action})`,
                            inline: true
                        },
                        {
                            name: '🖼️ NSFW Images',
                            value: `${settings.image.enabled ? '✅ Enabled' : '❌ Disabled'} (${settings.image.action})`,
                            inline: true
                        },
                        {
                            name: '📝 Whitelist',
                            value: `${settings.whitelist.length} members`,
                            inline: true
                        },
                        {
                            name: '⚙️ Spam Settings',
                            value: `${settings.antispam.messageLimit} msgs/${settings.antispam.timeWindow/1000}s`,
                            inline: true
                        },
                        {
                            name: '📋 Log Channel',
                            value: settings.logChannel ? `<#${settings.logChannel}>` : 'Not set',
                            inline: true
                        }
                    )
                    .setTimestamp();

                if (settings.whitelist.length > 0) {
                    const whitelistText = settings.whitelist
                        .slice(0, 10)
                        .map(entry => `• ${entry.username}`)
                        .join('\n');
                    embed.addFields({ name: 'Whitelisted Members', value: whitelistText });
                }

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'reset': {
                // Reset all automod settings for this guild
                delete config.guilds[interaction.guild.id];
                writeAutomodConfig(config);

                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🔄 Automod Settings Reset')
                    .setDescription('All automoderation settings for this server have been reset to default.')
                    .addFields(
                        { name: 'Reset Items', value: '• Bot Addition Protection\n• Anti-Link Protection\n• Anti-Spam Protection\n• NSFW Image Detection\n• Whitelist', inline: false }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }

            case 'log': {
                const channel = interaction.options.getChannel('channel');
                
                // Check if bot can send messages to the channel
                if (!channel.permissionsFor(botMember).has([PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks])) {
                    return interaction.editReply(`❌ Bot doesn't have permission to send messages or embed links in ${channel}.`);
                }

                settings.logChannel = channel.id;
                writeAutomodConfig(config);

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('📋 Automod Log Channel Set')
                    .setDescription(`Automod logs will now be sent to ${channel}.`)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
                break;
            }
        }
    },

    // Message handler for automod features
    async handleMessage(message) {
        if (message.author.bot || !message.guild) return;

        const config = readAutomodConfig();
        const settings = getGuildAutomodSettings(config, message.guild.id);

        // Check if user is whitelisted
        if (isWhitelisted(settings, message.author.id)) return;

        // Anti-link
        if (settings.antilink.enabled && urlRegex.test(message.content)) {
            if (isOnCooldown(message.author.id, 'antilink')) return;
            
            try {
                await message.delete();
                await this.executeAction(message.member, settings.antilink.action, 'Posting links');
                
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setDescription(`${message.author}, links are not allowed in this server!`)
                    .setTimestamp();

                const reply = await message.channel.send({ embeds: [embed] });
                setTimeout(() => reply.delete().catch(() => {}), 5000);
            } catch (error) {
                console.error('Error handling anti-link:', error);
            }
        }

        // Anti-spam
        if (settings.antispam.enabled) {
            const userId = message.author.id;
            const now = Date.now();

            if (!messageTracker.has(userId)) {
                messageTracker.set(userId, []);
            }

            const userMessages = messageTracker.get(userId);
            userMessages.push(now);

            // Remove old messages outside time window
            const filtered = userMessages.filter(timestamp => now - timestamp < settings.antispam.timeWindow);
            messageTracker.set(userId, filtered);

            if (filtered.length >= settings.antispam.messageLimit) {
                if (isOnCooldown(userId, 'antispam')) return;
                
                try {
                    // Delete recent messages
                    const messages = await message.channel.messages.fetch({ limit: 50 });
                    const userSpamMessages = messages.filter(msg => 
                        msg.author.id === userId && 
                        now - msg.createdTimestamp < settings.antispam.timeWindow
                    );

                    await message.channel.bulkDelete(userSpamMessages, true);
                    await this.executeAction(message.member, settings.antispam.action, 'Spamming');

                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription(`${message.author}, please don't spam!`)
                        .setTimestamp();

                    const reply = await message.channel.send({ embeds: [embed] });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);

                    messageTracker.set(userId, []);
                } catch (error) {
                    console.error('Error handling anti-spam:', error);
                }
            }
        }

        // NSFW Image detection (basic implementation - checks for image attachments)
        if (settings.image.enabled && message.attachments.size > 0) {
            const hasImages = message.attachments.some(attachment => 
                attachment.contentType && attachment.contentType.startsWith('image/')
            );

            if (hasImages && !message.channel.nsfw) {
                if (isOnCooldown(message.author.id, 'image')) return;
                
                try {
                    await message.delete();
                    await this.executeAction(message.member, settings.image.action, 'Posting inappropriate images');

                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setDescription(`${message.author}, images are restricted in this channel!`)
                        .setTimestamp();

                    const reply = await message.channel.send({ embeds: [embed] });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                } catch (error) {
                    console.error('Error handling image detection:', error);
                }
            }
        }
    },

    // Member add handler for bot detection
    async handleMemberAdd(member) {
        if (!member.user.bot) return;

        const config = readAutomodConfig();
        const settings = getGuildAutomodSettings(config, member.guild.id);

        if (!settings.addbot.enabled) return;

        try {
            // Get audit logs to find who added the bot
            const auditLogs = await member.guild.fetchAuditLogs({
                type: 28, // MEMBER_UPDATE (bot add)
                limit: 1
            });

            const auditEntry = auditLogs.entries.first();
            if (auditEntry && auditEntry.target.id === member.id) {
                const executor = auditEntry.executor;
                const executorMember = member.guild.members.cache.get(executor.id);

                if (executorMember && !isWhitelisted(settings, executor.id)) {
                    await member.ban({ reason: 'Unauthorized bot addition' });
                    await this.executeAction(executorMember, settings.addbot.action, 'Adding unauthorized bot');

                    // Log the action
                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('🤖 Unauthorized Bot Detected')
                        .setDescription(`Bot ${member.user.tag} was banned and ${executor.tag} was ${settings.addbot.action}ed for adding it.`)
                        .setTimestamp();

                    // Try to send to a log channel or system channel
                    const logChannel = member.guild.systemChannel;
                    if (logChannel) {
                        await logChannel.send({ embeds: [embed] });
                    }
                }
            }
        } catch (error) {
            console.error('Error handling bot addition:', error);
        }
    },

    async executeAction(member, action, reason) {
        try {
            switch (action) {
                case 'timeout':
                    await member.timeout(10 * 60 * 1000, reason); // 10 minutes
                    break;
                case 'kick':
                    await member.kick(reason);
                    break;
                case 'ban':
                    await member.ban({ reason });
                    break;
            }
            
            // Log the action
            await this.logAction(member.guild, member.user, action, reason);
        } catch (error) {
            console.error(`Error executing ${action}:`, error);
        }
    },

    async logAction(guild, user, action, reason) {
        try {
            const config = readAutomodConfig();
            const settings = getGuildAutomodSettings(config, guild.id);
            
            if (!settings.logChannel) return;
            
            const logChannel = guild.channels.cache.get(settings.logChannel);
            if (!logChannel) return;

            const actionColors = {
                timeout: 0xFFA500,
                kick: 0xFF6B00,
                ban: 0xFF0000
            };

            const actionEmojis = {
                timeout: '⏰',
                kick: '👢',
                ban: '🔨'
            };

            const embed = new EmbedBuilder()
                .setColor(actionColors[action] || 0xFF0000)
                .setTitle(`${actionEmojis[action]} Automod Action: ${action.charAt(0).toUpperCase() + action.slice(1)}`)
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Action', value: action, inline: true },
                    { name: 'Reason', value: reason, inline: true }
                )
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error logging automod action:', error);
        }
    }
};
