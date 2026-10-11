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

/* ══════════ 环境判断 ══════════ */

function isTouchDevice() {
    return window.matchMedia('(hover: none)').matches || 'ontouchstart' in window;
}

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
                if (input && !isTouchDevice()) input.focus();
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

/* ══════════ 终端离屏提示 ══════════ */

let offscreenTipEl = null;

function initOffscreenTip() {
    if (offscreenTipEl) return;

    offscreenTipEl = document.createElement('div');
    offscreenTipEl.className = 'offscreen-tip';
    offscreenTipEl.setAttribute('role', 'alert');
    offscreenTipEl.setAttribute('aria-live', 'polite');
    offscreenTipEl.innerHTML =
        '<span class="offscreen-tip-icon">!</span>' +
        '<span class="offscreen-tip-text">Terminal is off-screen</span>' +
        '<button type="button" class="offscreen-tip-btn">Reset</button>';

    document.body.appendChild(offscreenTipEl);

    const btn = offscreenTipEl.querySelector('.offscreen-tip-btn');
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        resetTerminalPos();
        hideOffscreenTip();
    });
}

/** 终端整体是否已经不在视口内 */
function isTerminalFullyOffscreen() {
    const terminal = document.getElementById('terminal');
    if (!terminal) return false;

    const r = terminal.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    /* 只要有一条边完全越过了对面的视口边界，就认为整体在屏幕外 */
    return (
        r.right  <= 0 ||      // 整个在左侧之外
        r.bottom <= 0 ||      // 整个在上方之外
        r.left   >= vw ||     // 整个在右侧之外
        r.top    >= vh        // 整个在下方之外
    );
}

function showOffscreenTip() {
    if (!offscreenTipEl) return;
    offscreenTipEl.classList.add('visible');
}

function hideOffscreenTip() {
    if (!offscreenTipEl) return;
    offscreenTipEl.classList.remove('visible');
}

/** 根据终端位置刷新提示显隐 */
function updateOffscreenTip() {
    if (!offscreenTipEl) return;
    if (isTerminalFullyOffscreen()) showOffscreenTip();
    else hideOffscreenTip();
}

/* ══════════ 终端窗口拖拽 / 尺寸 ══════════ */

const dragOffset = { x: 0, y: 0 };   // 仅用于标题栏拖动

/** 把拖拽位移写进 transform（缩放不再动 transform） */
function applyTerminalTransform() {
    const terminal = document.getElementById('terminal');
    if (!terminal) return;
    terminal.style.transform =
        'translate(' + dragOffset.x + 'px, ' + dragOffset.y + 'px)';
}

/* 复位动画时长，和 CSS 里保持一致 */
const RESET_DURATION = 420;
const RESET_EASING   = 'cubic-bezier(0.2, 0.8, 0.3, 1)';

/**
 * 复位：把终端平滑恢复成 flex 布局下的初始尺寸和位置。
 *
 * 思路：
 *   1. 若终端当前是 absolute（被拖/被缩过），先量下它现在的视觉矩形；
 *   2. 临时摘掉所有 inline style 让 flex 布一次局，量出「目标矩形」；
 *   3. 把 inline style 还原到「当前矩形」，强制 reflow；
 *   4. 打开 left/top/width/height 过渡，把值改成目标矩形；
 *   5. 动画结束后彻底清空 inline style，把控制权交还给 flex。
 *
 * 若终端还在 flex 流里（只拖过没缩过），只处理 transform。
 */
export function resetTerminalPos() {
    const terminal = document.getElementById('terminal');
    if (!terminal) return;

    /* 用户已经主动复位 → 立刻撤掉离屏提示 */
    hideOffscreenTip();

    const wasAbsolute = terminal.style.position === 'absolute';

    /* ── 分支 A：没被缩过，只处理 transform ── */
    if (!wasAbsolute) {
        if (!dragOffset.x && !dragOffset.y) return;
        dragOffset.x = 0;
        dragOffset.y = 0;
        terminal.style.transition = 'transform ' + RESET_DURATION + 'ms ' + RESET_EASING;
        terminal.style.transform = '';
        setTimeout(function () {
            terminal.style.transition = '';
        }, RESET_DURATION + 20);
        return;
    }

    /* ── 分支 B：absolute 状态，连位置带尺寸一起动画 ── */
    const wrap = terminal.closest('.wrap') || document.body;
    const wrapRect = wrap.getBoundingClientRect();
    const wrapCS = getComputedStyle(wrap);
    const borderL = parseFloat(wrapCS.borderLeftWidth) || 0;
    const borderT = parseFloat(wrapCS.borderTopWidth)  || 0;

    function rectRelativeTo(el) {
        const r = el.getBoundingClientRect();
        return {
            left:   r.left - wrapRect.left - borderL,
            top:    r.top  - wrapRect.top  - borderT,
            width:  r.width,
            height: r.height
        };
    }

    /* ① 当前矩形 */
    const currentRect = rectRelativeTo(terminal);

    /* ② 临时摘干净，让 flex 布一次局，量出目标矩形 */
    terminal.style.transition = 'none';
    terminal.style.position   = '';
    terminal.style.margin     = '';
    terminal.style.alignSelf  = '';
    terminal.style.left       = '';
    terminal.style.top        = '';
    terminal.style.width      = '';
    terminal.style.height     = '';
    terminal.style.transform  = '';
    void terminal.offsetWidth;   // 强制 reflow

    const targetRect = rectRelativeTo(terminal);

    /* ③ 还原到当前矩形，准备从这里出发动画 */
    terminal.style.position = 'absolute';
    terminal.style.left     = currentRect.left   + 'px';
    terminal.style.top      = currentRect.top    + 'px';
    terminal.style.width    = currentRect.width  + 'px';
    terminal.style.height   = currentRect.height + 'px';
    void terminal.offsetWidth;   // 强制 reflow

    /* ④ 打开过渡，把值推向目标矩形 */
    terminal.style.transition = [
        'left '   + RESET_DURATION + 'ms ' + RESET_EASING,
        'top '    + RESET_DURATION + 'ms ' + RESET_EASING,
        'width '  + RESET_DURATION + 'ms ' + RESET_EASING,
        'height ' + RESET_DURATION + 'ms ' + RESET_EASING
    ].join(', ');

    terminal.style.left   = targetRect.left   + 'px';
    terminal.style.top    = targetRect.top    + 'px';
    terminal.style.width  = targetRect.width  + 'px';
    terminal.style.height = targetRect.height + 'px';

    /* 复位拖拽变量 */
    dragOffset.x = 0;
    dragOffset.y = 0;

    /* ⑤ 动画结束后彻底交给 flex。
          用 setTimeout 而不是 transitionend —— 因为快速连点 Reset
          或用户中途再拖动时 transitionend 有可能被吞掉。 */
    let done = false;
    function finish() {
        if (done) return;
        done = true;
        terminal.style.transition = '';
        terminal.style.position   = '';
        terminal.style.margin     = '';
        terminal.style.alignSelf  = '';
        terminal.style.left       = '';
        terminal.style.top        = '';
        terminal.style.width      = '';
        terminal.style.height     = '';
        terminal.style.transform  = '';
        updateOffscreenTip();
    }
    setTimeout(finish, RESET_DURATION + 40);
}

function initWindowDrag() {
    const terminal = document.getElementById('terminal');
    const titlebar = document.getElementById('titlebar');
    if (!terminal || !titlebar) return;

    let dragging = false;
    let startX = 0, startY = 0;
    let activeTouchId = null;

    function begin(clientX, clientY) {
        dragging = true;
        startX = clientX - dragOffset.x;
        startY = clientY - dragOffset.y;
        terminal.classList.add('dragging');
        document.body.style.userSelect = 'none';
    }

    function move(clientX, clientY) {
        if (!dragging) return;
        dragOffset.x = clientX - startX;
        dragOffset.y = clientY - startY;
        applyTerminalTransform();
        /* 拖动过程中实时检测是否整个跑出视口 */
        updateOffscreenTip();
    }

    function end() {
        if (!dragging) return;
        dragging = false;
        activeTouchId = null;
        terminal.classList.remove('dragging');
        document.body.style.userSelect = '';
        updateOffscreenTip();
    }

    /* 鼠标 */
    titlebar.addEventListener('mousedown', function (e) {
        if (e.target.closest('.dots')) return;
        if (e.target.closest('.terminal-resize-handle')) return;
        if (e.button !== 0) return;
        begin(e.clientX, e.clientY);
        e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
        if (dragging) move(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', end);

    /* 触摸 */
    titlebar.addEventListener('touchstart', function (e) {
        if (e.target.closest('.dots')) return;
        if (e.target.closest('.terminal-resize-handle')) return;
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        activeTouchId = t.identifier;
        begin(t.clientX, t.clientY);
    }, { passive: true });

    titlebar.addEventListener('touchmove', function (e) {
        if (!dragging || activeTouchId === null) return;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === activeTouchId) {
                move(e.touches[i].clientX, e.touches[i].clientY);
                if (e.cancelable) e.preventDefault();
                return;
            }
        }
    }, { passive: false });

    titlebar.addEventListener('touchend', end);
    titlebar.addEventListener('touchcancel', end);

    titlebar.addEventListener('dblclick', function (e) {
        if (e.target.closest('.dots')) return;
        resetTerminalPos();
    });
}

/* ══════════ 终端窗口缩放（8 方向，脱离 flex 流） ══════════ */

const MIN_TERM_W = 280;
const MIN_TERM_H = 180;
const EDGE_PAD   = 12;   // 距 wrap 内容区留白

function initWindowResize() {
    const terminal = document.getElementById('terminal');
    if (!terminal) return;

    const wrap = terminal.closest('.wrap') || document.body;

    /* 幂等：清掉旧手柄 */
    const oldHandles = terminal.querySelectorAll('.terminal-resize-handle');
    for (let i = 0; i < oldHandles.length; i++) oldHandles[i].remove();

    /* 8 个方向手柄 */
    const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    DIRS.forEach(function (dir) {
        const h = document.createElement('div');
        h.className = 'terminal-resize-handle terminal-resize-' + dir;
        h.dataset.dir = dir;
        h.setAttribute('aria-hidden', 'true');
        terminal.appendChild(h);
    });

    let resizing  = false;
    let activeDir = null;
    let startX = 0, startY = 0;
    let startW = 0, startH = 0;
    let startLeft = 0, startTop = 0;
    let activeTouchId = null;

    /* 可用区域（相对 wrap 的 padding box 左上角） */
    function getBounds() {
        const cs   = getComputedStyle(wrap);
        const padL = parseFloat(cs.paddingLeft)   || 0;
        const padR = parseFloat(cs.paddingRight)  || 0;
        const padT = parseFloat(cs.paddingTop)    || 0;
        const padB = parseFloat(cs.paddingBottom) || 0;

        const w = wrap.clientWidth;
        const h = wrap.clientHeight;

        return {
            left:   padL + EDGE_PAD,
            top:    padT + EDGE_PAD,
            right:  w - padR - EDGE_PAD,
            bottom: h - padB - EDGE_PAD
        };
    }

    function readCurrentRect() {
        const termRect = terminal.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const cs = getComputedStyle(wrap);
        const borderL = parseFloat(cs.borderLeftWidth) || 0;
        const borderT = parseFloat(cs.borderTopWidth)  || 0;

        return {
            left:   termRect.left - wrapRect.left - borderL,
            top:    termRect.top  - wrapRect.top  - borderT,
            width:  termRect.width,
            height: termRect.height
        };
    }

    function detachToAbsolute() {
        const r = readCurrentRect();

        dragOffset.x = 0;
        dragOffset.y = 0;
        terminal.style.transform = '';

        terminal.style.position  = 'absolute';
        terminal.style.margin    = '0';
        terminal.style.alignSelf = '';
        terminal.style.left      = r.left + 'px';
        terminal.style.top       = r.top + 'px';
        terminal.style.width     = r.width + 'px';
        terminal.style.height    = r.height + 'px';

        return r;
    }

    function begin(dir, clientX, clientY) {
        const r = detachToAbsolute();
        const b = getBounds();

        /* 起手把当前矩形收进边界，防止已有越界被后续计算放大 */
        let w = Math.min(r.width,  b.right - b.left);
        let h = Math.min(r.height, b.bottom - b.top);
        let left = Math.min(Math.max(r.left, b.left), b.right - w);
        let top  = Math.min(Math.max(r.top,  b.top),  b.bottom - h);

        if (left !== r.left || top !== r.top || w !== r.width || h !== r.height) {
            terminal.style.left   = left + 'px';
            terminal.style.top    = top  + 'px';
            terminal.style.width  = w    + 'px';
            terminal.style.height = h    + 'px';
        }

        startX = clientX;
        startY = clientY;
        startW = w;
        startH = h;
        startLeft = left;
        startTop = top;

        resizing  = true;
        activeDir = dir;
        terminal.classList.add('resizing');
        document.body.style.userSelect = 'none';

        /* 已经贴回边界内 → 提示可以撤掉了 */
        updateOffscreenTip();
    }

    function move(clientX, clientY) {
        if (!resizing || !activeDir) return;

        const dx = clientX - startX;
        const dy = clientY - startY;
        const dir = activeDir;

        const west  = dir.indexOf('w') !== -1;
        const east  = dir.indexOf('e') !== -1;
        const north = dir.indexOf('n') !== -1;
        const south = dir.indexOf('s') !== -1;

        let newW = startW;
        let newH = startH;
        if (east)  newW = startW + dx;
        if (west)  newW = startW - dx;
        if (south) newH = startH + dy;
        if (north) newH = startH - dy;

        if (newW < MIN_TERM_W) newW = MIN_TERM_W;
        if (newH < MIN_TERM_H) newH = MIN_TERM_H;

        let newLeft = startLeft;
        let newTop  = startTop;
        if (west)  newLeft = (startLeft + startW) - newW;
        if (north) newTop  = (startTop  + startH) - newH;

        const b = getBounds();

        if (newLeft < b.left) {
            if (west) {
                newW -= (b.left - newLeft);
                newLeft = b.left;
            } else {
                newLeft = b.left;
            }
        }
        if (newLeft + newW > b.right) {
            if (east) {
                newW = b.right - newLeft;
            } else {
                newLeft = b.right - newW;
            }
        }

        if (newTop < b.top) {
            if (north) {
                newH -= (b.top - newTop);
                newTop = b.top;
            } else {
                newTop = b.top;
            }
        }
        if (newTop + newH > b.bottom) {
            if (south) {
                newH = b.bottom - newTop;
            } else {
                newTop = b.bottom - newH;
            }
        }

        const availW = b.right - b.left;
        const availH = b.bottom - b.top;
        const hardMinW = Math.min(MIN_TERM_W, availW);
        const hardMinH = Math.min(MIN_TERM_H, availH);
        if (newW < hardMinW) newW = hardMinW;
        if (newH < hardMinH) newH = hardMinH;

        terminal.style.left   = newLeft + 'px';
        terminal.style.top    = newTop  + 'px';
        terminal.style.width  = newW    + 'px';
        terminal.style.height = newH    + 'px';

        updateOffscreenTip();
    }

    function end() {
        if (!resizing) return;
        resizing  = false;
        activeDir = null;
        activeTouchId = null;
        terminal.classList.remove('resizing');
        document.body.style.userSelect = '';
        updateOffscreenTip();
    }

    /* ── 鼠标 ── */
    terminal.addEventListener('mousedown', function (e) {
        const handle = e.target.closest && e.target.closest('.terminal-resize-handle');
        if (!handle) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        begin(handle.dataset.dir, e.clientX, e.clientY);
    });

    document.addEventListener('mousemove', function (e) {
        if (resizing) move(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', end);

    /* ── 触摸 ── */
    terminal.addEventListener('touchstart', function (e) {
        const handle = e.target.closest && e.target.closest('.terminal-resize-handle');
        if (!handle) return;
        if (e.touches.length !== 1) return;
        e.preventDefault();
        e.stopPropagation();
        const t = e.touches[0];
        activeTouchId = t.identifier;
        begin(handle.dataset.dir, t.clientX, t.clientY);
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
        if (!resizing || activeTouchId === null) return;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === activeTouchId) {
                move(e.touches[i].clientX, e.touches[i].clientY);
                if (e.cancelable) e.preventDefault();
                return;
            }
        }
    }, { passive: false });

    document.addEventListener('touchend', function (e) {
        if (!resizing) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
                end();
                return;
            }
        }
    });

    document.addEventListener('touchcancel', end);

    /* 视口尺寸变化时把终端收进新边界 */
    window.addEventListener('resize', function () {
        if (terminal.style.position !== 'absolute') {
            updateOffscreenTip();
            return;
        }
        const b = getBounds();

        let w = parseFloat(terminal.style.width)  || terminal.offsetWidth;
        let h = parseFloat(terminal.style.height) || terminal.offsetHeight;
        let left = parseFloat(terminal.style.left) || 0;
        let top  = parseFloat(terminal.style.top)  || 0;

        w = Math.min(w, b.right  - b.left);
        h = Math.min(h, b.bottom - b.top);
        left = Math.min(Math.max(left, b.left), b.right  - w);
        top  = Math.min(Math.max(top,  b.top),  b.bottom - h);

        terminal.style.left   = left + 'px';
        terminal.style.top    = top  + 'px';
        terminal.style.width  = w    + 'px';
        terminal.style.height = h    + 'px';

        updateOffscreenTip();
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
    if (isTouchDevice()) return;

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
    if (!window.matchMedia('(any-pointer: fine)').matches) return;

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

        const resizeNS = svgURI(
            '<path d="M11 3 L11 19" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round"/>' +
            '<path d="M7 6 L11 2 L15 6" fill="none" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M7 16 L11 20 L15 16" fill="none" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
            22, 22) + ' 11 11, ns-resize';

        const resizeEW = svgURI(
            '<path d="M3 11 L19 11" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round"/>' +
            '<path d="M6 7 L2 11 L6 15" fill="none" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M16 7 L20 11 L16 15" fill="none" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
            22, 22) + ' 11 11, ew-resize';

        const resizeNWSE = svgURI(
            '<path d="M4 4 L18 18" stroke="' + accent +
            '" stroke-width="1.4" opacity="0.7"/>' +
            '<path d="M4 4 L4 9 M4 4 L9 4" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round"/>' +
            '<path d="M18 18 L18 13 M18 18 L13 18" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round"/>',
            22, 22) + ' 11 11, nwse-resize';

        const resizeNESW = svgURI(
            '<path d="M18 4 L4 18" stroke="' + accent +
            '" stroke-width="1.4" opacity="0.7"/>' +
            '<path d="M18 4 L18 9 M18 4 L13 4" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round"/>' +
            '<path d="M4 18 L4 13 M4 18 L9 18" stroke="' + accent +
            '" stroke-width="1.6" stroke-linecap="round"/>',
            22, 22) + ' 11 11, nesw-resize';

        root.style.setProperty('--cursor-default',  def);
        root.style.setProperty('--cursor-pointer',  ptr);
        root.style.setProperty('--cursor-text',     txt);
        root.style.setProperty('--cursor-grab',     grab);
        root.style.setProperty('--cursor-grabbing', grabbing);
        root.style.setProperty('--cursor-resize',    resizeNWSE);
        root.style.setProperty('--cursor-resize-n',  resizeNS);
        root.style.setProperty('--cursor-resize-s',  resizeNS);
        root.style.setProperty('--cursor-resize-e',  resizeEW);
        root.style.setProperty('--cursor-resize-w',  resizeEW);
        root.style.setProperty('--cursor-resize-ne', resizeNESW);
        root.style.setProperty('--cursor-resize-nw', resizeNWSE);
        root.style.setProperty('--cursor-resize-se', resizeNWSE);
        root.style.setProperty('--cursor-resize-sw', resizeNESW);
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
        return features[name] !== false;
    };

    function hideEl(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    initSnake();
    initMinimize();
    initOffscreenTip();

    /* 窗口拖拽 + 缩放共用同一个开关 */
    if (enable('windowDrag')) {
        initWindowDrag();
        initWindowResize();
        initResetPosButton();
    } else {
        hideEl('resetPosBtn');
    }

    initGameButton();
    initExitGameButton();

    if (enable('cursorGlow')) {
        initCursorGlow();
    }

    if (enable('themedCursor')) {
        initThemedCursor();
    }

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

        if (m === 'ai' && !isTouchDevice()) {
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
        if (isTouchDevice()) {
            const input = document.querySelector('.input-line input');
            if (input) input.blur();
        }
    });
}

main();