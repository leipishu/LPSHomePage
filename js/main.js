import { loadConfig, getConfig, showConfigError } from './config.js';
import {
    initTerminal,
    startPrompt,
    runCommand as termRunCommand
} from './terminal.js';
import { initThemes } from './themes.js';
import { renderHero, renderFooter, renderWindowTitle } from './hero.js';
import { registerDefaultCommands, execute, getCommandNames } from './commands.js';
import { playIntro } from './intro.js';
import { initContextMenu, setContextMenuCallbacks } from './contextmenu.js';
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
    await sleep(520);
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

/* ══════════ 终端窗口拖拽 ══════════ */

const dragOffset = { x: 0, y: 0 };

export function resetTerminalPos() {
    const terminal = document.getElementById('terminal');
    if (!terminal) return;
    if (!dragOffset.x && !dragOffset.y) return;

    dragOffset.x = 0;
    dragOffset.y = 0;

    terminal.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.3, 1)';
    terminal.style.transform = '';
    setTimeout(function () {
        terminal.style.transition = '';
    }, 420);
}

function initWindowDrag() {
    const terminal = document.getElementById('terminal');
    const titlebar = document.getElementById('titlebar');
    if (!terminal || !titlebar) return;

    if (window.matchMedia('(hover: none)').matches && 'ontouchstart' in window) return;

    let dragging = false;
    let startX = 0, startY = 0;

    titlebar.addEventListener('mousedown', function (e) {
        if (e.target.closest('.dots')) return;
        if (e.button !== 0) return;

        dragging = true;
        startX = e.clientX - dragOffset.x;
        startY = e.clientY - dragOffset.y;

        terminal.classList.add('dragging');
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (!dragging) return;

        dragOffset.x = e.clientX - startX;
        dragOffset.y = e.clientY - startY;

        terminal.style.transform = 'translate(' + dragOffset.x + 'px, ' + dragOffset.y + 'px)';
    });

    document.addEventListener('mouseup', function () {
        if (!dragging) return;
        dragging = false;
        terminal.classList.remove('dragging');
        document.body.style.userSelect = '';
    });

    titlebar.addEventListener('dblclick', function (e) {
        if (e.target.closest('.dots')) return;
        resetTerminalPos();
    });
}

/* ══════════ 归位按钮 ══════════ */

function initResetPosButton() {
    const btn = document.getElementById('resetPosBtn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        resetTerminalPos();
    });
}

/* ══════════ 鼠标跟随光晕 ══════════ */

function initCursorGlow() {
    const el = document.getElementById('cursor-glow');
    if (!el) return;

    if (window.matchMedia('(hover: none)').matches) return;

    let rafId = null;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;

    function apply() {
        rafId = null;
        el.style.setProperty('--mx', mx + 'px');
        el.style.setProperty('--my', my + 'px');
    }

    document.addEventListener('mousemove', function (e) {
        mx = e.clientX;
        my = e.clientY;

        if (!el.classList.contains('visible')) {
            el.classList.add('visible');
        }
        if (!rafId) {
            rafId = requestAnimationFrame(apply);
        }
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
        el.classList.remove('visible');
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden && rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    });
}

/* ══════════ 主题化鼠标光标 ══════════ */

function initThemedCursor() {
    if (window.matchMedia('(hover: none)').matches) return;

    const root = document.documentElement;

    function svgURI(body, w, h) {
        const svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"' +
            ' viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg>';
        return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    }

    function refresh() {
        const cs = getComputedStyle(root);
        const accent = cs.getPropertyValue('--accent').trim() || '#7ee787';
        const bg     = cs.getPropertyValue('--bg').trim()     || '#05070a';
        const link   = cs.getPropertyValue('--link').trim()   || '#58a6ff';

        const defBody =
            '<path d="M3 1.5 L3 17.5 L7 13.5 L9.8 19.8 L12.3 18.7 L9.4 12.3 L15.5 12.3 Z" ' +
            'fill="' + bg + '" stroke="' + accent + '" stroke-width="1.3" ' +
            'stroke-linejoin="round" stroke-linecap="round"/>' +
            '<path d="M5.2 5 L5.2 12.5 L7.4 10.4 L9.4 14.8" ' +
            'fill="none" stroke="' + accent + '" stroke-width="0.6" opacity="0.55"/>';
        const def = svgURI(defBody, 22, 22) + ' 3 1.5, auto';

        const ptrBody =
            '<path d="M5 8.5 L5 5 L8.5 5" fill="none" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M13.5 5 L17 5 L17 8.5" fill="none" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M17 13.5 L17 17 L13.5 17" fill="none" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M8.5 17 L5 17 L5 13.5" fill="none" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="11" cy="11" r="1.8" fill="' + accent + '"/>';
        const ptr = svgURI(ptrBody, 22, 22) + ' 11 11, pointer';

        const txtBody =
            '<path d="M9 3.5 L9 18.5" stroke="' + accent +
            '" stroke-width="1.5" stroke-linecap="round"/>' +
            '<path d="M6 3.5 L12 3.5" stroke="' + accent +
            '" stroke-width="1.5" stroke-linecap="round"/>' +
            '<path d="M6 18.5 L12 18.5" stroke="' + accent +
            '" stroke-width="1.5" stroke-linecap="round"/>' +
            '<circle cx="9" cy="11" r="0.9" fill="' + accent + '" opacity="0.6"/>';
        const txt = svgURI(txtBody, 18, 22) + ' 9 11, text';

        const grabBody =
            '<rect x="9.2" y="9.2" width="3.6" height="3.6" rx="0.8" fill="' + accent + '"/>' +
            '<circle cx="11" cy="11" r="6.5" fill="none" stroke="' + link +
            '" stroke-width="1.1" opacity="0.75"/>';
        const grab = svgURI(grabBody, 22, 22) + ' 11 11, grab';

        const grabbingBody =
            '<rect x="9.4" y="9.4" width="3.2" height="3.2" rx="0.6" fill="' + accent + '"/>' +
            '<circle cx="11" cy="11" r="5.5" fill="none" stroke="' + accent +
            '" stroke-width="1.3"/>' +
            '<circle cx="11" cy="11" r="8.5" fill="none" stroke="' + accent +
            '" stroke-width="0.9" opacity="0.55" stroke-dasharray="2 3"/>';
        const grabbing = svgURI(grabbingBody, 22, 22) + ' 11 11, grabbing';

        root.style.setProperty('--cursor-default',  def);
        root.style.setProperty('--cursor-pointer',  ptr);
        root.style.setProperty('--cursor-text',     txt);
        root.style.setProperty('--cursor-grab',     grab);
        root.style.setProperty('--cursor-grabbing', grabbing);
    }

    refresh();

    new MutationObserver(refresh).observe(root, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
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
    initLoading();
    setLoading(4, 'booting...');

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

    renderHero();
    renderFooter();
    renderWindowTitle();
    setLoading(38, 'rendering hero');

    await preloadImage(config.profile.avatar);
    setLoading(52, 'loading assets');
    await sleep(50);

    initStatusBar();
    setLoading(64, 'starting shell');
    await sleep(50);

    const themeDropdown = document.getElementById('themeDropdown');
    if (themeDropdown) {
        initThemes(themeDropdown);
    } else {
        console.warn('[leipishu] #themeDropdown not found — theme switcher disabled');
    }
    setLoading(74, 'applying theme');
    await sleep(50);

    /* ── 功能开关 ── */
    const features = config.features || {};
    const enable = function (name) {
        // 未声明视为启用；只有显式 false 才关闭
        return features[name] !== false;
    };

    /* 辅助：隐藏某个按钮 */
    function hideEl(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    /* 背景贪吃蛇 */
    initSnake();

    /* 终端最小化（核心 UI，不受开关控制） */
    initMinimize();

    /* 窗口拖拽 —— 关闭时同时隐藏 Reset 按钮 */
    if (enable('windowDrag')) {
        initWindowDrag();
        initResetPosButton();
    } else {
        hideEl('resetPosBtn');
    }

    /* 游戏按钮 */
    initGameButton();
    initExitGameButton();

    /* 鼠标跟随光晕 */
    if (enable('cursorGlow')) {
        initCursorGlow();
    }

    /* 主题化鼠标光标 */
    if (enable('themedCursor')) {
        initThemedCursor();
    }

    /* 右键菜单 */
    if (enable('contextMenu')) {
        setContextMenuCallbacks({
            onReset: resetTerminalPos,
            onAbout: function () { termRunCommand('about'); }
        });
        initContextMenu();
    }

    setLoading(84, 'wiring events');
    await sleep(40);

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

    registerDefaultCommands();

    const screenEl = document.getElementById('screen');
    initTerminal({
        screen: screenEl,
        onCommand: execute,
        getCommandNames: getCommandNames
    });
    setLoading(96, 'initializing shell');
    await sleep(80);

    await hideLoading();

    playIntro(function () {
        startPrompt();
    });
}

main();