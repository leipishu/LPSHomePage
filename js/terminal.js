import { getConfig } from './config.js';
import { escapeHTML } from './util.js';

let screenEl = null;
let inputEl = null;
let onCommandCallback = null;
let getCommandNamesCallback = null;
const history = [];
let historyIdx = 0;

/** 初始化终端，绑定屏幕元素和命令执行回调 */
export function initTerminal({ screen, onCommand, getCommandNames }) {
    screenEl = screen;
    onCommandCallback = onCommand;
    getCommandNamesCallback = getCommandNames;

    screenEl.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a')) return;
        focusInput();
    });
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

export function scrollBottom() {
    if (screenEl) screenEl.scrollTop = screenEl.scrollHeight;
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

/** 清空屏幕 */
export function clearScreen() {
    if (screenEl) screenEl.innerHTML = '';
}

export function focusInput() {
    if (inputEl) inputEl.focus();
}

function addInputLine() {
    const line = document.createElement('div');
    line.className = 'line input-line';
    line.innerHTML = promptHTML() +
        '<input type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">';
    screenEl.appendChild(line);
    inputEl = line.querySelector('input');
    inputEl.addEventListener('keydown', onKeyDown);
    scrollBottom();
}

/** 显示输入行并聚焦 */
export function startPrompt() {
    addInputLine();
    focusInput();
}

function submit(value) {
    const inputLine = inputEl.parentNode;
    inputLine.parentNode.removeChild(inputLine);

    print(promptHTML() + '<span class="cmd">' + escapeHTML(value) + '</span>');
    if (onCommandCallback) onCommandCallback(value);

    addInputLine();
    focusInput();
}

function onKeyDown(e) {
    // ── 回车 ──
    if (e.key === 'Enter') {
        e.preventDefault();
        const v = inputEl.value;

        if (!v.trim()) {
            const line = inputEl.parentNode;
            line.parentNode.removeChild(line);
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
        addInputLine();
        focusInput();
        return;
    }
}