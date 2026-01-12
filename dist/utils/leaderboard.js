"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.recordGameResult = recordGameResult;
exports.addPoints = addPoints;
exports.updateLeaderboardMessage = updateLeaderboardMessage;
exports.getTopPlayer = getTopPlayer;
exports.resetLeaderboard = resetLeaderboard;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(__dirname, '../data');
const HISTORY_DIR = path_1.default.join(DATA_DIR, 'history');
const STATS_FILE = path_1.default.join(DATA_DIR, 'ttt_stats.json');
const CONFIG_FILE = path_1.default.join(DATA_DIR, 'leaderboard_config.json');
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs_1.default.existsSync(HISTORY_DIR)) {
    fs_1.default.mkdirSync(HISTORY_DIR, { recursive: true });
}
// Load Stats
function loadStats() {
    if (!fs_1.default.existsSync(STATS_FILE))
        return {};
    return JSON.parse(fs_1.default.readFileSync(STATS_FILE, 'utf-8'));
}
// Save Stats
function saveStats(stats) {
    fs_1.default.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}
// Load Config
function loadConfig() {
    if (!fs_1.default.existsSync(CONFIG_FILE))
        return null;
    return JSON.parse(fs_1.default.readFileSync(CONFIG_FILE, 'utf-8'));
}
// Save Config
function saveConfig(config) {
    fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
// Helper to init player
function initPlayer(stats, user) {
    if (!stats[user.id]) {
        stats[user.id] = { username: user.username, wins: 0, losses: 0, games: 0, points: 0 };
    }
    else {
        // Update username
        stats[user.id].username = user.username;
        // Backfill
        if (stats[user.id].losses === undefined)
            stats[user.id].losses = 0;
        if (stats[user.id].points === undefined)
            stats[user.id].points = 0;
    }
}
// Record Result (Legacy TTT)
function recordGameResult(winner, player1, player2) {
    const stats = loadStats();
    initPlayer(stats, player1);
    initPlayer(stats, player2);
    stats[player1.id].games += 1;
    stats[player2.id].games += 1;
    if (winner) {
        initPlayer(stats, winner);
        stats[winner.id].wins += 1;
        // Legacy point system for TTT? Let's just give explicit points in addPoints. 
        // Or maybe 10 for win? User only specified UNO points. I'll leave TTT as is for now regarding points unless asked.
        const loser = winner.id === player1.id ? player2 : player1;
        stats[loser.id].losses += 1;
    }
    saveStats(stats);
}
// Generic Add Points
function addPoints(user, points) {
    const stats = loadStats();
    initPlayer(stats, user);
    stats[user.id].points += points;
    stats[user.id].games += 1; // Assume getting points implies playing a game
    saveStats(stats);
}
// Generate ASCII Table
function generateTable(stats) {
    const players = Object.values(stats)
        .sort((a, b) => (b.points || 0) - (a.points || 0) || b.wins - a.wins) // Sort by Points DESC
        .slice(0, 10);
    //     ┌────┬────────────────┬────────┬───────┐
    //     │ #  │ Player         │ Points │ Games │
    //     ├────┼────────────────┼────────┼───────┤
    let table = "┌────┬────────────────┬────────┬───────┐\n";
    table += "│ #  │ Player         │ Points │ Games │\n";
    table += "├────┼────────────────┼────────┼───────┤\n";
    players.forEach((p, index) => {
        const rank = (index + 1).toString().padEnd(2);
        let name = p.username.length > 14 ? p.username.substring(0, 11) + '...' : p.username;
        name = name.padEnd(14);
        const points = (p.points || 0).toString().padEnd(6);
        const games = p.games.toString().padEnd(5);
        table += `│ ${rank} │ ${name} │ ${points} │ ${games} │\n`;
    });
    table += "└────┴────────────────┴────────┴───────┘";
    return "```\n" + table + "\n```";
}
// Update Message
async function updateLeaderboardMessage(client) {
    const config = loadConfig();
    if (!config)
        return;
    const channel = await client.channels.fetch(config.channelId);
    if (!channel)
        return;
    const stats = loadStats();
    const table = generateTable(stats);
    const content = `**🏆 Leaderboard**\n${table}`;
    try {
        if (config.messageId) {
            const message = await channel.messages.fetch(config.messageId);
            if (message) {
                await message.edit(content);
                return;
            }
        }
    }
    catch (error) {
        console.log("Could not find leaderboard message, creating new one.");
    }
    // Create new if fetch failed
    const newMessage = await channel.send(content);
    saveConfig({ channelId: config.channelId, messageId: newMessage.id });
}
// --- NEW HELPER FUNCTIONS FOR RESET --- //
function getTopPlayer() {
    const stats = loadStats();
    const sorted = Object.entries(stats)
        .sort(([, a], [, b]) => b.wins - a.wins || a.games - b.games);
    if (sorted.length === 0)
        return null;
    return { id: sorted[0][0], stats: sorted[0][1] };
}
function resetLeaderboard() {
    const stats = loadStats();
    // Archive
    const date = new Date();
    const filename = `ttt_stats_${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}.json`;
    fs_1.default.writeFileSync(path_1.default.join(HISTORY_DIR, filename), JSON.stringify(stats, null, 2));
    // Clear
    saveStats({});
}
