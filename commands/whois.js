const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whois')
        .setDescription('Get detailed information about a user.')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The user to get information about (defaults to yourself).')
                .setRequired(false)), // The target user is optional

    async execute(interaction) {
        await interaction.deferReply(); // Defer the reply to show "Bot is thinking..."

        // Get the target user. If no user is specified, default to the interaction author.
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null); // Try to fetch as a GuildMember

        // Determine if the user is a bot
        const isBot = targetUser.bot ? 'Yes' : 'No';

        // Get user's Discord creation date
        const createdAt = targetUser.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });

        let joinedAt = 'N/A';
        let roles = 'N/A';
        let nickname = 'N/A';
        let highestRole = 'N/A';
        let presenceStatus = 'N/A';
        let activity = 'N/A';

        if (targetMember) {
            // Get user's join date to the guild
            joinedAt = targetMember.joinedAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
            });

            // Get user's roles (excluding @everyone)
            roles = targetMember.roles.cache
                .filter(role => role.id !== interaction.guild.id) // Filter out @everyone role
                .sort((a, b) => b.position - a.position) // Sort by position descending
                .map(role => `<@&${role.id}>`)
                .join(', ') || 'No custom roles.';
            
            // Get nickname
            nickname = targetMember.nickname || targetUser.displayName;

            // Get highest role
            highestRole = targetMember.roles.highest.name === '@everyone' ? 'None' : targetMember.roles.highest.name;

            // Get presence and activity (may require GatewayIntentBits.GuildPresences)
            if (targetMember.presence) {
                presenceStatus = targetMember.presence.status;
                const activities = targetMember.presence.activities;
                if (activities.length > 0) {
                    activity = activities.map(act => {
                        const typeMap = {
                            0: 'Playing',
                            1: 'Streaming',
                            2: 'Listening to',
                            3: 'Watching',
                            4: 'Custom Status',
                            5: 'Competing in'
                        };
                        const type = typeMap[act.type] || 'Unknown';
                        return `**${type}:** ${act.state || act.name}`; // Use state for custom status, name otherwise
                    }).join('\n');
                } else {
                    activity = 'No current activity.';
                }
            } else {
                presenceStatus = 'Offline/Invisible'; // Or if GuildPresences intent is missing
                activity = 'Not available (Presence intent may be missing or user is offline).';
            }

        } else {
            // If targetMember is null, it means the user is not in this guild (but could still be a Discord user)
            joinedAt = 'Not in this server.';
            roles = 'Not in this server.';
            nickname = targetUser.displayName;
            highestRole = 'Not in this server.';
            presenceStatus = 'Not available (User not in this server).';
            activity = 'Not available (User not in this server).';
        }

        const userInfoEmbed = new EmbedBuilder()
            .setColor(targetMember ? targetMember.displayHexColor : 0x0099FF) // Use member color if available, else a default blue
            .setTitle(`Whois: ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 })) // Dynamic for GIFs
            .addFields(
                { name: '👤 Username', value: `\`${targetUser.username}\``, inline: true },
                { name: '🏷️ Display Name', value: `\`${targetUser.displayName}\``, inline: true },
                { name: '🆔 User ID', value: `\`${targetUser.id}\``, inline: true },
                { name: '🤖 Is Bot?', value: `\`${isBot}\``, inline: true },
                { name: '⏰ Account Created', value: `\`${createdAt}\``, inline: true },
                { name: '🗓️ Joined Server', value: `\`${joinedAt}\``, inline: true },
                { name: '✨ Nickname', value: `\`${nickname}\``, inline: true },
                { name: '👑 Highest Role', value: `\`${highestRole}\``, inline: true },
                { name: '🛡️ Roles', value: roles.length > 1024 ? roles.substring(0, 1020) + '...' : roles }, // Truncate if too long
                { name: '🟢 Status', value: `\`${presenceStatus}\``, inline: true },
                { name: '🎮 Activity', value: activity, inline: true }, // Activity can be multiline
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [userInfoEmbed] });
    },
};