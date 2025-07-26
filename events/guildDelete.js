const { Events, EmbedBuilder } = require('discord.js');

// Hardcode the log channel ID here
const logChannelId = "1359955497746169967"; // Replace with your actual log channel ID if it's different!

module.exports = {
    name: Events.GuildDelete, // This specifies that this file handles the 'guildDelete' event
    async execute(guild) {
        console.log(`Left guild: ${guild.name} (${guild.id})`);

        // Check if a log channel ID is set (even if hardcoded, good practice)
        if (!logChannelId) {
            console.warn('logChannelId is not defined in guildDelete.js. Cannot log guild leave event.');
            return;
        }

        try {
            // Fetch the log channel using its ID
            const logChannel = await guild.client.channels.fetch(logChannelId);

            // If the channel is found and is a text-based channel
            if (logChannel && logChannel.isTextBased()) {
                const leaveEmbed = new EmbedBuilder()
                    .setColor(0xFF0000) // Red color for a "leave" event
                    .setTitle('Bot Left a Guild')
                    .setDescription(`I have been removed from **${guild.name}**!`)
                    .addFields(
                        { name: 'Guild Name', value: guild.name, inline: true },
                        { name: 'Guild ID', value: guild.id, inline: true },
                        { name: 'Member Count', value: `${guild.memberCount || 'N/A'}`, inline: true },
                        { name: 'Owner ID', value: guild.ownerId ? `<@${guild.ownerId}> (${guild.ownerId})` : 'N/A', inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: `Bot ID: ${guild.client.user.id}` });

                await logChannel.send({ embeds: [leaveEmbed] });
                console.log(`Logged guild leave event for ${guild.name} to channel ${logChannel.name}`);
            } else {
                console.warn(`Configured logChannelId (${logChannelId}) is not a valid text channel or could not be fetched.`);
            }
        } catch (error) {
            console.error(`Error logging guild leave event for ${guild.name}:`, error);
        }
    },
};