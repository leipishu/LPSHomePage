import { getConfig } from './config.js';
import { escapeHTML } from './util.js';
import { focusInput } from './terminal.js';

let wrapperEl = null;
let triggerEl = null;
let menuEl = null;
let currentTheme = null;
let outsideClickBound = false;

/* ─────────── 存储 ─────────── */

function readSavedTheme() {
    try {
        return localStorage.getItem(getConfig().storageKey || 'leipishu-theme');
    } catch (e) {
        return null;
    }
}

function writeSavedTheme(id) {
    try {
        localStorage.setItem(getConfig().storageKey || 'leipishu-theme', id);
    } catch (e) { /* ignore */ }
}

/* ─────────── 菜单开合 ─────────── */

function openMenu() {
    if (!wrapperEl) return;
    wrapperEl.classList.add('open');
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
    if (!wrapperEl) return;
    wrapperEl.classList.remove('open');
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
    if (!wrapperEl) return;
    if (wrapperEl.classList.contains('open')) closeMenu();
    else openMenu();
}

/* ─────────── 触发器显示 ─────────── */

function updateTrigger(themeId) {
    if (!triggerEl) return;
    const cfg = getConfig();
    const t = cfg.themes.find(function (x) { return x.id === themeId; });
    if (!t) return;

    const icon = triggerEl.querySelector('.trigger-icon');
    const label = triggerEl.querySelector('.trigger-label');

    if (icon) {
        icon.style.background = t.swatch;
        icon.style.color = t.swatch;
    }
    if (label) label.textContent = t.name;
}

/* ─────────── 对外 API ─────────── */

/**
 * 初始化主题下拉框。
 * @param {HTMLElement} wrapper 包含 .theme-trigger 和 .theme-menu 的外层元素
 */
export function initThemes(wrapper) {
    if (!wrapper) return;
    wrapperEl = wrapper;
    triggerEl = wrapper.querySelector('.theme-trigger');
    menuEl = wrapper.querySelector('.theme-menu');

    if (!triggerEl || !menuEl) return;

    const cfg = getConfig();

    /* 生成菜单项 */
    menuEl.innerHTML = '';
    cfg.themes.forEach(function (t) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'theme-item';
        btn.setAttribute('data-theme', t.id);
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('title', t.name);
        btn.innerHTML =
            '<span class="item-icon" style="background:' + t.swatch + '"></span>' +
            '<span class="item-name">' + escapeHTML(t.name) + '</span>' +
            '<span class="item-check">✓</span>';

        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            setTheme(t.id);
            closeMenu();
            // 选完把焦点还给终端输入框
            setTimeout(focusInput, 40);
        });

        menuEl.appendChild(btn);
    });

    /* 触发器点击 */
    triggerEl.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleMenu();
    });

    /* 点击外部关闭（只绑定一次） */
    if (!outsideClickBound) {
        outsideClickBound = true;

        document.addEventListener('click', function (e) {
            if (!wrapperEl) return;
            if (!wrapperEl.contains(e.target)) closeMenu();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu();
        });
    }

    /* 恢复上次选择或默认主题 */
    const saved = readSavedTheme();
    const valid = saved && cfg.themes.some(function (t) { return t.id === saved; });
    setTheme(valid ? saved : (cfg.defaultTheme || cfg.themes[0].id));
}

/** 切换主题（同时更新按钮、菜单项高亮、localStorage） */
export function setTheme(id) {
    const cfg = getConfig();
    if (!cfg.themes.some(function (t) { return t.id === id; })) return false;

    document.documentElement.setAttribute('data-theme', id);
    currentTheme = id;
    writeSavedTheme(id);

    /* 更新菜单项高亮 */
    const items = document.querySelectorAll('.theme-item');
    for (let i = 0; i < items.length; i++) {
        items[i].classList.toggle('active', items[i].getAttribute('data-theme') === id);
    }

    /* 更新触发器 */
    updateTrigger(id);

    return true;
}

export function getCurrentTheme() {
    return currentTheme;
}

export function getThemeIds() {
    return getConfig().themes.map(function (t) { return t.id; });
}