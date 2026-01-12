"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const leaderboard_1 = require("./utils/leaderboard");
const initScheduler = (client) => {
    const channelId = config_1.CONFIG.GENERAL_CHANNEL_ID;
    const sendMessage = async (message) => {
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel && channel instanceof discord_js_1.TextChannel) {
                await channel.send(message);
                console.log(`Sent scheduled message: ${message}`);
            }
            else {
                console.error(`Channel ${channelId} not found or not a TextChannel`);
            }
        }
        catch (error) {
            console.error('Error sending scheduled message:', error);
        }
    };
    // 9:00 AM
    node_cron_1.default.schedule('0 9 * * *', () => {
        sendMessage("Good Morning @everyone! ☀️");
    });
    // 1:00 PM (13:00)
    node_cron_1.default.schedule('0 13 * * *', () => {
        sendMessage("Good Afternoon @everyone! 🌤️");
    });
    // 10:00 PM (22:00)
    node_cron_1.default.schedule('0 22 * * *', () => {
        sendMessage("Good Night @everyone! 🌙");
    });
    // --- Monthly Leaderboard Reset ---
    // 00:00 on the 1st of every month
    node_cron_1.default.schedule('0 0 1 * *', async () => {
        console.log("⏰ Running Monthly Leaderboard Reset...");
        try {
            const winner = (0, leaderboard_1.getTopPlayer)();
            (0, leaderboard_1.resetLeaderboard)();
            await (0, leaderboard_1.updateLeaderboardMessage)(client);
            // Announce Winner in the Leaderboard Channel
            const config = (0, leaderboard_1.loadConfig)();
            if (config) {
                const lbChannel = await client.channels.fetch(config.channelId);
                if (lbChannel) {
                    if (winner) {
                        const previousMonth = new Date();
                        previousMonth.setMonth(previousMonth.getMonth() - 1);
                        const monthName = previousMonth.toLocaleString('default', { month: 'long' });
                        await lbChannel.send(`🎉 **Monthly Leaderboard Reset** 🎉\n` +
                            `Congratulations <@${winner.id}>! You are the champion of **${monthName}**! 🏆\n` +
                            `Awesome game! 🤴\n\n` +
                            `*Stats have been reset. Good luck for this month!*`);
                    }
                    else {
                        await lbChannel.send(`🎉 **Monthly Leaderboard Reset** 🎉\n` +
                            `No games played last month!\n` +
                            `*Stats have been reset. Good luck for this month!*`);
                    }
                }
            }
        }
        catch (error) {
            console.error("Error during leaderboard reset:", error);
        }
    });
    console.log('✅ Scheduler initialized (9AM, 1PM, 10PM, Monthly Reset)');
};
exports.initScheduler = initScheduler;
