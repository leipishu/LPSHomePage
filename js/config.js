let config = null;

/** 异步加载 config.json */
export async function loadConfig(url = 'config.json') {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' ' + res.statusText);
    }
    config = await res.json();
    return config;
}

/** 获取已加载的配置（同步） */
export function getConfig() {
    if (!config) throw new Error('Config has not been loaded yet.');
    return config;
}

/** 配置加载失败时，在页面上显示友好提示 */
export function showConfigError(err) {
    const box = document.createElement('div');
    box.className = 'config-error';
    box.innerHTML =
        '<div class="box">' +
        '<h2>⚠ config.json 加载失败</h2>' +
        '<p>错误信息：<code>' + String(err && err.message || err) + '</code></p>' +
        '<p style="margin-top:14px">常见原因：</p>' +
        '<p>1. 直接双击打开 <code>index.html</code>（file:// 协议下 fetch 会被浏览器拦截）</p>' +
        '<p>2. 未通过 HTTP 服务器访问</p>' +
        '<p style="margin-top:14px">解决办法：在项目根目录运行</p>' +
        '<p><code>python3 -m http.server 8000</code></p>' +
        '<p>然后访问 <code>http://localhost:8000</code></p>' +
        '</div>';
    document.body.appendChild(box);
}