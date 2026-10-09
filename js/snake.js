import { getConfig } from './config.js';

/* ═══════════ 状态 ═══════════ */

let canvas, ctx;
let W, H, DPR, CELL, COLS, ROWS;
let snake = [];
let dir = [1, 0];
let pendingDirs = [];
let food = { x: 0, y: 0 };

let canvasOpacity = 0.55;
let maxLength = 60;
let aiTickMs = 130;
let playerTickMs = 95;
let currentTickMs = 130;

let accum = 0;
let lastT = 0;
let running = false;

let colors = {
    body: '#7ee787',
    food: '#58a6ff',
    text: '#c9d1d9',
    dim: '#6e7681'
};

let mode = 'ai';
let score = 0;
let highScore = 0;
let onModeChangeCallback = null;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const HIGH_SCORE_KEY = 'leipishu-snake-highscore';

/* ═══════════ 工具 ═══════════ */

function randInt(n) { return Math.floor(Math.random() * n); }
function keyOf(x, y) { return x + ',' + y; }
function isPlayerMode() { return mode !== 'ai'; }

function loadHighScore() {
    try {
        const v = localStorage.getItem(HIGH_SCORE_KEY);
        return v ? parseInt(v, 10) || 0 : 0;
    } catch (e) { return 0; }
}

function saveHighScore() {
    try {
        localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    } catch (e) { /* ignore */ }
}

/* ═══════════ 路径搜索（AI） ═══════════ */

function bfs(sx, sy, gx, gy, blocked) {
    const cameFrom = new Map();
    cameFrom.set(keyOf(sx, sy), null);
    const queue = [[sx, sy]];

    while (queue.length) {
        const [x, y] = queue.shift();
        if (x === gx && y === gy) {
            const path = [];
            let cur = keyOf(x, y);
            while (cur !== null) {
                const parts = cur.split(',');
                path.unshift({ x: +parts[0], y: +parts[1] });
                cur = cameFrom.get(cur);
            }
            return path;
        }
        for (let i = 0; i < DIRS.length; i++) {
            const nx = x + DIRS[i][0], ny = y + DIRS[i][1];
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
            const k = keyOf(nx, ny);
            if (cameFrom.has(k) || blocked.has(k)) continue;
            cameFrom.set(k, keyOf(x, y));
            queue.push([nx, ny]);
        }
    }
    return null;
}

function floodCount(sx, sy, blocked) {
    const stack = [[sx, sy]];
    const seen = new Set([keyOf(sx, sy)]);
    let count = 0;
    while (stack.length) {
        const cell = stack.pop();
        count++;
        for (let i = 0; i < DIRS.length; i++) {
            const nx = cell[0] + DIRS[i][0];
            const ny = cell[1] + DIRS[i][1];
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
            const k = keyOf(nx, ny);
            if (seen.has(k) || blocked.has(k)) continue;
            seen.add(k);
            stack.push([nx, ny]);
        }
    }
    return count;
}

/* ═══════════ AI 决策 ═══════════ */

function decide() {
    const head = snake[0];
    const tail = snake[snake.length - 1];
    const n = snake.length;

    const blocked = new Set();
    for (let i = 0; i < n - 1; i++) {
        blocked.add(keyOf(snake[i].x, snake[i].y));
    }

    const candidates = [];
    for (let i = 0; i < DIRS.length; i++) {
        const d = DIRS[i];
        if (d[0] === -dir[0] && d[1] === -dir[1]) continue;
        candidates.push(d);
    }

    const foodPath = bfs(head.x, head.y, food.x, food.y, blocked);
    let nextOnPath = null;
    if (foodPath && foodPath.length >= 2) {
        nextOnPath = foodPath[1];
    }

    let bestDir = null;
    let bestScore = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
        const dx = candidates[i][0], dy = candidates[i][1];
        const nx = head.x + dx, ny = head.y + dy;

        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (blocked.has(keyOf(nx, ny))) continue;

        const after = new Set(blocked);
        after.add(keyOf(head.x, head.y));
        after.delete(keyOf(tail.x, tail.y));

        const space = floodCount(nx, ny, after);

        let score2 = space;
        if (nextOnPath && nextOnPath.x === nx && nextOnPath.y === ny) score2 += 100000;
        if (space < snake.length) score2 -= 50000;

        if (score2 > bestScore) {
            bestScore = score2;
            bestDir = [dx, dy];
        }
    }

    if (bestDir) dir = bestDir;
}

/* ═══════════ 输入缓冲 ═══════════ */

function consumePendingDirs() {
    while (pendingDirs.length > 0) {
        const nd = pendingDirs.shift();
        if (nd[0] === -dir[0] && nd[1] === -dir[1]) continue;
        if (nd[0] === dir[0] && nd[1] === dir[1]) continue;
        dir = nd;
        return;
    }
}

/* ═══════════ 游戏逻辑 ═══════════ */

function spawnFood() {
    const occupied = new Set();
    for (let i = 0; i < snake.length; i++) {
        occupied.add(keyOf(snake[i].x, snake[i].y));
    }
    const free = [];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (!occupied.has(keyOf(x, y))) free.push({ x: x, y: y });
        }
    }
    if (!free.length) return;
    food = free[randInt(free.length)];
}

function reset() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = [
        { x: cx,     y: cy },
        { x: cx - 1, y: cy },
        { x: cx - 2, y: cy }
    ];
    dir = [1, 0];
    pendingDirs = [];
    spawnFood();
}

function gameOver() {
    mode = 'gameover';
    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }
    notifyModeChange();
}

function step() {
    if (mode === 'paused' || mode === 'gameover') return;

    if (mode === 'ai') {
        decide();
    } else {
        consumePendingDirs();
    }

    const head = snake[0];
    const nx = head.x + dir[0];
    const ny = head.y + dir[1];

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
        if (isPlayerMode()) return gameOver();
        return reset();
    }

    const willEat = (nx === food.x && ny === food.y);
    const bodyEnd = willEat ? snake.length : snake.length - 1;

    for (let i = 0; i < bodyEnd; i++) {
        if (snake[i].x === nx && snake[i].y === ny) {
            if (isPlayerMode()) return gameOver();
            return reset();
        }
    }

    snake.unshift({ x: nx, y: ny });

    if (willEat) {
        if (isPlayerMode()) score++;
        const limit = isPlayerMode() ? 9999 : maxLength;
        while (snake.length > limit) snake.pop();
        spawnFood();
    } else {
        snake.pop();
    }
}

/* ═══════════ 绘制 ═══════════ */

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * 画一个胶囊卡片，右对齐到 rightX。
 * @returns {number} 卡片宽度
 */
function drawPill(text, rightX, y, options) {
    ctx.font = 'bold 11px ui-monospace, "SF Mono", "JetBrains Mono", monospace';

    const tw = Math.ceil(ctx.measureText(text).width);
    const padX = 9;
    const w = tw + padX * 2;
    const h = 20;
    const x = rightX - w;

    // 背景
    ctx.fillStyle = options.bg;
    roundRect(x, y, w, h, 5);
    ctx.fill();

    // 边框
    ctx.strokeStyle = options.border;
    ctx.lineWidth = 1;
    roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 5);
    ctx.stroke();

    // 文字
    ctx.fillStyle = options.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);

    // 复位
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    return w;
}

function drawGrid(player) {
    ctx.strokeStyle = player ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.018)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL + 0.5, 0);
        ctx.lineTo(x * CELL + 0.5, ROWS * CELL);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL + 0.5);
        ctx.lineTo(COLS * CELL, y * CELL + 0.5);
        ctx.stroke();
    }
}

function drawHUD() {
    const pad = 26;

    /* ══════════════════════════════════════
       左上：SCORE / LENGTH
       ══════════════════════════════════════ */
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    ctx.font = 'bold 13px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = colors.body;
    ctx.globalAlpha = 0.7;
    ctx.fillText('SCORE', pad, pad);
    ctx.globalAlpha = 1;

    ctx.font = '900 38px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = colors.body;
    ctx.shadowColor = colors.body;
    ctx.shadowBlur = 16;
    ctx.fillText(String(score), pad, pad + 18);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 13px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = colors.food;
    ctx.globalAlpha = 0.7;
    ctx.fillText('LENGTH', pad, pad + 76);
    ctx.globalAlpha = 1;

    ctx.font = '900 24px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = colors.food;
    ctx.shadowColor = colors.food;
    ctx.shadowBlur = 12;
    ctx.fillText(String(snake.length), pad, pad + 94);
    ctx.shadowBlur = 0;

    /* ══════════════════════════════════════
       右下：操作提示（卡片式）
       放在右下角，避免与右上角的 ESC 退出按钮重叠
       ══════════════════════════════════════ */
    const hints = [
        { keys: ['WASD', '↑↓←→'], label: 'move' },
        { keys: ['SPACE'],        label: 'pause' },
        { keys: ['R'],            label: 'restart' },
        { keys: ['ESC'],          label: 'exit' }
    ];

    const rowH = 26;
    const rightX = W - pad;
    const hintBlockH = hints.length * rowH;   // 4 * 26 = 104
    const bestH = 26;
    const totalH = hintBlockH + bestH;

    // 让整块紧贴屏幕底部，留出 pad 边距
    let y = H - pad - totalH;

    for (let i = 0; i < hints.length; i++) {
        const row = hints[i];
        let cursor = rightX;

        // 说明卡片（最右）
        const lw = drawPill(row.label, cursor, y, {
            bg: 'rgba(255,255,255,0.035)',
            border: 'rgba(255,255,255,0.08)',
            color: colors.dim
        });
        cursor -= lw + 6;

        // 键位卡片（从右往左依次排）
        for (let j = row.keys.length - 1; j >= 0; j--) {
            const kw = drawPill(row.keys[j], cursor, y, {
                bg: 'rgba(255,255,255,0.075)',
                border: 'rgba(255,255,255,0.16)',
                color: colors.text
            });
            cursor -= kw + 6;
        }

        y += rowH;
    }

    // BEST（在提示块正下方）
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = colors.food;
    ctx.globalAlpha = 0.85;
    ctx.fillText('BEST  ' + highScore, rightX, y + 4);
    ctx.globalAlpha = 1;

    /* ══════════════════════════════════════
       暂停 / 结束浮层
       ══════════════════════════════════════ */
    if (mode === 'paused') {
        drawOverlay('PAUSED', 'Press SPACE to resume', colors.body);
    } else if (mode === 'gameover') {
        drawOverlay(
            'GAME OVER',
            'Score ' + score + '   ·   Best ' + highScore + '   ·   Press R to restart',
            '#ff5f57'
        );
    }

    // 复位
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
}

function drawOverlay(title, subtitle, titleColor) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '900 ' + Math.min(W * 0.09, 88) + 'px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = titleColor;
    ctx.shadowColor = titleColor;
    ctx.shadowBlur = 36;
    ctx.fillText(title, W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;

    ctx.font = '14px ui-monospace, "SF Mono", monospace';
    ctx.fillStyle = colors.text;
    ctx.fillText(subtitle, W / 2, H / 2 + 50);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    const player = isPlayerMode();

    if (player) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        ctx.fillRect(0, 0, W, H);
    }

    drawGrid(player);

    // 食物
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 500);
    ctx.fillStyle = colors.food;
    ctx.globalAlpha = player
        ? 0.55 + pulse * 0.45
        : 0.30 + pulse * 0.30;
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2,
        CELL * 0.28 * (0.85 + pulse * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 蛇身
    const n = snake.length;
    const headAlpha = player ? 1.0 : 0.55;
    const tailAlpha = player ? 0.55 : 0.16;

    for (let i = n - 1; i >= 0; i--) {
        const seg = snake[i];
        const t = i / Math.max(1, n - 1);
        const pad = i === 0 ? 2 : 3;

        ctx.fillStyle = colors.body;
        ctx.globalAlpha = i === 0
            ? headAlpha
            : (headAlpha - (headAlpha - tailAlpha) * t);

        roundRect(seg.x * CELL + pad, seg.y * CELL + pad,
            CELL - pad * 2, CELL - pad * 2,
            i === 0 ? 6 : 3);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (player) drawHUD();
}

/* ═══════════ 主循环 ═══════════ */

function loop(t) {
    if (!running) return;
    const dt = Math.min(100, t - lastT);
    lastT = t;
    accum += dt;

    while (accum >= currentTickMs) {
        accum -= currentTickMs;
        step();
    }

    draw();
    requestAnimationFrame(loop);
}

/* ═══════════ 颜色 / 层级 ═══════════ */

function refreshColors() {
    const s = getComputedStyle(document.documentElement);
    colors.body = s.getPropertyValue('--accent').trim() || '#7ee787';
    colors.food = s.getPropertyValue('--link').trim()  || '#58a6ff';
    colors.text = s.getPropertyValue('--fg').trim()    || '#c9d1d9';
    colors.dim  = s.getPropertyValue('--dim').trim()   || '#6e7681';
}

function updateCanvasLayer() {
    if (!canvas) return;
    if (isPlayerMode()) {
        canvas.style.opacity = '1';
        canvas.style.zIndex = '100';
        document.body.classList.add('playing');
    } else {
        canvas.style.opacity = String(canvasOpacity);
        canvas.style.zIndex = '';
        document.body.classList.remove('playing');
    }
}

function notifyModeChange() {
    updateCanvasLayer();
    if (onModeChangeCallback) onModeChangeCallback(mode);
}

/* ═══════════ 尺寸 ═══════════ */

function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    CELL = W < 640 ? 20 : 30;
    COLS = Math.floor(W / CELL);
    ROWS = Math.floor(H / CELL);

    canvas.width = COLS * CELL * DPR;
    canvas.height = ROWS * CELL * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    reset();
}

/* ═══════════ 模式切换 API ═══════════ */

export function startSnakePlayer(force) {
    if (!force && mode !== 'ai') return;

    mode = 'player';
    score = 0;
    currentTickMs = playerTickMs;
    accum = 0;
    reset();
    notifyModeChange();

    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }
}

export function exitSnakePlayer() {
    if (mode === 'ai') return;
    mode = 'ai';
    currentTickMs = aiTickMs;
    accum = 0;
    reset();
    notifyModeChange();
}

export function getSnakeMode() { return mode; }
export function onSnakeModeChange(cb) { onModeChangeCallback = cb; }

/* ═══════════ 键盘 ═══════════ */

function onKeyDown(e) {
    if (mode === 'ai') return;

    if (e.key === 'Escape') {
        e.preventDefault();
        exitSnakePlayer();
        return;
    }

    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        startSnakePlayer(true);
        return;
    }

    if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (mode === 'player') mode = 'paused';
        else if (mode === 'paused') mode = 'player';
        notifyModeChange();
        return;
    }

    if (mode !== 'player') return;

    let nd = null;
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') nd = [0, -1];
    else if (k === 'ArrowDown' || k === 's' || k === 'S') nd = [0, 1];
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') nd = [-1, 0];
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') nd = [1, 0];

    if (nd) {
        e.preventDefault();
        if (pendingDirs.length < 2) pendingDirs.push(nd);
    }
}

/* ═══════════ 初始化 ═══════════ */

export function initSnake() {
    const cfg = getConfig();
    const sc = cfg.snake || {};
    if (sc.enabled === false) return;

    canvas = document.getElementById('snake-bg');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvasOpacity = sc.opacity != null ? sc.opacity : 0.55;
    aiTickMs = sc.speed || 130;
    maxLength = sc.maxLength || 60;
    const pc = sc.player || {};
    playerTickMs = pc.speed || 95;

    currentTickMs = aiTickMs;
    canvas.style.opacity = String(canvasOpacity);

    highScore = loadHighScore();

    refreshColors();
    new MutationObserver(refreshColors).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });

    resize();
    running = true;
    lastT = performance.now();
    requestAnimationFrame(loop);

    document.addEventListener('keydown', onKeyDown);

    let rt = null;
    window.addEventListener('resize', function () {
        if (rt) clearTimeout(rt);
        rt = setTimeout(resize, 200);
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            running = false;
            if (mode === 'player') {
                mode = 'paused';
                notifyModeChange();
            }
        } else if (!running && canvas) {
            running = true;
            lastT = performance.now();
            requestAnimationFrame(loop);
        }
    });
}