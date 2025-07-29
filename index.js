
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
		GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.Reaction, Partials.User], // Important for GuildMemberAdd event and full member objects
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

// Event handlers
client.once('ready', async () => {
    const readyEvent = require('./events/botstatus.js');
    readyEvent.execute(client);

    console.log(`Logged in as ${client.user.tag}!`);

    // Register slash commands
    try {
        console.log('Started refreshing application (/) commands.');

        const commands = [];
        for (const command of client.commands.values()) {
            commands.push(command.data.toJSON());
        }

        const rest = new REST().setToken(token);

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands globally.');
    } catch (error) {
        console.error('Error refreshing commands:', error);
    }
});

client.on('guildCreate', async guild => {
    const guildCreateEvent = require('./events/guildCreate.js');
    guildCreateEvent.execute(guild);
});

client.on('guildDelete', async guild => {
    const guildDeleteEvent = require('./events/guildDelete.js');
    guildDeleteEvent.execute(guild);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

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

// Reaction Role Handler
client.on(Events.MessageReactionAdd, async (reaction, user) => {
	if (user.bot) return;

	// Handle partial reactions
	if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch (error) {
			console.error('Something went wrong when fetching the reaction:', error);
			return;
		}
	}

	const fs = require('fs');
	const path = require('path');
	const reactionRolesPath = path.join(__dirname, 'reactionroles.json');

	try {
		if (!fs.existsSync(reactionRolesPath)) return;

		const data = fs.readFileSync(reactionRolesPath, 'utf8');
		const config = JSON.parse(data);
		const guildId = reaction.message.guild.id;
		const messageId = reaction.message.id;

		if (!config[guildId] || !config[guildId][messageId]) return;

		const emojiKey = reaction.emoji.id || reaction.emoji.name;
		const reactionData = config[guildId][messageId].reactions[emojiKey];

		if (!reactionData) return;

		const guild = reaction.message.guild;
		const member = await guild.members.fetch(user.id);
		const role = guild.roles.cache.get(reactionData.roleId);

		if (!role) return;

		if (!member.roles.cache.has(role.id)) {
			await member.roles.add(role, 'Reaction role added');
		}
	} catch (error) {
		console.error('Error handling reaction add:', error);
	}
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
	if (user.bot) return;

	// Handle partial reactions
	if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch (error) {
			console.error('Something went wrong when fetching the reaction:', error);
			return;
		}
	}

	const fs = require('fs');
	const path = require('path');
	const reactionRolesPath = path.join(__dirname, 'reactionroles.json');

	try {
		if (!fs.existsSync(reactionRolesPath)) return;

		const data = fs.readFileSync(reactionRolesPath, 'utf8');
		const config = JSON.parse(data);
		const guildId = reaction.message.guild.id;
		const messageId = reaction.message.id;

		if (!config[guildId] || !config[guildId][messageId]) return;

		const emojiKey = reaction.emoji.id || reaction.emoji.name;
		const reactionData = config[guildId][messageId].reactions[emojiKey];

		if (!reactionData) return;

		const guild = reaction.message.guild;
		const member = await guild.members.fetch(user.id);
		const role = guild.roles.cache.get(reactionData.roleId);

		if (!role) return;

		if (member.roles.cache.has(role.id)) {
			await member.roles.remove(role, 'Reaction role removed');
		}
	} catch (error) {
		console.error('Error handling reaction remove:', error);
	}
});

// Consolidated messageCreate handler
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    try {
        // Handle AFK system
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

        // Handle stick command
        const stickCommand = client.commands.get('stick');
        if (stickCommand && stickCommand.handleMessage) {
            await stickCommand.handleMessage(message);
        }

        // Handle automod command
        const automodCommand = client.commands.get('automod');
        if (automodCommand && automodCommand.handleMessage) {
            await automodCommand.handleMessage(message);
        }
    } catch (error) {
        console.error('Error in messageCreate event:', error);
    }
});

// Consolidated guildMemberAdd handler
client.on('guildMemberAdd', async (member) => {
    try {
        // Handle welcome system
        const welcomeCommand = client.commands.get('welcome');
        if (welcomeCommand && welcomeCommand.handleMemberJoin) {
            await welcomeCommand.handleMemberJoin(member);
        }

        // Handle automod system
        const automodCommand = client.commands.get('automod');
        if (automodCommand && automodCommand.handleMemberAdd) {
            await automodCommand.handleMemberAdd(member);
        }
    } catch (error) {
        console.error('Error in guildMemberAdd event:', error);
    }
});

// Log in to Discord with your client's token
client.login(token);
