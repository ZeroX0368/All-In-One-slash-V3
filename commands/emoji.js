const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

// Helper function to check permissions
async function checkPermissions(interaction, requiredBotPerms, requiredUserPerms) {
    if (!interaction.guild) {
        await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
        return false;
    }

    const botMember = interaction.guild.members.me;
    // For manage commands, bot needs manage emojis
    if (requiredBotPerms && !botMember.permissions.has(requiredBotPerms)) {
        await interaction.reply({ content: `❌ I need the **"${new PermissionsBitField(requiredBotPerms).toArray().join(', ')}"** permission to perform this action.`, ephemeral: true });
        return false;
    }

    if (requiredUserPerms && !interaction.member.permissions.has(requiredUserPerms)) {
        await interaction.reply({ content: `❌ You need the **"${new PermissionsBitField(requiredUserPerms).toArray().join(', ')}"** permission to use this.`, ephemeral: true });
        return false;
    }
    return true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Manage custom emojis in this server.')
        .setDMPermission(false) // This command cannot be used in DMs
        // Add Subcommand: /emoji add <image_attachment | emoji_url | emoji_string> [name]
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adds a new custom emoji to the server.')
                .addAttachmentOption(option =>
                    option.setName('image_file')
                        .setDescription('Upload an image file (PNG, JPG, GIF) for the emoji.')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('emoji_source')
                        .setDescription('A URL to an image or an existing custom emoji (e.g., <:name:id>).')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name for the new emoji (defaults to filename or inferred).')
                        .setRequired(false)))
        // Delete Subcommand: /emoji delete <emoji>
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Deletes a custom emoji from the server.')
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The custom emoji (e.g., :thonk: or its ID) to delete.')
                        .setRequired(true)))
        // Rename Subcommand: /emoji rename <emoji> <new_name>
        .addSubcommand(subcommand =>
            subcommand
                .setName('rename')
                .setDescription('Renames an existing custom emoji.')
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The custom emoji (e.g., :oldname: or its ID) to rename.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('new_name')
                        .setDescription('The new name for the emoji.')
                        .setRequired(true)))
        // List Subcommand: /emoji list
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists all custom emojis in this server.'))
        // Image Subcommand: /emoji image <emoji>
        .addSubcommand(subcommand =>
            subcommand
                .setName('image')
                .setDescription('Gets the full image of a custom emoji.')
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The custom emoji (e.g., :emoji_name:, its ID, or the raw emoji) to get the image for.')
                        .setRequired(true)))
        // NEW Subcommand: /emoji info <emoji>
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Gets detailed information about a custom emoji.')
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('The custom emoji (e.g., :emoji_name:, its ID, or the raw emoji) to get info for.')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        // Permissions needed for managing emojis
        const manageEmojisPerms = PermissionsBitField.Flags.ManageEmojisAndStick;

        // --- Helper for finding emoji ---
        const findEmoji = (input) => {
            let foundEmoji;

            // Try to parse as custom emoji string like <:name:id> or <a:name:id>
            const customEmojiMatch = input.match(/<(a)?:(\w+):(\d+)>/);
            if (customEmojiMatch) {
                const emojiId = customEmojiMatch[3];
                foundEmoji = guild.emojis.cache.get(emojiId);
            }

            // If not found by parsing, try by ID directly
            if (!foundEmoji && !isNaN(input)) {
                 foundEmoji = guild.emojis.cache.get(input);
            }
            
            // If still not found, try by name (case-insensitive and stripping colons)
            if (!foundEmoji) {
                const emojiName = input.replace(/:/g, ''); // Remove colons if present
                foundEmoji = guild.emojis.cache.find(e => e.name.toLowerCase() === emojiName.toLowerCase());
            }
            return foundEmoji;
        };

        // --- Add Command Logic ---
        if (subcommand === 'add') {
            if (!(await checkPermissions(interaction, manageEmojisPerms, manageEmojisPerms))) return;

            await interaction.deferReply({ ephemeral: true });

            const imageFile = interaction.options.getAttachment('image_file');
            const emojiSource = interaction.options.getString('emoji_source');
            let emojiName = interaction.options.getString('name');

            let imageUrl;

            if (imageFile) {
                imageUrl = imageFile.url;
                if (!emojiName) emojiName = imageFile.name.split('.')[0]; // Use filename as default name
            } else if (emojiSource) {
                // Regex to extract ID and animated status from custom emoji string <:name:id> or <a:name:id>
                const customEmojiMatch = emojiSource.match(/<(a)?:(\w+):(\d+)>/);
                if (customEmojiMatch) {
                    const animated = customEmojiMatch[1]; // 'a' if animated, undefined otherwise
                    const emojiId = customEmojiMatch[3];
                    imageUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? 'gif' : 'png'}`;
                    if (!emojiName) emojiName = customEmojiMatch[2]; // Use original emoji name as default
                } else if (emojiSource.startsWith('http://') || emojiSource.startsWith('https://')) {
                    imageUrl = emojiSource;
                } else {
                    return interaction.editReply('❌ Invalid emoji source. Please provide a valid image file, URL, or custom emoji string.');
                }
            } else {
                return interaction.editReply('❌ You must provide either an `image_file` or an `emoji_source` (URL/custom emoji) to add an emoji.');
            }

            // Basic validation for name
            if (!emojiName || emojiName.length < 2 || emojiName.length > 32 || !/^[a-zA-Z0-9_]+$/.test(emojiName)) {
                return interaction.editReply('❌ Emoji name must be between 2 and 32 alphanumeric characters or underscores, and cannot contain spaces or special characters.');
            }

            try {
                const newEmoji = await guild.emojis.create({
                    attachment: imageUrl,
                    name: emojiName
                });
                await interaction.editReply(`✅ Successfully added emoji: ${newEmoji} (\`${newEmoji.name}\`)`);
            } catch (error) {
                console.error('Error adding emoji:', error);
                if (error.code === 50035) { // Invalid Form Body - likely invalid image
                    await interaction.editReply('❌ Failed to add emoji: Invalid image format or size. Please try a different image.');
                } else if (error.code === 30008) { // Max emojis reached
                    await interaction.editReply('❌ Failed to add emoji: This server has reached the maximum number of emojis.');
                } else {
                    await interaction.editReply(`❌ Failed to add emoji: ${error.message || 'An unknown error occurred.'}`);
                }
            }
        }

        // --- Delete Command Logic ---
        else if (subcommand === 'delete') {
            if (!(await checkPermissions(interaction, manageEmojisPerms, manageEmojisPerms))) return;

            await interaction.deferReply({ ephemeral: true });

            const emojiInput = interaction.options.getString('emoji');
            const targetEmoji = findEmoji(emojiInput);

            if (!targetEmoji) {
                return interaction.editReply('❌ Custom emoji not found in this server. Please provide its exact name or ID.');
            }

            try {
                await targetEmoji.delete();
                await interaction.editReply(`✅ Successfully deleted emoji: \`${targetEmoji.name}\``);
            } catch (error) {
                console.error('Error deleting emoji:', error);
                await interaction.editReply(`❌ Failed to delete emoji: ${error.message || 'An unknown error occurred.'}`);
            }
        }

        // --- Rename Command Logic ---
        else if (subcommand === 'rename') {
            if (!(await checkPermissions(interaction, manageEmojisPerms, manageEmojisPerms))) return;

            await interaction.deferReply({ ephemeral: true });

            const emojiInput = interaction.options.getString('emoji');
            const newName = interaction.options.getString('new_name');
            const targetEmoji = findEmoji(emojiInput);

            if (!targetEmoji) {
                return interaction.editReply('❌ Custom emoji not found in this server. Please provide its exact name or ID.');
            }

            // Basic validation for new name
            if (newName.length < 2 || newName.length > 32 || !/^[a-zA-Z0-9_]+$/.test(newName)) {
                return interaction.editReply('❌ New emoji name must be between 2 and 32 alphanumeric characters or underscores, and cannot contain spaces or special characters.');
            }

            try {
                const oldName = targetEmoji.name;
                const updatedEmoji = await targetEmoji.setName(newName);
                await interaction.editReply(`✅ Successfully renamed emoji \`${oldName}\` to ${updatedEmoji} (\`${updatedEmoji.name}\`)`);
            } catch (error) {
                console.error('Error renaming emoji:', error);
                await interaction.editReply(`❌ Failed to rename emoji: ${error.message || 'An unknown error occurred.'}`);
            }
        }

        // --- List Command Logic ---
        else if (subcommand === 'list') {
            if (!guild) {
                return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: false }); // Not ephemeral, so everyone can see the list

            const emojis = guild.emojis.cache.sort((a, b) => a.name.localeCompare(b.name));

            if (emojis.size === 0) {
                return interaction.editReply('This server has no custom emojis.');
            }

            let emojiList = [];
            emojis.forEach(emoji => {
                emojiList.push(`${emoji} \`:${emoji.name}:\` (ID: \`${emoji.id}\`)`);
            });

            // Handle potential message length limits
            const maxChunks = 5; // Max embeds to send for very large lists
            const chunkSize = 10; // Number of emojis per embed field/chunk
            const embedLimit = 1024; // Discord embed field value limit

            let currentList = [];
            let currentLength = 0;
            let embeds = [];

            for (const emojiStr of emojiList) {
                if (currentLength + emojiStr.length + 1 > embedLimit || currentList.length >= chunkSize) {
                    embeds.push(new EmbedBuilder()
                        .setColor(0x3498DB)
                        .setTitle(`Custom Emojis in ${guild.name}`)
                        .setDescription(currentList.join('\n'))
                        .setFooter({ text: `Page ${embeds.length + 1}` }));
                    currentList = [];
                    currentLength = 0;
                }
                currentList.push(emojiStr);
                currentLength += emojiStr.length + 1;
            }
            if (currentList.length > 0) {
                embeds.push(new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle(`Custom Emojis in ${guild.name}`)
                    .setDescription(currentList.join('\n'))
                    .setFooter({ text: `Page ${embeds.length + 1}` }));
            }
            
            // Only send up to a certain number of embeds to prevent rate limits / spam
            if (embeds.length > maxChunks) {
                await interaction.editReply({ 
                    content: `This server has ${emojis.size} custom emojis. Showing the first ${maxChunks * chunkSize}:\n`, 
                    embeds: embeds.slice(0, maxChunks) 
                });
                await interaction.followUp({ content: 'There are too many emojis to list in one go. You can also view them in your server settings.', ephemeral: true });
            } else {
                await interaction.editReply({ embeds: embeds });
            }
        }
        // --- Image Command Logic ---
        else if (subcommand === 'image') {
            if (!interaction.guild) {
                return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
            }

            await interaction.deferReply();

            const emojiInput = interaction.options.getString('emoji');
            const targetEmoji = findEmoji(emojiInput);

            if (!targetEmoji) {
                return interaction.editReply('❌ Custom emoji not found in this server. Please provide its exact name, ID, or the full custom emoji string (e.g., `:myemoji:` or `<:myemoji:123456789>`).');
            }

            const emojiEmbed = new EmbedBuilder()
                .setColor(0x7289DA) // A Discord-ish color
                .setTitle(`Image for :${targetEmoji.name}:`)
                .setDescription(`**Name:** \`${targetEmoji.name}\`\n**ID:** \`${targetEmoji.id}\`\n**Animated:** \`${targetEmoji.animated ? 'Yes' : 'No'}\``)
                .setImage(targetEmoji.imageURL({ size: 1024, dynamic: true })) // Get high-res, dynamic for GIFs
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [emojiEmbed] });
        }
        // --- NEW Info Command Logic ---
        else if (subcommand === 'info') {
            if (!interaction.guild) {
                return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
            }

            await interaction.deferReply();

            const emojiInput = interaction.options.getString('emoji');
            const targetEmoji = findEmoji(emojiInput);

            if (!targetEmoji) {
                return interaction.editReply('❌ Custom emoji not found in this server. Please provide its exact name, ID, or the full custom emoji string (e.g., `:myemoji:` or `<:myemoji:123456789>`).');
            }

            // Format creation date
            const createdAt = targetEmoji.createdAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short'
            });

            const emojiInfoEmbed = new EmbedBuilder()
                .setColor(0xADD8E6) // Light blue color
                .setTitle(`Emoji Info: :${targetEmoji.name}:`)
                .setThumbnail(targetEmoji.imageURL({ dynamic: true, size: 256 })) // Show emoji as thumbnail
                .addFields(
                    { name: '🏷️ Name', value: `\`${targetEmoji.name}\``, inline: true },
                    { name: '🆔 ID', value: `\`${targetEmoji.id}\``, inline: true },
                    { name: '🔗 Mention', value: `\`<${targetEmoji.animated ? 'a' : ''}:${targetEmoji.name}:${targetEmoji.id}>\``, inline: true },
                    { name: '🔄 Animated', value: `\`${targetEmoji.animated ? 'Yes' : 'No'}\``, inline: true },
                    { name: '🏠 Guild', value: `\`${targetEmoji.guild.name}\` (ID: \`${targetEmoji.guild.id}\`)`, inline: true },
                    { name: '⏰ Created At', value: `\`${createdAt}\``, inline: true },
                    { name: '🌐 Image URL', value: `[Click Here](${targetEmoji.imageURL({ dynamic: true, size: 1024 })})`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [emojiInfoEmbed] });
        }
    },
};