import cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { CONFIG } from './config';
import { getTopPlayer, resetLeaderboard, updateLeaderboardMessage, loadConfig } from './utils/leaderboard';

export const initScheduler = (client: Client) => {
    const channelId = CONFIG.GENERAL_CHANNEL_ID;

    const sendMessage = async (message: string) => {
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel && channel instanceof TextChannel) {
                await channel.send(message);
                console.log(`Sent scheduled message: ${message}`);
            } else {
                console.error(`Channel ${channelId} not found or not a TextChannel`);
            }
        } catch (error) {
            console.error('Error sending scheduled message:', error);
        }
    };

    // 9:00 AM
    cron.schedule('0 9 * * *', () => {
        sendMessage("Good Morning @everyone! ☀️");
    });

    // 1:00 PM (13:00)
    cron.schedule('0 13 * * *', () => {
        sendMessage("Good Afternoon @everyone! 🌤️");
    });

    // 10:00 PM (22:00)
    cron.schedule('0 22 * * *', () => {
        sendMessage("Good Night @everyone! 🌙");
    });

    // --- Monthly Leaderboard Reset ---
    // 00:00 on the 1st of every month
    cron.schedule('0 0 1 * *', async () => {
        console.log("⏰ Running Monthly Leaderboard Reset...");

        try {
            const winner = getTopPlayer();
            resetLeaderboard();
            await updateLeaderboardMessage(client);

            // Announce Winner in the Leaderboard Channel
            const config = loadConfig();
            if (config) {
                const lbChannel = await client.channels.fetch(config.channelId) as TextChannel;
                if (lbChannel) {
                    if (winner) {
                        const previousMonth = new Date();
                        previousMonth.setMonth(previousMonth.getMonth() - 1);
                        const monthName = previousMonth.toLocaleString('default', { month: 'long' });

                        await lbChannel.send(
                            `🎉 **Monthly Leaderboard Reset** 🎉\n` +
                            `Congratulations <@${winner.id}>! You are the champion of **${monthName}**! 🏆\n` +
                            `Awesome game! 🤴\n\n` +
                            `*Stats have been reset. Good luck for this month!*`
                        );
                    } else {
                        await lbChannel.send(
                            `🎉 **Monthly Leaderboard Reset** 🎉\n` +
                            `No games played last month!\n` +
                            `*Stats have been reset. Good luck for this month!*`
                        );
                    }
                }
            }
        } catch (error) {
            console.error("Error during leaderboard reset:", error);
        }
    });

    console.log('✅ Scheduler initialized (9AM, 1PM, 10PM, Monthly Reset)');
};
