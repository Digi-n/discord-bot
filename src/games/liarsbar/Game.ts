import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    Message, StringSelectMenuBuilder, ComponentType, User,
    TextChannel, InteractionCollector, Collector, ButtonInteraction
} from 'discord.js';
import { Card, Deck } from './Card';
import { Player } from './Player';
import { RANKS, GameState, BLUFF_WINDOW_MS, TURN_TIMEOUT_MS, LIVES_COUNT } from './Constants';

export class Game {
    channel: TextChannel;
    message: Message | null = null;
    players: Player[] = [];
    deck: Deck;
    pile: { card: Card, originalOwnerId: string }[] = [];

    state: GameState = GameState.LOBBY;
    currentTurnIndex: number = 0;
    roundRank: string = ""; // The rank being played this round (e.g. "Q")

    // Tracking current play for bluffing
    lastPlay: {
        playerId: string,
        count: number,
        cards: Card[],
        accepted: number
    } | null = null;

    constructor(channel: TextChannel) {
        this.channel = channel;
        this.deck = new Deck();
    }

    addPlayer(user: User): boolean {
        if (this.players.some(p => p.id === user.id)) return false;
        if (this.state !== GameState.LOBBY) return false;
        this.players.push(new Player(user));
        return true;
    }

    async startGame() {
        if (this.players.length < 2) {
            await this.channel.send("❌ Need at least 2 players to start!");
            return;
        }
        this.state = GameState.PLAYING_TURN;
        this.startRound();
    }

    startRound() {
        this.deck.reset();

        // Deal cards (5 cards each?) - User Request said: "Player A hand: [Queen, Queen]"
        // Let's deal 5 cards to start.
        this.players.forEach(p => {
            p.hand = this.deck.deal(5);
            p.sortHand();
        });

        // Pick a Table Rank (e.g. Q)
        this.roundRank = RANKS[Math.floor(Math.random() * RANKS.length)];
        this.pile = [];
        this.lastPlay = null;
        this.currentTurnIndex = 0;

        this.updateGameMessage("🃏 **NEW ROUND STARTED!**");
        this.processTurn();
    }

    async processTurn() {
        if (this.checkWinCondition()) return;

        const player = this.players[this.currentTurnIndex];
        if (!player.active) {
            this.nextTurn();
            return;
        }

        this.updateGameMessage(`👉 **${player.username}'s Turn!**\nTable Rank: **${this.roundRank}**`);
    }

    nextTurn() {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        this.processTurn();
    }

    async handlePlayCards(player: Player, cards: Card[]) {
        // Move cards to pile
        cards.forEach(c => this.pile.push({ card: c, originalOwnerId: player.id }));
        player.removeCards(cards);

        this.lastPlay = {
            playerId: player.id,
            count: cards.length,
            cards: cards,
            accepted: 0
        };

        this.state = GameState.BLUFF_PHASE;
        this.updateGameMessage(
            `🕵️ **${player.username}** played **${cards.length}** cards.\n` +
            `Claim: **${this.roundRank}s**\n\n` +
            `🚨 **BLUFF WINDOW**: Anyone can call LIAR! (10s)`
        );

        // Start Bluff Timer
        setTimeout(() => {
            if (this.state === GameState.BLUFF_PHASE && this.lastPlay?.playerId === player.id) {
                // If nobody called liar, pass
                this.endBluffPhase(false);
            }
        }, BLUFF_WINDOW_MS);
    }

    async endBluffPhase(wasChallenged: boolean, challenger?: Player) {
        if (this.state !== GameState.BLUFF_PHASE) return; // Race condition check

        if (!wasChallenged) {
            this.channel.send(`✅ Nobody called Liar. Moving on.`);
            this.state = GameState.PLAYING_TURN;
            this.nextTurn();
        } else {
            // CHALLENGED!
            this.resolveChallenge(challenger!);
        }
    }

    resolveChallenge(challenger: Player) {
        if (!this.lastPlay) return;
        this.state = GameState.REVEAL;

        const playedCards = this.lastPlay.cards;
        const claimRank = this.roundRank;

        // Check if ANY card is NOT the claimed rank
        // Wait, regular Liar's Dice/Bar logic: If I play 3 cards, and claim they are Queens...
        // If ANY of them is NOT a Queen, I lied.
        const isLiar = playedCards.some(c => c.rank !== claimRank);
        const accused = this.players.find(p => p.id === this.lastPlay!.playerId)!;

        // Reveal Text
        const revealStr = playedCards.map(c => `[${c.toString()}]`).join(' ');

        let resultMsg = "";

        if (isLiar) {
            // Accused Lied -> Accused loses a life
            accused.lives -= 1;
            resultMsg = `❌ **LIAR!** ${accused.username} played ${revealStr} (Claimed: ${claimRank}).\n💀 **${accused.username} loses a life!**`;
        } else {
            // Accused told Truth -> Challenger loses a life
            challenger.lives -= 1;
            resultMsg = `✅ **TRUTH!** ${accused.username} indeed played ${revealStr}.\n💀 **${challenger.username} (Challenger) loses a life!**`;
        }

        this.channel.send(resultMsg);

        // Check Eliminations
        this.players.forEach(p => {
            if (p.lives <= 0 && p.active) {
                p.active = false;
                this.channel.send(`☠️ **${p.username} has been eliminated!**`);
            }
        });

        // Start New Round (Pile clears on challenge usually)
        setTimeout(() => {
            this.startRound();
        }, 5000);
    }

    checkWinCondition(): boolean {
        const activePlayers = this.players.filter(p => p.active);
        if (activePlayers.length === 1) {
            this.state = GameState.GAME_OVER;
            this.channel.send(`🏆 **GAME OVER!** ${activePlayers[0].username} wins Liar's Bar!`);
            this.message?.delete().catch(() => { });
            return true;
        }
        return false;
    }

    // --- UI Generation ---

    async updateGameMessage(statusText: string) {
        const embed = new EmbedBuilder()
            .setTitle(`🔫 Liar's Bar`)
            .setDescription(statusText)
            .setColor(this.state === GameState.BLUFF_PHASE ? 0xFF0000 : 0x0099FF)
            .addFields(
                { name: 'Table Info', value: `Target Rank: **${this.roundRank}**\nPile: **${this.pile.length}** cards`, inline: true },
                { name: 'Turn', value: `<@${this.players[this.currentTurnIndex].id}>`, inline: true }
            );

        // Player List
        const playerList = this.players.map(p =>
            `${p.active ? (p.id === this.players[this.currentTurnIndex].id ? '👉' : '👤') : '💀'} **${p.username}**: ${'❤️'.repeat(p.lives)}${p.active ? ` (${p.hand.length} 🎴)` : ''}`
        ).join('\n');

        embed.addFields({ name: 'Players', value: playerList });

        // Buttons
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const row1 = new ActionRowBuilder<ButtonBuilder>();

        if (this.state === GameState.LOBBY) {
            row1.addComponents(
                new ButtonBuilder().setCustomId('lb_join').setLabel('Join').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('lb_start').setLabel('Start').setStyle(ButtonStyle.Primary)
            );
        } else if (this.state === GameState.PLAYING_TURN) {
            row1.addComponents(
                new ButtonBuilder().setCustomId('lb_play').setLabel('Play Cards').setStyle(ButtonStyle.Primary).setEmoji('🎴')
            );
        } else if (this.state === GameState.BLUFF_PHASE) {
            row1.addComponents(
                new ButtonBuilder().setCustomId('lb_liar').setLabel('LIAR!').setStyle(ButtonStyle.Danger).setEmoji('❗')
            );
        }

        if (row1.components.length > 0) rows.push(row1);

        try {
            if (this.message) {
                await this.message.edit({ content: '', embeds: [embed], components: rows });
            } else {
                this.message = await this.channel.send({ embeds: [embed], components: rows });
            }
        } catch (e) { console.error("Update failed", e); }
    }
}
