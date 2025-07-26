const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands of the bot.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false }); // Reply publicly (change to true for ephemeral)

        const commands = interaction.client.commands; // Get the collection of loaded commands
        
        if (!commands || commands.size === 0) {
            return interaction.editReply('❌ No commands found or loaded.');
        }

        const commandList = [];
        commands.forEach(command => {
            // For each command, we want to display its name and description
            commandList.push(`**\`/${command.data.name}\`**: ${command.data.description}`);
            
            // If the command has subcommands, list them too for better detail
            if (command.data.options && command.data.options.length > 0) {
                command.data.options.forEach(option => {
                    if (option.type === 1 || option.type === 2) { // 1 = SUB_COMMAND, 2 = SUB_COMMAND_GROUP
                        const subcommandName = option.name;
                        const subcommandDescription = option.description;
                        commandList.push(`  ↳ \`/${command.data.name} ${subcommandName}\`: ${subcommandDescription}`);

                        // If it's a subcommand group, iterate its options for subcommands
                        if (option.options && option.options.length > 0 && option.type === 2) {
                            option.options.forEach(groupOption => {
                                if (groupOption.type === 1) { // Only direct subcommands within a group
                                    commandList.push(`    ↳ \`/${command.data.name} ${subcommandName} ${groupOption.name}\`: ${groupOption.description}`);
                                }
                            });
                        }
                    }
                });
            }
        });

        // Split the list into chunks if it's too long for a single embed field
        // Max characters for embed description is 4096
        const chunkSize = 1500; // Aim for chunks of this size
        const commandStrings = commandList.join('\n');
        
        const embeds = [];
        let currentChunk = '';
        let chunkCount = 0;

        // Simple splitting logic, could be more robust for very long lists
        if (commandStrings.length > chunkSize) {
            const lines = commandStrings.split('\n');
            for (const line of lines) {
                if (currentChunk.length + line.length + 1 > chunkSize && currentChunk.length > 0) {
                    embeds.push(new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(`🤖 Bot Commands (Page ${++chunkCount})`)
                        .setDescription(currentChunk)
                        .setFooter({ text: `Total commands: ${commands.size}` })
                        .setTimestamp());
                    currentChunk = '';
                }
                currentChunk += line + '\n';
            }
            if (currentChunk.length > 0) {
                embeds.push(new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`🤖 Bot Commands (Page ${++chunkCount})`)
                    .setDescription(currentChunk)
                    .setFooter({ text: `Total commands: ${commands.size}` })
                    .setTimestamp());
            }
        } else {
            embeds.push(new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🤖 Bot Commands')
                .setDescription(commandStrings)
                .setFooter({ text: `Total commands: ${commands.size}` })
                .setTimestamp());
        }


        try {
            if (embeds.length > 1) {
                await interaction.editReply({ content: 'Here are my commands, split into multiple messages:', embeds: [embeds[0]] });
                for (let i = 1; i < embeds.length; i++) {
                    await interaction.followUp({ embeds: [embeds[i]], ephemeral: false });
                }
            } else {
                await interaction.editReply({ embeds: embeds });
            }
        } catch (error) {
            console.error('Error sending help command embeds:', error);
            await interaction.editReply('❌ There was an error trying to list commands.');
        }
    },
};