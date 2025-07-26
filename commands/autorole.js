const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Determine the path to autorole.json relative to this command file
const AUTOROLE_FILE = path.join(__dirname, '../autorole.json');

// --- Helper Functions for AutoRole Data Management ---

/**
 * Reads the autorole configuration from autorole.json.
 * Initializes the file if it doesn't exist or is malformed.
 * @returns {object} The autorole configuration object.
 */
function readAutoroleConfig() {
    try {
        const data = fs.readFileSync(AUTOROLE_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        // Ensure 'guilds' property exists and is an object
        return typeof parsedData.guilds === 'object' && parsedData.guilds !== null ? parsedData : { guilds: {} };
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            // File not found or invalid JSON, create/reset it
            const defaultConfig = { guilds: {} };
            fs.writeFileSync(AUTOROLE_FILE, JSON.stringify(defaultConfig, null, 4), 'utf8');
            return defaultConfig;
        }
        console.error('Error reading autorole.json:', error);
        return { guilds: {} }; // Return empty state on critical error
    }
}

/**
 * Writes the given autorole configuration object to autorole.json.
 * @param {object} config The autorole configuration object to write.
 */
function writeAutoroleConfig(config) {
    try {
        fs.writeFileSync(AUTOROLE_FILE, JSON.stringify(config, null, 4), 'utf8');
    } catch (error) {
        console.error('Error writing autorole.json:', error);
    }
}

/**
 * Gets the current auto-role settings for a specific guild.
 * Initializes guild settings if they don't exist.
 * @param {object} config The overall autorole configuration.
 * @param {string} guildId The ID of the guild.
 * @returns {object} The guild's auto-role settings.
 */
function getGuildSettings(config, guildId) {
    if (!config.guilds[guildId]) {
        config.guilds[guildId] = { humans: [], bots: [] };
    }
    return config.guilds[guildId];
}

/**
 * Validates if the bot has necessary permissions to manage roles.
 * @param {GuildMember} botMember The bot's GuildMember object.
 * @returns {boolean} True if the bot has MANAGE_ROLES, false otherwise.
 */
function botHasPermissions(botMember) {
    return botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
}

// --- Command Definition ---
module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Manages automatic role assignments for new members.')
        .setDMPermission(false) // This command is guild-specific
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles) // Only users with Manage Roles can use this command

        // Subcommand Group: Bots
        .addSubcommandGroup(group =>
            group
                .setName('bots')
                .setDescription('Manage auto-roles for new bots.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Add a role to be automatically given to new bots.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('The role to add for new bots.')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a role from being automatically given to new bots.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('The role to remove for new bots.')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List all roles automatically given to new bots.')))

        // Subcommand Group: Humans
        .addSubcommandGroup(group =>
            group
                .setName('humans')
                .setDescription('Manage auto-roles for new human members.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Add a role to be automatically given to new human members.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('The role to add for new human members.')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a role from being automatically given to new human members.')
                        .addRoleOption(option =>
                            option
                                .setName('role')
                                .setDescription('The role to remove for new human members.')
                                .setRequired(true)))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List all roles automatically given to new human members.')))

        // Subcommand: reset-all
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-all')
                .setDescription('Resets all auto-role settings (for bots and humans) for this server.'))

        // Subcommand: reset-bots
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-bots')
                .setDescription('Resets all auto-role settings for new bots for this server.'))

        // Subcommand: reset-humans
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-humans')
                .setDescription('Resets all auto-role settings for new human members for this server.')),

    // --- Command Execution Logic ---
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); // Defer to show "Bot is thinking..."

        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        let config = readAutoroleConfig();
        let guildSettings = getGuildSettings(config, guildId);

        // Check bot's permissions upfront for role management actions
        const botMember = interaction.guild.members.me;
        if (!botHasPermissions(botMember)) {
            return interaction.editReply({
                content: '❌ I do not have the **"Manage Roles"** permission in this server. Please grant it to me to use auto-roles.',
                ephemeral: true
            });
        }

        const type = subcommandGroup; // 'bots' or 'humans'

        if (type && ['bots', 'humans'].includes(type)) {
            const rolesArray = guildSettings[type]; // Reference to either humans[] or bots[]

            switch (subcommand) {
                case 'add': {
                    const role = interaction.options.getRole('role');

                    // Check bot's role hierarchy
                    if (role.position >= botMember.roles.highest.position) {
                        return interaction.editReply({
                            content: `❌ I cannot assign the role \`${role.name}\` because it is higher than or equal to my highest role. Please ensure my role is above the role you want me to assign.`,
                            ephemeral: true
                        });
                    }

                    if (rolesArray.includes(role.id)) {
                        return interaction.editReply(`\`${role.name}\` is already set for new ${type}.`);
                    }

                    rolesArray.push(role.id);
                    writeAutoroleConfig(config);
                    return interaction.editReply(`✅ Added \`${role.name}\` to auto-assign for new ${type}.`);
                }
                case 'remove': {
                    const role = interaction.options.getRole('role');
                    const index = rolesArray.indexOf(role.id);

                    if (index === -1) {
                        return interaction.editReply(`\`${role.name}\` is not currently set for new ${type}.`);
                    }

                    rolesArray.splice(index, 1);
                    writeAutoroleConfig(config);
                    return interaction.editReply(`✅ Removed \`${role.name}\` from auto-assign for new ${type}.`);
                }
                case 'list': {
                    let description = '';
                    if (rolesArray.length === 0) {
                        description = `No auto-roles configured for new ${type} in this server.`;
                    } else {
                        // Attempt to resolve role names
                        const roleNames = rolesArray.map(roleId => {
                            const role = interaction.guild.roles.cache.get(roleId);
                            return role ? `\`${role.name}\`` : `<@&${roleId}> (Deleted Role)`;
                        });
                        description = `Auto-roles for new ${type}:\n` + roleNames.join('\n');
                    }

                    const embed = new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle(`Auto-Roles for New ${type.charAt(0).toUpperCase() + type.slice(1)}`)
                        .setDescription(description)
                        .setTimestamp();

                    return interaction.editReply({ embeds: [embed] });
                }
            }
        } else { // Reset commands
            switch (subcommand) {
                case 'reset-all': {
                    guildSettings.humans = [];
                    guildSettings.bots = [];
                    writeAutoroleConfig(config);
                    return interaction.editReply('✅ All auto-role settings for this server have been reset.');
                }
                case 'reset-bots': {
                    guildSettings.bots = [];
                    writeAutoroleConfig(config);
                    return interaction.editReply('✅ Auto-role settings for new bots in this server have been reset.');
                }
                case 'reset-humans': {
                    guildSettings.humans = [];
                    writeAutoroleConfig(config);
                    return interaction.editReply('✅ Auto-role settings for new human members in this server have been reset.');
                }
            }
        }
    },
};