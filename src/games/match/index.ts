import { ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { MatchGame } from './Game';

export const games: Map<string, MatchGame> = new Map(); // ChannelID -> Game

export async function execute(interaction: ChatInputCommandInteraction) {
    if (games.has(interaction.channelId)) {
        return interaction.reply({ content: 'A game is already running in this channel!', flags: MessageFlags.Ephemeral });
    }

    const game = new MatchGame(interaction.channel as any);
    games.set(interaction.channelId, game);
    game.addPlayer(interaction.user);

    await interaction.reply({ content: 'Starting Donkey Game...', flags: MessageFlags.Ephemeral }); // Silent ack
    await game.updateGameMessage();
}

export async function handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
    const game = games.get(interaction.channelId);
    if (!game) {
        return false;
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'match_join') {
            if (game.addPlayer(interaction.user)) {
                await interaction.reply({ content: 'Joined!', flags: MessageFlags.Ephemeral });
                await game.updateGameMessage();
            } else {
                await interaction.reply({ content: 'Already joined or game started.', flags: MessageFlags.Ephemeral });
            }
        } else if (interaction.customId === 'match_start') {
            if (game.players[0].id !== interaction.user.id) {
                await interaction.reply({ content: 'Only the host can start.', flags: MessageFlags.Ephemeral });
                return true;
            }
            if (game.players.length < 2) {
                await interaction.reply({ content: 'Need at least 2 players!', flags: MessageFlags.Ephemeral });
                return true;
            }
            await interaction.deferUpdate();
            await game.startGame();
        } else if (interaction.customId === 'match_hand') {
            const player = game.players.find(p => p.id === interaction.user.id);
            if (!player) {
                await interaction.reply({ content: 'You are not in this game.', flags: MessageFlags.Ephemeral });
                return true;
            }

            // Turn check
            const currentPlayer = game.players[game.turnIndex];
            if (currentPlayer.id !== interaction.user.id) {
                await interaction.reply({
                    content: `It is not your turn! Waiting for **${currentPlayer.username}**.`,
                    flags: MessageFlags.Ephemeral
                });
                return true;
            }

            const options = player.hand.map((card, index) => ({
                label: card.toString(),
                value: index.toString(),
                description: `Pass to ${game.players[(game.turnIndex + 1) % game.players.length].username}`
            }));

            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('match_select_pass')
                        .setPlaceholder('Select a card to PASS...')
                        .addOptions(options)
                );

            await interaction.reply({
                content: `**Your Turn!**\nYou have **${player.hand.length}** cards.\nSelect one to pass to **${game.players[(game.turnIndex + 1) % game.players.length].username}**:`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        } else if (interaction.customId === 'match_showdown') {
            await interaction.deferUpdate();
            await game.handleShowdown(interaction.user.id);
        } else if (interaction.customId === 'match_end_game') {
            if (game.players[0].id !== interaction.user.id) {
                await interaction.reply({ content: 'Only the host can end the game.', flags: MessageFlags.Ephemeral });
                return true;
            }
            game.gameState = 'ENDED';
            try {
                if (game.gameMessage) await game.gameMessage.edit({ content: '🛑 **Game Ended by Host**', components: [] });
            } catch (e) { }
            games.delete(interaction.channelId);
            await interaction.reply({ content: '🛑 Game Ended.', flags: MessageFlags.Ephemeral });
        }
    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'match_select_pass') {
            const index = parseInt(interaction.values[0]);
            game.handleCardSelection(interaction.user.id, index);
            await interaction.reply({ content: 'Card selected!', flags: MessageFlags.Ephemeral });
        }
    }
    return true;
}
