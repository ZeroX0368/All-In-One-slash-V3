const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    // Command data for Discord API
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Provides information about the server or a user.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('server')
                .setDescription('Get information about the current server.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Get information about a user.')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('The user to get info about')
                        .setRequired(false) // Make it optional for getting info about self
                )
        ),

    // Execute function for the command
    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'server') {
            const guild = interaction.guild;
            if (!guild) {
                return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            }

            // Fetch owner for better display (optional, but good practice)
            let ownerTag = 'Unknown';
            try {
                const owner = await guild.fetchOwner();
                ownerTag = owner ? owner.user.tag : 'Unknown';
            } catch (error) {
                console.error(`Error fetching guild owner for ${guild.name}:`, error);
            }

            const serverInfoEmbed = new EmbedBuilder()
                .setColor(0x0099FF) // Blue color
                .setTitle(`Information about ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 })) // Server icon
                .addFields(
                    { name: '🆔 Server ID', value: guild.id, inline: true },
                    { name: '📅 Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                    { name: '👑 Owned by', value: ownerTag, inline: true },
                    { name: '👥 Total Members', value: `${guild.memberCount}`, inline: true },
                    { name: '💬 Channels', value: `${guild.channels.cache.size} (Text: ${guild.channels.cache.filter(c => c.type === 0).size}, Voice: ${guild.channels.cache.filter(c => c.type === 2).size})`, inline: true },
                    { name: '🏷️ Roles', value: `${guild.roles.cache.size}`, inline: true },
                    { name: 'Region', value: guild.preferredLocale ? guild.preferredLocale : 'N/A', inline: true }, // Add region if available
                    { name: 'Boost Level', value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} boosts)`, inline: true },
                )
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}` });

            await interaction.reply({ embeds: [serverInfoEmbed] });
        } else if (interaction.options.getSubcommand() === 'user') {
            const targetUser = interaction.options.getUser('target') || interaction.user; // Get target or default to self
            const member = interaction.guild.members.cache.get(targetUser.id);

            if (!member) {
                return interaction.reply({ content: 'Could not find that user in this server.', ephemeral: true });
            }

            const userStatus = member.presence?.status || 'offline';
            const userRoles = member.roles.cache
                .filter(role => role.id !== interaction.guild.id) // Exclude @everyone role
                .sort((a, b) => b.position - a.position) // Sort by position
                .map(role => role.toString())
                .join(', ') || 'No roles';

            const userInfoEmbed = new EmbedBuilder()
                .setColor(member.displayHexColor === '#000000' ? 0x0099FF : member.displayHexColor) // Use user's role color or default blue
                .setTitle(`Information about ${targetUser.tag}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 })) // User avatar
                .addFields(
                    { name: '🆔 User ID', value: targetUser.id, inline: true },
                    { name: '🗓️ Joined Discord', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:D>`, inline: true },
                    { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
                    { name: '✨ Status', value: userStatus.charAt(0).toUpperCase() + userStatus.slice(1), inline: true }, // Capitalize status
                    { name: '🤖 Is Bot?', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                    { name: '💎 Nickname', value: member.nickname || 'None', inline: true },
                    { name: '🎨 Highest Role', value: member.roles.highest.name, inline: true },
                    { name: '📍 Roles', value: userRoles.length > 1024 ? userRoles.substring(0, 1021) + '...' : userRoles || 'No roles', inline: false } // Check length for field value limit
                )
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}` });

            await interaction.reply({ embeds: [userInfoEmbed] });
        }
    },
};