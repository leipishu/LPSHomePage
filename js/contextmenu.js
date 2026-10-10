import { getConfig } from './config.js';
import { escapeHTML } from './util.js';
import { setTheme } from './themes.js';
import * as term from './terminal.js';

/* ═══════════ 状态 ═══════════ */

let menuEl = null;
let items = [];
let activeIdx = -1;
let visible = false;

const callbacks = {
    onReset: null,
    onMinimize: null,
    onPlayToggle: null,
    onAbout: null
};

export function setContextMenuCallbacks(cbs) {
    Object.assign(callbacks, cbs || {});
}

/* ═══════════ 功能开关 ═══════════ */

function featureOn(name) {
    const cfg = getConfig();
    const f = (cfg && cfg.features) || {};
    return f[name] !== false;
}

/* ═══════════ 工具 ═══════════ */

function clickById(id) {
    const el = document.getElementById(id);
    if (el) el.click();
}

function copySelection() {
    const text = window.getSelection().toString();
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
    } else {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        } catch (e) { /* ignore */ }
    }
}

function pasteFromClipboard() {
    if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (text) {
            const input = document.querySelector('.input-line input');
            if (input && text) {
                input.value += text;
                input.focus();
            }
        }).catch(function () { /* 用户拒绝或无权限 */ });
    }
}

function selectAllIn(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function cycleTheme() {
    const cfg = getConfig();
    const current = document.documentElement.getAttribute('data-theme');
    const idx = cfg.themes.findIndex(function (t) { return t.id === current; });
    const next = cfg.themes[(idx + 1) % cfg.themes.length];
    setTheme(next.id);
}

/* ═══════════ 菜单构造 ═══════════ */

function buildMenuItems(ctx) {
    const sel = window.getSelection().toString();
    const hasSel = sel.length > 0;
    const inTerminal = ctx.target.closest && ctx.target.closest('.screen');
    const linkEl = ctx.target.closest ? ctx.target.closest('a') : null;
    const isPlaying = document.body.classList.contains('playing');

    if (isPlaying) {
        return [
            {
                icon: '■', label: 'Exit Game', shortcut: 'Esc',
                action: function () { clickById('gameBtn'); }
            }
        ];
    }

    const list = [];

    if (linkEl) {
        const href = linkEl.href;
        list.push({
            header: true,
            text: href.length > 52 ? href.slice(0, 49) + '...' : href
        });
        list.push({
            icon: '↗', label: 'Open Link',
            action: function () { window.open(href, '_blank', 'noopener'); }
        });
        list.push({
            icon: '⎘', label: 'Copy Link Address',
            action: function () {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(href).catch(function () {});
                }
            }
        });
        list.push({ sep: true });
    }

    list.push({
        icon: '⧉', label: 'Copy', shortcut: 'Ctrl+C',
        disabled: !hasSel,
        action: copySelection
    });
    list.push({
        icon: '⎘', label: 'Paste', shortcut: 'Ctrl+V',
        action: pasteFromClipboard
    });
    list.push({
        icon: '▤', label: 'Select All', shortcut: 'Ctrl+A',
        action: function () {
            if (inTerminal) selectAllIn('.screen');
            else selectAllIn('body');
        }
    });
    list.push({ sep: true });

    list.push({
        icon: '◐', label: 'Cycle Theme',
        action: cycleTheme
    });
    list.push({
        icon: '⌄', label: 'Minimize Terminal',
        action: function () {
            if (callbacks.onMinimize) callbacks.onMinimize();
            else clickById('minBtn');
        }
    });

    if (featureOn('windowDrag')) {
        list.push({
            icon: '↺', label: 'Reset Window Position',
            action: function () {
                if (callbacks.onReset) callbacks.onReset();
            }
        });
    }

    if (inTerminal) {
        list.push({ sep: true });
        list.push({
            icon: '▶', label: 'Play Snake',
            action: function () {
                if (callbacks.onPlayToggle) callbacks.onPlayToggle();
                else clickById('gameBtn');
            }
        });
        list.push({
            icon: '✕', label: 'Clear Screen',
            action: function () {
                term.runCommand('clear');
            }
        });
    }

    list.push({ sep: true });
    list.push({
        icon: '?', label: 'About',
        action: function () {
            if (callbacks.onAbout) callbacks.onAbout();
            else term.runCommand('about');
        }
    });
    list.push({
        icon: '⏻', label: 'Close Menu', shortcut: 'Esc',
        action: closeMenu
    });

    return list;
}

/* ═══════════ 渲染 ═══════════ */

function renderMenu(list) {
    menuEl.innerHTML = '';
    items = [];

    list.forEach(function (entry) {
        if (entry.sep) {
            const sep = document.createElement('div');
            sep.className = 'ctx-sep';
            menuEl.appendChild(sep);
            items.push(null);
            return;
        }
        if (entry.header) {
            const h = document.createElement('div');
            h.className = 'ctx-header';
            h.textContent = entry.text;
            h.title = entry.text;
            menuEl.appendChild(h);
            items.push(null);
            return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ctx-item';
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('tabindex', '-1');
        if (entry.disabled) btn.classList.add('disabled');

        btn.innerHTML =
            '<span class="ctx-icon">' + escapeHTML(entry.icon || '·') + '</span>' +
            '<span class="ctx-label">' + escapeHTML(entry.label) + '</span>' +
            (entry.shortcut
                ? '<span class="ctx-shortcut">' + escapeHTML(entry.shortcut) + '</span>'
                : '');

        if (!entry.disabled) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
                try { entry.action(); } catch (err) { console.error(err); }
            });
            btn.addEventListener('mouseenter', function () {
                setActive(items.indexOf(btn));
            });
        } else {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
            });
        }

        menuEl.appendChild(btn);
        items.push(btn);
    });
}

/* ═══════════ 定位 ═══════════ */

function positionMenu(x, y) {
    menuEl.style.visibility = 'hidden';
    menuEl.style.left = '0px';
    menuEl.style.top = '0px';

    const rect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;

    let left = x;
    let top = y;

    if (left + rect.width + gap > vw) left = x - rect.width;
    if (left < gap) left = gap;

    if (top + rect.height + gap > vh) top = y - rect.height;
    if (top < gap) top = gap;

    menuEl.style.left = left + 'px';
    menuEl.style.top = top + 'px';
    menuEl.style.visibility = '';
}

/* ═══════════ 开关 ═══════════ */

function openMenu(x, y, list) {
    renderMenu(list);
    menuEl.classList.add('open');
    menuEl.setAttribute('aria-hidden', 'false');
    visible = true;
    positionMenu(x, y);
    setActive(-1);
}

function closeMenu() {
    if (!visible) return;
    visible = false;
    activeIdx = -1;
    menuEl.classList.remove('open');
    menuEl.setAttribute('aria-hidden', 'true');
}

export function closeContextMenu() {
    closeMenu();
}

/* ═══════════ 高亮 / 键盘 ═══════════ */

function setActive(idx) {
    if (activeIdx >= 0 && items[activeIdx]) {
        items[activeIdx].classList.remove('active');
    }
    activeIdx = idx;
    if (activeIdx >= 0 && items[activeIdx]) {
        items[activeIdx].classList.add('active');
    }
}

function moveActive(delta) {
    if (!items.length) return;
    let i = activeIdx;
    let tries = 0;
    do {
        i = (i + delta + items.length) % items.length;
        tries++;
    } while (
        (!items[i] || items[i].classList.contains('disabled')) &&
        tries < items.length * 2
        );
    if (items[i] && !items[i].classList.contains('disabled')) {
        setActive(i);
    }
}

function onKeyDown(e) {
    if (!visible) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveActive(1);
        return;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveActive(-1);
        return;
    }
    if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && items[activeIdx] && !items[activeIdx].classList.contains('disabled')) {
            items[activeIdx].click();
        }
        return;
    }
}

/* ═══════════ 长按（触屏） ═══════════ */

let longPressTimer = null;
let longPressX = 0;
let longPressY = 0;
let longPressTarget = null;
let longPressFired = false;

function startLongPress(e) {
    if (e.touches.length !== 1) return;

    /* 输入框内不弹菜单（用户要的是选中/粘贴） */
    const tgt = e.target;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;

    /* 已有选中时忽略（用户在拖动选择手柄） */
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) return;

    const t = e.touches[0];
    longPressX = t.clientX;
    longPressY = t.clientY;
    longPressTarget = tgt;
    longPressFired = false;

    longPressTimer = setTimeout(function () {
        longPressTimer = null;
        longPressFired = true;

        const list = buildMenuItems({ target: longPressTarget });
        if (!list.length) return;

        /* 触觉反馈 */
        if (navigator.vibrate) {
            try { navigator.vibrate(30); } catch (e) { /* ignore */ }
        }

        openMenu(longPressX, longPressY, list);
    }, 500);
}

function cancelLongPressOnMove(e) {
    if (!longPressTimer) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - longPressX);
    const dy = Math.abs(t.clientY - longPressY);
    if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

function endLongPress(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    /* 长按后阻止后续 click，避免误触 */
    if (longPressFired) {
        e.preventDefault();
        longPressFired = false;
    }
}

/* ═══════════ 初始化 ═══════════ */

export function initContextMenu() {
    menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu';
    menuEl.setAttribute('role', 'menu');
    menuEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(menuEl);

    /* 桌面右键 */
    document.addEventListener('contextmenu', function (e) {
        if (e.shiftKey) return;
        e.preventDefault();
        const list = buildMenuItems({ target: e.target });
        if (!list.length) return;
        openMenu(e.clientX, e.clientY, list);
    });

    /* 触屏长按 */
    document.addEventListener('touchstart', startLongPress, { passive: true });
    document.addEventListener('touchmove', cancelLongPressOnMove, { passive: true });
    document.addEventListener('touchend', endLongPress, { passive: false });
    document.addEventListener('touchcancel', function () {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        longPressFired = false;
    }, { passive: true });

    /* 点击外部关闭 */
    document.addEventListener('mousedown', function (e) {
        if (!visible) return;
        if (menuEl.contains(e.target)) return;
        closeMenu();
    });

    document.addEventListener('touchstart', function (e) {
        if (!visible) return;
        if (menuEl.contains(e.target)) return;
        closeMenu();
    }, { passive: true });

    /* 键盘 */
    document.addEventListener('keydown', onKeyDown, true);

    /* 窗口事件 */
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('blur', closeMenu);

    /* 图片拖拽禁用 */
    document.addEventListener('dragstart', function (e) {
        if (e.target && e.target.nodeName === 'IMG') e.preventDefault();
    });
}