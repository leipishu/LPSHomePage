import { loadConfig, getConfig, showConfigError } from './config.js';
import { initTerminal, startPrompt } from './terminal.js';
import { initThemes } from './themes.js';
import { renderHero, renderFooter, renderWindowTitle } from './hero.js';
import { registerDefaultCommands, execute, getCommandNames } from './commands.js';
import { playIntro } from './intro.js';
import {
    initSnake,
    startSnakePlayer,
    exitSnakePlayer,
    onSnakeModeChange
} from './snake.js';

/* ══════════ Loading ══════════ */

let loadingEl = null;
let loadingFillEl = null;
let loadingPercentEl = null;
let loadingStatusEl = null;

function initLoading() {
    loadingEl = document.getElementById('loading');
    if (!loadingEl) return;
    loadingFillEl = loadingEl.querySelector('.loading-fill');
    loadingPercentEl = loadingEl.querySelector('.loading-percent');
    loadingStatusEl = loadingEl.querySelector('.loading-status');
}

function setLoading(pct, status) {
    if (loadingFillEl) loadingFillEl.style.width = pct + '%';
    if (loadingPercentEl) loadingPercentEl.textContent = Math.round(pct) + '%';
    if (status && loadingStatusEl) loadingStatusEl.textContent = status;
}

function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
}

async function hideLoading() {
    if (!loadingEl) return;
    setLoading(100, 'ready');
    await sleep(280);
    loadingEl.classList.add('hidden');
    await sleep(520);  // 等淡出动画结束
}

function preloadImage(src) {
    return new Promise(function (resolve) {
        if (!src) return resolve();
        const img = new Image();
        img.onload = function () { resolve(); };
        img.onerror = function () { resolve(); };
        img.src = src;
    });
}

/* ══════════ 状态栏 ══════════ */

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
let statusTimer = null;

function pad2(n) { return String(n).padStart(2, '0'); }

function updateStatusClock() {
    const now = new Date();
    const timeEl = document.getElementById('sbTime');
    const dateEl = document.getElementById('sbDate');

    if (timeEl) {
        timeEl.textContent =
            pad2(now.getHours()) + ':' +
            pad2(now.getMinutes()) + ':' +
            pad2(now.getSeconds());
    }
    if (dateEl) {
        dateEl.textContent =
            WEEKDAYS[now.getDay()] + ' ' +
            pad2(now.getMonth() + 1) + '.' +
            pad2(now.getDate());
    }
}

function initStatusBar() {
    const cfg = getConfig();
    const sb = cfg.statusBar || {};

    const branchEl   = document.getElementById('sbBranch');
    const encodingEl = document.getElementById('sbEncoding');
    const eolEl      = document.getElementById('sbEol');
    const shellEl    = document.getElementById('sbShell');

    if (branchEl)   branchEl.textContent   = sb.branch   || 'main';
    if (encodingEl) encodingEl.textContent = sb.encoding || 'UTF-8';
    if (eolEl)      eolEl.textContent      = sb.eol      || 'LF';
    if (shellEl)    shellEl.textContent    = sb.shell    || 'bash';

    updateStatusClock();
    if (statusTimer) clearInterval(statusTimer);
    statusTimer = setInterval(updateStatusClock, 1000);
}

/* ══════════ 终端最小化 ══════════ */

function initMinimize() {
    const btn = document.getElementById('minBtn');
    const terminal = document.getElementById('terminal');
    const yellowDot = document.getElementById('yellowDot');
    const label = btn ? btn.querySelector('.action-label') : null;
    if (!btn || !terminal) return;

    let minimized = false;

    function apply(state) {
        minimized = state;
        terminal.classList.toggle('minimized', minimized);
        btn.classList.toggle('is-minimized', minimized);
        if (label) label.textContent = minimized ? 'Restore' : 'Minimize';
        btn.setAttribute('title', minimized ? 'Restore terminal' : 'Minimize terminal');

        if (!minimized) {
            setTimeout(function () {
                const input = document.querySelector('.input-line input');
                if (input) input.focus();
            }, 80);
        }
    }

    function toggle() { apply(!minimized); }

    btn.addEventListener('click', function (e) {
        e.preventDefault();
        toggle();
    });

    if (yellowDot) {
        yellowDot.addEventListener('click', function (e) {
            e.stopPropagation();
            toggle();
        });
    }

    const titlebar = document.getElementById('titlebar');
    if (titlebar) {
        titlebar.addEventListener('click', function (e) {
            if (e.target.closest('.dots')) return;
            if (minimized) toggle();
        });
    }
}

/* ══════════ 游戏按钮 ══════════ */

function initGameButton() {
    const btn = document.getElementById('gameBtn');
    if (!btn) return;

    btn.addEventListener('click', function (e) {
        e.preventDefault();
        const m = btn.classList.contains('is-playing');
        if (m) exitSnakePlayer();
        else startSnakePlayer();
    });
}

function initExitGameButton() {
    const btn = document.getElementById('exitGameBtn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        exitSnakePlayer();
    });
}

/* ══════════ 启动 ══════════ */

async function main() {
    // ── 0. 显示 loading ──
    initLoading();
    setLoading(4, 'booting...');

    // ── 1. 加载配置 ──
    let config;
    try {
        config = await loadConfig('config.json');
    } catch (err) {
        console.error('[leipishu] config load failed:', err);
        if (loadingEl) loadingEl.classList.add('hidden');
        showConfigError(err);
        return;
    }
    setLoading(22, 'reading config');
    await sleep(60);

    document.title = config.profile.pageTitle || config.profile.username || 'terminal';

    // ── 2. 渲染静态区域 ──
    renderHero();
    renderFooter();
    renderWindowTitle();
    setLoading(38, 'rendering hero');

    // ── 3. 等头像图片真正加载完 ──
    await preloadImage(config.profile.avatar);
    setLoading(52, 'loading assets');
    await sleep(50);

    // ── 4. 状态栏 ──
    initStatusBar();
    setLoading(64, 'starting shell');
    await sleep(50);

    // ── 5. 主题下拉 ──
    const themeDropdown = document.getElementById('themeDropdown');
    if (themeDropdown) {
        initThemes(themeDropdown);
    } else {
        console.warn('[leipishu] #themeDropdown not found — theme switcher disabled');
    }
    setLoading(74, 'applying theme');
    await sleep(50);

    // ── 6. 背景贪吃蛇 / 交互 ──
    initSnake();
    initMinimize();
    initGameButton();
    initExitGameButton();
    setLoading(84, 'wiring events');
    await sleep(40);

    // ── 7. 模式切换回调 ──
    const gameBtn = document.getElementById('gameBtn');
    onSnakeModeChange(function (m) {
        if (gameBtn) {
            gameBtn.classList.toggle('is-playing', m !== 'ai');
            const lbl = gameBtn.querySelector('.action-label');
            if (lbl) lbl.textContent = (m === 'ai') ? 'Play' : 'Exit';
        }

        if (m === 'ai') {
            setTimeout(function () {
                const input = document.querySelector('.input-line input');
                if (input) input.focus();
            }, 120);
        }
    });

    // ── 8. 注册命令 + 初始化终端 ──
    registerDefaultCommands();

    const screenEl = document.getElementById('screen');
    initTerminal({
        screen: screenEl,
        onCommand: execute,
        getCommandNames: getCommandNames
    });
    setLoading(96, 'initializing shell');
    await sleep(80);

    // ── 9. 全部就绪，淡出 loading ──
    await hideLoading();

    // ── 10. 等 loading 完全消失，再启动终端开场动画 ──
    playIntro(function () {
        startPrompt();
    });
}

main();