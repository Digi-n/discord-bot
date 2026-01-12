"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const leaderboard_1 = require("../utils/leaderboard");
// The specific channel ID required by the user
const LEADERBOARD_CHANNEL_ID = '1459533249985646706';
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Initialize the live Tic-Tac-Toe leaderboard')
    .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator);
async function execute(interaction) {
    if (interaction.channelId !== LEADERBOARD_CHANNEL_ID) {
        return interaction.reply({
            content: `This command can only be used in <#${LEADERBOARD_CHANNEL_ID}>!`,
            ephemeral: true
        });
    }
    await interaction.reply({ content: 'Initializing leaderboard...', ephemeral: true });
    // Save initial config with empty message ID (wrapper will create it)
    (0, leaderboard_1.saveConfig)({
        channelId: LEADERBOARD_CHANNEL_ID,
        messageId: ''
    });
    // Trigger update immediately
    await (0, leaderboard_1.updateLeaderboardMessage)(interaction.client);
    await interaction.editReply({ content: 'Leaderboard initialized! It will update every minute.' });
}
