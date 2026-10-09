import { getConfig } from './config.js';
import { escapeHTML, rand, linkHTML } from './util.js';
import * as term from './terminal.js';

/** 把 {linksCount} 之类的占位符替换掉 */
function applyVars(text) {
    const cfg = getConfig();
    return String(text)
        .replace(/\{linksCount\}/g, cfg.links.length)
        .replace(/\{username\}/g, cfg.profile.username);
}

function resolvePlaceholder(name) {
    const cfg = getConfig();
    switch (name) {
        case 'username':  return cfg.profile.username;
        case 'signature': return cfg.profile.signature;
        default:          return '';
    }
}

/**
 * 播放开场动画。
 * @param {Function} onComplete 播放结束后调用
 */
export function playIntro(onComplete) {
    const cfg = getConfig();
    const intro = cfg.intro || {};

    if (!intro.enabled) {
        onComplete();
        return;
    }

    const lines = intro.lines || [];
    const lineDelay = intro.lineDelay || [100, 170];
    const commandDelay = intro.commandDelay || [340, 520];

    let idx = 0;

    function next() {
        if (idx >= lines.length) {
            onComplete();
            return;
        }

        const step = lines[idx++];
        let isCommand = false;

        switch (step.type) {
            case 'blank':
                term.print('');
                break;

            case 'output':
                term.print('<span class="out">' + escapeHTML(applyVars(step.text)) + '</span>');
                break;

            case 'command':
                term.print(term.promptHTML() + '<span class="cmd">' + escapeHTML(step.text) + '</span>');
                isCommand = true;
                break;

            case 'placeholder': {
                const val = resolvePlaceholder(step.placeholder);
                const cls = step.cls || 'out';
                term.print('<span class="' + cls + '">' + escapeHTML(val) + '</span>');
                break;
            }

            case 'links': {
                const cfgNow = getConfig();
                cfgNow.links.forEach(function (item) {
                    term.print(linkHTML(item));
                });
                break;
            }

            default:
                break;
        }

        const range = isCommand ? commandDelay : lineDelay;
        const delay = rand(range[0], range[1]);
        setTimeout(next, delay);
    }

    setTimeout(next, intro.startDelay || 500);
}