
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stick')
        .setDescription('Manage sticky messages in channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a sticky message for this channel')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message to stick')
                        .setRequired(true)
                        .setMaxLength(2000)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the sticky message in this channel (keeps it saved)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start the sticky message in this channel')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove the sticky message from this channel permanently')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stickies')
                .setDescription('List all sticky messages in this server')
        ),

    // Store sticky messages in memory (in production, use a database)
    stickyMessages: new Map(), // channelId -> { message, isActive, lastMessageId }

    async execute(interaction) {
        // Check if bot has MANAGE_MESSAGES permission
        if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await interaction.reply({ 
                content: 'I need the "Manage Messages" permission to execute this command.', 
                ephemeral: true 
            });
            return;
        }

        // Check if user has MANAGE_MESSAGES permission
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await interaction.reply({ 
                content: 'You need the "Manage Messages" permission to use this command.', 
                ephemeral: true 
            });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'set':
                    await this.handleSetSticky(interaction);
                    break;
                case 'stop':
                    await this.handleStopSticky(interaction);
                    break;
                case 'start':
                    await this.handleStartSticky(interaction);
                    break;
                case 'remove':
                    await this.handleRemoveSticky(interaction);
                    break;
                case 'stickies':
                    await this.handleListStickies(interaction);
                    break;
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ 
                content: 'An error occurred while processing your request.', 
                ephemeral: true 
            });
        }
    },

    async handleSetSticky(interaction) {
        const message = interaction.options.getString('message');
        const channelId = interaction.channel.id;

        // Set or update sticky message
        this.stickyMessages.set(channelId, {
            message: message,
            isActive: true,
            lastMessageId: null,
            guildId: interaction.guild.id,
            channelName: interaction.channel.name
        });

        // Send the sticky message
        const stickyMsg = await interaction.channel.send({
            content: `📌 **Sticky Message**\n${message}`,
            allowedMentions: { parse: [] }
        });

        // Update the stored message ID
        const stickyData = this.stickyMessages.get(channelId);
        stickyData.lastMessageId = stickyMsg.id;
        this.stickyMessages.set(channelId, stickyData);

        const embed = new EmbedBuilder()
            .setTitle('Sticky Message Set')
            .setDescription(`Sticky message has been set for ${interaction.channel}`)
            .addFields({ name: 'Message', value: message })
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async handleStopSticky(interaction) {
        const channelId = interaction.channel.id;
        const stickyData = this.stickyMessages.get(channelId);

        if (!stickyData) {
            await interaction.reply({ 
                content: 'There is no sticky message set for this channel.', 
                ephemeral: true 
            });
            return;
        }

        if (!stickyData.isActive) {
            await interaction.reply({ 
                content: 'The sticky message is already stopped in this channel.', 
                ephemeral: true 
            });
            return;
        }

        // Stop the sticky message
        stickyData.isActive = false;
        this.stickyMessages.set(channelId, stickyData);

        // Delete the last sticky message if it exists
        if (stickyData.lastMessageId) {
            try {
                const lastMessage = await interaction.channel.messages.fetch(stickyData.lastMessageId);
                await lastMessage.delete();
            } catch (error) {
                // Message might already be deleted
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('Sticky Message Stopped')
            .setDescription(`Sticky message has been stopped in ${interaction.channel}`)
            .setColor(0xFFFF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async handleStartSticky(interaction) {
        const channelId = interaction.channel.id;
        const stickyData = this.stickyMessages.get(channelId);

        if (!stickyData) {
            await interaction.reply({ 
                content: 'There is no sticky message set for this channel. Use `/stick set` first.', 
                ephemeral: true 
            });
            return;
        }

        if (stickyData.isActive) {
            await interaction.reply({ 
                content: 'The sticky message is already active in this channel.', 
                ephemeral: true 
            });
            return;
        }

        // Start the sticky message
        stickyData.isActive = true;
        this.stickyMessages.set(channelId, stickyData);

        // Send the sticky message
        const stickyMsg = await interaction.channel.send({
            content: `📌 **Sticky Message**\n${stickyData.message}`,
            allowedMentions: { parse: [] }
        });

        stickyData.lastMessageId = stickyMsg.id;
        this.stickyMessages.set(channelId, stickyData);

        const embed = new EmbedBuilder()
            .setTitle('Sticky Message Started')
            .setDescription(`Sticky message has been started in ${interaction.channel}`)
            .setColor(0x00FF00)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async handleRemoveSticky(interaction) {
        const channelId = interaction.channel.id;
        const stickyData = this.stickyMessages.get(channelId);

        if (!stickyData) {
            await interaction.reply({ 
                content: 'There is no sticky message set for this channel.', 
                ephemeral: true 
            });
            return;
        }

        // Delete the last sticky message if it exists
        if (stickyData.lastMessageId) {
            try {
                const lastMessage = await interaction.channel.messages.fetch(stickyData.lastMessageId);
                await lastMessage.delete();
            } catch (error) {
                // Message might already be deleted
            }
        }

        // Remove the sticky message data
        this.stickyMessages.delete(channelId);

        const embed = new EmbedBuilder()
            .setTitle('Sticky Message Removed')
            .setDescription(`Sticky message has been permanently removed from ${interaction.channel}`)
            .setColor(0xFF0000)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async handleListStickies(interaction) {
        const guildId = interaction.guild.id;
        const guildStickies = [];

        // Filter sticky messages for this guild
        for (const [channelId, stickyData] of this.stickyMessages.entries()) {
            if (stickyData.guildId === guildId) {
                guildStickies.push({ channelId, ...stickyData });
            }
        }

        if (guildStickies.length === 0) {
            await interaction.reply({ 
                content: 'There are no sticky messages set in this server.', 
                ephemeral: true 
            });
            return;
        }

        const stickyList = guildStickies.map(sticky => {
            const status = sticky.isActive ? '🟢 Active' : '🔴 Stopped';
            const channel = interaction.guild.channels.cache.get(sticky.channelId) || 'Unknown Channel';
            const preview = sticky.message.length > 50 ? sticky.message.substring(0, 50) + '...' : sticky.message;
            return `**${channel}** - ${status}\n> ${preview}`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`Sticky Messages in ${interaction.guild.name}`)
            .setDescription(stickyList)
            .setColor(0x00AE86)
            .setFooter({ text: `${guildStickies.length} sticky message(s) found` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    // Function to handle message events (to be called from index.js)
    async handleMessage(message) {
        if (message.author.bot) return;
        
        const channelId = message.channel.id;
        const stickyData = this.stickyMessages.get(channelId);
        
        if (!stickyData || !stickyData.isActive) return;

        // Delete the previous sticky message
        if (stickyData.lastMessageId) {
            try {
                const lastMessage = await message.channel.messages.fetch(stickyData.lastMessageId);
                await lastMessage.delete();
            } catch (error) {
                // Message might already be deleted
            }
        }

        // Send a new sticky message
        const stickyMsg = await message.channel.send({
            content: `📌 **Sticky Message**\n${stickyData.message}`,
            allowedMentions: { parse: [] }
        });

        // Update the stored message ID
        stickyData.lastMessageId = stickyMsg.id;
        this.stickyMessages.set(channelId, stickyData);
    }
};
