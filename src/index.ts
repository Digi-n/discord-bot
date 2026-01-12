import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import http from 'http';
import { CONFIG } from './config';
import { initScheduler } from './scheduler';
import * as ticTacToe from './commands/ticTacToe';
import * as leaderboardCommand from './commands/leaderboardCommand';
import * as connect4 from './commands/connect4';
import * as uno from './commands/uno';
import { updateLeaderboardMessage } from './utils/leaderboard';
import { handleUnoInteraction } from './games/uno';


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    initScheduler(client);

    // Register Commands
    try {
        console.log('Started refreshing application (/) commands.');
        await client.application?.commands.set([
            ticTacToe.data.toJSON(),
            leaderboardCommand.data.toJSON(),
            connect4.data.toJSON(),
            uno.data.toJSON()
        ]);
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }

    // Start Leaderboard Update Loop (Every 60 seconds)
    updateLeaderboardMessage(client).catch(() => { }); // Ignore error if not initialized

    setInterval(() => {
        updateLeaderboardMessage(client).catch(console.error);
    }, 60000);

    // Keep Alive Ping (Every 14 Minutes)
    setInterval(() => {
        console.log('🔔 Keep-Alive Ping: Bot is running...');
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
        }
    } else if (interaction.isButton()) {
        if (interaction.customId.startsWith('ttt_')) {
            await ticTacToe.handleButton(interaction);
        } else if (interaction.customId.startsWith('c4_')) {
            await connect4.handleButton(interaction);
        } else if (interaction.customId.startsWith('uno_')) {
            await handleUnoInteraction(interaction);
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
