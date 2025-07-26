const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    // Defines the slash command's structure and options
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Provides user-related information.')
        .setDMPermission(false) // This command is designed for use in servers

        // Subcommand: avatar
        .addSubcommand(subcommand =>
            subcommand
                .setName('avatar')
                .setDescription('Displays the avatar of a user.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user whose avatar you want to see (defaults to yourself).')
                        .setRequired(false))) // Optional user, defaults to command invoker

        // Subcommand: banner
        .addSubcommand(subcommand =>
            subcommand
                .setName('banner')
                .setDescription('Displays the banner of a user.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user whose banner you want to see (defaults to yourself).')
                        .setRequired(false))), // Optional user, defaults to command invoker

    // The function that executes when the command is called
    async execute(interaction) {
        // Defer the reply to give the bot time to fetch data.
        // The user will see a "Bot is thinking..." message.
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        // Get the target user from the option, or default to the user who ran the command
        let targetUser = interaction.options.getUser('user') || interaction.user;

        // Crucial step: Fetch the user's latest data from Discord API.
        // This ensures the 'banner' property is populated, as it might not be in the cached user object.
        try {
            targetUser = await interaction.client.users.fetch(targetUser.id, { force: true });
        } catch (error) {
            console.error(`Error fetching user ${targetUser.id}:`, error);
            return interaction.editReply({ content: 'Could not fetch data for that user. They might no longer exist or I might lack necessary permissions.', ephemeral: true });
        }

        switch (subcommand) {
            case 'avatar': {
                // Get the avatar URL. dynamic: true ensures animated GIFs are used if available.
                const avatarURL = targetUser.displayAvatarURL({ size: 1024, dynamic: true });

                const avatarEmbed = new EmbedBuilder()
                    .setColor(0x0099FF) // A nice blue color
                    .setTitle(`${targetUser.username}'s Avatar`)
                    .setImage(avatarURL) // Set the avatar image
                    .setURL(avatarURL) // Make the title clickable to open the full-size image
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [avatarEmbed] });
                break;
            }

            case 'banner': {
                // Get the banner URL.
                const bannerURL = targetUser.bannerURL({ size: 1024, dynamic: true });

                // Check if the user has a banner set. If not, inform the user.
                if (!bannerURL) {
                    return interaction.editReply({ content: `${targetUser.username} does not have a custom banner set.`, ephemeral: true });
                }

                const bannerEmbed = new EmbedBuilder()
                    .setColor(0x0099FF) // A nice blue color
                    .setTitle(`${targetUser.username}'s Banner`)
                    .setImage(bannerURL) // Set the banner image
                    .setURL(bannerURL) // Make the title clickable to open the full-size image
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [bannerEmbed] });
                break;
            }
        }
    },
};