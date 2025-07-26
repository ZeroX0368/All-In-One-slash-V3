const { Events, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: Events.GuildCreate, // This specifies that this file handles the 'guildCreate' event
    async execute(guild) {
        console.log(`Joined a new guild: ${guild.name} (${guild.id})`);

        let welcomeChannel = null;

        // --- Strategy to find a suitable welcome channel ---
        // 1. Try to find a channel named 'welcome', 'general', or 'announcements'
        const preferredChannelNames = ['welcome', 'general', 'announcements'];
        for (const name of preferredChannelNames) {
            welcomeChannel = guild.channels.cache.find(
                channel => channel.name === name &&
                           channel.type === 0 && // 0 is GuildText channel type
                           channel.viewable && // Bot can see the channel
                           channel.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages) // Bot can send messages
            );
            if (welcomeChannel) break; // Found a suitable channel, stop searching
        }

        // 2. If no preferred channel found, find the first text channel the bot can send to
        if (!welcomeChannel) {
            welcomeChannel = guild.channels.cache.find(
                channel => channel.type === 0 && // GuildText channel
                           channel.viewable &&
                           channel.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)
            );
        }

        // If a welcome channel is found, send the message
        if (welcomeChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor(0x0099FF) // A nice blue color
                .setTitle(`Hello from ${guild.client.user.username}!`)
                .setDescription(
                    `Thank you for inviting me to **${guild.name}**!`)
                .setThumbnail(guild.client.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `Bot ID: ${guild.client.user.id}` });

            try {
                await welcomeChannel.send({ embeds: [welcomeEmbed] });
                console.log(`Sent welcome message to ${welcomeChannel.name} in ${guild.name}`);
            } catch (error) {
                console.error(`Failed to send welcome message to ${welcomeChannel.name} in ${guild.name}:`, error);
            }
        } else {
            console.warn(`Could not find a suitable channel to send welcome message in guild: ${guild.name} (${guild.id}).`);
        }
    },
};