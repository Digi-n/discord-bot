import fs from 'fs';
import path from 'path';
import { Client, TextChannel, User } from 'discord.js';

const DATA_DIR = path.join(__dirname, '../data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const STATS_FILE = path.join(DATA_DIR, 'ttt_stats.json');
const CONFIG_FILE = path.join(DATA_DIR, 'leaderboard_config.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

interface PlayerStats {
    username: string;
    wins: number;
    losses: number;
    games: number;
    points: number;
}

interface LeaderboardConfig {
    channelId: string;
    messageId: string;
}

// Load Stats
function loadStats(): Record<string, PlayerStats> {
    if (!fs.existsSync(STATS_FILE)) return {};
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
}

// Save Stats
function saveStats(stats: Record<string, PlayerStats>) {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

// Load Config
export function loadConfig(): LeaderboardConfig | null {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

// Save Config
export function saveConfig(config: LeaderboardConfig) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Helper to init player
function initPlayer(stats: Record<string, PlayerStats>, user: User) {
    if (!stats[user.id]) {
        stats[user.id] = { username: user.username, wins: 0, losses: 0, games: 0, points: 0 };
    } else {
        // Update username
        stats[user.id].username = user.username;
        // Backfill
        if (stats[user.id].losses === undefined) stats[user.id].losses = 0;
        if (stats[user.id].points === undefined) stats[user.id].points = 0;
    }
}

// Record Result (Legacy TTT)
export function recordGameResult(winner: User | null, player1: User, player2: User) {
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
export function addPoints(user: User, points: number) {
    const stats = loadStats();
    initPlayer(stats, user);
    stats[user.id].points += points;
    stats[user.id].games += 1; // Assume getting points implies playing a game
    saveStats(stats);
}

// Generate ASCII Table
function generateTable(stats: Record<string, PlayerStats>): string {
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
export async function updateLeaderboardMessage(client: Client) {
    const config = loadConfig();
    if (!config) return;

    const channel = await client.channels.fetch(config.channelId) as TextChannel;
    if (!channel) return;

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
    } catch (error) {
        console.log("Could not find leaderboard message, creating new one.");
    }

    // Create new if fetch failed
    const newMessage = await channel.send(content);
    saveConfig({ channelId: config.channelId, messageId: newMessage.id });
}

// --- NEW HELPER FUNCTIONS FOR RESET --- //

export function getTopPlayer(): { id: string, stats: PlayerStats } | null {
    const stats = loadStats();
    const sorted = Object.entries(stats)
        .sort(([, a], [, b]) => b.wins - a.wins || a.games - b.games);

    if (sorted.length === 0) return null;
    return { id: sorted[0][0], stats: sorted[0][1] };
}

export function resetLeaderboard() {
    const stats = loadStats();

    // Archive
    const date = new Date();
    const filename = `ttt_stats_${date.getFullYear()}_${(date.getMonth() + 1).toString().padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(HISTORY_DIR, filename), JSON.stringify(stats, null, 2));

    // Clear
    saveStats({});
}
