import { ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuInteraction, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import { DonkeyGame } from './Game';

export const games: Map<string, DonkeyGame> = new Map(); // ChannelID -> Game

export async function execute(interaction: ChatInputCommandInteraction) {
    if (games.has(interaction.channelId)) {
        return interaction.reply({ content: 'A game is already running in this channel!', flags: MessageFlags.Ephemeral });
    }

    const game = new DonkeyGame(interaction.channel as any);
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
        if (interaction.customId === 'donkey_join') {
            if (game.addPlayer(interaction.user)) {
                await interaction.reply({ content: 'Joined!', flags: MessageFlags.Ephemeral });
                await game.updateGameMessage();
            } else {
                await interaction.reply({ content: 'Already joined or game started.', flags: MessageFlags.Ephemeral });
            }
        } else if (interaction.customId === 'donkey_start') {
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
        } else if (interaction.customId === 'donkey_end_game') {
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
        } else if (interaction.customId === 'donkey_hand') {
            const player = game.players.find(p => p.id === interaction.user.id);
            if (!player || player.finished) {
                await interaction.reply({ content: 'You are not in this game or already safe.', flags: MessageFlags.Ephemeral });
                return true;
            }

            // Turn Check
            if (game.gameState === 'PLAYING' && game.players[game.turnIndex].id !== player.id) {
                await interaction.reply({ content: `It is not your turn! Waiting for **${game.players[game.turnIndex].username}**.`, flags: MessageFlags.Ephemeral });
                return true;
            }

            // Organize Options: Valid suit first
            const hand = player.hand;
            let options = hand.map((card, index) => {
                let label = card.toString();
                let description = "";

                if (game.isFirstTurn) {
                    if (card.suit === '♠️' && card.rank === 'A') {
                        description = "🌟 MUST START (Ace of Spades)";
                        label = `🌟 ${label}`;
                    } else {
                        description = "❌ Must play Ace of Spades to start";
                        label = `❌ ${label}`;
                        // We can't disable individual options in a SELECT MENU easily without just not showing them or erroring on select.
                        // Or we filter the list to ONLY show the Ace of Spades if it's the first turn.
                    }
                } else if (game.currentSuit) {
                    if (card.suit === game.currentSuit) {
                        description = "✅ Follows Suit";
                        label = `✅ ${label}`;
                    } else {
                        // Check if player HAS suit
                        const hasSuit = hand.some(c => c.suit === game.currentSuit);
                        if (hasSuit) {
                            description = "⚠️ Invalid (Must follow suit!)";
                            label = `❌ ${label}`;
                        } else {
                            description = "💥 STRIKE (Cut)";
                            label = `💥 ${label}`;
                        }
                    }
                } else if (game.forcedLeadSuit) {
                    // Leading, but FORCED
                    if (card.suit === game.forcedLeadSuit) {
                        description = "🛡️ Forced Lead";
                        label = `🛡️ ${label}`;
                    } else {
                        const hasForced = hand.some(c => c.suit === game.forcedLeadSuit);
                        if (hasForced) {
                            description = "❌ Invalid (Must Lead Forced Suit)";
                            label = `❌ ${label}`;
                        } else {
                            description = "Lead New Suit";
                        }
                    }
                } else {
                    description = "Lead this card";
                }
                return {
                    label: label,
                    value: index.toString(),
                    description: description
                };
            });

            // If First Turn, Filter options to ONLY Ace of Spades?
            // This prevents misclicks.
            if (game.isFirstTurn) {
                // Player MUST have Ace of Spades because turnIndex is set to them.
                options = options.filter(o => o.label.includes('🌟'));
            }

            // If too many cards (25 limit), slice?
            // "3-8 players". 52/3 = 17 cards max. Safe.

            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('donkey_select_pass')
                        .setPlaceholder('Select a card to PLAY...')
                        .addOptions(options.slice(0, 25))
                );

            await interaction.reply({
                content: `**Your Turn!**\nCurrent Suit: **${game.currentSuit || "None"}**\nSelect a card to play:`,
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        }
    } else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'donkey_select_pass') {
            const index = parseInt(interaction.values[0]);
            // Add logic call
            await game.handleCardPlay(interaction.user.id, index);
            await interaction.deferUpdate();
        }
    }
    return true;
}
