import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ButtonInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    User,
    MessageFlags,
    ComponentType
} from 'discord.js';
import { recordGameResult, updateLeaderboardMessage } from '../utils/leaderboard';

// Game Constants
const ROWS = 6;
const COLS = 7;
const EMPTY = '⚪';
const P1_TOKEN = '🔴';
const P2_TOKEN = '🟡';

interface GameState {
    board: string[][]; // [row][col]
    player1: User;
    player2: User;
    currentPlayer: User;
    gameOver: boolean;
}

// Store active games: MessageID -> GameState
const activeGames = new Map<string, GameState>();

export const data = new SlashCommandBuilder()
    .setName('connect4')
    .setDescription('Start a game of Connect 4')
    .addUserOption(option =>
        option.setName('opponent')
            .setDescription('The user you want to play against')
            .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
    const opponent = interaction.options.getUser('opponent');
    const player1 = interaction.user;

    if (!opponent) {
        return interaction.reply({ content: 'You must specify an opponent!', flags: MessageFlags.Ephemeral });
    }

    if (opponent.id === player1.id) {
        return interaction.reply({ content: 'You cannot play against yourself!', flags: MessageFlags.Ephemeral });
    }

    // Initialize Board (6 Rows, 7 Cols)
    const board = Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));

    const components = createControlButtons(false, false);
    const content = formatGameMessage(player1, opponent, player1, board);

    const response = await interaction.reply({
        content: content,
        components: components,
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
            // Try to edit if possible, otherwise reply ephemeral
            try {
                await interaction.update({ content: 'This game is no longer active.', components: [] });
            } catch {
                await interaction.reply({ content: 'This game is no longer active.', flags: MessageFlags.Ephemeral });
            }
            return;
        }

        // --- Handle Control Buttons ---
        if (interaction.customId === 'c4_rematch') {
            if (interaction.user.id !== game.player1.id && interaction.user.id !== game.player2.id) {
                return interaction.reply({ content: 'Only players can restart.', flags: MessageFlags.Ephemeral });
            }
            await restartGame(interaction, game);
            return;
        }

        if (interaction.customId === 'c4_end') {
            if (interaction.user.id !== game.player1.id && interaction.user.id !== game.player2.id) {
                return interaction.reply({ content: 'Only players can end the game.', flags: MessageFlags.Ephemeral });
            }
            activeGames.delete(interaction.message.id);
            await interaction.update({
                content: `🛑 **Connect 4 Ended**\n${game.player1} vs ${game.player2}\n\n_Powered by Narcos Dev_`,
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

        const colIndex = parseInt(interaction.customId.split('_')[2]); // c4_col_X

        // --- Player Move ---
        await makeMove(interaction, game, colIndex);

        // If game ended or it's still player's turn (invalid move), stop here.
        if (game.gameOver || game.currentPlayer.id === interaction.user.id) return;


        // --- Bot Move Logic ---
        if (game.player2.bot && game.currentPlayer.id === game.player2.id) {
            const botCol = getBestBotMove(game.board);

            // Apply Bot Move
            const rowIndex = getLowestEmptyRow(game.board, botCol);

            if (rowIndex !== -1) {
                game.board[rowIndex][botCol] = P2_TOKEN;

                if (checkWin(game.board, P2_TOKEN, rowIndex, botCol)) {
                    await handleGameEnd(interaction, game, P2_TOKEN, `🏆 **${game.player2} Wins!**`);
                    return;
                }

                if (checkDraw(game.board)) {
                    await handleGameEnd(interaction, game, P2_TOKEN, `🤝 **It's a Draw!**`);
                    return;
                }

                // Switch back to Player 1
                game.currentPlayer = game.player1;

                const content = formatGameMessage(game.player1, game.player2, game.currentPlayer, game.board);
                await interaction.message.edit({
                    content: content
                });
            }
        }

    } catch (error) {
        console.error("Connect4 Error:", error);
        try {
            if (!interaction.replied) {
                await interaction.reply({ content: "Error processing move.", flags: MessageFlags.Ephemeral });
            }
        } catch { }
    }
}

async function makeMove(interaction: ButtonInteraction, game: GameState, colIndex: number) {
    const rowIndex = getLowestEmptyRow(game.board, colIndex);

    if (rowIndex === -1) {
        await interaction.reply({ content: 'Column is full!', flags: MessageFlags.Ephemeral });
        return; // Turn does not switch
    }

    // Place Token
    const isPlayer1 = interaction.user.id === game.player1.id;
    const symbol = isPlayer1 ? P1_TOKEN : P2_TOKEN;
    game.board[rowIndex][colIndex] = symbol;

    // Check Win
    if (checkWin(game.board, symbol, rowIndex, colIndex)) {
        await handleGameEnd(interaction, game, symbol, `🏆 **${game.currentPlayer} Wins!**`);
        return;
    }

    // Check Draw (Board Full)
    if (checkDraw(game.board)) {
        await handleGameEnd(interaction, game, symbol, `🤝 **It's a Draw!**`);
        return;
    }

    // Switch Turn
    game.currentPlayer = isPlayer1 ? game.player2 : game.player1;

    // Update Message
    const content = formatGameMessage(game.player1, game.player2, game.currentPlayer, game.board);
    await interaction.update({
        content: content
    });
}

async function handleGameEnd(interaction: ButtonInteraction, game: GameState, lastSymbol: string, resultText: string) {
    game.gameOver = true;

    // Record Result
    // If it's a win, the resultText will contain 'Wins'
    const winner = resultText.includes('Wins') ? game.currentPlayer : null;
    try {
        recordGameResult(winner, game.player1, game.player2);
        updateLeaderboardMessage(interaction.client).catch(console.error);
    } catch (e) {
        console.error("Failed to record stats:", e);
    }

    // Don't delete from activeGames yet

    const finalContent = formatGameMessage(game.player1, game.player2, game.currentPlayer, game.board, resultText);
    const components = createControlButtons(true, true);

    if (interaction.replied || interaction.deferred) {
        await interaction.message.edit({
            content: finalContent,
            components: components
        });
    } else {
        await interaction.update({
            content: finalContent,
            components: components
        });
    }
}

async function restartGame(interaction: ButtonInteraction, game: GameState) {
    game.board = Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
    game.gameOver = false;
    game.currentPlayer = game.player1;

    const components = createControlButtons(false, false);
    const content = formatGameMessage(game.player1, game.player2, game.currentPlayer, game.board);

    await interaction.update({
        content: content,
        components: components
    });
}

function getLowestEmptyRow(board: string[][], col: number): number {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === EMPTY) {
            return r;
        }
    }
    return -1;
}

function checkDraw(board: string[][]): boolean {
    return board.every(row => row.every(cell => cell !== EMPTY));
}

function formatGameMessage(p1: User, p2: User, current: User, board: string[][], result?: string): string {
    let boardStr = "";
    for (let r = 0; r < ROWS; r++) {
        boardStr += board[r].join(" ") + "\n";
    }

    let status = result ? result : `🕒 **Turn:** ${current} (${current.id === p1.id ? P1_TOKEN : P2_TOKEN})`;

    return `🔴 **Connect 4** 🟡\n${p1} vs ${p2}\n\n${status}\n\n${boardStr}`;
}

function createControlButtons(disabled: boolean, showControls: boolean): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>();
    const row2 = new ActionRowBuilder<ButtonBuilder>();

    for (let i = 0; i < COLS; i++) {
        const btn = new ButtonBuilder()
            .setCustomId(`c4_col_${i}`)
            .setLabel(`${i + 1}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled);

        if (i < 4) {
            row1.addComponents(btn);
        } else {
            row2.addComponents(btn);
        }
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [row1, row2];

    if (showControls) {
        const controlRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('c4_rematch')
                    .setLabel('Play Again')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('c4_end')
                    .setLabel('End Game')
                    .setStyle(ButtonStyle.Secondary)
            );
        rows.push(controlRow);
    }

    return rows;
}

function checkWin(board: string[][], token: string, r: number, c: number): boolean {
    // Horizontal
    if (countDirection(board, r, c, 0, 1, token) + countDirection(board, r, c, 0, -1, token) >= 3) return true;

    // Vertical
    if (countDirection(board, r, c, 1, 0, token) + countDirection(board, r, c, -1, 0, token) >= 3) return true;

    // Diag 1 (\)
    if (countDirection(board, r, c, 1, 1, token) + countDirection(board, r, c, -1, -1, token) >= 3) return true;

    // Diag 2 (/)
    if (countDirection(board, r, c, 1, -1, token) + countDirection(board, r, c, -1, 1, token) >= 3) return true;

    return false;
}

function countDirection(board: string[][], r: number, c: number, dr: number, dc: number, token: string): number {
    let count = 0;
    let currR = r + dr;
    let currC = c + dc;

    while (currR >= 0 && currR < ROWS && currC >= 0 && currC < COLS && board[currR][currC] === token) {
        count++;
        currR += dr;
        currC += dc;
    }
    return count;
}


// --- AI STUFF ---

function getBestBotMove(board: string[][]): number {
    // First, check immediate win
    for (let c = 0; c < COLS; c++) {
        if (isValidLocation(board, c)) {
            let r = getLowestEmptyRow(board, c);
            if (checkWinWithBoard(board, P2_TOKEN, r, c)) return c;
        }
    }

    // Second, check immediate block
    for (let c = 0; c < COLS; c++) {
        if (isValidLocation(board, c)) {
            let r = getLowestEmptyRow(board, c);
            if (checkWinWithBoard(board, P1_TOKEN, r, c)) return c;
        }
    }

    // Minimax
    const { col } = minimax(board, 5, -Infinity, Infinity, true);
    return col;
}

function isValidLocation(board: string[][], col: number): boolean {
    return board[0][col] === EMPTY;
}

// Helper to check win without passing coords (scans whole board, suboptimal but clean for recursion)
function checkWinFull(board: string[][], token: string): boolean {
    // Check Horizontal
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS; r++) {
            if (board[r][c] == token && board[r][c + 1] == token && board[r][c + 2] == token && board[r][c + 3] == token) return true;
        }
    }
    // Check Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            if (board[r][c] == token && board[r + 1][c] == token && board[r + 2][c] == token && board[r + 3][c] == token) return true;
        }
    }
    // Diagonals
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            if (board[r][c] == token && board[r + 1][c + 1] == token && board[r + 2][c + 2] == token && board[r + 3][c + 3] == token) return true;
        }
    }
    for (let c = 0; c < COLS - 3; c++) {
        for (let r = 3; r < ROWS; r++) {
            if (board[r][c] == token && board[r - 1][c + 1] == token && board[r - 2][c + 2] == token && board[r - 3][c + 3] == token) return true;
        }
    }
    return false;
}

function checkWinWithBoard(board: string[][], token: string, r: number, c: number): boolean {
    return checkWinFull(board, token);
}

function evaluateWindow(window: string[], piece: string): number {
    let score = 0;
    const oppPiece = piece === P1_TOKEN ? P2_TOKEN : P1_TOKEN;

    let pieceCount = window.filter(c => c === piece).length;
    let emptyCount = window.filter(c => c === EMPTY).length;
    let oppCount = window.filter(c => c === oppPiece).length;

    if (pieceCount === 4) score += 100;
    else if (pieceCount === 3 && emptyCount === 1) score += 5;
    else if (pieceCount === 2 && emptyCount === 2) score += 2;

    if (oppCount === 3 && emptyCount === 1) score -= 4; // Block

    return score;
}

function scorePosition(board: string[][], piece: string): number {
    let score = 0;

    // Center Column Score
    const centerArray = [];
    for (let r = 0; r < ROWS; r++) centerArray.push(board[r][Math.floor(COLS / 2)]);
    const centerCount = centerArray.filter(c => c === piece).length;
    score += centerCount * 3;

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        const rowArray = board[r];
        for (let c = 0; c < COLS - 3; c++) {
            const window = rowArray.slice(c, c + 4);
            score += evaluateWindow(window, piece);
        }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
        const colArray = [];
        for (let r = 0; r < ROWS; r++) colArray.push(board[r][c]);
        for (let r = 0; r < ROWS - 3; r++) {
            const window = colArray.slice(r, r + 4);
            score += evaluateWindow(window, piece);
        }
    }

    // Diagonals
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            const window = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
            score += evaluateWindow(window, piece);
        }
    }
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            const window = [board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]];
            score += evaluateWindow(window, piece);
        }
    }

    return score;
}

// Returns [col, score]
function minimax(board: string[][], depth: number, alpha: number, beta: number, maximizingPlayer: boolean): { col: number, score: number } {
    const validLocations = [];
    for (let c = 0; c < COLS; c++) if (isValidLocation(board, c)) validLocations.push(c);

    const isTerminal = checkWinFull(board, P1_TOKEN) || checkWinFull(board, P2_TOKEN) || validLocations.length === 0;

    if (depth === 0 || isTerminal) {
        if (isTerminal) {
            if (checkWinFull(board, P2_TOKEN)) return { col: -1, score: 99999999 };
            else if (checkWinFull(board, P1_TOKEN)) return { col: -1, score: -99999999 }; // Minimize Opponent
            else return { col: -1, score: 0 };
        } else {
            return { col: -1, score: scorePosition(board, P2_TOKEN) };
        }
    }

    if (maximizingPlayer) {
        let value = -Infinity;
        let column = validLocations[Math.floor(Math.random() * validLocations.length)];

        for (const col of validLocations) {
            const row = getLowestEmptyRow(board, col);
            const bCopy = board.map(arr => [...arr]);
            bCopy[row][col] = P2_TOKEN;
            const newScore = minimax(bCopy, depth - 1, alpha, beta, false).score;

            if (newScore > value) {
                value = newScore;
                column = col;
            }
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return { col: column, score: value };
    } else {
        let value = Infinity;
        let column = validLocations[Math.floor(Math.random() * validLocations.length)];

        for (const col of validLocations) {
            const row = getLowestEmptyRow(board, col);
            const bCopy = board.map(arr => [...arr]);
            bCopy[row][col] = P1_TOKEN;
            const newScore = minimax(bCopy, depth - 1, alpha, beta, true).score;

            if (newScore < value) {
                value = newScore;
                column = col;
            }
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return { col: column, score: value };
    }
}
