import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    Message, StringSelectMenuBuilder, ComponentType, User,
    TextChannel, InteractionCollector, Collector, ButtonInteraction
} from 'discord.js';
import { Card, Deck } from './Card';
import { Player } from './Player';
import { RANKS, GameState, BLUFF_WINDOW_MS, TURN_TIMEOUT_MS } from './Constants';

export class Game {
    channel: TextChannel;
    message: Message | null = null;
    players: Player[] = [];
    deck: Deck;
    pile: { card: Card, originalOwnerId: string }[] = [];
    winners: Player[] = []; // Track players who finished safely [1st, 2nd...]

    state: GameState = GameState.LOBBY;
    currentTurnIndex: number = 0;
    roundRank: string = "";

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

        // Deal initial hands
        this.deck.reset();
        this.players.forEach(p => {
            p.hand = this.deck.deal(5);
            p.sortHand();
            p.active = true; // Ensure active
        });

        this.winners = []; // Reset winners

        this.state = GameState.PLAYING_TURN;
        this.startRound();
    }

    startRound() {
        // Pick a Table Rank (e.g. Q)
        this.roundRank = RANKS[Math.floor(Math.random() * RANKS.length)];
        this.pile = [];
        this.lastPlay = null;
        this.state = GameState.PLAYING_TURN;

        // Check for Winners (Active players with 0 cards)
        // Instead of eliminating them, we mark them as WINNERS and remove from active play
        const newWinners = this.players.filter(p => p.active && p.hand.length === 0);
        newWinners.forEach(winner => {
            winner.active = false; // Finished playing
            this.winners.push(winner);
            const rank = this.getOrdinal(this.winners.length);
            this.channel.send(`🎉 **${winner.username} finished their cards!** They take **${rank} Place**!`);
        });

        // Check Win Condition immediately (if everyone finished except one)
        if (this.checkWinCondition()) return;

        // Advance to NEXT player
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;

        // Skip dead/finished players to find valid next
        let attempts = 0;
        while ((!this.players[this.currentTurnIndex].active) && attempts < this.players.length) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
            attempts++;
        }

        this.processTurn("🃏 **NEW ROUND STARTED!**");
    }

    async processTurn(statusPrefix?: string) {
        if (this.checkWinCondition()) return;

        const player = this.players[this.currentTurnIndex];
        if (!player.active) {
            this.nextTurn();
            return;
        }

        this.updateGameMessage(statusPrefix || "Waiting for play...");
    }

    nextTurn(statusPrefix?: string) {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
        // Skip dead/finished players
        let attempts = 0;
        while ((!this.players[this.currentTurnIndex].active) && attempts < this.players.length) {
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
            attempts++;
        }
        this.processTurn(statusPrefix);
    }

    async handlePlayCards(player: Player, cards: Card[]) {
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
            `🚨 **BLUFF WINDOW**: Anyone can call LIAR!`
        );

        setTimeout(() => {
            if (this.state === GameState.BLUFF_PHASE && this.lastPlay?.playerId === player.id) {
                this.endBluffPhase(false);
            }
        }, BLUFF_WINDOW_MS);
    }

    async endBluffPhase(wasChallenged: boolean, challenger?: Player) {
        if (this.state !== GameState.BLUFF_PHASE) return;

        if (!wasChallenged) {
            // Check if player won right here? 
            // startRound check handles it, but maybe we can announce early?
            // Actually, nextTurn -> processTurn -> checkWinCondition logic is safer in startRound or checkWinCondition.
            // We'll let the game flow to startRound/nextTurn logic.
            // Wait, startRound is only called after a Gun Event usually?
            // If I play cards and safe... I need to check if I am out?
            // A: Normal flow is: Play -> Bluff -> EndBluff -> NextTurn.
            // If I have 0 cards at EndBluff, I am effectively "Spectating" until... until what?
            // The Round continues. I just sit there with 0 cards.
            // But my turn won't come back up if nextTurn skips 0 cards?
            // Wait, I changed nextTurn to ONLY skip !active.
            // So if I have 0 cards and am active, I'd get a turn?
            // NO. I should trigger the "Winner" logic immediately if I am safe.

            // Let's call startRound logic style check here?
            const player = this.players.find(p => p.id === this.lastPlay!.playerId);
            if (player && player.hand.length === 0) {
                // Player finished safely!
                player.active = false;
                this.winners.push(player);
                const rank = this.getOrdinal(this.winners.length);
                this.channel.send(`🎉 **${player.username} finished their cards!** They take **${rank} Place**!`);
                if (this.checkWinCondition()) return;
            }

            this.state = GameState.PLAYING_TURN;
            this.nextTurn("✅ Nobody called Liar. Moving on.");
        } else {
            this.resolveChallenge(challenger!);
        }
    }

    resolveChallenge(challenger: Player) {
        if (!this.lastPlay) return;
        this.state = GameState.REVEAL;

        const playedCards = this.lastPlay.cards;
        const claimRank = this.roundRank;
        const isLiar = playedCards.some(c => c.rank !== claimRank);
        const accused = this.players.find(p => p.id === this.lastPlay!.playerId)!;

        // Reveal Text
        const revealStr = playedCards.map(c => `[${c.toString()}]`).join(' ');
        let gameMsg = "";

        if (isLiar) {
            gameMsg = `❌ **LIAR!** ${accused.username} played ${revealStr} (Claimed: ${claimRank}).`;
            this.triggerGun(accused, gameMsg);
        } else {
            gameMsg = `✅ **TRUTH!** ${accused.username} indeed played ${revealStr}.`;
            this.triggerGun(challenger, gameMsg);
        }
    }

    triggerGun(victim: Player, contextMsg: string) {
        const isDead = (Math.floor(Math.random() * 6)) === 0;
        let gunMsg = "";

        if (isDead) {
            gunMsg = `🔫 **${victim.username} pulls the trigger...**\n💥 **BANG!**\n☠️ ${victim.username} is eliminated.`;
            victim.active = false;
            victim.hand = [];
        } else {
            gunMsg = `🔫 **${victim.username} pulls the trigger...**\n😮‍💨 **CLICK!**\n➡️ ${victim.username} survives.\n🔄 Game continues...`;

            // If victim survived and has 0 cards, they WIN now (because they survived the challenge).
            if (victim.active && victim.hand.length === 0) {
                victim.active = false;
                this.winners.push(victim);
                const rank = this.getOrdinal(this.winners.length);
                gunMsg += `\n🎉 **${victim.username} finished cards and SURVIVED!** They take **${rank} Place**!`;
            }
        }

        const fullMsg = `${contextMsg}\n\n${gunMsg}`;
        this.channel.send(fullMsg);

        if (this.checkWinCondition()) return;

        setTimeout(() => {
            this.startRound();
        }, 5000);
    }

    checkWinCondition(): boolean {
        // Game ends when 0 or 1 active player remains.
        const activePlayers = this.players.filter(p => p.active);

        if (activePlayers.length <= 1) {
            this.state = GameState.GAME_OVER;

            // If 1 active left, they are the LOSER (Last Place).
            // All others (winners + dead) are ranked?
            // User said: "who finishes... is 2nd...". Implicitly last guy is last.

            let resultMsg = "🏆 **GAME OVER!**\n\n";

            // List Winners
            if (this.winners.length > 0) {
                this.winners.forEach((w, i) => {
                    resultMsg += `🥇 **${this.getOrdinal(i + 1)}**: ${w.username}\n`;
                });
            }

            // List Loser (Survivor)
            if (activePlayers.length === 1) {
                const loser = activePlayers[0];
                resultMsg += `🤡 **LOSER**: ${loser.username} (Stuck at the bar!)`;
            } else if (activePlayers.length === 0 && this.winners.length === 0) {
                resultMsg += "💀 Everyone died. No winners.";
            } else if (activePlayers.length === 0) {
                // Everyone finished or died
                resultMsg += "The bar is empty!";
            }

            this.channel.send(resultMsg);
            this.message?.delete().catch(() => { });
            return true;
        }

        return false;
    }

    getOrdinal(n: number): string {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    async updateGameMessage(statusText: string) {
        const color = this.state === GameState.BLUFF_PHASE ? 0x8B0000 : 0x2F3136;
        const currentPlayer = this.players[this.currentTurnIndex];

        // Ensure we don't crash if currentTurnIndex is out of bounds (can happen during race conditions)
        if (!currentPlayer) return;

        const embed = new EmbedBuilder()
            .setTitle(`🔫 LIAR'S BAR`)
            .setColor(color);

        // Show Winners in header if any?
        if (this.winners.length > 0) {
            embed.addFields({ name: '🏆 FINISHED', value: this.winners.map(w => w.username).join(', '), inline: false });
        }

        if (this.state !== GameState.LOBBY && this.state !== GameState.GAME_OVER && currentPlayer) {
            embed.addFields(
                { name: '👉 TURN', value: `${currentPlayer.username}\n🎯 Target Rank: **${this.roundRank}**`, inline: false }
            );
        }

        embed.setDescription(`**${statusText}**`);

        embed.addFields(
            { name: '🃏 TABLE', value: `• Cards in Pile: **${this.pile.length}**\n• Status: ${this.state}`, inline: true }
        );

        const playerList = this.players.map(p => {
            // Check if winner
            const isWinner = this.winners.some(w => w.id === p.id);
            if (isWinner) {
                return `🏆 **${p.username}**   ✅ SAFE`;
            }

            const isTurn = (this.state !== GameState.LOBBY && p.id === currentPlayer?.id);
            const pointer = isTurn ? '👉' : '👤';
            let statusIcon = p.active ? '🟢 ALIVE' : '💀 DEAD';
            const stats = p.active ? `| 🎴 ${p.hand.length}` : '';

            const name = isTurn ? `**${p.username}**` : p.username;
            return `${pointer} ${name}   ${statusIcon}  ${stats}`;
        }).join('\n');

        embed.addFields({ name: '👥 PLAYERS', value: playerList });

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const row1 = new ActionRowBuilder<ButtonBuilder>();

        if (this.state === GameState.LOBBY) {
            row1.addComponents(
                new ButtonBuilder().setCustomId('lb_join').setLabel('Join').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('lb_start').setLabel('Start').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('lb_end_game').setLabel('End Game').setStyle(ButtonStyle.Danger)
            );
        } else if (this.state === GameState.PLAYING_TURN) {
            row1.addComponents(
                new ButtonBuilder().setCustomId('lb_play').setLabel('Play Cards').setStyle(ButtonStyle.Primary).setEmoji('🎴'),
                new ButtonBuilder().setCustomId('lb_end_game').setLabel('End Game').setStyle(ButtonStyle.Danger)
            );
        } else if (this.state === GameState.BLUFF_PHASE) {
            row1.addComponents(
                new ButtonBuilder().setCustomId('lb_liar').setLabel('LIAR!').setStyle(ButtonStyle.Danger).setEmoji('❗'),
                new ButtonBuilder().setCustomId('lb_end_game').setLabel('End Game').setStyle(ButtonStyle.Danger)
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
