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

/** 渲染页脚（许可证信息） */
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
}

/** 渲染窗口标题栏文字 */
export function renderWindowTitle() {
    const cfg = getConfig();
    const el = document.getElementById('winTitle');
    if (el) el.textContent = cfg.profile.windowTitle || '';
}