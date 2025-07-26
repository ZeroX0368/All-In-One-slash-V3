const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios'); // Make sure you have axios installed: npm install axios

module.exports = {
    // Command data for Discord's API
    data: new SlashCommandBuilder()
        .setName('animal')
        .setDescription('Get a random image and fact about an animal!')
        // Subcommand for Cat
        .addSubcommand(subcommand =>
            subcommand
                .setName('cat')
                .setDescription('Get a random cat image and fact.')
        )
        // Subcommand for Dog
        .addSubcommand(subcommand =>
            subcommand
                .setName('dog')
                .setDescription('Get a random dog image and fact.')
        )
        // Subcommand for Bird
        .addSubcommand(subcommand =>
            subcommand
                .setName('bird')
                .setDescription('Get a random bird image and fact.')
        )
        // Subcommand for Bear
        .addSubcommand(subcommand =>
            subcommand
                .setName('bear')
                .setDescription('Get a random bear image and fact.')
        )
        // Subcommand for Red Panda
        .addSubcommand(subcommand =>
            subcommand
                .setName('redpanda')
                .setDescription('Get a random red panda image and fact.')
        )
        // Subcommand for Panda
        .addSubcommand(subcommand =>
            subcommand
                .setName('panda')
                .setDescription('Get a random panda image and fact.')
        )
        // Subcommand for Snake
        .addSubcommand(subcommand =>
            subcommand
                .setName('snake')
                .setDescription('Get a random snake image and fact.')
        ),

    // Execute function for the command
    async execute(interaction) {
        await interaction.deferReply(); // Defer reply as API calls can take time

        // Get the name of the subcommand that was used
        const animalType = interaction.options.getSubcommand();
        let imageUrl = '';
        let factText = '';
        let errorOccurred = false;

        try {
            switch (animalType) {
                case 'cat':
                    const catImageRes = await axios.get('https://api.thecatapi.com/v1/images/search');
                    imageUrl = catImageRes.data[0].url;
                    try {
                        const catFactRes = await axios.get('https://catfact.ninja/fact');
                        factText = catFactRes.data.fact;
                    } catch (factError) {
                        console.warn('Could not fetch cat fact:', factError.message);
                        factText = 'No cat fact available at the moment.';
                    }
                    break;
                case 'dog':
                    const dogImageRes = await axios.get('https://dog.ceo/api/breeds/image/random');
                    imageUrl = dogImageRes.data.message;
                    try {
                        const dogFactRes = await axios.get('https://some-random-api.com/facts/dog');
                        factText = dogFactRes.data.fact;
                    } catch (factError) {
                        console.warn('Could not fetch dog fact:', factError.message);
                        factText = 'No dog fact available at the moment.';
                    }
                    break;
                case 'bird':
                    const birdImageRes = await axios.get('https://some-random-api.com/img/bird');
                    imageUrl = birdImageRes.data.link;
                    try {
                        const birdFactRes = await axios.get('https://some-random-api.com/facts/bird');
                        factText = birdFactRes.data.fact;
                    } catch (factError) {
                        console.warn('Could not fetch bird fact:', factError.message);
                        factText = 'No bird fact available at the moment.';
                    }
                    break;
                case 'bear':
                    const bearImageRes = await axios.get('https://some-random-api.com/img/bear');
                    imageUrl = bearImageRes.data.link;
                    try {
                        const bearFactRes = await axios.get('https://some-random-api.com/facts/bear');
                        factText = bearFactRes.data.fact;
                    } catch (factError) {
                        console.warn('Could not fetch bear fact:', factError.message);
                        factText = 'No bear fact available at the moment.';
                    }
                    break;
                case 'redpanda':
                    const redPandaImageRes = await axios.get('https://some-random-api.com/img/red_panda');
                    imageUrl = redPandaImageRes.data.link;
                    try {
                        const redPandaFactRes = await axios.get('https://some-random-api.com/facts/red_panda');
                        factText = redPandaFactRes.data.fact;
                    } catch (factError) {
                        console.warn('Could not fetch red panda fact:', factError.message);
                        factText = 'No red panda fact available at the moment.';
                    }
                    break;
                case 'panda':
                    const pandaImageRes = await axios.get('https://some-random-api.com/img/panda');
                    imageUrl = pandaImageRes.data.link;
                    try {
                        const pandaFactRes = await axios.get('https://some-random-api.com/facts/panda');
                        factText = pandaFactRes.data.fact;
                    } catch (factError) {
                        console.warn('Could not fetch panda fact:', factError.message);
                        factText = 'No panda fact available at the moment.';
                    }
                    break;
                case 'snake':
                    // As noted previously, some-random-api.com does not have a direct 'snake' image or fact API.
                    // You'll need to find an alternative for snakes. For now, it will use a placeholder.
                    imageUrl = 'https://via.placeholder.com/300x200?text=Snake+Image+Unavailable';
                    factText = 'No specific snake image API integrated yet. Fact: Snakes are legless reptiles.';
                    console.warn('No direct API for snake images/facts integrated. Consider adding one.');
                    break;
                default:
                    // This case should ideally not be hit if all subcommands are handled
                    imageUrl = 'https://via.placeholder.com/300x200?text=Unknown+Animal';
                    factText = 'An unexpected animal type was requested.';
                    errorOccurred = true;
                    break;
            }
        } catch (error) {
            console.error(`Error fetching ${animalType} data:`, error);
            imageUrl = 'https://via.placeholder.com/300x200?text=Error+Loading+Image';
            factText = `Sorry, I couldn't fetch data for ${animalType} at the moment. Please try again later.`;
            errorOccurred = true;
        }

        const embed = new EmbedBuilder()
            .setColor(errorOccurred ? 0xED4245 : 0x0099FF) // Red for error, blue otherwise
            .setTitle(`Random ${animalType.charAt(0).toUpperCase() + animalType.slice(1).replace('redpanda', 'Red Panda')}`) // Capitalize and handle redpanda
            .setImage(imageUrl)
            .setFooter({ text: `Fact: ${factText}` });

        await interaction.editReply({ embeds: [embed] });
    },
};