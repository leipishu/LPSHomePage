import { getConfig } from './config.js';
import { escapeHTML, padEnd, linkHTML } from './util.js';
import * as term from './terminal.js';
import { setTheme, getThemeIds } from './themes.js';
import { startSnakePlayer } from './snake.js';

const registry = new Map();
const aliasMap = new Map();
const startedAt = Date.now();

/* ─────────── 注册表 API ─────────── */

export function register(name, fn) {
    registry.set(name, fn);
}

export function registerAlias(alias, target) {
    aliasMap.set(alias, target);
}

export function getCommandNames() {
    return Array.from(registry.keys()).concat(Array.from(aliasMap.keys()));
}

function descOf(name) {
    const cfg = getConfig();
    return (cfg.commands && cfg.commands[name]) || '';
}

/* ─────────── 执行 ─────────── */

export function execute(input) {
    const trimmed = String(input).trim();
    if (!trimmed) return;

    const parts = trimmed.split(/\s+/);
    let cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const cfg = getConfig();

    if (aliasMap.has(cmd)) cmd = aliasMap.get(cmd);

    const fn = registry.get(cmd);
    if (!fn) {
        term.print('<span class="out">' +
            cfg.text.commandNotFound.replace('{cmd}', escapeHTML(parts[0])) +
            '</span>');
        term.print('<span class="out">' + cfg.text.typeHelpHint + '</span>');
        return;
    }

    try {
        const result = fn(args);
        // 异步命令错误捕获
        if (result && typeof result.catch === 'function') {
            result.catch(function (err) {
                term.printBeforeInput('<span class="out">error: ' +
                    escapeHTML(err && err.message ? err.message : String(err)) +
                    '</span>');
            });
        }
    } catch (err) {
        term.printBeforeInput('<span class="out">error: ' +
            escapeHTML(err && err.message ? err.message : String(err)) +
            '</span>');
    }
}

/* ─────────── 工具 ─────────── */

function fmtUptime() {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return h + ':' + m + ':' + ss;
}

function printBanner() {
    const cfg = getConfig();
    const text = Array.isArray(cfg.banner) ? cfg.banner.join('\n') : cfg.banner;
    const d = document.createElement('div');
    d.className = 'line';
    const pre = document.createElement('pre');
    pre.className = 'banner';
    pre.style.margin = '6px 0 2px';
    pre.textContent = text;
    d.appendChild(pre);
    term.print('');
    document.getElementById('screen').appendChild(d);
    term.scrollBottom(true);
}

function printLinks() {
    const cfg = getConfig();
    term.print('<span class="out">total ' + cfg.links.length + '</span>');
    cfg.links.forEach(function (item) { term.print(linkHTML(item)); });
}

/* ─────────── 新命令：history / matrix / weather ─────────── */

function cmdHistory() {
    const list = term.getHistory();
    if (!list.length) {
        term.print('<span class="out">(no history)</span>');
        return;
    }
    list.forEach(function (c, i) {
        term.print('  <span class="prompt-path">' + String(i + 1).padStart(4, ' ') + '</span>  ' +
            '<span class="out">' + escapeHTML(c) + '</span>');
    });
}

function cmdMatrix() {
    const screen = term.getScreenEl();
    if (!screen) return;
    if (screen.querySelector('.matrix-overlay')) return;

    term.print('<span class="out">Wake up, Neo...</span>');

    const canvas = document.createElement('canvas');
    canvas.className = 'matrix-overlay';

    const rect = screen.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    screen.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fontSize = 14;
    const cols = Math.max(1, Math.floor(rect.width / fontSize));
    const drops = new Array(cols).fill(1);

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789';
    const maxFrames = 300; // ≈5 秒
    let frame = 0;

    function draw() {
        if (!canvas.parentNode) return;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
        ctx.fillRect(0, 0, rect.width, rect.height);

        ctx.fillStyle = '#00ff6a';
        ctx.font = 'bold ' + fontSize + 'px ui-monospace, "SF Mono", monospace';
        ctx.textBaseline = 'top';

        for (let i = 0; i < drops.length; i++) {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > rect.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }

        frame++;
        if (frame < maxFrames) {
            requestAnimationFrame(draw);
        } else {
            canvas.style.transition = 'opacity 0.6s ease';
            canvas.style.opacity = '0';
            setTimeout(function () {
                if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
            }, 700);
        }
    }
    draw();
}

function cmdWeather(args) {
    const city = (args.join(' ') || '').trim();

    term.printBeforeInput('<span class="out">Fetching weather' +
        (city ? ' for ' + escapeHTML(city) : '') + ' ...</span>');

    // wttr.in 免费、无需 key，返回 JSON
    const url = 'https://wttr.in/' + encodeURIComponent(city) + '?format=j1';

    return fetch(url, { cache: 'no-cache' })
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            const cur = data.current_condition && data.current_condition[0];
            const area = data.nearest_area && data.nearest_area[0];
            if (!cur || !area) throw new Error('unexpected response');

            const place =
                (area.areaName && area.areaName[0] && area.areaName[0].value || '') +
                ', ' +
                (area.country && area.country[0] && area.country[0].value || '');

            term.printBeforeInput('');
            term.printBeforeInput('<span class="prompt-path">Location</span>   <span class="out">' + escapeHTML(place) + '</span>');
            term.printBeforeInput('<span class="prompt-path">Temp</span>       <span class="out">' +
                escapeHTML(cur.temp_C) + '°C (feels ' + escapeHTML(cur.FeelsLikeC) + '°C)</span>');
            term.printBeforeInput('<span class="prompt-path">Weather</span>    <span class="out">' +
                escapeHTML(cur.weatherDesc && cur.weatherDesc[0] ? cur.weatherDesc[0].value : '') + '</span>');
            term.printBeforeInput('<span class="prompt-path">Humidity</span>   <span class="out">' +
                escapeHTML(cur.humidity) + '%</span>');
            term.printBeforeInput('<span class="prompt-path">Wind</span>       <span class="out">' +
                escapeHTML(cur.windspeedKmph) + ' km/h</span>');
            term.printBeforeInput('');
        });
}

/* ─────────── 注册所有默认命令 ─────────── */

export function registerDefaultCommands() {
    const cfg = getConfig();

    register('help', function () {
        const c = getConfig();
        term.print('');
        term.print('<span class="out">' + c.text.helpHeader + '</span>');

        Array.from(registry.keys()).sort().forEach(function (name) {
            term.print('  <span class="prompt-path">' + padEnd(name, 14) + '</span>' +
                '<span class="out">' + descOf(name) + '</span>');
        });

        term.print('');
        term.print('<span class="out">' + c.text.aliasesLine + '</span>');
        term.print('<span class="out">' + c.text.shortcutsLine + '</span>');
        term.print('');
    });

    register('whoami', function () {
        term.print('<span class="brand">' + escapeHTML(getConfig().profile.username) + '</span>');
    });

    register('signature', function () {
        term.print('<span class="sign">' + escapeHTML(getConfig().profile.signature) + '</span>');
    });

    register('links', printLinks);
    register('banner', printBanner);

    register('welcome', function () {
        const c = getConfig();
        term.print('<span class="out">' + c.text.welcomeLine1 + '</span>');
        term.print('');
        term.print('<span class="brand">' + escapeHTML(c.profile.username) + '</span>  ' +
            '<span class="sign">' + escapeHTML(c.profile.signature) + '</span>');
        term.print('');
        term.print('<span class="out">' + c.text.welcomeLine2 + '</span>');
        term.print('<span class="out">' + c.text.welcomeLine3 + '</span>');
        term.print('');
    });

    register('theme', function (args) {
        const c = getConfig();

        if (!args.length) {
            term.print('<span class="out">' + c.text.themeListHeader + '</span>');
            c.themes.forEach(function (t) {
                const mark = document.documentElement.getAttribute('data-theme') === t.id ? ' *' : '';
                term.print('  <span class="prompt-path">' + padEnd(t.id, 12) + '</span>' +
                    '<span class="out">' + t.name + mark + '</span>');
            });
            term.print('<span class="out">' + c.text.themeUsage + '</span>');
            return;
        }

        const id = String(args[0]).toLowerCase();
        const ok = setTheme(id);
        if (!ok) {
            term.print('<span class="out">' +
                c.text.themeNotFound.replace('{id}', escapeHTML(id)) +
                '</span>');
            return;
        }
        term.print('<span class="out">' +
            c.text.themeSwitched.replace('{id}', escapeHTML(id)) +
            '</span>');
    });

    // 游戏
    register('game', function () {
        const c = getConfig();
        term.print('<span class="out">' + c.text.gameStarting + '</span>');
        term.print('<span class="out">' + c.text.gameHelp + '</span>');
        setTimeout(function () {
            startSnakePlayer();
        }, 400);
    });

    register('about', function () {
        const c = getConfig();
        c.about.lines.forEach(function (line) {
            term.print('<span class="out">' + escapeHTML(line) + '</span>');
        });
    });

    register('contact', function () {
        const c = getConfig();
        c.contact.forEach(function (item) {
            term.print('<span class="prompt-path">' + padEnd(item.label, 9) + '</span>' +
                '<span class="out">' + escapeHTML(item.value) + '</span>');
        });
    });

    register('date', function () {
        term.print('<span class="out">' + new Date().toString() + '</span>');
    });

    register('echo', function (args) {
        term.print('<span class="out">' + escapeHTML(args.join(' ')) + '</span>');
    });

    register('neofetch', function () {
        const c = getConfig();
        const n = c.neofetch || {};
        term.print('<span class="brand">' + escapeHTML(c.profile.username) + '</span>' +
            '<span class="out">@</span>' +
            '<span class="prompt-path">localhost</span>');
        term.print('<span class="out">─────────────────────────────</span>');
        term.print('<span class="prompt-path">OS</span>        <span class="out">' + escapeHTML(n.os || '') + '</span>');
        term.print('<span class="prompt-path">Shell</span>     <span class="out">' + escapeHTML(n.shell || '') + '</span>');
        term.print('<span class="prompt-path">Terminal</span>  <span class="out">' + escapeHTML(n.terminal || '') + '</span>');
        term.print('<span class="prompt-path">Theme</span>     <span class="out">' +
            (document.documentElement.getAttribute('data-theme') || '') + '</span>');
        term.print('<span class="prompt-path">Uptime</span>    <span class="out">' + fmtUptime() + '</span>');
        term.print('<span class="prompt-path">Links</span>     <span class="out">' + c.links.length + '</span>');
    });

    register('license', function () {
        const c = getConfig();
        term.print('<span class="out">' +
            c.text.licenseLine1.replace('{username}', escapeHTML(c.profile.username)) +
            '</span>');
        term.print('<span class="out">' + c.text.licenseLine2 + '</span>');
        term.print('<span class="out">' + c.text.licenseLine3 + '</span>');
        term.print('<span class="out">' + c.text.licenseLine4 + '</span>');
    });

    register('clear', function () { term.clearScreen(); });

    register('sudo', function () {
        const c = getConfig();
        term.print('<span class="out">' + c.text.sudoPrompt + '</span>');
        setTimeout(function () {
            term.print('<span class="out">' + c.text.sudoFail + '</span>');
        }, 750);
    });

    register('exit', function () {
        term.print('<span class="out">' + getConfig().text.exitMsg + '</span>');
    });

    /* ─────────── 新增命令 ─────────── */

    register('history', cmdHistory);
    register('matrix', cmdMatrix);
    register('weather', cmdWeather);

    /* 别名 */
    const aliases = cfg.aliases || {};
    Object.keys(aliases).forEach(function (a) {
        registerAlias(a, aliases[a]);
    });
}