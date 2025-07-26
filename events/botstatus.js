const { Events, EmbedBuilder } = require('discord.js');

// Define the channel ID where status messages will be sent
const STATUS_CHANNEL_ID = "1385273334484435108";

let botStatusMessageSent = false; // Flag to ensure "online" message is sent only once on initial ready

module.exports = {
    name: Events.ClientReady, // Listen for the bot becoming ready
    once: true, // This event should only run once when the bot starts
    async execute(client) {
        if (botStatusMessageSent) return; // Prevent duplicate messages if ready fires multiple times

        console.log(`[STATUS] Bot is online! Logged in as ${client.user.tag}`);

        const statusChannel = await client.channels.fetch(STATUS_CHANNEL_ID).catch(console.error);

        if (statusChannel && statusChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00) // Green for online
                .setTitle('🟢 Bot Status: Online')
                .setDescription(`\`${client.user.tag}\` is now **online** and ready to use!`)
                .setTimestamp();
            try {
                await statusChannel.send({ embeds: [embed] });
                botStatusMessageSent = true;
            } catch (error) {
                console.error(`[STATUS] Could not send online message to channel ${STATUS_CHANNEL_ID}:`, error);
            }
        } else {
            console.warn(`[STATUS] Status channel with ID ${STATUS_CHANNEL_ID} not found or is not a text channel.`);
        }

        // --- Additional Listeners for Disconnect/Reconnect ---
        // These will be attached to the client instance after it's ready

        client.on(Events.Warn, (info) => {
            console.warn(`[DISCORD WARNING] ${info}`);
            // You could log this to the status channel if severe enough
        });

        client.on(Events.Error, (error) => {
            console.error(`[DISCORD ERROR]`, error);
            // You could log this to the status channel
            if (statusChannel && statusChannel.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000) // Red for error
                    .setTitle('🔴 Bot Error Detected')
                    .setDescription(`An unexpected error occurred:\n\`\`\`\n${error.message}\n\`\`\``)
                    .setTimestamp();
                statusChannel.send({ embeds: [embed] }).catch(console.error);
            }
        });

        // The 'disconnect' event indicates a closed connection, potentially temporary or permanent.
        client.on(Events.ShardDisconnect, async (event, id) => {
            console.log(`[STATUS] Bot disconnected from Discord (Shard ${id}). Code: ${event.code}, Reason: ${event.reason || 'No reason'}`);
            if (statusChannel && statusChannel.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500) // Orange for disconnect
                    .setTitle('🟠 Bot Status: Disconnected')
                    .setDescription(`\`${client.user.tag}\` disconnected from Discord (Shard ${id}).\nCode: \`${event.code}\`\nReason: \`${event.reason || 'No reason specified'}\``)
                    .setTimestamp();
                await statusChannel.send({ embeds: [embed] }).catch(console.error);
            }
        });

        // The 'reconnecting' event indicates the bot is attempting to reconnect after a disconnect.
        client.on(Events.ShardReconnecting, async (id) => {
            console.log(`[STATUS] Bot reconnecting to Discord (Shard ${id})...`);
            if (statusChannel && statusChannel.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500) // Orange for reconnecting
                    .setTitle('🟡 Bot Status: Reconnecting')
                    .setDescription(`\`${client.user.tag}\` is attempting to reconnect to Discord (Shard ${id})...`)
                    .setTimestamp();
                // Avoid spamming if it's rapidly reconnecting, perhaps edit the last message or rate-limit
                await statusChannel.send({ embeds: [embed] }).catch(console.error);
            }
        });

        // The 'resume' event indicates a successful reconnection.
        client.on(Events.ShardResume, async (id, replayed) => {
            console.log(`[STATUS] Bot successfully reconnected and resumed (Shard ${id}). Replayed events: ${replayed}`);
            if (statusChannel && statusChannel.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setColor(0x00FF00) // Green for reconnected
                    .setTitle('🟢 Bot Status: Reconnected')
                    .setDescription(`\`${client.user.tag}\` successfully reconnected to Discord (Shard ${id}).`)
                    .setTimestamp();
                await statusChannel.send({ embeds: [embed] }).catch(console.error);
            }
        });
    }
};