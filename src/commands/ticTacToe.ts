import {
    SlashCommandBuilder,
    CommandInteraction,
    ButtonInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    User,
    ChatInputCommandInteraction,
    Message,
    MessageFlags
} from 'discord.js';
import { recordGameResult, updateLeaderboardMessage } from '../utils/leaderboard';

// Game state interface
interface GameState {
    board: (string | null)[];
    player1: User;
    player2: User;
    currentPlayer: User;
    gameOver: boolean;
}

// Store active games: MessageID -> GameState
const activeGames = new Map<string, GameState>();

export const data = new SlashCommandBuilder()
    .setName('ttt')
    .setDescription('Start a game of Tic-Tac-Toe')
    .addUserOption(option =>
        option.setName('opponent')
            .setDescription('The user you want to play against')
            .setRequired(true));

// Channel ID confirmation
const ALLOWED_CHANNEL_ID = '1459533059165520016';

export async function execute(interaction: ChatInputCommandInteraction) {
    if (interaction.channelId !== ALLOWED_CHANNEL_ID) {
        return interaction.reply({ content: `You can only play Tic-Tac-Toe in <#${ALLOWED_CHANNEL_ID}>!`, flags: MessageFlags.Ephemeral });
    }

    const opponent = interaction.options.getUser('opponent');
    const player1 = interaction.user;

    if (!opponent) {
        return interaction.reply({ content: 'You must specify an opponent!', flags: MessageFlags.Ephemeral });
    }

    // REMOVED bot check to allow play against bot
    if (opponent.id === player1.id) {
        return interaction.reply({ content: 'You cannot play against yourself!', flags: MessageFlags.Ephemeral });
    }

    await startGame(interaction, player1, opponent);
}

export async function startAgainstBot(message: Message) {
    if (message.channelId !== ALLOWED_CHANNEL_ID) {
        return message.reply(`Tic-Tac-Toe can only be played in <#${ALLOWED_CHANNEL_ID}>!`);
    }

    // If mentioned, start game: Player vs Bot
    const player1 = message.author;
    const opponent = message.client.user!; // Bot user

    // Initialize empty board
    const board = Array(9).fill(null);
    const rows = createBoardComponents(board, false);
    const content = formatGameMessage(player1, opponent, player1);

    const reply = await message.reply({
        content: content,
        components: rows
    });

    activeGames.set(reply.id, {
        board,
        player1,
        player2: opponent,
        currentPlayer: player1,
        gameOver: false
    });
}

// Shared start logic for interaction
async function startGame(interaction: ChatInputCommandInteraction, player1: User, opponent: User) {
    const board = Array(9).fill(null);
    const rows = createBoardComponents(board, false);
    const content = formatGameMessage(player1, opponent, player1);

    const response = await interaction.reply({
        content: content,
        components: rows,
        withResponse: true
    });

    const message = response.resource?.message || await interaction.fetchReply();

    activeGames.set(message.id, {
        board,
        player1,
        player2: opponent,
        currentPlayer: player1,
        gameOver: false
    });
}

export async function handleButton(interaction: ButtonInteraction) {
    try {
        const game = activeGames.get(interaction.message.id);

        if (!game) {
            return interaction.reply({ content: 'This game is no longer active.', flags: MessageFlags.Ephemeral });
        }

        // Handle Rematch/End buttons (allow even if game.gameOver is true)
        if (interaction.customId === 'ttt_rematch') {
            if (interaction.user.id !== game.player1.id && interaction.user.id !== game.player2.id) {
                return interaction.reply({ content: 'Only players can restart.', flags: MessageFlags.Ephemeral });
            }
            await restartGame(interaction, game);
            return;
        }

        if (interaction.customId === 'ttt_end') {
            if (interaction.user.id !== game.player1.id && interaction.user.id !== game.player2.id) {
                return interaction.reply({ content: 'Only players can end the game.', flags: MessageFlags.Ephemeral });
            }
            activeGames.delete(interaction.message.id);
            await interaction.update({
                content: `🛑 **Game Ended**\n${game.player1} vs ${game.player2}\n\n_Powered by Narcos Dev_`,
                components: []
            });
            return;
        }

        if (game.gameOver) {
            return interaction.reply({ content: 'This game is already over.', flags: MessageFlags.Ephemeral });
        }

        if (interaction.user.id !== game.currentPlayer.id) {
            if (interaction.user.id === game.player1.id || interaction.user.id === game.player2.id) {
                return interaction.reply({ content: 'It is not your turn!', flags: MessageFlags.Ephemeral });
            } else {
                return interaction.reply({ content: 'You are not a participant in this game.', flags: MessageFlags.Ephemeral });
            }
        }

        const index = parseInt(interaction.customId.split('_')[1]);

        if (game.board[index] !== null) {
            return interaction.reply({ content: 'This spot is already taken!', flags: MessageFlags.Ephemeral });
        }

        // --- Player 1 Move ---
        const isPlayer1 = interaction.user.id === game.player1.id;
        const symbol = isPlayer1 ? '❌' : '⭕';
        game.board[index] = symbol;

        let winningIndices = getWinningIndices(game.board);
        let isDraw = !winningIndices && game.board.every(cell => cell !== null);

        // Standard Game End Check
        if (winningIndices || isDraw) {
            await endGame(interaction, game, winningIndices, symbol);
            return;
        }

        // Switch Turn
        game.currentPlayer = isPlayer1 ? game.player2 : game.player1;

        // --- Bot Move Logic (If playing against bot) ---
        if (game.player2.bot && game.currentPlayer.id === game.player2.id) {
            // Find empty spots
            const emptyIndices = game.board.map((val, idx) => val === null ? idx : null).filter(val => val !== null) as number[];

            if (emptyIndices.length > 0) {
                // Minimax AI
                const botMoveIndex = getBestMove(game.board);

                // Fallback to random if something goes wrong (shouldn't happen)
                const moveIndex = botMoveIndex !== -1 ? botMoveIndex : emptyIndices[Math.floor(Math.random() * emptyIndices.length)];

                game.board[moveIndex] = '⭕'; // Bot is always Player 2

                // Check Win for Bot
                const botWinningIndices = getWinningIndices(game.board);
                const botIsDraw = !botWinningIndices && game.board.every(cell => cell !== null);

                if (botWinningIndices || botIsDraw) {
                    // Bot won or draw
                    game.currentPlayer = game.player2; // Ensure winner is set to bot
                    await endGame(interaction, game, botWinningIndices, '⭕');
                    return;
                }

                // Switch back to Player 1
                game.currentPlayer = game.player1;
            }
        }

        // --- Update UI for Next Turn ---
        const nextRows = createBoardComponents(game.board, false);
        const nextContent = formatGameMessage(game.player1, game.player2, game.currentPlayer);

        await interaction.update({
            content: nextContent,
            components: nextRows
        });

    } catch (error) {
        console.error('Error in TTT:', error);
        // Attempt to notify user if interaction is still valid
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while processing your move.', flags: MessageFlags.Ephemeral });
            }
        } catch (e) {
            // Ignore
        }
    }
}

async function endGame(interaction: ButtonInteraction, game: GameState, winningIndices: number[] | null, lastSymbol: string) {
    game.gameOver = true;

    // Record Result
    const winner = winningIndices ? game.currentPlayer : null;
    recordGameResult(winner, game.player1, game.player2);

    // Update Leaderboard immediately (fire and forget)
    updateLeaderboardMessage(interaction.client).catch(console.error);

    // Don't delete from activeGames yet to allow Rematch/End

    const endRows = createBoardComponents(game.board, true, winningIndices || []);

    // Add Control Row
    const controlRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('ttt_rematch')
                .setLabel('Play Again')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('ttt_end')
                .setLabel('End Game')
                .setStyle(ButtonStyle.Secondary)
        );

    // Cast because TS array types can be tricky with heterogenous ActionRows
    const components = [...endRows, controlRow] as ActionRowBuilder<ButtonBuilder>[];

    let resultText = '';
    if (winningIndices) {
        resultText = `🏆 **Winner:** ${game.currentPlayer}!`;
    } else {
        resultText = `🤝 **It's a Draw!**`;
    }

    const finalContent = `🎮 **Tic-Tac-Toe**\n${game.player1} vs ${game.player2}\n\n${resultText}\n\n_Powered by Narcos Dev_`;

    await interaction.update({
        content: finalContent,
        components: components
    });
}

async function restartGame(interaction: ButtonInteraction, game: GameState) {
    game.board = Array(9).fill(null);
    game.gameOver = false;
    game.currentPlayer = game.player1; // Reset to Player 1 starts

    const rows = createBoardComponents(game.board, false);
    const content = formatGameMessage(game.player1, game.player2, game.currentPlayer);

    await interaction.update({
        content: content,
        components: rows
    });
}

function formatGameMessage(player1: User, player2: User, currentTurn: User): string {
    return `🎮 **Tic-Tac-Toe**\n${player1} vs ${player2}\n🕒 **Turn:** ${currentTurn}\n\n_Powered by Narcos Dev_`;
}

function createBoardComponents(board: (string | null)[], disabled: boolean, winningIndices: number[] = []): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (let j = 0; j < 3; j++) {
            const index = i * 3 + j;
            const cell = board[index];
            const isWinningCell = winningIndices.includes(index);

            // Style Logic:
            // Default (Empty) = Secondary
            // X and O used = Primary (Light Blue/Blurple)
            // Winning Cell = Success (Green)

            let style = ButtonStyle.Secondary;

            // If cell is occupied (X or O), make it Primary (Blue)
            if (cell !== null) {
                style = ButtonStyle.Primary;
            }

            // If it's a winning cell, turn it GREEN (Success)
            if (isWinningCell) {
                style = ButtonStyle.Success;
            }

            const button = new ButtonBuilder()
                .setCustomId(`ttt_${index}`)
                .setStyle(style)
                .setLabel(cell || '\u200b') // Zero Width Space for empty feel
                .setDisabled(disabled || cell !== null); // Disable if game over or cell taken

            row.addComponents(button);
        }
        rows.push(row);
    }
    return rows;
}

function getWinningIndices(board: (string | null)[]): number[] | null {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
        [0, 4, 8], [2, 4, 6]             // Diags
    ];

    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return [a, b, c];
        }
    }
    return null;
}

// Kept for compatibility if used elsewhere, but simply delegating
function checkWin(board: (string | null)[]): boolean {
    return getWinningIndices(board) !== null;
}

function checkWinnerSymbol(board: (string | null)[]): string | null {
    const indices = getWinningIndices(board);
    if (indices) {
        return board[indices[0]];
    }
    return null;
}

function minimax(board: (string | null)[], depth: number, isMaximizing: boolean): number {
    const winner = checkWinnerSymbol(board);
    if (winner === '⭕') return 10 - depth;
    if (winner === '❌') return depth - 10;
    if (board.every(cell => cell !== null)) return 0;

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = '⭕';
                let score = minimax(board, depth + 1, false);
                board[i] = null;
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
                board[i] = '❌';
                let score = minimax(board, depth + 1, true);
                board[i] = null;
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

function getBestMove(board: (string | null)[]): number {
    let bestScore = -Infinity;
    let move = -1;
    // Optimize: if it's the very first move of the bot and center is open, take it.
    // Minimax is fast enough for 3x3 but let's be safe.
    // Actually, minimax handles it.

    for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
            board[i] = '⭕';
            let score = minimax(board, 0, false);
            board[i] = null;

            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    }
    return move;
}
