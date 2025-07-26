
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const welcomeConfigPath = path.join(__dirname, '..', 'welcome.json');

// Load welcome configuration
function loadWelcomeConfig() {
    try {
        if (fs.existsSync(welcomeConfigPath)) {
            return JSON.parse(fs.readFileSync(welcomeConfigPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading welcome config:', error);
    }
    return {};
}

// Save welcome configuration
function saveWelcomeConfig(config) {
    try {
        fs.writeFileSync(welcomeConfigPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving welcome config:', error);
    }
}

// Replace placeholders in welcome message
function replacePlaceholders(text, member, guild) {
    const joinedDate = member.joinedAt;
    const createdDate = member.user.createdAt;
    const now = new Date();
    
    const daysJoined = Math.floor((now - joinedDate) / (1000 * 60 * 60 * 24));
    const daysCreated = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    
    // Calculate years, months, days for joined
    const diffJoined = calculateTimeDifference(joinedDate, now);
    const diffCreated = calculateTimeDifference(createdDate, now);
    
    return text
        .replace(/{username}/g, member.user.username)
        .replace(/{memberid}/g, member.user.id)
        .replace(/{servername}/g, guild.name)
        .replace(/{guildid}/g, guild.id)
        .replace(/{count}/g, guild.memberCount.toString())
        .replace(/{joined}/g, joinedDate.toDateString())
        .replace(/{created}/g, createdDate.toDateString())
        .replace(/{days-joined}/g, daysJoined.toString())
        .replace(/{diff-joined}/g, diffJoined)
        .replace(/{days-created}/g, daysCreated.toString())
        .replace(/{diff-created}/g, diffCreated);
}

// Calculate time difference in years, months, days
function calculateTimeDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();
    
    if (days < 0) {
        months--;
        days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    }
    
    if (months < 0) {
        years--;
        months += 12;
    }
    
    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    
    return parts.length > 0 ? parts.join(', ') : '0 days';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Manage welcome messages for new members')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Display available placeholders for welcome messages')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('preview')
                .setDescription('Preview the welcome message with your data')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a welcome message')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send welcome messages')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome message (use placeholders from /welcome info)')
                        .setRequired(true)
                        .setMaxLength(2000)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('change')
                .setDescription('Change the welcome message or channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('New channel for welcome messages')
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('New welcome message')
                        .setMaxLength(2000)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete the welcome message configuration')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('text')
                .setDescription('View the current welcome message configuration')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Toggle welcome messages on/off')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('format')
                .setDescription('Change welcome message format')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Format type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Plain Text', value: 'text' },
                            { name: 'Embed', value: 'embed' }
                        )
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const config = loadWelcomeConfig();

        if (!config[guildId]) {
            config[guildId] = {
                enabled: false,
                channel: null,
                message: 'Welcome {username} to {servername}!',
                format: 'text'
            };
        }

        const guildConfig = config[guildId];

        switch (subcommand) {
            case 'info':
                const infoEmbed = new EmbedBuilder()
                    .setTitle('🌊 WELCOME INFO 🌊')
                    .setDescription(`**Available Placeholders:**
                    
\`{username}\` = member username
\`{memberid}\` = member ID
\`{servername}\` = discord server name
\`{guildid}\` = discord server ID
\`{count}\` = member count
\`{joined}\` = member join date
\`{created}\` = member create date
\`{days-joined}\` = member join in days
\`{diff-joined}\` = member join in years, months and days
\`{days-created}\` = member create in days
\`{diff-created}\` = member create in years, months and days`)
                    .setColor(0x00AE86)
                    .setTimestamp();

                await interaction.reply({ embeds: [infoEmbed] });
                break;

            case 'preview':
                if (!guildConfig.message) {
                    await interaction.reply({ content: 'No welcome message is configured. Use `/welcome create` first.', ephemeral: true });
                    return;
                }

                const previewMessage = replacePlaceholders(guildConfig.message, interaction.member, interaction.guild);
                
                if (guildConfig.format === 'embed') {
                    const previewEmbed = new EmbedBuilder()
                        .setTitle('Welcome Preview')
                        .setDescription(previewMessage)
                        .setColor(0x00FF00)
                        .setTimestamp();
                    
                    await interaction.reply({ embeds: [previewEmbed] });
                } else {
                    await interaction.reply({ content: `**Welcome Message Preview:**\n${previewMessage}` });
                }
                break;

            case 'create':
                const channel = interaction.options.getChannel('channel');
                const message = interaction.options.getString('message');

                guildConfig.channel = channel.id;
                guildConfig.message = message;
                guildConfig.enabled = true;
                
                config[guildId] = guildConfig;
                saveWelcomeConfig(config);

                const createEmbed = new EmbedBuilder()
                    .setTitle('Welcome Message Created')
                    .setDescription(`Welcome messages will be sent to ${channel} when new members join.`)
                    .addFields(
                        { name: 'Channel', value: channel.toString(), inline: true },
                        { name: 'Status', value: 'Enabled', inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.reply({ embeds: [createEmbed] });
                break;

            case 'change':
                const newChannel = interaction.options.getChannel('channel');
                const newMessage = interaction.options.getString('message');

                if (!newChannel && !newMessage) {
                    await interaction.reply({ content: 'Please specify either a new channel or message to change.', ephemeral: true });
                    return;
                }

                if (!guildConfig.channel && !guildConfig.message) {
                    await interaction.reply({ content: 'No welcome configuration exists. Use `/welcome create` first.', ephemeral: true });
                    return;
                }

                if (newChannel) guildConfig.channel = newChannel.id;
                if (newMessage) guildConfig.message = newMessage;

                config[guildId] = guildConfig;
                saveWelcomeConfig(config);

                const changes = [];
                if (newChannel) changes.push(`Channel: ${newChannel}`);
                if (newMessage) changes.push('Message updated');

                const changeEmbed = new EmbedBuilder()
                    .setTitle('Welcome Configuration Updated')
                    .setDescription(`**Changes made:**\n${changes.join('\n')}`)
                    .setColor(0x00AE86)
                    .setTimestamp();

                await interaction.reply({ embeds: [changeEmbed] });
                break;

            case 'delete':
                if (!guildConfig.channel) {
                    await interaction.reply({ content: 'No welcome configuration exists to delete.', ephemeral: true });
                    return;
                }

                delete config[guildId];
                saveWelcomeConfig(config);

                const deleteEmbed = new EmbedBuilder()
                    .setTitle('Welcome Configuration Deleted')
                    .setDescription('Welcome message configuration has been permanently removed.')
                    .setColor(0xFF0000)
                    .setTimestamp();

                await interaction.reply({ embeds: [deleteEmbed] });
                break;

            case 'text':
                if (!guildConfig.channel) {
                    await interaction.reply({ content: 'No welcome configuration exists.', ephemeral: true });
                    return;
                }

                const channel_obj = interaction.guild.channels.cache.get(guildConfig.channel);
                const textEmbed = new EmbedBuilder()
                    .setTitle('Current Welcome Configuration')
                    .addFields(
                        { name: 'Channel', value: channel_obj ? channel_obj.toString() : 'Channel not found', inline: true },
                        { name: 'Status', value: guildConfig.enabled ? 'Enabled' : 'Disabled', inline: true },
                        { name: 'Format', value: guildConfig.format === 'embed' ? 'Embed' : 'Plain Text', inline: true },
                        { name: 'Message', value: guildConfig.message || 'No message set' }
                    )
                    .setColor(0x00AE86)
                    .setTimestamp();

                await interaction.reply({ embeds: [textEmbed] });
                break;

            case 'toggle':
                if (!guildConfig.channel) {
                    await interaction.reply({ content: 'No welcome configuration exists. Use `/welcome create` first.', ephemeral: true });
                    return;
                }

                guildConfig.enabled = !guildConfig.enabled;
                config[guildId] = guildConfig;
                saveWelcomeConfig(config);

                const toggleEmbed = new EmbedBuilder()
                    .setTitle('Welcome Messages Toggled')
                    .setDescription(`Welcome messages are now **${guildConfig.enabled ? 'enabled' : 'disabled'}**.`)
                    .setColor(guildConfig.enabled ? 0x00FF00 : 0xFF0000)
                    .setTimestamp();

                await interaction.reply({ embeds: [toggleEmbed] });
                break;

            case 'format':
                const formatType = interaction.options.getString('type');

                if (!guildConfig.channel) {
                    await interaction.reply({ content: 'No welcome configuration exists. Use `/welcome create` first.', ephemeral: true });
                    return;
                }

                guildConfig.format = formatType;
                config[guildId] = guildConfig;
                saveWelcomeConfig(config);

                const formatEmbed = new EmbedBuilder()
                    .setTitle('Welcome Format Updated')
                    .setDescription(`Welcome messages will now be sent as **${formatType === 'embed' ? 'embeds' : 'plain text'}**.`)
                    .setColor(0x00AE86)
                    .setTimestamp();

                await interaction.reply({ embeds: [formatEmbed] });
                break;
        }
    },

    // Function to handle member join events (to be called from index.js)
    async handleMemberJoin(member) {
        const config = loadWelcomeConfig();
        const guildConfig = config[member.guild.id];

        if (!guildConfig || !guildConfig.enabled || !guildConfig.channel) {
            return;
        }

        const channel = member.guild.channels.cache.get(guildConfig.channel);
        if (!channel) {
            return;
        }

        const welcomeMessage = replacePlaceholders(guildConfig.message, member, member.guild);

        try {
            if (guildConfig.format === 'embed') {
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('Welcome!')
                    .setDescription(welcomeMessage)
                    .setColor(0x00FF00)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                    .setTimestamp();

                await channel.send({ embeds: [welcomeEmbed] });
            } else {
                await channel.send(welcomeMessage);
            }
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    }
};
