import { getConfig } from './config.js';

/** 渲染 Hero 区（头像 / Banner / 签名）与页脚 */
export function renderHero() {
    const cfg = getConfig();

    const avatar = document.getElementById('avatar');
    if (avatar) {
        avatar.src = cfg.profile.avatar;
        avatar.alt = cfg.profile.username;
    }

    const banner = document.getElementById('banner');
    if (banner) {
        banner.textContent = Array.isArray(cfg.banner) ? cfg.banner.join('\n') : cfg.banner;
    }

    const sign = document.getElementById('heroSign');
    if (sign) sign.textContent = cfg.profile.signature;
}

/** 渲染页脚（许可证信息 + GitHub 源码链接） */
export function renderFooter() {
    const cfg = getConfig();
    const f = cfg.footer || {};

    const licenseEl = document.getElementById('footerLicense');
    if (licenseEl) licenseEl.textContent = f.license || '';

    const copyEl = document.getElementById('footerCopyright');
    if (copyEl) copyEl.textContent = f.copyright || '';

    const linkEl = document.getElementById('footerLink');
    if (linkEl) {
        linkEl.href = f.linkUrl || '#';
        linkEl.textContent = f.linkText || '';
    }

    /* ── GitHub 源码链接 ── */
    const ghLink = document.getElementById('footerGithub');
    if (ghLink) {
        const repoUrl = (cfg.profile && cfg.profile.repoUrl) || '';
        if (repoUrl) {
            ghLink.href = repoUrl;
        } else {
            /* 没配 repoUrl 就整个隐藏（连同左侧分隔符） */
            ghLink.style.display = 'none';
            const sepBefore = ghLink.previousElementSibling;
            if (sepBefore && sepBefore.classList.contains('footer-sep')) {
                sepBefore.style.display = 'none';
            }
        }
    }
}

/* ══════════ 窗口标题：动态计算终端网格 ══════════ */

let titleObserver = null;
let titleScreenEl = null;
let lastGrid = null;   // 缓存最近一次成功的测量结果

/**
 * 用一个临时 canvas 测量当前字体下等宽字符的宽度。
 * 取几个代表性字符的最大值，避免 'M' 或 'i' 单独取值偏差。
 */
function measureCharWidth(fontSize, fontFamily) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return fontSize * 0.6;

    ctx.font = fontSize + 'px ' + fontFamily;

    let maxW = 0;
    const samples = ['M', 'W', '0', 'x', ' '];
    for (let i = 0; i < samples.length; i++) {
        const w = ctx.measureText(samples[i]).width;
        if (w > maxW) maxW = w;
    }
    return maxW || fontSize * 0.6;
}

/**
 * 计算终端内容区（.screen）当前能容纳的字符网格。
 * 返回 { cols, rows }；如果元素还没布局好则返回 null。
 */
export function measureTerminalGrid() {
    const screen = document.getElementById('screen');
    if (!screen) return null;

    const cs = getComputedStyle(screen);
    const fontSize   = parseFloat(cs.fontSize)   || 13.5;
    const fontFamily = cs.fontFamily || 'monospace';

    /* line-height 可能是 "normal"，此时用 fontSize * 1.5 兜底 */
    let lineHeight = parseFloat(cs.lineHeight);
    if (!lineHeight || isNaN(lineHeight)) lineHeight = fontSize * 1.5;

    const padL = parseFloat(cs.paddingLeft)   || 0;
    const padR = parseFloat(cs.paddingRight)  || 0;
    const padT = parseFloat(cs.paddingTop)    || 0;
    const padB = parseFloat(cs.paddingBottom) || 0;

    const innerW = screen.clientWidth  - padL - padR;
    const innerH = screen.clientHeight - padT - padB;
    if (innerW <= 0 || innerH <= 0) return null;

    const charWidth = measureCharWidth(fontSize, fontFamily);

    const cols = Math.max(1, Math.floor(innerW / charWidth));
    const rows = Math.max(1, Math.floor(innerH / lineHeight));

    return { cols: cols, rows: rows };
}

/** 把模板里的 {cols} / {rows} 替换成给定值 */
function composeWindowTitle(template, grid) {
    let title = String(template || '');
    if (!grid) {
        /* 从未测成功过：至少不要把 {cols}/{rows} 原样漏出来 */
        return title
            .replace(/\{cols\}/g, '?')
            .replace(/\{rows\}/g, '?');
    }
    return title
        .replace(/\{cols\}/g, grid.cols)
        .replace(/\{rows\}/g, grid.rows);
}

/** 立即刷新一次标题栏文字 */
function refreshWindowTitle() {
    const el = document.getElementById('winTitle');
    if (!el) return;

    const cfg = getConfig();
    const template = (cfg.profile && cfg.profile.windowTitle) || '';

    /* 测量成功 → 更新缓存；失败 → 沿用上次成功的值（例如最小化时 .screen 高度为 0） */
    const grid = measureTerminalGrid() || lastGrid;
    if (grid) lastGrid = grid;

    el.textContent = composeWindowTitle(template, grid);
}

/** 渲染窗口标题栏文字，并监听屏幕尺寸变化动态更新 */
export function renderWindowTitle() {
    /* 首次尽力刷新一次 */
    refreshWindowTitle();

    const screen = document.getElementById('screen');
    if (!screen) return;

    /* 已经监听同一个元素就不重复绑定 */
    if (titleObserver && titleScreenEl === screen) return;

    /* 换了元素 → 先把旧的断开 */
    if (titleObserver) {
        titleObserver.disconnect();
        titleObserver = null;
    }
    titleScreenEl = screen;

    /* 用 ResizeObserver 盯住 .screen：
       · 拖 / 缩终端窗口时触发
       · 浏览器窗口 resize 触发
       · 最小化 / 还原终端触发
       · 布局变动导致内容区尺寸变化时触发 */
    if (typeof ResizeObserver !== 'undefined') {
        titleObserver = new ResizeObserver(function () {
            refreshWindowTitle();
        });
        titleObserver.observe(screen);
    } else {
        /* 兜底：老浏览器 */
        window.addEventListener('resize', refreshWindowTitle);
    }

    /* ═══ 首帧兜底 ═══
       main.js 里 renderWindowTitle() 是在同步连调 renderHero/renderFooter 之后立即执行的，
       此时 .screen 的第一次布局很可能还没完成，clientWidth/Height 为 0，
       导致 measureTerminalGrid() 返回 null。
       而 ResizeObserver 只在尺寸发生变化时触发，从 0→0 不会再回调。
       因此这里用 rAF 主动重试，直到测量成功或超过上限。 */
    let tries = 0;
    const MAX_TRIES = 120;   // 约 2 秒
    function retry() {
        if (measureTerminalGrid()) {
            refreshWindowTitle();
            return;
        }
        if (tries++ < MAX_TRIES) {
            requestAnimationFrame(retry);
        }
    }
    requestAnimationFrame(retry);

    /* ═══ 字体加载完成后重测一次 ═══
       移动端和 Safari 上，Web Font 通常是异步加载的。
       若在字体就绪前测量，用的是 fallback 字体宽度，结果会偏；
       字体就绪后 canvas measure 用真字体，宽度可能略有不同。
       这里在 fonts.ready 后补一次，保证 cols 更准确。 */
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready.then(function () {
            refreshWindowTitle();
        });
    }

    /* ═══ 软键盘弹出/收起时补测 ═══
       iOS / Android 上点击终端输入框会弹出软键盘，
       visualViewport 尺寸变化可能不触发 .screen 的 ResizeObserver
       （因为 .screen 用的是布局视口），这里直接监听 visualViewport 兜底。 */
    if (window.visualViewport) {
        let vvRaf = null;
        window.visualViewport.addEventListener('resize', function () {
            if (vvRaf) return;
            vvRaf = requestAnimationFrame(function () {
                vvRaf = null;
                refreshWindowTitle();
            });
        });
    }
}