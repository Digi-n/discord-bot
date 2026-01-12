"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const discord_js_1 = require("discord.js");
const http_1 = __importDefault(require("http"));
const config_1 = require("./config");
const scheduler_1 = require("./scheduler");
const ticTacToe = __importStar(require("./commands/ticTacToe"));
const leaderboardCommand = __importStar(require("./commands/leaderboardCommand"));
const connect4 = __importStar(require("./commands/connect4"));
const uno = __importStar(require("./commands/uno"));
const setupStatus = __importStar(require("./commands/setupStatus"));
const liarsbar = __importStar(require("./commands/liarsbar"));
const leaderboard_1 = require("./utils/leaderboard");
const uno_1 = require("./games/uno");
const liarsbar_1 = require("./games/liarsbar");
const statusConfig_1 = require("./features/status/statusConfig");
const StatusRenderer_1 = require("./features/status/StatusRenderer");
const discord_js_2 = require("discord.js");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent
    ]
});
client.once(discord_js_1.Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    (0, scheduler_1.initScheduler)(client);
    // Register Commands
    try {
        console.log('Started refreshing application (/) commands.');
        const commands = [
            ticTacToe.data.toJSON(),
            leaderboardCommand.data.toJSON(),
            connect4.data.toJSON(),
            uno.data.toJSON(),
            setupStatus.data.toJSON(),
            liarsbar.data.toJSON()
        ];
        if (config_1.CONFIG.GUILD_ID) {
            console.log(`Registering commands to Configured Guild ID: ${config_1.CONFIG.GUILD_ID}`);
            try {
                await client.application?.commands.set(commands, config_1.CONFIG.GUILD_ID);
            }
            catch (e) {
                console.error(`Failed to register to config guild: ${e}`);
            }
        }
        // Also register to all other joined guilds to be safe (for dev purposes)
        console.log(`Registering commands to ${client.guilds.cache.size} joined guilds...`);
        client.guilds.cache.forEach(async (guild) => {
            console.log(`Registering to ${guild.name} (${guild.id})...`);
            try {
                await guild.commands.set(commands);
            }
            catch (e) {
                console.error(`Failed to register commands in ${guild.name}:`, e);
            }
        });
        // Register global as fallback
        // await client.application?.commands.set(commands);
        console.log('Successfully requested command registration for all guilds.');
    }
    catch (error) {
        console.error(error);
    }
    // Start Leaderboard Update Loop (Every 60 seconds)
    (0, leaderboard_1.updateLeaderboardMessage)(client).catch(() => { }); // Ignore error if not initialized
    setInterval(() => {
        (0, leaderboard_1.updateLeaderboardMessage)(client).catch(console.error);
    }, 60000);
    // --- Status Dashboard Logic ---
    const pingHistory = [];
    const updateStatus = async () => {
        const config = (0, statusConfig_1.loadStatusConfig)();
        if (!config || !config.channelId) {
            console.log("⚠️ No Status Channel Configured.");
            return;
        }
        try {
            const channel = await client.channels.fetch(config.channelId);
            if (!channel) {
                console.error(`❌ Status channel ${config.channelId} not found.`);
                return;
            }
            let message;
            try {
                if (config.messageId) {
                    message = await channel.messages.fetch(config.messageId);
                }
            }
            catch (e) {
                console.log("⚠️ Status message not found, creating new one.");
            }
            // Update Ping History
            const ping = client.ws.ping;
            pingHistory.push(ping);
            if (pingHistory.length > 20)
                pingHistory.shift();
            // Gather Stats
            const activeGames = {
                uno: uno_1.getActiveGameCount ? (0, uno_1.getActiveGameCount)() : 0,
                c4: connect4.getActiveGameCount ? connect4.getActiveGameCount() : 0,
                ttt: ticTacToe.getActiveGameCount ? ticTacToe.getActiveGameCount() : 0
            };
            // Render
            const buffer = await (0, StatusRenderer_1.renderStatusImage)(ping, pingHistory, activeGames);
            const attachment = new discord_js_2.AttachmentBuilder(buffer, { name: 'status.png' });
            const payload = {
                content: `🖥️ **SYSTEM STATUS** (Updated: <t:${Math.floor(Date.now() / 1000)}:R>)`,
                files: [attachment]
            };
            if (message) {
                await message.edit(payload);
                // console.log("✅ Status dashboard updated.");
            }
            else {
                const newMessage = await channel.send(payload);
                (0, statusConfig_1.saveStatusConfig)({
                    channelId: config.channelId,
                    messageId: newMessage.id
                });
                console.log("✅ Status dashboard created.");
            }
        }
        catch (e) {
            console.error('❌ Failed to update status dashboard:', e);
        }
    };
    // Run immediately
    updateStatus();
    // Run every minute
    setInterval(updateStatus, 60000);
    // Keep Alive Ping (Every 14 Minutes)
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
        // console.log(`🔔 Sending Keep-Alive Ping to ${url}...`);
        http_1.default.get(url, (res) => {
            console.log(`✅ Keep-Alive Ping successful: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error(`❌ Keep-Alive Ping failed: ${err.message}`);
        });
    }, 14 * 60 * 1000);
});
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'ttt') {
            await ticTacToe.execute(interaction);
        }
        else if (interaction.commandName === 'leaderboard') {
            await leaderboardCommand.execute(interaction);
        }
        else if (interaction.commandName === 'connect4') {
            await connect4.execute(interaction);
        }
        else if (interaction.commandName === 'uno') {
            await uno.execute(interaction);
        }
        else if (interaction.commandName === 'setup-status') {
            await setupStatus.execute(interaction);
        }
        else if (interaction.commandName === 'liarsbar') {
            await liarsbar.execute(interaction);
        }
    }
    else if (interaction.isButton()) {
        if (interaction.customId.startsWith('ttt_')) {
            await ticTacToe.handleButton(interaction);
        }
        else if (interaction.customId.startsWith('c4_')) {
            await connect4.handleButton(interaction);
        }
        else if (interaction.customId.startsWith('uno_')) {
            await (0, uno_1.handleUnoInteraction)(interaction);
        }
        else if (interaction.customId.startsWith('lb_')) {
            await (0, liarsbar_1.handleLiarsBarInteraction)(interaction);
        }
    }
    else if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('lb_')) {
            await (0, liarsbar_1.handleLiarsBarInteraction)(interaction);
        }
    }
});
client.on(discord_js_1.Events.MessageCreate, async (message) => {
    if (message.author.bot)
        return;
    if (message.mentions.has(client.user) && !message.mentions.everyone) {
        await ticTacToe.startAgainstBot(message);
    }
});
if (!config_1.CONFIG.TOKEN) {
    throw new Error("❌ DISCORD_TOKEN is missing in .env file");
}
client.login(config_1.CONFIG.TOKEN);
const port = process.env.PORT || 3000;
http_1.default.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Bot is alive!');
    res.end();
}).listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
