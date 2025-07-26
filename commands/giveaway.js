
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const GIVEAWAY_COLOR = 0x0099ff;
const GIVEAWAYS_FILE = path.join(__dirname, '..', 'giveaways.json');

// Helper functions for giveaway data management
function loadGiveaways() {
    try {
        if (!fs.existsSync(GIVEAWAYS_FILE)) {
            fs.writeFileSync(GIVEAWAYS_FILE, JSON.stringify({ giveaways: [] }, null, 2));
            return { giveaways: [] };
        }
        const data = fs.readFileSync(GIVEAWAYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading giveaways:', error);
        return { giveaways: [] };
    }
}

function saveGiveaways(data) {
    try {
        fs.writeFileSync(GIVEAWAYS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving giveaways:', error);
    }
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
    if (seconds % 60 > 0) parts.push(`${seconds % 60}s`);

    return parts.length > 0 ? parts.join(' ') : '0s';
}

function parseTimeString(timeStr) {
    const regex = /(\d+)([dhms])/g;
    let totalMs = 0;
    let match;

    while ((match = regex.exec(timeStr)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 'd': totalMs += value * 24 * 60 * 60 * 1000; break;
            case 'h': totalMs += value * 60 * 60 * 1000; break;
            case 'm': totalMs += value * 60 * 1000; break;
            case 's': totalMs += value * 1000; break;
        }
    }

    return totalMs;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways in your server')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start a new giveaway')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to host the giveaway')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('End a giveaway early')
                .addStringOption(option =>
                    option.setName('messageid')
                        .setDescription('Message ID of the giveaway')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reroll')
                .setDescription('Reroll a giveaway winner')
                .addStringOption(option =>
                    option.setName('messageid')
                        .setDescription('Message ID of the giveaway')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('pause')
                .setDescription('Pause a giveaway')
                .addStringOption(option =>
                    option.setName('messageid')
                        .setDescription('Message ID of the giveaway')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resume')
                .setDescription('Resume a paused giveaway')
                .addStringOption(option =>
                    option.setName('messageid')
                        .setDescription('Message ID of the giveaway')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all active giveaways'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit a giveaway')
                .addStringOption(option =>
                    option.setName('messageid')
                        .setDescription('Message ID of the giveaway')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset (clear) all giveaways in this server')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'start':
                await this.handleStart(interaction);
                break;
            case 'end':
                await this.handleEnd(interaction);
                break;
            case 'reroll':
                await this.handleReroll(interaction);
                break;
            case 'pause':
                await this.handlePause(interaction);
                break;
            case 'resume':
                await this.handleResume(interaction);
                break;
            case 'list':
                await this.handleList(interaction);
                break;
            case 'edit':
                await this.handleEdit(interaction);
                break;
            case 'reset':
                await this.handleReset(interaction);
                break;
        }
    },

    async handleStart(interaction) {
        const channel = interaction.options.getChannel('channel');

        if (!channel.isTextBased()) {
            return interaction.reply({ content: '❌ Please select a text channel.', ephemeral: true });
        }

        // Create modal for giveaway setup
        const modal = new ModalBuilder()
            .setCustomId('giveaway_setup')
            .setTitle('Setup New Giveaway');

        const prizeInput = new TextInputBuilder()
            .setCustomId('prize')
            .setLabel('Prize')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('What are you giving away?')
            .setRequired(true)
            .setMaxLength(100);

        const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 1d 12h 30m (days, hours, minutes)')
            .setRequired(true)
            .setMaxLength(20);

        const winnersInput = new TextInputBuilder()
            .setCustomId('winners')
            .setLabel('Number of Winners')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('How many winners? (default: 1)')
            .setRequired(false)
            .setMaxLength(2);

        const requirementInput = new TextInputBuilder()
            .setCustomId('requirement')
            .setLabel('Requirements (Optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Any requirements to enter? (e.g., must be in server for 1 week)')
            .setRequired(false)
            .setMaxLength(500);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description (Optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Additional description for the giveaway')
            .setRequired(false)
            .setMaxLength(1000);

        const row1 = new ActionRowBuilder().addComponents(prizeInput);
        const row2 = new ActionRowBuilder().addComponents(durationInput);
        const row3 = new ActionRowBuilder().addComponents(winnersInput);
        const row4 = new ActionRowBuilder().addComponents(requirementInput);
        const row5 = new ActionRowBuilder().addComponents(descriptionInput);

        modal.addComponents(row1, row2, row3, row4, row5);

        // Store channel info for modal submission
        interaction.client.giveawayChannels = interaction.client.giveawayChannels || new Map();
        interaction.client.giveawayChannels.set(interaction.user.id, channel.id);

        await interaction.showModal(modal);
    },

    async handleModalSubmit(interaction) {
        if (interaction.customId !== 'giveaway_setup') return;

        await interaction.deferReply({ ephemeral: true });

        const prize = interaction.fields.getTextInputValue('prize');
        const durationStr = interaction.fields.getTextInputValue('duration');
        const winnersStr = interaction.fields.getTextInputValue('winners') || '1';
        const requirement = interaction.fields.getTextInputValue('requirement') || '';
        const description = interaction.fields.getTextInputValue('description') || '';

        const winners = parseInt(winnersStr);
        if (isNaN(winners) || winners < 1 || winners > 20) {
            return interaction.editReply('❌ Number of winners must be between 1 and 20.');
        }

        const duration = parseTimeString(durationStr);
        if (duration < 60000) { // Less than 1 minute
            return interaction.editReply('❌ Duration must be at least 1 minute.');
        }

        const channelId = interaction.client.giveawayChannels?.get(interaction.user.id);
        if (!channelId) {
            return interaction.editReply('❌ Channel information not found. Please try again.');
        }

        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel) {
            return interaction.editReply('❌ Channel not found.');
        }

        const endTime = Date.now() + duration;
        const giveawayId = Date.now().toString();

        // Create giveaway embed
        const embed = new EmbedBuilder()
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`**Prize:** ${prize}\n\n${description ? `${description}\n\n` : ''}${requirement ? `**Requirements:**\n${requirement}\n\n` : ''}**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n**Hosted by:** ${interaction.user}`)
            .setColor(GIVEAWAY_COLOR)
            .setFooter({ text: `Giveaway ID: ${giveawayId}` })
            .setTimestamp(endTime);

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_enter')
                    .setLabel('🎉') // button join giveaway
                    .setStyle(ButtonStyle.Primary)
            );

        const giveawayMessage = await channel.send({
            embeds: [embed],
            components: [button]
        });

        // Save giveaway data
        const giveaways = loadGiveaways();
        giveaways.giveaways.push({
            id: giveawayId,
            messageId: giveawayMessage.id,
            channelId: channel.id,
            guildId: interaction.guild.id,
            hostId: interaction.user.id,
            prize,
            description,
            requirement,
            winners,
            endTime,
            participants: [],
            status: 'active',
            createdAt: Date.now()
        });
        saveGiveaways(giveaways);

        // Set timeout to end giveaway
        setTimeout(() => {
            this.endGiveaway(giveawayMessage.id, interaction.client);
        }, duration);

        interaction.client.giveawayChannels?.delete(interaction.user.id);
        await interaction.editReply(`✅ Giveaway started in ${channel}!`);
    },

    async handleEnd(interaction) {
        const messageId = interaction.options.getString('messageid');
        await interaction.deferReply({ ephemeral: true });

        const result = await this.endGiveaway(messageId, interaction.client, interaction.user.id);
        await interaction.editReply(result);
    },

    async handleReroll(interaction) {
        const messageId = interaction.options.getString('messageid');
        await interaction.deferReply({ ephemeral: true });

        const giveaways = loadGiveaways();
        const giveaway = giveaways.giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            return interaction.editReply('❌ Giveaway not found.');
        }

        if (giveaway.hostId !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.editReply('❌ You can only reroll your own giveaways.');
        }

        if (giveaway.status !== 'ended') {
            return interaction.editReply('❌ This giveaway has not ended yet.');
        }

        if (giveaway.participants.length === 0) {
            return interaction.editReply('❌ No participants to reroll from.');
        }

        const winners = this.selectWinners(giveaway.participants, giveaway.winners);
        const channel = interaction.guild.channels.cache.get(giveaway.channelId);

        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('🎉 Giveaway Rerolled!')
                .setDescription(`**Prize:** ${giveaway.prize}\n\n**New Winner${winners.length > 1 ? 's' : ''}:**\n${winners.map(w => `<@${w}>`).join('\n')}`)
                .setColor(GIVEAWAY_COLOR)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        }

        await interaction.editReply('✅ Giveaway rerolled successfully!');
    },

    async handlePause(interaction) {
        const messageId = interaction.options.getString('messageid');
        await interaction.deferReply({ ephemeral: true });

        const giveaways = loadGiveaways();
        const giveaway = giveaways.giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            return interaction.editReply('❌ Giveaway not found.');
        }

        if (giveaway.hostId !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.editReply('❌ You can only pause your own giveaways.');
        }

        if (giveaway.status !== 'active') {
            return interaction.editReply('❌ This giveaway is not active.');
        }

        giveaway.status = 'paused';
        saveGiveaways(giveaways);

        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        if (channel) {
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (message) {
                const embed = EmbedBuilder.from(message.embeds[0])
                    .setTitle('⏸️ GIVEAWAY PAUSED ⏸️')
                    .setColor(0xFFFF00);

                const button = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('giveaway_enter')
                            .setLabel('⏸️ Giveaway Paused')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );

                await message.edit({ embeds: [embed], components: [button] });
            }
        }

        await interaction.editReply('✅ Giveaway paused successfully!');
    },

    async handleResume(interaction) {
        const messageId = interaction.options.getString('messageid');
        await interaction.deferReply({ ephemeral: true });

        const giveaways = loadGiveaways();
        const giveaway = giveaways.giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            return interaction.editReply('❌ Giveaway not found.');
        }

        if (giveaway.hostId !== interaction.user.id && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.editReply('❌ You can only resume your own giveaways.');
        }

        if (giveaway.status !== 'paused') {
            return interaction.editReply('❌ This giveaway is not paused.');
        }

        if (Date.now() >= giveaway.endTime) {
            return interaction.editReply('❌ This giveaway has already expired.');
        }

        giveaway.status = 'active';
        saveGiveaways(giveaways);

        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        if (channel) {
            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (message) {
                const embed = EmbedBuilder.from(message.embeds[0])
                    .setTitle('🎉 GIVEAWAY 🎉')
                    .setColor(GIVEAWAY_COLOR);

                const button = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('giveaway_enter')
                            .setLabel('🎉 Enter Giveaway')
                            .setStyle(ButtonStyle.Primary)
                    );

                await message.edit({ embeds: [embed], components: [button] });
            }
        }

        // Reset timeout
        const remainingTime = giveaway.endTime - Date.now();
        if (remainingTime > 0) {
            setTimeout(() => {
                this.endGiveaway(messageId, interaction.client);
            }, remainingTime);
        }

        await interaction.editReply('✅ Giveaway resumed successfully!');
    },

    async handleList(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const giveaways = loadGiveaways();
        const serverGiveaways = giveaways.giveaways.filter(g => g.guildId === interaction.guild.id);

        if (serverGiveaways.length === 0) {
            return interaction.editReply('❌ No giveaways found in this server.');
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Server Giveaways')
            .setColor(GIVEAWAY_COLOR)
            .setTimestamp();

        let description = '';
        serverGiveaways.forEach(g => {
            const status = g.status === 'active' ? '🟢 Active' : g.status === 'paused' ? '🟡 Paused' : '🔴 Ended';
            description += `**${g.prize}** (${status})\nID: \`${g.messageId}\` | Channel: <#${g.channelId}>\n\n`;
        });

        embed.setDescription(description || 'No giveaways found.');
        await interaction.editReply({ embeds: [embed] });
    },

    async handleEdit(interaction) {
        // For brevity, this would show another modal to edit giveaway details
        await interaction.reply({ content: '🚧 Edit functionality coming soon!', ephemeral: true });
    },

    async handleReset(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Check permissions
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.editReply('❌ You need the "Manage Guild" permission to reset giveaways.');
        }

        const giveaways = loadGiveaways();
        const serverGiveaways = giveaways.giveaways.filter(g => g.guildId === interaction.guild.id);

        if (serverGiveaways.length === 0) {
            return interaction.editReply('❌ No giveaways found in this server to reset.');
        }

        // Remove all giveaways for this server
        giveaways.giveaways = giveaways.giveaways.filter(g => g.guildId !== interaction.guild.id);
        saveGiveaways(giveaways);

        // Try to disable buttons on existing giveaway messages
        let disabledCount = 0;
        for (const giveaway of serverGiveaways) {
            try {
                const channel = interaction.guild.channels.cache.get(giveaway.channelId);
                if (channel) {
                    const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
                    if (message) {
                        const embed = EmbedBuilder.from(message.embeds[0])
                            .setTitle('🗑️ GIVEAWAY RESET')
                            .setColor(0xFF0000);

                        const button = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('giveaway_enter')
                                    .setLabel('🗑️ Giveaway Reset')
                                    .setStyle(ButtonStyle.Secondary)
                                    .setDisabled(true)
                            );

                        await message.edit({ embeds: [embed], components: [button] });
                        disabledCount++;
                    }
                }
            } catch (error) {
                console.error(`Failed to update giveaway message ${giveaway.messageId}:`, error);
            }
        }

        await interaction.editReply(`✅ Successfully reset ${serverGiveaways.length} giveaway(s) from this server.${disabledCount > 0 ? ` Updated ${disabledCount} giveaway message(s).` : ''}`);
    },

    async endGiveaway(messageId, client, hostId = null) {
        const giveaways = loadGiveaways();
        const giveaway = giveaways.giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            return '❌ Giveaway not found.';
        }

        if (hostId && giveaway.hostId !== hostId) {
            return '❌ You can only end your own giveaways.';
        }

        if (giveaway.status === 'ended') {
            return '❌ This giveaway has already ended.';
        }

        giveaway.status = 'ended';

        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) {
            saveGiveaways(giveaways);
            return '❌ Guild not found.';
        }

        const channel = guild.channels.cache.get(giveaway.channelId);
        if (!channel) {
            saveGiveaways(giveaways);
            return '❌ Channel not found.';
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
            saveGiveaways(giveaways);
            return '❌ Giveaway message not found.';
        }

        let resultEmbed;
        if (giveaway.participants.length === 0) {
            resultEmbed = new EmbedBuilder()
                .setTitle('🎉 Giveaway Ended')
                .setDescription(`**Prize:** ${giveaway.prize}\n\n**Winner:** No valid entries`)
                .setColor(0xFF0000)
                .setTimestamp();
        } else {
            const winners = this.selectWinners(giveaway.participants, giveaway.winners);
            resultEmbed = new EmbedBuilder()
                .setTitle('🎉 Giveaway Ended')
                .setDescription(`**Prize:** ${giveaway.prize}\n\n**Winner${winners.length > 1 ? 's' : ''}:**\n${winners.map(w => `<@${w}>`).join('\n')}`)
                .setColor(GIVEAWAY_COLOR)
                .setTimestamp();

            // Send winner announcement
            await channel.send({
                content: `🎉 Congratulations ${winners.map(w => `<@${w}>`).join(', ')}! You won **${giveaway.prize}**!`,
                embeds: [resultEmbed]
            });
        }

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('giveaway_enter')
                    .setLabel('🎉 Giveaway Ended')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

        await message.edit({
            embeds: [resultEmbed],
            components: [button]
        });

        saveGiveaways(giveaways);
        return '✅ Giveaway ended successfully!';
    },

    selectWinners(participants, count) {
        if (participants.length <= count) {
            return [...participants];
        }

        const winners = [];
        const availableParticipants = [...participants];

        for (let i = 0; i < count; i++) {
            const randomIndex = Math.floor(Math.random() * availableParticipants.length);
            winners.push(availableParticipants.splice(randomIndex, 1)[0]);
        }

        return winners;
    },

    async handleGiveawayButton(interaction) {
        if (interaction.customId !== 'giveaway_enter') return;

        const giveaways = loadGiveaways();
        const giveaway = giveaways.giveaways.find(g => g.messageId === interaction.message.id);

        if (!giveaway) {
            return interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });
        }

        if (giveaway.status !== 'active') {
            return interaction.reply({ content: '❌ This giveaway is not active.', ephemeral: true });
        }

        if (Date.now() >= giveaway.endTime) {
            return interaction.reply({ content: '❌ This giveaway has ended.', ephemeral: true });
        }

        if (giveaway.participants.includes(interaction.user.id)) {
            // Remove from giveaway
            giveaway.participants = giveaway.participants.filter(p => p !== interaction.user.id);
            saveGiveaways(giveaways);
            return interaction.reply({ content: '❌ You have left the giveaway.', ephemeral: true });
        } else {
            // Add to giveaway
            giveaway.participants.push(interaction.user.id);
            saveGiveaways(giveaways);
            return interaction.reply({ content: '✅ You have entered the giveaway! Good luck!', ephemeral: true });
        }
    }
};
