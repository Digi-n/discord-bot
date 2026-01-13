import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, User, Message } from 'discord.js';
import { Player } from './Player';
import { Card, Suit, Rank } from './Card';
import { recordRankedGameResult, updateLeaderboardMessage } from '../../utils/leaderboard';

export class DonkeyGame {
    channel: TextChannel;
    players: Player[] = [];
    deck: Card[] = [];
    gameState: 'LOBBY' | 'PLAYING' | 'ENDED' = 'LOBBY';

    // Game State
    turnIndex: number = 0;
    currentSuit: Suit | null = null;
    centerPile: { card: Card, playerId: string }[] = [];
    isFirstTurn: boolean = true;
    forcedLeadSuit: Suit | null = null;

    // Tracking for the current trick
    highestCard: { card: Card, playerId: string, value: number } | null = null;
    playersPlayedInTrick: string[] = [];

    gameMessage: Message | null = null;

    constructor(channel: TextChannel) {
        this.channel = channel;
    }

    addPlayer(user: User): boolean {
        if (this.players.some(p => p.id === user.id)) return false;
        if (this.gameState !== 'LOBBY') return false;
        this.players.push(new Player(user));
        return true;
    }

    async startGame() {
        if (this.players.length < 2) return;

        this.gameState = 'PLAYING';
        this.generateDeck();
        this.dealCards();

        // Find who has Ace of Spades to Start
        const starterIndex = this.players.findIndex(p => p.hand.some(c => c.suit === '♠️' && c.rank === 'A'));
        this.turnIndex = starterIndex !== -1 ? starterIndex : 0;

        await this.updateGameMessage("♠️ **Ace of Spades Holder Starts!**");
    }

    generateDeck() {
        const suits: Suit[] = ['♠️', '♥️', '♦️', '♣️'];
        const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        this.deck = [];
        for (const s of suits) {
            for (const r of ranks) {
                this.deck.push(new Card(s, r));
            }
        }
        // Shuffle
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        // Deal ALL cards evenly
        let pIndex = 0;
        while (this.deck.length > 0) {
            this.players[pIndex].addCard(this.deck.pop()!);
            pIndex = (pIndex + 1) % this.players.length;
        }
    }

    // --- Core Logic ---

    // Value helper for comparison (Standard: A > K > Q ... > 2?)
    // Or A high? Usually A is high.
    getCardValue(card: Card): number {
        const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        return ranks.indexOf(card.rank) + 2;
    }

    async handleCardPlay(playerId: string, cardIndex: number) {
        const player = this.players.find(p => p.id === playerId);
        const currentPlayer = this.players[this.turnIndex];

        if (!player || player.id !== currentPlayer.id) return; // Not turn

        const selectedCard = player.hand[cardIndex];

        // --- First Turn Validation ---
        if (this.isFirstTurn) {
            if (selectedCard.suit !== '♠️' || selectedCard.rank !== 'A') {
                console.log("Invalid Start: Must play Ace of Spades.");
                return;
            }
            this.isFirstTurn = false;
        }

        // --- Validation: Must Follow Suit ---
        if (this.currentSuit) {
            const hasSuit = player.hand.some(c => c.suit === this.currentSuit);
            if (hasSuit && selectedCard.suit !== this.currentSuit) {
                // Illegal Move logic handled in UI validation, but if forced:
                // We assume UI prevents invalid moves unless intent is Strike.
                // But in Kazhutha, playing wrong suit IS the Strike.
                // If they HAVE suit, they MUST play it.
                // If they play wrong suit while having correct suit, we should reject.
                // UNLESS the game trusts the client. Server side check:
                if (hasSuit) {
                    console.log("Invalid move rejected: Player has suit.");
                    return;
                }
            }
        } else {
            // Leading the trick
            // --- Forced Lead Check ---
            if (this.forcedLeadSuit) {
                const hasForced = player.hand.some(c => c.suit === this.forcedLeadSuit);
                if (hasForced) {
                    if (selectedCard.suit !== this.forcedLeadSuit) {
                        console.log("Invalid Lead: Must play Forced Suit.");
                        return;
                    }
                }
                // If they follow forced, or don't have it (Strategy?), we clear the force.
                // "he puut love carad" -> implies if he HAS it he puts it.
                // If he doesn't have it? Then he plays something else. Is that a new Cut?
                // Probably leads new suit.
                this.forcedLeadSuit = null;
            }

            this.currentSuit = selectedCard.suit;
            // Reset trick tracking if new trick
            if (this.playersPlayedInTrick.length === 0) {
                this.highestCard = null;
            }
        }

        // --- Execution ---
        player.removeCard(cardIndex);
        this.centerPile.push({ card: selectedCard, playerId: player.id });
        this.playersPlayedInTrick.push(player.id);

        let trickLog = `🃏 **${player.username}** played **${selectedCard.toString()}**`;
        let roundEnded = false;

        // -- Check for Strike (Cut) --
        if (this.currentSuit && selectedCard.suit !== this.currentSuit) {
            // STRIKE! 
            // Penalty: Highest card holder picks up EVERYTHING.
            if (this.highestCard) {
                const victim = this.players.find(p => p.id === this.highestCard!.playerId);
                if (victim) {
                    // Give all cards to victim
                    this.centerPile.forEach(item => victim.addCard(item.card));

                    trickLog += `\n💥 **STRIKE!** ${player.username} cut with ${selectedCard.suit}!\n🤡 **${victim.username}** picks up **${this.centerPile.length}** cards!`;

                    // Reset Pot
                    this.centerPile = [];
                    this.playersPlayedInTrick = [];
                    this.currentSuit = null;
                    this.highestCard = null;

                    // RULES UPDATE:
                    // 1. Victim picks up (Done).
                    // 2. Next Turn is played by the player NEXT to the Victim.
                    const victimIndex = this.players.indexOf(victim);
                    let nextPlayerIndex = (victimIndex + 1) % this.players.length;

                    // Ensure next player is not finished?
                    // "3 player also want to play..." - if P2 finished, does it skip?
                    // Assuming standard skip logic.
                    let checks = 0;
                    while (this.players[nextPlayerIndex].finished && checks < this.players.length) {
                        nextPlayerIndex = (nextPlayerIndex + 1) % this.players.length;
                        checks++;
                    }

                    this.turnIndex = nextPlayerIndex;

                    // 3. New Leader MUST play the suit of the CUT card.
                    this.forcedLeadSuit = selectedCard.suit;
                    trickLog += `\n👉 **${this.players[this.turnIndex].username}** plays next.\n⚠️ **Forced Suit:** ${this.forcedLeadSuit}`;

                    roundEnded = true; // Round interrupted
                }
            }
        } else {
            // Followed Suit or Lead
            // precise value check: only update high card if same suit
            if (selectedCard.suit === this.currentSuit) {
                const val = this.getCardValue(selectedCard);
                if (!this.highestCard || val > this.highestCard.value) {
                    this.highestCard = { card: selectedCard, playerId: player.id, value: val };
                }
            }

            // Advance Turn
            let nextIndex = (this.turnIndex + 1) % this.players.length;
            // Loop to find next active player
            let checks = 0;
            while (this.players[nextIndex].finished && checks < this.players.length) {
                nextIndex = (nextIndex + 1) % this.players.length;
                checks++;
            }
            this.turnIndex = nextIndex;
        }

        // --- Check Trick Completion (Normal Clear) ---
        if (!roundEnded) {
            const activePlayers = this.players.filter(p => !p.finished).length;
            if (this.playersPlayedInTrick.length >= activePlayers) {
                // All players played. Trick Ends.
                // Clear pile (Trash)
                trickLog += `\n🧹 **Trick Cleared!** Cards removed.`;
                this.centerPile = [];
                this.playersPlayedInTrick = [];
                this.currentSuit = null;

                // Winner leads next
                if (this.highestCard) {
                    const winner = this.players.find(p => p.id === this.highestCard!.playerId);
                    if (winner) {
                        this.turnIndex = this.players.indexOf(winner);
                        trickLog += `\n� **${winner.username}** leads next.`;
                    }
                }
                this.highestCard = null;
            }
        }

        // --- Check Game End (Safe Players) ---
        this.players.forEach(p => {
            if (!p.finished && p.hand.length === 0) {
                p.finished = true;
                trickLog += `\n🎉 **${p.username}** finished and is SAFE!`;
            }
        });

        const remaining = this.players.filter(p => !p.finished);
        if (remaining.length === 1) {
            this.endGame(remaining[0]); // The Donkey
            return;
        }

        await this.updateGameMessage(trickLog);
    }

    async endGame(loser: Player) {
        this.gameState = 'ENDED';
        const winners = this.players.filter(p => p.id !== loser.id);

        // Update Leaderboard
        const winnerUsers = winners.map(p => ({ id: p.id, username: p.username, bot: false } as User));
        const loserUsers = [{ id: loser.id, username: loser.username, bot: false } as User];

        try {
            recordRankedGameResult(winnerUsers, loserUsers, 'donkey');
            updateLeaderboardMessage(this.channel.client);
        } catch (e) {
            console.error(e);
        }

        await this.updateGameMessage(`🤡 **GAME OVER!** 🤡\n\n**${loser.username}** is the **KAZHUTHA (DONKEY)**!`);
    }

    // --- UI ---

    async updateGameMessage(statusPrefix: string = "") {
        if (!this.channel) return;

        let description = "";
        let components: any[] = [];
        const embed = new EmbedBuilder().setTitle('🐴 **Kazhutha (Donkey)**');

        if (this.gameState === 'LOBBY') {
            // Realistic Lobby Mock
            embed.setColor('#8B4513');

            description = `🟡 **Table Status:** Waiting for players\n🃏 **Deck:** Ready & Shuffled\n\n` +
                `━━━━━━━━━━━━━━\n` +
                `🪑 **Seats at the Table**\n`;

            if (this.players.length === 0) {
                description += `*Empty Table*\n`;
            } else {
                this.players.forEach(p => {
                    description += `🧍 **${p.username}**\n`;
                });
            }

            description += `━━━━━━━━━━━━━━\n\n${statusPrefix}`;
            embed.setDescription(description);

            // Buttons: [ 🪑 Join Table ] [ 🃏 Start Dealing ] [ ❌ End Game ]
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder().setCustomId('donkey_join').setLabel('🪑 Join Table').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('donkey_start').setLabel('🃏 Start Dealing').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('donkey_end_game').setLabel('❌ End Game').setStyle(ButtonStyle.Danger)
                );
            components.push(row);

        } else if (this.gameState === 'PLAYING') {
            embed.setColor('#00FF00');
            const currentPlayer = this.players[this.turnIndex];
            description = `🟢 **Status:** Playing\n👉 **Turn:** ${currentPlayer?.username}\n**Suit:** ${this.currentSuit || "None (Lead)"}\n\n${statusPrefix}`;

            // Center Pile Visual
            if (this.centerPile.length > 0) {
                const pileDisplay = this.centerPile.map(i => {
                    const p = this.players.find(pl => pl.id === i.playerId);
                    return `${i.card.toString()} \`(${p?.username || '?'})\``;
                }).join('\n');
                description += `\n\n🏞️ **Center Pile:**\n${pileDisplay}`;
            }
            embed.setDescription(description);

            // Player Stats (Fields) - Keep old style for Playing? 
            // Or unify? User only spec'd Lobby. I'll keep Playing functional.
            let pList = "";
            this.players.forEach((p, idx) => {
                let prefix = "👤";
                if (idx === this.turnIndex) prefix = "🔴";
                else if (this.playersPlayedInTrick.includes(p.id)) prefix = "✅";
                else prefix = "⏳";
                if (p.finished) prefix = "🏆";
                pList += `${prefix} **${p.username}**: ${p.handSize} cards\n`;
            });
            embed.addFields({ name: 'Players', value: pList || 'None' });

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder().setCustomId('donkey_hand').setLabel('✋ Play Card').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('donkey_end_game').setLabel('End Game').setStyle(ButtonStyle.Danger)
                );
            components.push(row);
        } else {
            // Ended
            embed.setColor('#FF0000').setDescription(statusPrefix);
        }

        try {
            if (this.gameMessage) {
                await this.gameMessage.edit({ embeds: [embed], components });
            } else {
                this.gameMessage = await this.channel.send({ embeds: [embed], components });
            }
        } catch (e) { console.error(e); }
    }
}
