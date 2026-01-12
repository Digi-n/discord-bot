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

interface GameStats {
    wins: number;
    losses: number;
    draws: number;
}

interface PlayerStats {
    username: string;
    wins: number;
    losses: number;
    games: number;
    points: number;
    details: {
        uno: GameStats;
        connect4: GameStats;
        ttt: GameStats;
    };
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
        stats[user.id] = {
            username: user.username,
            wins: 0,
            losses: 0,
            games: 0,
            points: 0,
            details: {
                uno: { wins: 0, losses: 0, draws: 0 },
                connect4: { wins: 0, losses: 0, draws: 0 },
                ttt: { wins: 0, losses: 0, draws: 0 }
            }
        };
    } else {
        // Update username
        stats[user.id].username = user.username;
        // Backfill main stats
        if (stats[user.id].losses === undefined) stats[user.id].losses = 0;
        if (stats[user.id].points === undefined) stats[user.id].points = 0;
        // Backfill details
        if (!stats[user.id].details) {
            stats[user.id].details = {
                uno: { wins: 0, losses: 0, draws: 0 },
                connect4: { wins: 0, losses: 0, draws: 0 },
                ttt: { wins: 0, losses: 0, draws: 0 }
            };
        } else {
            if (!stats[user.id].details.uno) stats[user.id].details.uno = { wins: 0, losses: 0, draws: 0 };
            if (!stats[user.id].details.connect4) stats[user.id].details.connect4 = { wins: 0, losses: 0, draws: 0 };
            if (!stats[user.id].details.ttt) stats[user.id].details.ttt = { wins: 0, losses: 0, draws: 0 };
        }
    }
}

// Record Result
export function recordGameResult(winner: User | null, player1: User, player2: User, gameType: 'uno' | 'connect4' | 'ttt') {
    const stats = loadStats();

    initPlayer(stats, player1);
    initPlayer(stats, player2);

    stats[player1.id].games += 1;
    stats[player2.id].games += 1;

    if (winner) {
        initPlayer(stats, winner);
        stats[winner.id].wins += 1;
        stats[winner.id].details[gameType].wins += 1;

        const loser = winner.id === player1.id ? player2 : player1;
        stats[loser.id].losses += 1;
        stats[loser.id].details[gameType].losses += 1;
    } else {
        // Draw
        stats[player1.id].details[gameType].draws += 1;
        stats[player2.id].details[gameType].draws += 1;
    }

    saveStats(stats);
}

export function recordMultiplayerGameResult(winner: User, players: User[], gameType: 'uno') {
    const stats = loadStats();

    players.forEach(p => {
        initPlayer(stats, p);
        stats[p.id].games += 1;
    });

    // Winner
    initPlayer(stats, winner);
    stats[winner.id].wins += 1;
    stats[winner.id].details[gameType].wins += 1;

    // Losers (everyone else)
    players.forEach(p => {
        if (p.id !== winner.id) {
            stats[p.id].losses += 1;
            stats[p.id].details[gameType].losses += 1;
        }
    });

    saveStats(stats);
}

// Generic Add Points
export function addPoints(user: User, points: number) {
    const stats = loadStats();
    initPlayer(stats, user);
    stats[user.id].points += points;
    // Note: We don't increment global games count here as it's usually done in recordGameResult,
    // but if addPoints is called separately for other reasons, we effectively consider it part of "activity".
    // For now, let's leave games count increment logic to game results mostly.
    // If this is strictly for Uno points, Uno game result also calls recordGameResult.
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

function generateGlobalStats(stats: Record<string, PlayerStats>): string {
    let uno = { wins: 0, losses: 0, draws: 0 }; // Losses track same as wins globally (1v1), but for total activity tracking:
    // Actually, "wins" + "losses" + "draws" across all players / 2 equals total games played roughly.
    // But user wants "Win and Lose for every game".
    // Displaying total wins recorded implies total games won.
    // I'll sum up all wins/losses recorded in details.

    let ttt = { wins: 0, losses: 0, draws: 0 };
    let c4 = { wins: 0, losses: 0, draws: 0 };

    Object.values(stats).forEach(p => {
        if (p.details) {
            if (p.details.uno) {
                uno.wins += p.details.uno.wins;
                uno.losses += p.details.uno.losses;
                uno.draws += p.details.uno.draws;
            }
            if (p.details.ttt) {
                ttt.wins += p.details.ttt.wins;
                ttt.losses += p.details.ttt.losses;
                ttt.draws += p.details.ttt.draws;
            }
            if (p.details.connect4) {
                c4.wins += p.details.connect4.wins;
                c4.losses += p.details.connect4.losses;
                c4.draws += p.details.connect4.draws;
            }
        }
    });

    // We can display total games played per category by dividing (wins+losses+draws)/2 roughly but straightforward sum is safer
    // Actually, just listing "Total Wins" or "Total Games" might be better.
    // User requested "Win and Lose".
    // "UNO: 10 Wins | 10 Losses" doesn't make sense globally (it's always equal for 1v1).
    // Maybe they meant "Your Personal Stats"? But Leaderboard usually shows global top 10.
    // "in leaderboard above heading there should be win and lose for every game"
    // I will assume they want GLOBAL TOTALS for the server activity.

    // Let's format it nicely.
    return `**Global Stats**\n` +
        `🃏 **UNO:** ${uno.wins} Wins | ${uno.draws} Draws\n` +
        `🔴 **Connect 4:** ${c4.wins} Wins | ${c4.draws} Draws\n` +
        `❌ **Tic-Tac-Toe:** ${ttt.wins} Wins | ${ttt.draws} Draws\n`;
}

// Update Message
export async function updateLeaderboardMessage(client: Client) {
    const config = loadConfig();
    if (!config) return;

    const channel = await client.channels.fetch(config.channelId) as TextChannel;
    if (!channel) return;

    const stats = loadStats();
    const table = generateTable(stats);
    const globalStats = generateGlobalStats(stats);

    const content = `**🏆 Leaderboard**\n\n${globalStats}\n${table}`;

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
