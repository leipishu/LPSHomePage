/** HTML 转义 */
export function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/** 生成 [a, b) 范围内的随机数 */
export function rand(a, b) {
    return a + Math.random() * (b - a);
}

/** 右补空格 */
export function padEnd(s, n) {
    return String(s).padEnd(n);
}

/** 生成一个可点击的链接行 HTML */
export function linkHTML(item) {
    return '<a class="link" href="' + escapeHTML(item.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="name">' + escapeHTML(item.name) + '</span>' +
        '<span class="desc">' + escapeHTML(item.desc) + '</span>' +
        '<span class="go">↗</span>' +
        '</a>';
}