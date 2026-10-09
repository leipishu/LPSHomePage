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
    let config;
    try {
        config = await loadConfig('config.json');
    } catch (err) {
        console.error('[leipishu] config load failed:', err);
        showConfigError(err);
        return;
    }

    document.title = config.profile.pageTitle || config.profile.username || 'terminal';

    // 静态区域
    renderHero();
    renderFooter();
    renderWindowTitle();

    // 主题下拉框（外层容器 id 是 themeDropdown）
    const themeDropdown = document.getElementById('themeDropdown');
    if (themeDropdown) {
        initThemes(themeDropdown);
    } else {
        console.warn('[leipishu] #themeDropdown not found — theme switcher disabled');
    }

    // 背景贪吃蛇
    initSnake();

    // 终端最小化
    initMinimize();

    // 游戏按钮
    initGameButton();
    initExitGameButton();

    // 模式切换回调
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

    // 注册命令
    registerDefaultCommands();

    // 初始化终端
    const screenEl = document.getElementById('screen');
    initTerminal({
        screen: screenEl,
        onCommand: execute,
        getCommandNames: getCommandNames
    });

    // 开场动画
    playIntro(function () {
        startPrompt();
    });
}

main();