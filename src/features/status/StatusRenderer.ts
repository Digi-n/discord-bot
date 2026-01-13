import { createCanvas, CanvasRenderingContext2D } from 'canvas';

// Helper to format bytes
function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper to format uptime
function formatUptime(uptime: number) {
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}

interface GameStats {
    uno: number;
    c4: number;
    ttt: number;
}

export async function renderStatusImage(ping: number, history: number[], games: GameStats, isOffline: boolean = false) {
    const w = 400;
    const h = 200;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    // --- Colors (Cyberpunk Palette) ---
    const colors = {
        bg: '#050510',
        grid: isOffline ? '#401a1a' : '#1a1a40',
        text: isOffline ? '#ff0000' : '#00ffee',
        accent: isOffline ? '#ff0000' : '#ff00ff',
        success: '#00ff41',
        danger: '#ff0055',
        graphFill: isOffline ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 238, 0.2)',
        graphLine: isOffline ? '#ff0000' : '#00ffee'
    };

    // 1. Background Fill
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);

    // 2. Retro Grid Background
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    const gridSize = 20;

    ctx.beginPath();
    // Vertical lines
    for (let x = 0; x <= w; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    // Horizontal lines
    for (let y = 0; y <= h; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    ctx.stroke();

    // 3. Header
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 20px "Courier New"';
    ctx.fillText(isOffline ? '🔌 SYSTEM OFFLINE' : '⚡ SYSTEM MONITOR', 15, 30);

    // Uptime Badge (Right aligned)
    const uptimeText = isOffline ? "DISCONNECTED" : `UPTIME: ${formatUptime(process.uptime())}`;
    ctx.font = '12px "Courier New"';
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.accent;
    ctx.fillText(uptimeText, w - 15, 30);
    ctx.textAlign = 'left';

    // 4. Ping Graph (Left Side)
    const graphX = 15;
    const graphY = 60;
    const graphW = 180;
    const graphH = 80;

    // Graph Area Box
    ctx.strokeStyle = colors.graphLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(graphX, graphY, graphW, graphH);

    // Grid inside graph
    ctx.strokeStyle = 'rgba(0, 255, 238, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(graphX, graphY + graphH / 2);
    ctx.lineTo(graphX + graphW, graphY + graphH / 2); // Center line
    ctx.stroke();

    // Plot History
    if (history.length > 1) {
        ctx.beginPath();
        const maxPing = Math.max(...history, 200); // Scale to max observed or at least 200ms
        const stepX = graphW / (history.length - 1);

        history.forEach((val, i) => {
            const x = graphX + i * stepX;
            // Invert Y (0 is top)
            const normalizedHeight = Math.min(val / maxPing, 1);
            const y = (graphY + graphH) - (normalizedHeight * graphH);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        // Create gradient fill
        ctx.lineTo(graphX + graphW, graphY + graphH);
        ctx.lineTo(graphX, graphY + graphH);
        ctx.closePath();
        ctx.fillStyle = colors.graphFill;
        ctx.fill();

        // Stroke the line on top
        ctx.beginPath();
        history.forEach((val, i) => {
            const x = graphX + i * stepX;
            const normalizedHeight = Math.min(val / maxPing, 1);
            const y = (graphY + graphH) - (normalizedHeight * graphH);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = colors.graphLine;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Ping Text Overlay
    ctx.fillStyle = ping < 150 ? colors.success : colors.danger;
    ctx.font = 'bold 16px "Arial"';
    ctx.fillText(`${Math.round(ping)}ms`, graphX + 10, graphY + 20);


    // 5. System Stats (Right Side Top)
    const statsX = 220;
    const statsY = 60;
    const mem = process.memoryUsage();

    ctx.fillStyle = colors.text;
    ctx.font = '14px "Courier New"';
    ctx.fillText(`RAM USAGE: ${formatBytes(mem.heapUsed)}`, statsX, statsY + 15);

    // RAM Bar
    const totalMem = 512 * 1024 * 1024; // Mock 512MB max for visuals
    const usedPercent = Math.min(mem.heapUsed / totalMem, 1);

    ctx.fillStyle = '#333';
    ctx.fillRect(statsX, statsY + 25, 160, 6);
    ctx.fillStyle = colors.accent;
    ctx.fillRect(statsX, statsY + 25, 160 * usedPercent, 6);


    // 6. Active Games (Right Side Bottom)
    const gamesY = 110;
    ctx.fillStyle = colors.text;
    ctx.font = 'bold 14px "Courier New"';
    ctx.fillText('ACTIVE SESSIONS', statsX, gamesY);

    // Game Icons/Stats
    const drawGameStat = (label: string, count: number, x: number, y: number, color: string) => {
        // Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 50, 40);

        // Count
        ctx.fillStyle = color;
        ctx.font = 'bold 18px "Arial"';
        ctx.textAlign = 'center';
        ctx.fillText(count.toString(), x + 25, y + 20);

        // Label
        ctx.font = '10px "Courier New"';
        ctx.fillText(label, x + 25, y + 35);
        ctx.textAlign = 'left';
    };

    drawGameStat('UNO', games.uno, statsX, gamesY + 15, '#ff5555');
    drawGameStat('C4', games.c4, statsX + 60, gamesY + 15, '#ffff55');
    drawGameStat('TTT', games.ttt, statsX + 120, gamesY + 15, '#5555ff');


    // 7. Scanlines Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    for (let y = 0; y < h; y += 2) {
        ctx.fillRect(0, y, w, 1);
    }

    // CRT Vignette (Radial Gradient)
    const gradient = ctx.createRadialGradient(w / 2, h / 2, h / 3, w / 2, h / 2, w);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    return canvas.toBuffer();
}
