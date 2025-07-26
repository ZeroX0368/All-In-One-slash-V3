const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('random')
        .setDescription('Generates random things!')
        .setDMPermission(true) // Allows commands in DMs if needed, though meme/color are fine.
        // Subcommand: /random color
        .addSubcommand(subcommand =>
            subcommand
                .setName('color')
                .setDescription('Generates and displays a random hexadecimal color.')
        )
        // Subcommand: /random meme
        .addSubcommand(subcommand =>
            subcommand
                .setName('meme')
                .setDescription('Fetches a random meme from Reddit.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'color') {
            // Defer reply for commands that might take a moment
            await interaction.deferReply();

            // Generate a random hexadecimal color code
            const randomColor = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
            const hexColor = `#${randomColor}`;

            const colorEmbed = new EmbedBuilder()
                .setColor(randomColor) // Set the embed's color to the generated random color
                .setTitle('🎨 Your Random Color!')
                .setDescription(`Here's your random color:\n\`${hexColor}\``)
                .setThumbnail(`https://singlecolorimage.com/get/${randomColor}/128x128`) // A simple service to get a square image of the color
                .setTimestamp()
                .setFooter({ text: `Generated for ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [colorEmbed] });

        } else if (subcommand === 'meme') {
            await interaction.deferReply(); // Defer to allow time for API call

            try {
                const response = await fetch('https://meme-api.com/gimme');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(`API returned ${response.status}: ${data.message || 'Unknown error'}`);
                }

                const memeEmbed = new EmbedBuilder()
                    .setColor(0x00FF00) // Green color for success
                    .setTitle(data.title)
                    .setURL(data.postLink) // Link to the Reddit post
                    .setImage(data.url) // The meme image
                    .addFields(
                        { name: 'Subreddit', value: `r/${data.subreddit}`, inline: true },
                        { name: 'Author', value: data.author || 'N/A', inline: true }
                    )
                    .setFooter({ text: `From ${data.subreddit}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [memeEmbed] });

            } catch (error) {
                console.error('Error fetching meme:', error);
                await interaction.editReply('❌ Failed to fetch a random meme. Please try again later.');
            }
        }
    },
};