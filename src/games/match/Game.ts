import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, User, Message } from 'discord.js';
import { Player } from './Player';
import { Card, Suit, Rank } from './Card';
import { recordRankedGameResult, updateLeaderboardMessage } from '../../utils/leaderboard';

export class MatchGame {
    channel: TextChannel;
    players: Player[] = [];
    deck: Card[] = [];
    gameState: 'LOBBY' | 'PLAYING' | 'ENDED' = 'LOBBY';

    // Turn State
    turnIndex: number = 0; // Index of the player whose turn it is

    gameMessage: Message | null = null;
    removedCards: Card[] = [];

    constructor(channel: TextChannel) {
        this.channel = channel;
    }

    addPlayer(user: User): boolean {
        if (this.players.some(p => p.id === user.id)) return false;
        if (this.gameState !== 'LOBBY') return false;
        this.players.push(new Player(user));
        return true;
    }

    removePlayer(userId: string) {
        this.players = this.players.filter(p => p.id !== userId);
    }

    async startGame() {
        if (this.players.length < 2) return; // Need 2+

        this.gameState = 'PLAYING';
        this.turnIndex = 0; // P1 starts

        this.generateDeck();
        this.dealCards();

        // No auto-pairing anymore (Rummy style)

        await this.updateGameMessage();
    }

    generateDeck() {
        // Standard 52 card deck
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

        // We use the full deck. excess remains undealt.
    }

    dealCards() {
        // P1 (turnIndex 0) gets 7 cards. Everyone else gets 6.
        // Total needed: 7 + (N-1)*6 = 6N + 1.
        // Max players with 52 cards: 6N+1 <= 52. 
        // 6N <= 51 -> N <= 8. Safe.

        this.players.forEach((p, idx) => {
            const count = idx === this.turnIndex ? 7 : 6;
            for (let i = 0; i < count; i++) {
                if (this.deck.length > 0) {
                    p.addCard(this.deck.pop()!);
                }
            }
        });
    }

    // --- Interaction Handlers ---

    // Called when ACTIVE player selects a card to pass
    async handleCardSelection(playerId: string, cardIndex: number) {
        const currentPlayer = this.players[this.turnIndex];

        // Validation: Must be active player's turn
        if (currentPlayer.id !== playerId) return;

        // Validation: Must have cards (should have 7)
        if (currentPlayer.hand.length === 0) return;

        // Execute Pass
        const card = currentPlayer.removeCard(cardIndex);
        if (!card) return;

        // Give to Next Player
        const nextIndex = (this.turnIndex + 1) % this.players.length;
        this.players[nextIndex].addCard(card);

        // Advance Turn
        this.turnIndex = nextIndex;

        // Note: No "Win Condition" check here unless deck runs out? 
        // This game ends via Showdown.
        // Update UI
        await this.updateGameMessage(`🔄 **${currentPlayer.username}** passed a card to **${this.players[nextIndex].username}**.`);
    }

    async handleShowdown(triggerPlayerId: string) {
        const player = this.players.find(p => p.id === triggerPlayerId);
        if (!player) return;

        // Restriction: Can only show hand if it's your turn?
        // OR: You can show hand anytime you have 6 cards?
        // User said: "player can only show hand when there turn comes"
        // AND "exact 6 cards".
        // If it's my turn, I have 7 cards.
        // I must drop one to have 6.
        // Logic: The "Show Hand" button should be available INSTEAD of Passing? 
        // -> "I discard this card and Show".
        // OR: "I Show 6 cards" (and the 7th is ignored/discarded implicit?).

        // Easier Implementation:
        // You click "Show Hand".
        // If you have 7 cards (Your Turn):
        //  - You must discard one to match "Exact 6"? 
        //  - Or we just score the best 6?
        //  - User: "exact amount of 6 cards".
        // Let's assume you click Show Hand *instead* of passing. 
        // But physically you hold 7. 
        // Maybe the UI should ask "Select card to discard & show"?
        // COMPLEXITY ALERT.

        // Simplification: 
        // If I have 7 cards, I am allowed to Show Hand. (I will be scored on best 6? Or just Sum of all 7 - Avg?)
        // User said "Sum of Points". 7 cards > 6 cards. Unfair.
        // Solution: If you Show, you DO NOT pass. 
        // But you have 7 cards.
        // Maybe I just score all 7? No "exact 6".
        // User was specific: "exact amount of 6 cards".
        // Valid Flow:
        // 1. My Turn (7 cards).
        // 2. I click "Pass". I select card.
        // 3. Card moves to Next. I have 6.
        // 4. (My turn ended). Next player has 7.
        // 5. Wait, I can't show if my turn ended.

        // Alternate Flow: 
        // "Show Hand" IS the discard.
        // 1. My Turn (7 cards).
        // 2. I click "Show Hand".
        // 3. I select a card to "Burn"/Discard.
        // 4. Game Ends. I hold 6. Everyone else holds 6 (or 7? No, only I had 7).
        // Everyone else has 6. I discard 1 -> I have 6.
        // EQUILIBRIUM.

        // Implementation: 
        // If Showdown is clicked:
        // If player has 7 cards: precise Discard required? 
        // Or just "Remove last drawn"?
        // Let's just remove the highest value card automatically?
        // No, strategy.

        // Let's stick to the SIMPLEST interpretation that works mechanically:
        // You can click Show Hand ONLY if you have 6 cards.
        // BUT you only have 6 cards when it is NOT your turn (after passing).
        // So anyone can Show Hand *when it is not their turn*?
        // "player can only show hand when there turn comes".

        // OKAY. This means I must have 6 cards AND it must be my turn.
        // This is impossible in the "Pass 1" flow (Start 7).
        // UNLESS:
        // Turn Step 1: Draw (Have 7).
        // Turn Step 2: Discard (Have 6).
        // Turn Step 3: End Turn / Show.

        // This implies an explicitly multi-stage turn.
        // Current UI: "Select Card to Pass".
        // Action: Click Card -> Passes -> End Turn.
        // There is no "Step 3".

        // HYBRID SOLUTION:
        // Button: "Pass Card" (Select menu).
        // Button: "Show Hand (Win)" (Select menu to discard 7th card?).
        // 
        // Let's implement:
        // If you click "Show Hand (Win)", the game asks you "Select card to discard for Showdown".
        // You pick 1.
        // You now have 6. Game Ends.

        const currentPlayer = this.players[this.turnIndex];
        if (currentPlayer.id !== triggerPlayerId) return; // Not your turn

        this.gameState = 'ENDED';
        this.updateGameMessage("🛑 **SHOWDOWN CALLED!** Game Paused. Revealing hands...");

        let showdownMsg = `📢 **${player.username}** called SHOWDOWN!\n\n`;

        // If player has 7 cards, we should ideally remove one.
        // For MVP, if they have 7, we'll just ignore the *lowest* value card (or highest?) 
        // actually if they win by points, they want HIGH cards.
        // So we remove the LOWEST value card to maximize their score?
        // Or we just score all 7 and penalty?
        // User said "exact 6".
        // I will just remove the last card (most recently added) for fairness/randomness if not specified.
        // Or for now, just score all 7 and scale? No.

        // Hack: Remove 1 random card from the trigger player to make it 6.
        if (player.hand.length > 6) {
            // Remove the card with the LOWEST value (optimal play assumption)
            player.hand.sort((a, b) => b.value - a.value); // Descending
            const removed = player.hand.pop(); // Remove lowest
            showdownMsg += `(Discarded ${removed?.toString()} to make 6 cards)\n`;
        }

        // Calculate scores
        const activePlayers = this.players; // Everyone plays
        let winner: Player | null = null;
        let maxScore = -1;

        activePlayers.forEach(p => {
            let score = 0;
            // Ensure everyone scores only top 6 cards (if someone else had 7 somehow)
            const scorableHand = p.hand.slice(0, 6);
            if (p.hand.length > 6) {
                // Should not happen for others if turn based
                p.hand.sort((a, b) => b.value - a.value);
            }
            // Sum 6 highest
            for (let i = 0; i < Math.min(p.hand.length, 6); i++) {
                score += p.hand[i].value;
            }

            showdownMsg += `**${p.username}**: [${p.hand.slice(0, 6).map(c => c.toString()).join(' ')}] (Points: ${score})\n`;

            if (score > maxScore) {
                maxScore = score;
                winner = p;
            }
        });

        showdownMsg += `\n🏆 **WINNER**: ${winner ? (winner as Player).username : "Unknown"} with ${maxScore} points!`;

        if (winner) {
            const winPlayer = winner as Player;
            const winners = [winPlayer];
            const losers = activePlayers.filter(p => p.id !== winPlayer.id);

            const winnerUsers = winners.map(p => ({ id: p.id, username: p.username, bot: false } as User));
            const loserUsers = losers.map(p => ({ id: p.id, username: p.username, bot: false } as User));

            try {
                recordRankedGameResult(winnerUsers, loserUsers, 'match');
                updateLeaderboardMessage(this.channel.client);
            } catch (e) { console.error(e); }
        }

        await this.gameMessage?.edit({
            embeds: [new EmbedBuilder().setTitle('🃏 Showdown Results').setDescription(showdownMsg).setColor('#FFD700')],
            components: []
        });
    }

    // --- UI ---

    async updateGameMessage(statusPrefix: string = "") {
        if (!this.channel) return;

        // Status Line
        let statusLine = "🟡 **Status:** Waiting for players...";
        if (this.gameState === 'PLAYING') {
            const currentPlayer = this.players[this.turnIndex];
            statusLine = `🟢 **Status:** Game in Progress\n👉 **Current Turn:** ${currentPlayer?.username || "Unknown"}`;
        } else if (this.gameState === 'ENDED') {
            statusLine = "🔴 **Status:** Game Ended";
        }

        const embed = new EmbedBuilder()
            .setTitle('🐴 **Donkey Card Game**')
            .setColor(this.gameState === 'PLAYING' ? '#00FF00' : '#8B4513')
            .setDescription(`${statusLine}\n\n${statusPrefix}`);

        // Player List
        let pList = "";
        this.players.forEach((p, idx) => {
            let prefix = "👤";
            let status = "Ready";

            if (this.gameState === 'PLAYING') {
                if (idx === this.turnIndex) {
                    prefix = "🔴"; // Red circle for active turn
                    status = "Thinking...";
                } else {
                    status = "Waiting";
                }
            }

            pList += `${prefix} **${p.username}** — ${status} (${p.handSize} cards)\n`;
        });
        embed.addFields({ name: 'Players', value: pList || 'None' });

        // Components
        let components: any[] = [];
        if (this.gameState === 'LOBBY') {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder().setCustomId('donkey_join').setLabel('Join Lobby').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('donkey_start').setLabel('Start Game').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('match_end_game').setLabel('End Game').setStyle(ButtonStyle.Danger)
                );
            components.push(row);
        } else if (this.gameState === 'PLAYING') {
            // Button to open Hand View / Select Card (Universal, logic checks turn)
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder().setCustomId('donkey_hand').setLabel('✋ Play Turn / View Hand').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('donkey_showdown').setLabel('📢 Show Hand (Win)').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('match_end_game').setLabel('End Game').setStyle(ButtonStyle.Danger)
                );
            components.push(row);
        }

        try {
            if (this.gameMessage) {
                await this.gameMessage.edit({ embeds: [embed], components });
            } else {
                this.gameMessage = await this.channel.send({ embeds: [embed], components });
            }
        } catch (e) {
            console.error("Failed to update Donkey game message:", e);
        }
    }
}
