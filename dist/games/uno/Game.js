"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = exports.GameState = void 0;
const discord_js_1 = require("discord.js");
const Player_1 = require("./Player");
const Deck_1 = require("./Deck");
const leaderboard_1 = require("../../utils/leaderboard");
var GameState;
(function (GameState) {
    GameState[GameState["LOBBY"] = 0] = "LOBBY";
    GameState[GameState["PLAYING"] = 1] = "PLAYING";
    GameState[GameState["ENDED"] = 2] = "ENDED";
})(GameState || (exports.GameState = GameState = {}));
class Game {
    interaction;
    channelId;
    players;
    hostId;
    state;
    message;
    deck;
    topCard = null;
    currentPlayerIndex = 0;
    direction = 1; // 1 for clockwise, -1 for counter-clockwise
    pendingWildPlay = null;
    constructor(interaction) {
        this.interaction = interaction;
        this.channelId = interaction.channelId;
        this.players = [];
        this.hostId = interaction.user.id;
        this.state = GameState.LOBBY;
        this.deck = new Deck_1.Deck();
    }
    async init() {
        try {
            this.addPlayer(this.hostId, this.interaction.user.username, this.interaction, true);
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId('uno_join')
                .setLabel('Join Game')
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId('uno_start')
                .setLabel('Start Game')
                .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                .setCustomId('uno_cancel')
                .setLabel('Cancel Game')
                .setStyle(discord_js_1.ButtonStyle.Danger));
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🃏 UNO Game Created!')
                .setDescription(`Click the buttons below to join.`)
                .setColor(discord_js_1.Colors.Red)
                .addFields({ name: 'Host', value: `<@${this.hostId}>`, inline: true }, { name: 'Players', value: `${this.players.length}/10`, inline: true }, { name: 'Player List', value: `<@${this.hostId}>` })
                .setFooter({ text: 'Waiting for players...' })
                .setTimestamp();
            await this.interaction.reply({
                embeds: [embed],
                components: [row]
            });
            this.message = await this.interaction.fetchReply();
            console.log('✅ UNO Game Created message sent.');
        }
        catch (error) {
            console.error('❌ Error sending UNO Game Created message:', error);
        }
    }
    // ... (existing code for addPlayer, startGame, etc.)
    async updateLobbyMessage() {
        try {
            const playerList = this.players.map(p => `<@${p.id}>`).join('\n• ');
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🃏 UNO Game Created!')
                .setDescription(`Click the buttons below to join.`)
                .setColor(discord_js_1.Colors.Red)
                .addFields({ name: 'Host', value: `<@${this.hostId}>`, inline: true }, { name: 'Players', value: `${this.players.length}/10`, inline: true }, { name: 'Player List', value: `• ${playerList}` })
                .setFooter({ text: 'Waiting for players...' })
                .setTimestamp();
            await this.message.edit({
                content: '', // Clear any plain text content
                embeds: [embed]
            });
        }
        catch (error) {
            console.error('Failed to update lobby message:', error);
        }
    }
    async addPlayer(userId, username, interaction, isSilent = false) {
        if (this.players.some(p => p.id === userId)) {
            if (!isSilent)
                return interaction.reply({ content: '❌ You are already in the game!', ephemeral: true });
            return;
        }
        if (this.state !== GameState.LOBBY) {
            if (!isSilent)
                return interaction.reply({ content: '❌ Game has already started!', ephemeral: true });
            return;
        }
        if (this.players.length >= 10) {
            if (!isSilent)
                return interaction.reply({ content: '❌ Lobby is full!', ephemeral: true });
            return;
        }
        const newPlayer = new Player_1.Player(userId, username);
        this.players.push(newPlayer);
        if (!isSilent) {
            try {
                // Defer the button update so it doesn't show "interaction failed"
                await interaction.deferUpdate();
            }
            catch (e) { }
            await this.updateLobbyMessage();
        }
    }
    async startGame(userId, interaction) {
        if (userId !== this.hostId) {
            return interaction.reply({ content: '❌ Only the host can start the game!', ephemeral: true });
        }
        if (this.players.length < 2) {
            return interaction.reply({ content: '❌ Need at least 2 players to start!', ephemeral: true });
        }
        this.state = GameState.PLAYING;
        // 1. Determine first card (cannot be Wild+4 for start, usually)
        do {
            this.topCard = this.deck.draw();
        } while (this.topCard.value === 'wild4');
        // 2. Randomize starting player
        this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
        // 3. Deal 7 cards to each player
        for (const player of this.players) {
            for (let i = 0; i < 7; i++) {
                player.addCard(this.deck.draw());
            }
        }
        // 4. Send Public Game Board
        await interaction.reply({ content: '▶️ **UNO Game Starting!**', ephemeral: false });
        this.message = await interaction.channel.send(this.getBoardMessage());
        console.log(`UNO Game started in ${this.channelId}. Top card: ${this.topCard?.toString()}`);
        // 5. Send Hands to Players
        await this.sendHandsToPlayers();
    }
    getCardImageUrl(card) {
        if (!card)
            return '';
        let colorHex = '000000';
        let text = card.value.toString();
        let textColor = 'ffffff';
        switch (card.color) {
            case 'red':
                colorHex = 'FF5555';
                break;
            case 'blue':
                colorHex = '5555FF';
                break;
            case 'green':
                colorHex = '55AA55';
                break;
            case 'yellow':
                colorHex = 'FFAA00';
                break;
            case 'wild':
                colorHex = '000000';
                text = card.value === 'wild4' ? '+4' : 'Wild';
                break;
        }
        // Special value handling for display
        if (card.value === 'skip')
            text = '⊘';
        if (card.value === 'reverse')
            text = '⇄';
        if (card.value === 'draw2')
            text = '+2';
        // Encode text for URL
        const encodedText = encodeURIComponent(text);
        return `https://placehold.co/200x300/${colorHex}/${textColor}.png?text=${encodedText}`;
    }
    getBoardMessage() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        const nextPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
        const nextPlayer = this.players[nextPlayerIndex];
        // Row 1: Action Buttons Including "Table" and "Leave"
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('uno_view_hand')
            .setLabel('Show Hand')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('🃏'), new discord_js_1.ButtonBuilder()
            .setCustomId('uno_table')
            .setLabel('Table')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🔄'), new discord_js_1.ButtonBuilder()
            .setCustomId('uno_leave')
            .setLabel('Leave')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('🚪'));
        // Spec: "Title: UNO!", "Description: Turn info", "Thumbnail: Card Image"
        const topCardName = this.topCard ? `${this.topCard.color.toUpperCase()} ${this.topCard.value.toString().toUpperCase()}` : 'None';
        const cardImageUrl = this.getCardImageUrl(this.topCard);
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('UNO!')
            .setDescription(`**It is now ${currentPlayer.username}'s turn!**\n\n` +
            `The game has begun with ${this.players.length} players!\n\n` +
            `**The currently flipped card is: ${topCardName}**`)
            .setThumbnail(cardImageUrl)
            .setColor(this.topCard?.color === 'wild' ? 0x000000 :
            this.topCard?.color === 'red' ? discord_js_1.Colors.Red :
                this.topCard?.color === 'blue' ? discord_js_1.Colors.Blue :
                    this.topCard?.color === 'green' ? discord_js_1.Colors.Green :
                        this.topCard?.color === 'yellow' ? discord_js_1.Colors.Gold : discord_js_1.Colors.White)
            .setFooter({ text: `Decks: 1(108) | Remaining: ${this.deck.count()} | Discarded: -` });
        return {
            content: '',
            embeds: [embed],
            components: [row]
        };
    }
    async sendHandsToPlayers() {
        for (const player of this.players) {
            try {
                // We'll rely on "View Hand" button primarily, but could try to DM if we wanted.
                // For this implementation, we won't spam DMs/ephemerals on every turn start unless it's their turn?
                // Actually, the best UX is:
                // 1. Board updates.
                // 2. We try to send an ephemeral message to the current player if they interacted recently? No, unreliable.
                // 3. User clicks "View Hand" to see their cards and play.
                console.log(`Turn started for ${player.username}`);
            }
            catch (e) {
                console.error(`Error in loop for ${player.username}`);
            }
        }
    }
    async cancelGame(interaction) {
        if (interaction.user.id !== this.hostId) {
            return interaction.reply({ content: '❌ Only the host can cancel the game!', ephemeral: true });
        }
        this.state = GameState.ENDED;
        await interaction.reply({ content: '🚫 **Game Cancelled by Host!**' });
        // Disable lobby buttons
        if (this.message) {
            try {
                await this.message.edit({ components: [] });
            }
            catch (e) { }
        }
    }
    getButtonStyle(color) {
        switch (color) {
            case 'red': return discord_js_1.ButtonStyle.Danger;
            case 'blue': return discord_js_1.ButtonStyle.Primary;
            case 'green': return discord_js_1.ButtonStyle.Success;
            case 'yellow': return discord_js_1.ButtonStyle.Secondary;
            default: return discord_js_1.ButtonStyle.Secondary;
        }
    }
    async handleSayUno(interaction) {
        const player = this.players.find(p => p.id === interaction.user.id);
        if (!player)
            return interaction.reply({ content: '❌ Not in game.', ephemeral: true });
        player.saidUno = true;
        await interaction.reply({ content: '📢 **You shouted UNO!**', ephemeral: true });
    }
    // Handles any UNO interaction (Play, Draw, View Hand)
    async handleInteraction(interaction) {
        if (interaction.customId === 'uno_view_hand') {
            await this.handleViewHand(interaction);
        }
        else if (interaction.customId === 'uno_table') {
            await interaction.deferUpdate();
            await this.updateBoard();
        }
        else if (interaction.customId === 'uno_leave') {
            await this.handleLeave(interaction);
        }
        else if (interaction.customId === 'uno_draw') {
            await this.handleDraw(interaction);
        }
        else if (interaction.customId.startsWith('uno_play_')) {
            const cardIndex = parseInt(interaction.customId.split('_')[2]);
            await this.handlePlay(interaction, cardIndex);
        }
        else if (interaction.customId.startsWith('uno_color_')) {
            await this.handleColorSelect(interaction);
        }
        else if (interaction.customId === 'uno_draw_play') {
            await this.handleDrawDecision(interaction, true);
        }
        else if (interaction.customId === 'uno_draw_pass') {
            await this.handleDrawDecision(interaction, false);
        }
        else if (interaction.customId === 'uno_say_uno') {
            await this.handleSayUno(interaction);
        }
    }
    async handleLeave(interaction) {
        const playerIndex = this.players.findIndex(p => p.id === interaction.user.id);
        if (playerIndex === -1)
            return interaction.reply({ content: '❌ You are not in the game.', ephemeral: true });
        const player = this.players[playerIndex];
        this.players.splice(playerIndex, 1);
        // If current player left, check turn
        if (playerIndex === this.currentPlayerIndex) {
            this.nextTurn();
        }
        else if (playerIndex < this.currentPlayerIndex) {
            this.currentPlayerIndex--; // Shift index
        }
        await interaction.reply({ content: `🚪 **${player.username}** left the game.`, ephemeral: false });
        if (this.players.length < 2) {
            this.state = GameState.ENDED;
            await interaction.followUp({ content: '🚫 **Game Ended** (Not enough players).' });
            await this.message.edit({ components: [] });
            return;
        }
        await this.updateBoard();
    }
    async handleViewHand(interaction) {
        const player = this.players.find(p => p.id === interaction.user.id);
        if (!player)
            return interaction.reply({ content: '❌ You are not in this game.', ephemeral: true });
        const rows = [];
        let currentRow = new discord_js_1.ActionRowBuilder();
        // Add "Draw Card" button
        currentRow.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('uno_draw')
            .setLabel('Draw Card')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🃏'), new discord_js_1.ButtonBuilder()
            .setCustomId('uno_say_uno')
            .setLabel('UNO!')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('📢'));
        player.hand.forEach((card, index) => {
            if (currentRow.components.length >= 5) {
                rows.push(currentRow);
                currentRow = new discord_js_1.ActionRowBuilder();
            }
            currentRow.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`uno_play_${index}`)
                .setLabel(`${card.toString()}`)
                .setStyle(this.getButtonStyle(card.color)));
        });
        rows.push(currentRow);
        const isMyTurn = this.players[this.currentPlayerIndex].id === player.id;
        const turnText = isMyTurn ? "**It is YOUR turn!** 🟢" : `It is <@${this.players[this.currentPlayerIndex].id}>'s turn. 🔴`;
        await interaction.reply({
            content: `🃏 **Your Hand**\n${turnText}`,
            components: rows,
            ephemeral: true
        });
    }
    async handleDraw(interaction) {
        const player = this.players[this.currentPlayerIndex];
        if (interaction.user.id !== player.id) {
            return interaction.reply({ content: '❌ It is not your turn!', ephemeral: true });
        }
        const card = this.deck.draw();
        player.addCard(card);
        // Check if playable
        const top = this.topCard;
        const isPlayable = (card.color === 'wild') || (card.color === top.color) || (card.value === top.value);
        if (isPlayable) {
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('uno_draw_play').setLabel('Play it!').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('uno_draw_pass').setLabel('Keep it').setStyle(discord_js_1.ButtonStyle.Secondary));
            await interaction.reply({
                content: `You drew **${card.toString()}**. It is playable!`,
                components: [row],
                ephemeral: true
            });
        }
        else {
            await interaction.reply({ content: `You drew **${card.toString()}**. (Not playable)`, ephemeral: true });
            this.nextTurn();
            await this.updateBoard();
        }
    }
    async handleDrawDecision(interaction, play) {
        const player = this.players[this.currentPlayerIndex];
        if (interaction.user.id !== player.id)
            return;
        if (play) {
            const cardIndex = player.hand.length - 1;
            const card = player.hand[cardIndex];
            if (card.color === 'wild') {
                await this.handlePlay(interaction, cardIndex);
            }
            else {
                await this.executePlay(interaction, player, card, cardIndex);
            }
        }
        else {
            await interaction.update({ content: 'You kept the card.', components: [] });
            this.nextTurn();
            await this.updateBoard();
        }
    }
    async handlePlay(interaction, cardIndex) {
        const player = this.players[this.currentPlayerIndex];
        if (interaction.user.id !== player.id) {
            return interaction.reply({ content: '❌ It is not your turn!', ephemeral: true });
        }
        if (cardIndex >= player.hand.length) {
            return interaction.reply({ content: '❌ Card not found!', ephemeral: true });
        }
        const card = player.hand[cardIndex];
        // Wild Card Handling: Prompt for Color
        if (card.color === 'wild') {
            this.pendingWildPlay = { cardIndex, originalInteraction: interaction };
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('uno_color_red').setLabel('Red').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId('uno_color_blue').setLabel('Blue').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId('uno_color_green').setLabel('Green').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('uno_color_yellow').setLabel('Yellow').setStyle(discord_js_1.ButtonStyle.Secondary));
            return interaction.reply({ content: '🎨 **Choose a color:**', components: [row], ephemeral: true });
        }
        // Standard Play Validation and Execution
        await this.executePlay(interaction, player, card, cardIndex);
    }
    async handleColorSelect(interaction) {
        const player = this.players[this.currentPlayerIndex];
        if (interaction.user.id !== player.id || !this.pendingWildPlay) {
            return interaction.reply({ content: '❌ Invalid action.', ephemeral: true });
        }
        const color = interaction.customId.split('_')[2];
        const { cardIndex } = this.pendingWildPlay;
        const card = player.hand[cardIndex];
        await this.executePlay(interaction, player, card, cardIndex, color);
        this.pendingWildPlay = null;
    }
    async executePlay(interaction, player, card, cardIndex, wildColor) {
        // Validation
        const top = this.topCard;
        if (!wildColor) {
            if (card.color !== 'wild' && card.color !== top.color && card.value !== top.value) {
                return interaction.reply({ content: `❌ You cannot play ${card.toString()} on ${top.toString()}`, ephemeral: true });
            }
        }
        // Remove card from hand
        player.hand.splice(cardIndex, 1);
        // Update Top Card
        this.topCard = wildColor ? { ...card, color: wildColor, toString: () => `WILD (${wildColor.toUpperCase()})` } : card;
        // Check Win
        // Check Win
        if (player.hand.length === 0) {
            this.state = GameState.ENDED;
            // Scoreboard: Winner first, then sorted by least cards
            const rankedPlayers = this.players
                .map(p => ({ ...p, cardCount: p.hand.length }))
                .sort((a, b) => a.cardCount - b.cardCount);
            // Award Points to Top 3
            if (rankedPlayers[0])
                (0, leaderboard_1.addPoints)({ id: rankedPlayers[0].id, username: rankedPlayers[0].username }, 10);
            if (rankedPlayers[1])
                (0, leaderboard_1.addPoints)({ id: rankedPlayers[1].id, username: rankedPlayers[1].username }, 5);
            if (rankedPlayers[2])
                (0, leaderboard_1.addPoints)({ id: rankedPlayers[2].id, username: rankedPlayers[2].username }, 3);
            // Record Stats
            try {
                (0, leaderboard_1.recordMultiplayerGameResult)({ id: player.id, username: player.username }, this.players, 'uno');
                (0, leaderboard_1.updateLeaderboardMessage)(this.interaction.client).catch(console.error);
            }
            catch (e) {
                console.error("Failed to update stats:", e);
            }
            const scoreboard = rankedPlayers.map((p, i) => {
                let medal = '🎲';
                let points = '';
                if (i === 0) {
                    medal = '🥇';
                    points = '(+10 pts)';
                }
                else if (i === 1) {
                    medal = '🥈';
                    points = '(+5 pts)';
                }
                else if (i === 2) {
                    medal = '🥉';
                    points = '(+3 pts)';
                }
                return `${medal} **${p.username}** - ${p.cardCount} cards left ${points}`;
            }).join('\n');
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('Game Over - We Have a Winner!')
                .setDescription(`Congratulations to <@${player.id}> for winning the game! 🎉\n\n**Scoreboard:**\n${scoreboard}`)
                .setColor(discord_js_1.Colors.Green)
                .setFooter({ text: 'Points have been awarded to the Top 3 players! Use /leaderboard to check ranks.' });
            await interaction.reply({ embeds: [embed], ephemeral: false });
            return;
        }
        let message = wildColor ? `You played WILD and chose ${wildColor.toUpperCase()}` : `You played ${card.toString()}`;
        // UNO Penalty Check
        if (player.hand.length === 1) {
            if (!player.saidUno) {
                message += `\n⚠️ **Forgot to say UNO!** (+2 Cards penalty)`;
                player.addCard(this.deck.draw());
                player.addCard(this.deck.draw());
            }
            else {
                message += `\n📢 **UNO!**`;
            }
        }
        // Apply Effects
        if (card.value === 'skip') {
            this.nextTurn();
            message += ` (Skipped next player)`;
        }
        else if (card.value === 'reverse') {
            this.direction *= -1;
            if (this.players.length === 2)
                this.nextTurn();
            message += ` (Reversed direction)`;
        }
        else if (card.value === 'draw2') {
            const nextIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
            this.players[nextIndex].addCard(this.deck.draw());
            this.players[nextIndex].addCard(this.deck.draw());
            message += ` (Next player drew 2)`;
            this.nextTurn();
        }
        else if (card.value === 'wild4') {
            const nextIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
            for (let i = 0; i < 4; i++)
                this.players[nextIndex].addCard(this.deck.draw());
            this.nextTurn();
        }
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: message, ephemeral: true });
        }
        else {
            await interaction.update({ content: message, components: [] });
        }
        this.nextTurn();
        await this.updateBoard();
    }
    nextTurn() {
        // Reset saidUno state for the current player as their turn ends
        const currentPlayer = this.players[this.currentPlayerIndex];
        currentPlayer.saidUno = false;
        this.currentPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
    }
    async updateBoard() {
        if (this.state === GameState.ENDED)
            return;
        try {
            await this.message.edit(this.getBoardMessage());
        }
        catch (e) {
            console.error('Failed to update board');
        }
    }
}
exports.Game = Game;
