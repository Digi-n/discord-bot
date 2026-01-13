import {
    ButtonInteraction, ChatInputCommandInteraction,
    ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction,
    ComponentType, MessageFlags, ButtonBuilder
} from 'discord.js';
import { Game } from './Game';
import { GameState } from './Constants';
import { Card } from './Card';

const activeGames = new Map<string, Game>();

export function getActiveGameCount(): number {
    return activeGames.size;
}

export async function startLiarsBarGame(interaction: ChatInputCommandInteraction) {
    if (!interaction.channel || !interaction.guild) return;

    // Check if game exists in channel
    if (activeGames.has(interaction.channelId)) {
        await interaction.reply({ content: '❌ A game is already running in this channel!', flags: MessageFlags.Ephemeral });
        return;
    }

    const game = new Game(interaction.channel as any);
    activeGames.set(interaction.channelId, game);

    // Add host
    game.addPlayer(interaction.user);

    await interaction.reply({ content: '🔫 **Liar\'s Bar Lobby Created!**' });
    game.updateGameMessage("Waiting for players...");
}

export async function handleLiarsBarInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
    const game = activeGames.get(interaction.channelId);
    if (!game) {
        if (interaction.isButton() && interaction.customId.startsWith('lb_')) {
            await interaction.reply({ content: '❌ Game not found or ended.', flags: MessageFlags.Ephemeral });
        }
        return;
    }

    if (interaction.isButton()) {
        const action = interaction.customId;

        if (action === 'lb_join') {
            if (game.addPlayer(interaction.user)) {
                await interaction.reply({ content: '✅ Joined!', flags: MessageFlags.Ephemeral });
                game.updateGameMessage("Player joined!");
            } else {
                await interaction.reply({ content: '❌ Could not join (Full or already joined).', flags: MessageFlags.Ephemeral });
            }
        }
        else if (action === 'lb_start') {
            if (game.players[0].id !== interaction.user.id) {
                await interaction.reply({ content: '❌ Only the host can start.', flags: MessageFlags.Ephemeral });
                return;
            }
            await interaction.deferUpdate();
            game.startGame();
        }
        else if (action === 'lb_play') {
            // Check turn
            const currentPlayer = game.players[game.currentTurnIndex];
            if (currentPlayer.id !== interaction.user.id) {
                await interaction.reply({ content: '❌ Not your turn!', flags: MessageFlags.Ephemeral });
                return;
            }

            // Show Hand Selection
            const options = currentPlayer.hand.map((card, index) => ({
                label: `${card.toString()}`,
                value: `${card.rank}:${card.suit}:${index}`, // Unique value
                description: `Rank: ${card.rank}`
            }));

            if (options.length === 0) {
                await interaction.reply({ content: '❌ You have no cards!', flags: MessageFlags.Ephemeral });
                return;
            }

            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('lb_select_cards')
                        .setPlaceholder('Select 1-3 cards to play')
                        .setMinValues(1)
                        .setMaxValues(Math.min(3, options.length))
                        .addOptions(options)
                );

            await interaction.reply({
                content: `🕵️ Select cards to play as **${game.roundRank}s**. (You can lie!)`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }
        else if (action === 'lb_liar') {
            // Check if winner
            if (game.winners.some(w => w.id === interaction.user.id)) {
                await interaction.reply({ content: '🏆 You have already won! Sit back and watch.', flags: MessageFlags.Ephemeral });
                return;
            }

            // Check if alive
            const p = game.players.find(p => p.id === interaction.user.id);
            if (!p || !p.active) {
                await interaction.reply({ content: '❌ You are not in the game or eliminated.', flags: MessageFlags.Ephemeral });
                return;
            }

            // Check self-challenge (optional rule, usually allowed or disallowed? standard: cannot challenge self)
            if (game.lastPlay?.playerId === interaction.user.id) {
                await interaction.reply({ content: '❌ You cannot call yourself a liar!', flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.reply({ content: '🚨 **CALLED LIAR!**', flags: MessageFlags.Ephemeral });
            game.endBluffPhase(true, p);
        }
        else if (action === 'lb_end_game') {
            if (game.players[0].id !== interaction.user.id) {
                await interaction.reply({ content: '❌ Only the host can end the game.', flags: MessageFlags.Ephemeral });
                return;
            }

            game.state = GameState.GAME_OVER;
            // Update UI to show ended
            const embed = new ActionRowBuilder<ButtonBuilder>(); // Empty components
            try {
                if (game.message) await game.message.edit({ content: '🛑 **Game Ended by Host**', components: [] });
            } catch (e) { }

            activeGames.delete(interaction.channelId);
            await interaction.reply({ content: '🛑 Game Ended.', flags: MessageFlags.Ephemeral });
        }
    }
    else if (interaction.isStringSelectMenu() && interaction.customId === 'lb_select_cards') {
        const currentPlayer = game.players[game.currentTurnIndex];
        if (currentPlayer.id !== interaction.user.id) return; // Should be ephemeral anyway

        const selectedValues = interaction.values; // "Rank:Suit:Index"
        const selectedCards = selectedValues.map(val => {
            const [rank, suit] = val.split(':');
            return new Card(rank, suit);
        });

        await interaction.update({ content: `✅ Submitted ${selectedCards.length} cards.`, components: [] });
        game.handlePlayCards(currentPlayer, selectedCards);
    }
}
