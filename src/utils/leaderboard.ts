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
        liarsbar: GameStats;
        donkey: GameStats;
        match: GameStats;
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
                ttt: { wins: 0, losses: 0, draws: 0 },
                liarsbar: { wins: 0, losses: 0, draws: 0 },
                donkey: { wins: 0, losses: 0, draws: 0 },
                match: { wins: 0, losses: 0, draws: 0 }
            }
        };
    } else {
        // ...
        // Backfill details
        if (!stats[user.id].details) {
            stats[user.id].details = {
                uno: { wins: 0, losses: 0, draws: 0 },
                connect4: { wins: 0, losses: 0, draws: 0 },
                ttt: { wins: 0, losses: 0, draws: 0 },
                liarsbar: { wins: 0, losses: 0, draws: 0 },
                donkey: { wins: 0, losses: 0, draws: 0 },
                match: { wins: 0, losses: 0, draws: 0 }
            };
        } else {
            if (!stats[user.id].details.uno) stats[user.id].details.uno = { wins: 0, losses: 0, draws: 0 };
            if (!stats[user.id].details.connect4) stats[user.id].details.connect4 = { wins: 0, losses: 0, draws: 0 };
            if (!stats[user.id].details.ttt) stats[user.id].details.ttt = { wins: 0, losses: 0, draws: 0 };
            if (!stats[user.id].details.liarsbar) stats[user.id].details.liarsbar = { wins: 0, losses: 0, draws: 0 };
            if (!stats[user.id].details.donkey) stats[user.id].details.donkey = { wins: 0, losses: 0, draws: 0 };
            if (!stats[user.id].details.match) stats[user.id].details.match = { wins: 0, losses: 0, draws: 0 };
        }
    }
}

// Record Result
export function recordGameResult(winner: User | null, player1: User, player2: User, gameType: 'uno' | 'connect4' | 'ttt' | 'liarsbar') {
    const stats = loadStats();

    initPlayer(stats, player1);
    initPlayer(stats, player2);

    stats[player1.id].games += 1;
    stats[player2.id].games += 1;

    if (winner) {
        initPlayer(stats, winner);
        stats[winner.id].wins += 1;
        stats[winner.id].details[gameType].wins += 1;
        // Points: +10 for Win
        stats[winner.id].points += 10;

        const loser = winner.id === player1.id ? player2 : player1;
        stats[loser.id].losses += 1;
        stats[loser.id].details[gameType].losses += 1;
        // Points: -5 for Lose
        stats[loser.id].points -= 5;
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
    stats[winner.id].points += 10;

    // Losers (everyone else)
    players.forEach(p => {
        if (p.id !== winner.id) {
            stats[p.id].losses += 1;
            stats[p.id].details[gameType].losses += 1;
            stats[p.id].points -= 5;
        }
    });

    saveStats(stats);
}

export function recordRankedGameResult(winners: User[], losers: User[], gameType: 'liarsbar' | 'donkey' | 'match') {
    const stats = loadStats();

    // Process Winners
    winners.forEach(w => {
        initPlayer(stats, w);
        stats[w.id].games += 1;
        stats[w.id].wins += 1;
        stats[w.id].details[gameType].wins += 1;
        stats[w.id].points += 10;
    });

    // Process Losers
    losers.forEach(l => {
        initPlayer(stats, l);
        stats[l.id].games += 1;
        stats[l.id].losses += 1;
        stats[l.id].details[gameType].losses += 1;
        stats[l.id].points -= 5;
    });

    saveStats(stats);
}

// Generic Add Points
export function addPoints(user: User, points: number) {
    const stats = loadStats();
    initPlayer(stats, user);
    stats[user.id].points += points;
    saveStats(stats);
}

// Generate ASCII Table
function generateTable(stats: Record<string, PlayerStats>): string {
    const players = Object.values(stats)
        .sort((a, b) => (b.points || 0) - (a.points || 0) || b.wins - a.wins) // Sort by Points DESC
        .slice(0, 10);

    // Column Widths (Content + Padding):
    // #        : 2 (Content) + 2 (Pad) = 4
    // Player   : 14 (Content) + 2 (Pad) = 16
    // Points   : 6 (Content) + 2 (Pad) = 8
    // W/L      : 8 (Content) + 2 (Pad) = 10 (Allows "999 / 99" = 8 chars)
    // Total    : 10 (Content) + 2 (Pad) = 12

    // Header: 
    // #  (4)
    // Player         (14)
    //  Points (6)
    //  TTT (8) | C4 (8) | UNO (8) | LB (8) | DK (8) | MT (8) | Total (10)
    // Total len: 4+14+6+8*6+10 + borders ~ 90. OK.

    let table = "┌────┬────────────────┬────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┐\n";
    table += "│ #  │ Player         │ Points │ TTT W/L  │  C4 W/L  │ UNO W/L  │  LB W/L  │  DK W/L  │  MT W/L  │ Total Games│\n";
    table += "├────┼────────────────┼────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼────────────┤\n";

    players.forEach((p, index) => {
        const rank = (index + 1).toString().padEnd(2);

        // Player: Max 14 chars.
        let name = p.username.length > 14 ? p.username.substring(0, 14) : p.username;
        const paddedName = name.padEnd(14);

        const points = (p.points || 0).toString().padEnd(6);

        const tttWins = p.details?.ttt?.wins || 0;
        const tttLosses = p.details?.ttt?.losses || 0;
        const ttt = `${tttWins} / ${tttLosses}`.padEnd(8);

        const c4Wins = p.details?.connect4?.wins || 0;
        const c4Losses = p.details?.connect4?.losses || 0;
        const c4 = `${c4Wins} / ${c4Losses}`.padEnd(8);

        const unoWins = p.details?.uno?.wins || 0;
        const unoLosses = p.details?.uno?.losses || 0;
        const uno = `${unoWins} / ${unoLosses}`.padEnd(8);

        const lbWins = p.details?.liarsbar?.wins || 0;
        const lbLosses = p.details?.liarsbar?.losses || 0;
        const lb = `${lbWins} / ${lbLosses}`.padEnd(8);

        const dkWins = p.details?.donkey?.wins || 0;
        const dkLosses = p.details?.donkey?.losses || 0;
        const dk = `${dkWins} / ${dkLosses}`.padEnd(8);

        const mtWins = p.details?.match?.wins || 0;
        const mtLosses = p.details?.match?.losses || 0;
        const mt = `${mtWins} / ${mtLosses}`.padEnd(8);

        const total = p.games.toString().padEnd(10);

        table += `│ ${rank} │ ${paddedName} │ ${points} │ ${ttt} │ ${c4} │ ${uno} │ ${lb} │ ${dk} │ ${mt} │ ${total} │\n`;
    });

    table += "└────┴────────────────┴────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴────────────┘";
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

    const content = `**🏆 Global Leaderboard**\n${table}`;

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
