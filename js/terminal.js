import { getConfig } from './config.js';
import { escapeHTML } from './util.js';

let screenEl = null;
let inputEl = null;
let onCommandCallback = null;
let getCommandNamesCallback = null;
const history = [];
let historyIdx = 0;

/* 粘性滚动：用户主动上滚时不打扰 */
let sticky = true;
const STICKY_THRESHOLD = 24;

/** 初始化终端，绑定屏幕元素和命令执行回调 */
export function initTerminal({ screen, onCommand, getCommandNames }) {
    screenEl = screen;
    onCommandCallback = onCommand;
    getCommandNamesCallback = getCommandNames;

    screenEl.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a')) return;
        focusInput();
    });

    screenEl.addEventListener('scroll', function () {
        const dist = screenEl.scrollHeight - screenEl.scrollTop - screenEl.clientHeight;
        sticky = dist < STICKY_THRESHOLD;
    }, { passive: true });
}

/** 生成提示符 HTML */
export function promptHTML() {
    const p = getConfig().profile;
    return '<span class="prompt">' +
        '<span class="prompt-user">' + escapeHTML(p.promptUser) + '</span>' +
        '<span class="prompt-sym">:</span>' +
        '<span class="prompt-path">' + escapeHTML(p.promptPath) + '</span>' +
        '<span class="prompt-sym">$</span> ' +
        '</span>';
}

/**
 * 滚动到底部。
 * @param {boolean} [force] 为 true 时无视粘性状态强制滚动（用于用户主动操作）
 */
export function scrollBottom(force) {
    if (!screenEl) return;
    if (force || sticky) {
        screenEl.scrollTop = screenEl.scrollHeight;
        sticky = true;
    }
}

/** 输出一行 HTML */
export function print(html) {
    const d = document.createElement('div');
    d.className = 'line';
    d.innerHTML = (html === undefined || html === null || html === '') ? '&nbsp;' : html;
    screenEl.appendChild(d);
    scrollBottom();
    return d;
}

/**
 * 在当前输入行之前插入一行 HTML。
 * 异步命令（如 weather）的输出会落在用户敲下的命令下方、输入框上方，
 * 而不是跑到最新输入框的下方。
 */
export function printBeforeInput(html) {
    const d = document.createElement('div');
    d.className = 'line';
    d.innerHTML = (html === undefined || html === null || html === '') ? '&nbsp;' : html;

    if (inputEl && inputEl.parentNode && inputEl.parentNode.parentNode === screenEl) {
        screenEl.insertBefore(d, inputEl.parentNode);
    } else {
        screenEl.appendChild(d);
    }

    scrollBottom();
    return d;
}

/**
 * 清空屏幕并重建输入行。
 * 会保留用户当前未提交的输入内容，避免清屏时把正在打的字一起抹掉。
 * 若输入行还没建立（例如开场动画尚未结束），则只清空。
 */
export function clearScreen() {
    if (!screenEl) return;

    const savedValue = inputEl ? inputEl.value : '';

    screenEl.innerHTML = '';
    inputEl = null;
    sticky = true;

    addInputLine();

    if (inputEl) {
        inputEl.value = savedValue;
        focusInput();
    }
}

export function focusInput() {
    if (inputEl) inputEl.focus();
}

/** 暴露终端屏幕元素（供 matrix 等命令使用） */
export function getScreenEl() {
    return screenEl;
}

/** 获取历史命令副本 */
export function getHistory() {
    return history.slice();
}

/**
 * 模拟用户在终端里敲入一条命令并回车。
 * 会：移除旧输入行 → 打印 prompt + 命令回显 → 执行 → 建新输入行 → 聚焦。
 * 用于右键菜单等非键盘触发的场景，保证输出位置和交互一致。
 */
export function runCommand(cmd) {
    const value = String(cmd).trim();
    if (!value) return;

    // 若输入行尚未创建（例如开场动画未结束），退化为直接执行
    if (!inputEl || !inputEl.parentNode) {
        if (onCommandCallback) onCommandCallback(value);
        return;
    }

    history.push(value);
    historyIdx = history.length;
    submit(value);
}

function addInputLine() {
    const line = document.createElement('div');
    line.className = 'line input-line';
    line.innerHTML = promptHTML() +
        '<input type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">';
    screenEl.appendChild(line);
    inputEl = line.querySelector('input');
    inputEl.addEventListener('keydown', onKeyDown);
    scrollBottom(true);
}

/** 显示输入行并聚焦 */
export function startPrompt() {
    addInputLine();
    focusInput();
}

function submit(value) {
    const inputLine = inputEl.parentNode;
    inputLine.parentNode.removeChild(inputLine);
    inputEl = null;

    print(promptHTML() + '<span class="cmd">' + escapeHTML(value) + '</span>');
    if (onCommandCallback) onCommandCallback(value);

    // 如果命令执行过程中已经重建了输入行（例如 clearScreen），就不重复添加
    if (!screenEl.querySelector('.input-line')) {
        addInputLine();
    }
    focusInput();
    scrollBottom(true);
}

function onKeyDown(e) {
    // ── 回车 ──
    if (e.key === 'Enter') {
        e.preventDefault();
        const v = inputEl.value;

        if (!v.trim()) {
            const line = inputEl.parentNode;
            line.parentNode.removeChild(line);
            inputEl = null;
            print(promptHTML());
            addInputLine();
            focusInput();
            return;
        }

        history.push(v);
        historyIdx = history.length;
        submit(v);
        return;
    }

    // ── 上一条历史 ──
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!history.length) return;
        if (historyIdx > 0) historyIdx--;
        inputEl.value = history[historyIdx] || '';
        inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
        return;
    }

    // ── 下一条历史 ──
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!history.length) return;
        if (historyIdx < history.length - 1) {
            historyIdx++;
            inputEl.value = history[historyIdx];
        } else {
            historyIdx = history.length;
            inputEl.value = '';
        }
        inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
        return;
    }

    // ── Tab 补全 ──
    if (e.key === 'Tab') {
        e.preventDefault();
        const partial = inputEl.value.trim();
        if (!partial || partial.indexOf(' ') !== -1) return;

        const pool = getCommandNamesCallback ? getCommandNamesCallback() : [];
        const matches = pool.filter(function (n) { return n.indexOf(partial) === 0; });

        if (matches.length === 1) {
            inputEl.value = matches[0] + ' ';
        } else if (matches.length > 1) {
            const line = inputEl.parentNode;
            line.parentNode.removeChild(line);
            inputEl = null;
            print(promptHTML() + '<span class="cmd">' + escapeHTML(partial) + '</span>');
            print('<span class="out">' + matches.join('   ') + '</span>');
            addInputLine();
            inputEl.value = partial;
            focusInput();
        }
        return;
    }

    // ── Ctrl+L 清屏 ──
    if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        clearScreen();
        return;
    }
}