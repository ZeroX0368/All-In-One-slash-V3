const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Searches for information on various platforms.')
        .setDMPermission(true) // Can be used in DMs

        // Subcommand: github
        .addSubcommand(subcommand =>
            subcommand
                .setName('github')
                .setDescription('Get information about a GitHub user.')
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription('The GitHub username to search for.')
                        .setRequired(true)))

        // New Subcommand: pokemon
        .addSubcommand(subcommand =>
            subcommand
                .setName('pokemon')
                .setDescription('Get information about a Pokémon.')
                .addStringOption(option =>
                    option
                        .setName('pokemon')
                        .setDescription('The name or ID of the Pokémon.')
                        .setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply(); // Show "Bot is thinking..." while we process

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'github') {
            const githubUsername = interaction.options.getString('username');
            const apiUrl = `https://api.github.com/users/${githubUsername}`;

            try {
                const response = await fetch(apiUrl, {
                    headers: {
                        'User-Agent': 'DiscordBot' // GitHub API requires a User-Agent header
                    }
                });

                if (response.status === 404) {
                    return interaction.editReply({ content: `❌ GitHub user \`${githubUsername}\` not found. Please check the username.`, ephemeral: true });
                }

                if (!response.ok) {
                    console.error(`GitHub API error: ${response.status} ${response.statusText}`);
                    return interaction.editReply({ content: 'An error occurred while fetching data from GitHub. Please try again later.', ephemeral: true });
                }

                const userData = await response.json();

                const githubEmbed = new EmbedBuilder()
                    .setColor(0x2B3137) // GitHub's dark grey color
                    .setTitle(`${userData.login}'s GitHub Profile`)
                    .setURL(userData.html_url) // Link to their GitHub profile
                    .setThumbnail(userData.avatar_url) // User's avatar
                    .addFields(
                        { name: 'Name', value: userData.name || 'Not specified', inline: true },
                        { name: 'Company', value: userData.company || 'Not specified', inline: true },
                        { name: 'Location', value: userData.location || 'Not specified', inline: true },
                        { name: 'Followers', value: userData.followers.toLocaleString(), inline: true },
                        { name: 'Following', value: userData.following.toLocaleString(), inline: true },
                        { name: 'Public Repos', value: userData.public_repos.toLocaleString(), inline: true },
                        { name: 'Public Gists', value: userData.public_gists.toLocaleString(), inline: true }
                    )
                    .setFooter({ text: `ID: ${userData.id} | Account created:` })
                    .setTimestamp(new Date(userData.created_at)); // Convert creation date to timestamp

                if (userData.bio) {
                    githubEmbed.setDescription(userData.bio); // Add bio if available
                }
                if (userData.email) {
                    githubEmbed.addFields({ name: 'Email', value: userData.email, inline: true });
                }
                if (userData.blog) {
                    // Check if blog URL is valid before adding
                    const blogUrl = userData.blog.startsWith('http') ? userData.blog : `https://${userData.blog}`;
                    githubEmbed.addFields({ name: 'Website/Blog', value: `[${userData.blog}](${blogUrl})`, inline: true });
                }


                await interaction.editReply({ embeds: [githubEmbed] });

            } catch (error) {
                console.error('Error fetching GitHub user info:', error);
                await interaction.editReply({ content: 'An unexpected error occurred while processing your request.', ephemeral: true });
            }
        } else if (subcommand === 'pokemon') {
            const pokemonName = interaction.options.getString('pokemon').toLowerCase(); // Convert to lowercase for API
            const apiUrl = `https://pokeapi.co/api/v2/pokemon/${pokemonName}/`;

            try {
                const response = await fetch(apiUrl);

                if (response.status === 404) {
                    return interaction.editReply({ content: `❌ Pokémon \`${pokemonName}\` not found. Please check the spelling.`, ephemeral: true });
                }

                if (!response.ok) {
                    console.error(`PokeAPI error: ${response.status} ${response.statusText}`);
                    return interaction.editReply({ content: 'An error occurred while fetching Pokémon data. Please try again later.', ephemeral: true });
                }

                const pokemonData = await response.json();

                // Helper function to capitalize and replace hyphens for better display names
                const formatName = (str) => {
                    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                };

                const name = formatName(pokemonData.name);
                const id = pokemonData.id;
                const types = pokemonData.types.map(t => formatName(t.type.name)).join(', ');
                const abilities = pokemonData.abilities.map(a => `${formatName(a.ability.name)}${a.is_hidden ? ' (Hidden)' : ''}`).join(', ');
                const height = (pokemonData.height / 10).toFixed(1); // Convert decimetres to meters
                const weight = (pokemonData.weight / 10).toFixed(1); // Convert hectograms to kilograms

                // Prioritize official artwork, fallback to front_default sprite
                const imageUrl = pokemonData.sprites.other?.['official-artwork']?.front_default || pokemonData.sprites.front_default;

                // Format base stats
                const stats = pokemonData.stats.map(s => {
                    const statName = formatName(s.stat.name);
                    const baseStat = s.base_stat;
                    return `**${statName}:** ${baseStat}`;
                }).join('\n');

                const pokemonEmbed = new EmbedBuilder()
                    .setColor(0xFF0000) // Classic Pokémon red color
                    .setTitle(`${name} (#${id})`)
                    .setURL(`https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}_(Pokémon)`) // Link to Bulbapedia
                    .setThumbnail(imageUrl) // Display the Pokémon's image
                    .addFields(
                        { name: 'Type(s)', value: types, inline: true },
                        { name: 'Abilities', value: abilities, inline: true },
                        { name: 'Height', value: `${height} m`, inline: true },
                        { name: 'Weight', value: `${weight} kg`, inline: true },
                        { name: 'Base Stats', value: stats, inline: false } // Not inline to give it more space
                    )
                    .setFooter({ text: `Data from PokéAPI.co` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [pokemonEmbed] });

            } catch (error) {
                console.error('Error fetching Pokémon info:', error);
                await interaction.editReply({ content: 'An unexpected error occurred while processing your request.', ephemeral: true });
            }
        }
    },
};