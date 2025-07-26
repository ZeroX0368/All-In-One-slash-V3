const { Client, Collection, GatewayIntentBits, REST, Routes, Partials, Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

// --- Define Paths for JSON Files ---
// These are needed here for event handlers that read/write data
const AFK_FILE = path.join(__dirname, 'afk.json');
const AUTOROLE_FILE = path.join(__dirname, 'autorole.json');

// --- Helper Functions (Duplicated for event handlers' self-containment) ---
// Ideally, move these to a 'utils' folder and import, but for simplicity, they're here.

// AFK Helper Functions
function readAfkDataForEvent() {
    try {
        const data = fs.readFileSync(AFK_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        return Array.isArray(parsedData.users) ? parsedData : { users: [] };
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            const defaultAfk = { users: [] };
            fs.writeFileSync(AFK_FILE, JSON.stringify(defaultAfk, null, 4), 'utf8');
            return defaultAfk;
        }
        console.error('Error reading afk.json in event handler:', error);
        return { users: [] };
    }
}

function writeAfkDataForEvent(data) {
    try {
        fs.writeFileSync(AFK_FILE, JSON.stringify(data, null, 4), 'utf8');
    } catch (error) {
        console.error('Error writing afk.json in event handler:', error);
    }
}

function formatDurationForEvent(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours % 24 > 0 || (days === 0 && hours > 0)) parts.push(`${hours % 24} hour${hours % 24 !== 1 ? 's' : ''}`);
    if (minutes % 60 > 0 || (hours === 0 && minutes > 0 && days === 0)) parts.push(`${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}`);

    if (parts.length === 0) parts.push(`less than a minute`);

    return parts.join(', ');
}

// AutoRole Helper Functions
function readAutoroleConfigForEvent() {
    try {
        const data = fs.readFileSync(AUTOROLE_FILE, 'utf8');
        const parsedData = JSON.parse(data);
        return typeof parsedData.guilds === 'object' && parsedData.guilds !== null ? parsedData : { guilds: {} };
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
            const defaultConfig = { guilds: {} };
            fs.writeFileSync(AUTOROLE_FILE, JSON.stringify(defaultConfig, null, 4), 'utf8');
            return defaultConfig;
        }
        console.error('Error reading autorole.json in event handler:', error);
        return { guilds: {} };
    }
}

function getGuildSettingsForEvent(config, guildId) {
    return config.guilds[guildId] || null;
}

function botHasPermissionsForEvent(botMember) {
    return botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
}

// --- Create a new client instance with all necessary intents ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // General guild events (e.g., bot joining, guild details)
        GatewayIntentBits.GuildMessages,    // Receiving messages
        GatewayIntentBits.MessageContent,   // Accessing message content (for AFK mentions and auto-return)
        GatewayIntentBits.GuildMembers,     // For GuildMemberAdd event (autorole) and fetching member info (user info command)
        GatewayIntentBits.GuildPresences,   // For user presence status (user info command)
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember], // Important for GuildMemberAdd event and full member objects
});

// Create a collection to store your commands
client.commands = new Collection();

// Array to hold command data for deployment
const commandsForDeployment = [];

// Load commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsForDeployment.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// --- NEW: Load event handlers from the events directory ---
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`[INFO] Loaded event: ${event.name} from ${filePath}`);
}
// --- END NEW EVENT LOADING ---

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // --- Command Deployment Logic ---
    const rest = new REST().setToken(token);

    try {
        console.log(`Started refreshing ${commandsForDeployment.length} application (/) commands.`);

        // Deploy GLOBAL commands (recommended for most bots)
        const data = await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commandsForDeployment },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
});

// --- Listen for interactions (this is where slash commands and button interactions are handled) ---
client.on(Events.InteractionCreate, async interaction => {
    // Handle modal submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'giveaway_setup') {
            const giveawayCommand = client.commands.get('giveaway');
            if (giveawayCommand) {
                await giveawayCommand.handleModalSubmit(interaction);
            }
        }
        return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('serverlist_')) {
            const botCommand = client.commands.get('bot');
            if (botCommand) {
                await botCommand.handleServerListButtons(interaction);
            }
        }
        if (interaction.customId === 'giveaway_enter') {
            const giveawayCommand = client.commands.get('giveaway');
            if (giveawayCommand) {
                await giveawayCommand.handleGiveawayButton(interaction);
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    // --- DM Check: Added this block ---
    if (!interaction.guildId) { // interaction.guildId is null if the command is used in a DM
        return interaction.reply({ content: '❌ Cannot use this command in Direct Messages. Please use it in a server.', ephemeral: true });
    }
    // --- End DM Check ---

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

// --- Listen for message creation (for AFK auto-return and mentions) ---
client.on(Events.MessageCreate, async message => {
    // Ignore messages from bots to prevent loops, and DMs
    if (message.author.bot || !message.guild) return; 

    let afkData = readAfkDataForEvent();

    // 1. Check if the message author is currently AFK (for automatic return)
    const authorAfkIndex = afkData.users.findIndex(u => u.id === message.author.id);
    if (authorAfkIndex !== -1) {
        const afkEntry = afkData.users[authorAfkIndex];
        const duration = formatDurationForEvent(Date.now() - new Date(afkEntry.timestamp).getTime());

        afkData.users.splice(authorAfkIndex, 1);
        writeAfkDataForEvent(afkData);

        try {
            await message.channel.send(`👋 Welcome back, ${message.author}! You were AFK for ${duration}.`);
        } catch (error) {
            console.error(`Error sending AFK return message in guild ${message.guild?.name}:`, error);
        }
    }

    // 2. Check if any mentioned users are AFK
    for (const mentionedUser of message.mentions.users.values()) {
        if (mentionedUser.bot) continue;

        const mentionedAfkEntry = afkData.users.find(u => u.id === mentionedUser.id);
        if (mentionedAfkEntry) {
            const duration = formatDurationForEvent(Date.now() - new Date(mentionedAfkEntry.timestamp).getTime());
            try {
                await message.reply({
                    content: `\`${mentionedUser.tag}\` is currently AFK: \`${mentionedAfkEntry.reason}\` (AFK for ${duration})`,
                    ephemeral: true
                });
            } catch (error) {
                console.error(`Error sending AFK mention reply in guild ${message.guild?.name}:`, error);
            }
        }
    }
});

// --- Listen for new guild members (for Autorole) ---
client.on(Events.GuildMemberAdd, async member => {
    if (!member.guild || member.user.id === client.user.id) return;

    let config = readAutoroleConfigForEvent();
    const guildSettings = getGuildSettingsForEvent(config, member.guild.id);

    if (!guildSettings || (guildSettings.humans.length === 0 && guildSettings.bots.length === 0)) {
        return;
    }

    const rolesToAssign = [];
    if (member.user.bot) {
        rolesToAssign.push(...guildSettings.bots);
    } else {
        rolesToAssign.push(...guildSettings.humans);
    }

    const assignableRoles = rolesToAssign.filter(roleId => member.guild.roles.cache.has(roleId));

    if (assignableRoles.length === 0) {
        return;
    }

    const botMember = member.guild.members.me;
    if (!botHasPermissionsForEvent(botMember)) {
        console.warn(`[AutoRole] Bot lacks "Manage Roles" permission in guild "${member.guild.name}" (${member.guild.id}). Cannot assign roles.`);
        return;
    }

    try {
        const validRolesForAssignment = assignableRoles.filter(roleId => {
            const role = member.guild.roles.cache.get(roleId);
            return role && role.position < botMember.roles.highest.position;
        });

        if (validRolesForAssignment.length > 0) {
            await member.roles.add(validRolesForAssignment, 'Auto-role assignment for new member.');
            console.log(`[AutoRole] Assigned roles to ${member.user.tag} (${member.id}) in ${member.guild.name}. Roles: ${validRolesForAssignment.join(', ')}`);
        } else {
            console.log(`[AutoRole] No assignable roles for ${member.user.tag} in ${member.guild.name} (roles might be too high or invalid).`);
        }
    } catch (error) {
        console.error(`[AutoRole] Failed to assign roles to ${member.user.tag} (${member.id}) in ${member.guild.name}:`, error);
    }
});

client.on('messageCreate', async message => {
    try {
        const stickCommand = client.commands.get('stick');
        if (stickCommand) {
            await stickCommand.handleMessage(message);
        }

        const automodCommand = client.commands.get('automod');
        if (automodCommand) {
            await automodCommand.handleMessage(message);
        }
    } catch (error) {
        console.error('Error in messageCreate event:', error);
    }
});

// Handle new member joins
client.on('guildMemberAdd', async (member) => {
    const welcomeCommand = client.commands.get('welcome');
    if (welcomeCommand && welcomeCommand.handleMemberJoin) {
        await welcomeCommand.handleMemberJoin(member);
    }

    const automodCommand = client.commands.get('automod');
    if (automodCommand && automodCommand.handleMemberAdd) {
        await automodCommand.handleMemberAdd(member);
    }
});

// Log in to Discord with your client's token
client.login(token);

// Handle AFK system
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const afkData = readAfkDataForEvent();
    const afkUserId = message.author.id;

    // Check if user is AFK and remove them
    const userIndex = afkData.users.findIndex(user => user.userId === afkUserId);
    if (userIndex !== -1) {
        afkData.users.splice(userIndex, 1);
        writeAfkDataForEvent(afkData);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setDescription(`Welcome back ${message.author}! I removed your AFK status.`);

        const reply = await message.reply({ embeds: [embed] });
        setTimeout(() => reply.delete().catch(() => {}), 5000);
    }

    // Check for AFK mentions
    message.mentions.users.forEach(mentionedUser => {
        if (mentionedUser.bot) return;

        const afkUser = afkData.users.find(user => user.userId === mentionedUser.id);
        if (afkUser) {
            const embed = new EmbedBuilder()
                .setColor(0xFFFF00)
                .setDescription(`${mentionedUser.username} is currently AFK: ${afkUser.reason}`)
                .setTimestamp(new Date(afkUser.timestamp));

            message.reply({ embeds: [embed] });
        }
    });
});