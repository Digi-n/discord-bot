"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveGameCount = getActiveGameCount;
exports.startUnoGame = startUnoGame;
exports.handleUnoInteraction = handleUnoInteraction;
exports.endActiveGame = endActiveGame;
const Game_1 = require("./Game");
const activeGames = new Map();
function getActiveGameCount() {
    return activeGames.size;
}
async function startUnoGame(interaction) {
    const channelId = interaction.channelId;
    console.log(`Starting UNO game in channel: ${channelId}`);
    if (activeGames.has(channelId)) {
        console.log('UNO game already exists in this channel.');
        return interaction.reply({
            content: '❌ A UNO game is already running in this channel',
            ephemeral: true,
        });
    }
    const game = new Game_1.Game(interaction);
    activeGames.set(channelId, game);
    await game.init();
}
async function handleUnoInteraction(interaction) {
    const channelId = interaction.channelId;
    const game = activeGames.get(channelId);
    if (!game) {
        return interaction.reply({
            content: '❌ No active UNO game found in this channel.',
            ephemeral: true,
        });
    }
    if (interaction.customId === 'uno_join') {
        await game.addPlayer(interaction.user.id, interaction.user.username, interaction);
    }
    else if (interaction.customId === 'uno_start') {
        await game.startGame(interaction.user.id, interaction);
    }
    else if (interaction.customId === 'uno_cancel') {
        await game.cancelGame(interaction);
        if (game.state === 2) { // ENDED
            activeGames.delete(channelId);
        }
    }
    else {
        // Pass other interactions (play, draw, view hand) to the game instance
        await game.handleInteraction(interaction);
        // Cleanup if game ended
        if (game.state === 2) { // ENDED
            activeGames.delete(channelId);
            console.log(`Game ended and removed from channel ${channelId}`);
        }
    }
}
function endActiveGame(channelId) {
    activeGames.delete(channelId);
}
