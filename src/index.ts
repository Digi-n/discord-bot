import 'dotenv/config';
import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import http from 'http';
import { CONFIG } from './config';
import { initScheduler } from './scheduler';
import * as ticTacToe from './commands/ticTacToe';
import * as leaderboardCommand from './commands/leaderboardCommand';
import * as connect4 from './commands/connect4';
import * as uno from './commands/uno';
import * as setupStatus from './commands/setupStatusCmd';
import * as liarsbar from './commands/liarsbar';
import * as match from './commands/match';
import * as donkey from './commands/donkeyCmd';
import { updateLeaderboardMessage } from './utils/leaderboard';
import { handleUnoInteraction, getActiveGameCount as getUnoActiveGameCount } from './games/uno';
import { handleLiarsBarInteraction } from './games/liarsbar';
import { handleInteraction as handleMatchInteraction } from './games/match/index';
import { handleInteraction as handleDonkeyInteraction } from './games/donkey/index';
import { loadStatusConfig, saveStatusConfig } from './features/status/statusConfig';
import { renderStatusImage } from './features/status/StatusRenderer';
import { AttachmentBuilder, TextChannel } from 'discord.js';


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    client.user?.setActivity('Kazhutha (Donkey) ♠️', { type: 0 }); // ActivityType.Playing = 0
    initScheduler(client);

    // Register Commands
    try {
        console.log('Started refreshing application (/) commands.');
        const commands = [
            ticTacToe.data.toJSON(),
            leaderboardCommand.data.toJSON(),
            connect4.data.toJSON(),
            uno.data.toJSON(),
            setupStatus.data.toJSON(),
            liarsbar.data.toJSON(),
            match.data.toJSON(),
            donkey.data.toJSON()
        ];

        if (CONFIG.GUILD_ID) {
            console.log(`Registering commands to Configured Guild ID: ${CONFIG.GUILD_ID}`);
            try {
                await client.application?.commands.set(commands, CONFIG.GUILD_ID);
            } catch (e) { console.error(`Failed to register to config guild: ${e}`); }
        }

        // Also register to all other joined guilds to be safe (for dev purposes)
        console.log(`Registering commands to ${client.guilds.cache.size} joined guilds...`);
        client.guilds.cache.forEach(async (guild) => {
            console.log(`Registering to ${guild.name} (${guild.id})...`);
            try {
                await guild.commands.set(commands);
            } catch (e) {
                console.error(`Failed to register commands in ${guild.name}:`, e);
            }
        });

        console.log('Successfully requested command registration for all guilds.');
    } catch (error) {
        console.error(error);
    }

    // Start Leaderboard Update Loop (Every 60 seconds)
    updateLeaderboardMessage(client).catch(() => { });

    setInterval(() => {
        updateLeaderboardMessage(client).catch(console.error);
    }, 60000);

    // --- Status Dashboard Logic ---
    const pingHistory: number[] = [];

    const updateStatus = async (isOffline: boolean = false) => {
        const config = loadStatusConfig();
        if (!config || !config.channelId) return;

        try {
            const channel = await client.channels.fetch(config.channelId) as TextChannel;
            if (!channel) return;

            let message;
            try {
                if (config.messageId) {
                    message = await channel.messages.fetch(config.messageId);
                }
            } catch (e) { }

            // Update Ping History
            const ping = client.ws.ping;
            pingHistory.push(ping);
            if (pingHistory.length > 20) pingHistory.shift();

            // Gather Stats
            const activeGames = {
                uno: getUnoActiveGameCount ? getUnoActiveGameCount() : 0,
                c4: connect4.getActiveGameCount ? connect4.getActiveGameCount() : 0,
                ttt: ticTacToe.getActiveGameCount ? ticTacToe.getActiveGameCount() : 0
            };

            // Render
            const buffer = await renderStatusImage(ping, pingHistory, activeGames, isOffline);
            const attachment = new AttachmentBuilder(buffer, { name: 'status.png' });
            const payload = {
                content: `🖥️ **SYSTEM STATUS** (Updated: <t:${Math.floor(Date.now() / 1000)}:R>)`,
                files: [attachment]
            };

            if (message) {
                await message.edit(payload);
            } else if (!isOffline) {
                const newMessage = await channel.send(payload);
                saveStatusConfig({
                    channelId: config.channelId,
                    messageId: newMessage.id
                });
            }
        } catch (e) {
            console.error('❌ Failed to update status dashboard:', e);
        }
    };

    updateStatus();
    const statusInterval = setInterval(() => updateStatus(false), 60000);

    // Graceful Shutdown Hook
    const shutdown = async () => {
        console.log("🛑 Shutting down...");
        clearInterval(statusInterval);
        await updateStatus(true);
        console.log("✅ Offline status set. Bye!");
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep Alive Ping (Every 14 Minutes)
    setInterval(() => {
        const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
        http.get(url, (res) => {
            console.log(`✅ Keep-Alive Ping successful: ${res.statusCode}`);
        }).on('error', (err) => {
            console.error(`❌ Keep-Alive Ping failed: ${err.message}`);
        });
    }, 14 * 60 * 1000);
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'ttt') {
            await ticTacToe.execute(interaction);
        } else if (interaction.commandName === 'leaderboard') {
            await leaderboardCommand.execute(interaction);
        } else if (interaction.commandName === 'connect4') {
            await connect4.execute(interaction);
        } else if (interaction.commandName === 'uno') {
            await uno.execute(interaction);
        } else if (interaction.commandName === 'setup-status') {
            await setupStatus.execute(interaction);
        } else if (interaction.commandName === 'liarsbar') {
            await liarsbar.execute(interaction);
        } else if (interaction.commandName === 'match') {
            await match.execute(interaction);
        } else if (interaction.commandName === 'donkey') {
            await donkey.execute(interaction);
        }
    } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('ttt_')) {
            await ticTacToe.handleButton(interaction);
        } else if (interaction.customId.startsWith('c4_')) {
            await connect4.handleButton(interaction);
        } else if (interaction.customId.startsWith('uno_')) {
            await handleUnoInteraction(interaction);
        } else if (interaction.customId.startsWith('lb_')) {
            await handleLiarsBarInteraction(interaction);
        } else if (interaction.customId.startsWith('lb_')) {
            await handleLiarsBarInteraction(interaction);
        } else if (interaction.customId.startsWith('donkey_')) {
            const donkeyHandled = await handleDonkeyInteraction(interaction);
            if (!donkeyHandled && !interaction.replied) {
                await interaction.reply({ content: '❌ No active game found.', flags: MessageFlags.Ephemeral });
            }
        } else if (interaction.customId.startsWith('match_')) {
            const matchHandled = await handleMatchInteraction(interaction);
            if (!matchHandled && !interaction.replied) {
                await interaction.reply({ content: '❌ No active game found.', flags: MessageFlags.Ephemeral });
            }
        }
    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('lb_')) {
            await handleLiarsBarInteraction(interaction);
        } else if (interaction.customId.startsWith('donkey_')) {
            const donkeyHandled = await handleDonkeyInteraction(interaction);
            if (!donkeyHandled && !interaction.replied) {
                await interaction.reply({ content: '❌ No active game found.', flags: MessageFlags.Ephemeral });
            }
        } else if (interaction.customId.startsWith('match_')) {
            const matchHandled = await handleMatchInteraction(interaction);
            if (!matchHandled && !interaction.replied) {
                await interaction.reply({ content: '❌ No active game found.', flags: MessageFlags.Ephemeral });
            }
        }
    }

});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    if (message.mentions.has(client.user!) && !message.mentions.everyone) {
        await ticTacToe.startAgainstBot(message);
    }
});


if (!CONFIG.TOKEN) {
    throw new Error("❌ DISCORD_TOKEN is missing in .env file");
}
client.login(CONFIG.TOKEN);

const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('Bot is alive!');
    res.end();
}).listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
