# [LEIPISHU Terminal Homepage](https://home.leipishu.com)

极客风格的终端式个人主页。零依赖，纯原生 HTML / CSS / JavaScript（ES Modules），无构建步骤。

## 特性

- **可交互终端** —— 支持命令输入、历史记录、Tab 补全、Ctrl+L 清屏、粘性滚动
- **背景贪吃蛇** —— AI 自动寻路作为氛围层，也可切换为玩家模式手动玩，**支持触屏滑动 + 虚拟方向键**
- **8 套主题** —— 下拉切换，选择存入 localStorage，跟随主题变色
- **主题化光标** —— 箭头 / 指针 / 文本 / 拖拽四种状态全用主题色 SVG 重绘
- **鼠标跟随光晕** —— 背景光晕平滑跟随鼠标，颜色随主题变化
- **自定义右键菜单** —— 上下文感知，支持链接 / 终端 / 游戏三种场景
- **可拖动终端窗口** —— 鼠标按住标题栏拖动，双击标题栏或点 Reset 归位
- **Hero 区** —— 头像、ANSI Shadow 大字、签名、社交图标
- **终端状态栏** —— 分支 / 编码 / Shell / 实时时钟
- **开场动画** —— 打字机式逐行输出，配置驱动
- **彩蛋命令** —— `matrix` 数字雨、`weather` 实时天气、`history` 历史记录
- **配置化** —— 除 CSS 外的一切都在 `config.json` 里
- **功能开关** —— `features` 里一键关闭光标 / 光晕 / 右键菜单 / 窗口拖动

## 目录结构

```
leipishu-terminal/
├── index.html
├── config.json          ★ 所有可配置内容
├── README.md
├── css/
│   └── style.css        样式 + 8 套主题变量 + 光标 / 右键菜单 / 光晕
├── js/
│   ├── main.js          入口，串联各模块
│   ├── config.js        加载 config.json
│   ├── util.js          escapeHTML / rand / linkHTML
│   ├── terminal.js      终端渲染、输入、历史、补全、粘性滚动
│   ├── themes.js        主题切换 + 下拉菜单
│   ├── hero.js          头像 / Banner / 签名 / 社交图标 / 页脚
│   ├── commands.js      命令注册与执行
│   ├── contextmenu.js   自定义右键菜单
│   ├── intro.js         开场动画
│   └── snake.js         背景贪吃蛇（AI + 玩家模式 + 触屏）
└── assets/
    ├── leipishu.jpg     头像
    └── favicon.svg      站点图标
```

## 快速开始

因使用了 ES Modules 和 `fetch('config.json')`，必须通过 HTTP 服务器访问：

```bash
# Python 3 自带
python3 -m http.server 8000

# 或 Node
npx serve .

# 或任意静态服务器
```

然后打开 `http://localhost:8000`。

> 直接双击 `index.html` 会因 CORS 拦截导致 config 加载失败，页面会显示友好提示。

## 配置（config.json）

| 字段 | 作用 |
|---|---|
| `profile` | 用户名、签名、头像、窗口标题、提示符、favicon |
| `social` | Hero 区社交图标行（id / label / url） |
| `banner` | 顶部 ASCII 大字，数组，每行一条 |
| `snake` | 背景贪吃蛇：开关、透明度、速度、长度上限、玩家模式速度 |
| `features` | 功能开关：光标 / 光晕 / 右键菜单 / 窗口拖动（见下） |
| `links` | `links` / `ls` 命令展示的链接列表 |
| `themes` | 主题卡片列表（id / name / swatch） |
| `defaultTheme` | 首次进入使用的主题 |
| `storageKey` | localStorage 里存主题选择的 key |
| `statusBar` | 终端状态栏左侧字段（branch / encoding / eol / shell） |
| `footer` | 页脚许可证信息 |
| `intro` | 开场动画：延迟、每行内容 |
| `text` | 所有 UI 文案（命令反馈、欢迎语等） |
| `commands` | 各命令在 `help` 里显示的描述 |
| `aliases` | 命令别名 |
| `about` / `contact` / `neofetch` | 各命令的具体输出 |

### 功能开关（features）

```json
"features": {
  "cursorGlow":   true,
  "themedCursor": true,
  "contextMenu":  true,
  "windowDrag":   true
}
```

| 字段 | 作用 | 关闭后的表现 |
|---|---|---|
| `cursorGlow` | 鼠标跟随光晕 | 背景不再有随鼠标移动的光圈 |
| `themedCursor` | 主题化 SVG 光标 | 光标回到系统默认 |
| `contextMenu` | 自定义右键菜单 | 右键不再弹菜单，恢复浏览器原生菜单 |
| `windowDrag` | 拖动终端标题栏移动窗口 | 终端固定，**Reset 按钮和右键菜单里的 Reset 项同时隐藏** |

**规则**：
- `true` 或省略 → 启用
- `false` → 关闭
- 整个 `features` 块缺失 → 全部按启用处理

### 换头像

把图片放进 `assets/`，改 `config.json` 的 `profile.avatar`：

```json
"avatar": "assets/your-avatar.png"
```

### 加链接

`links` 数组里加一条，`links` 命令和开场动画都会自动带上：

```json
{ "name": "github", "url": "https://github.com/you", "desc": "repositories" }
```

### 加社交图标

`social` 数组里加一条，前提是 `js/hero.js` 的 `SOCIAL_ICONS` 里有对应 id 的 SVG：

```json
{ "id": "github", "label": "GitHub", "url": "https://github.com/you" }
```

已内置的图标 id：`github` / `bilibili` / `mail` / `rss` / `twitter` / `zhihu`。

## 内置命令

| 命令 | 别名 | 说明 |
|---|---|---|
| `help` | `?` `man` | 列出所有命令 |
| `whoami` | — | 输出用户名 |
| `signature` | `sig` | 输出签名 |
| `links` | `ls` | 列出所有链接（可点击） |
| `banner` | — | 重打 ASCII 大字 |
| `welcome` | — | 重打欢迎信息 |
| `theme` | — | 列出/切换主题，如 `theme dracula` |
| `game` | `play` `snake` | 进入贪吃蛇玩家模式 |
| `history` | `hist` | 显示本次会话的命令历史 |
| `matrix` | `neo` | 触发数字雨彩蛋（约 5 秒） |
| `weather [city]` | `w` | 查询实时天气（默认当前位置） |
| `about` | — | 关于本页 |
| `contact` | — | 联系方式 |
| `date` | — | 当前时间 |
| `echo <文字>` | — | 回显 |
| `neofetch` | `info` | 系统信息风格输出 |
| `license` | — | 打印 MIT 协议 |
| `clear` | `cls` | 清屏 |
| `sudo` | — | 彩蛋 |
| `exit` | — | 彩蛋 |

## 快捷键

- `↑` / `↓` —— 翻历史命令
- `Tab` —— 补全命令名（多个候选会列出）
- `Ctrl + L` —— 清屏
- `Shift + 右键` —— 放行浏览器原生右键菜单（调试用）

## 鼠标交互

### 光晕

鼠标移动时，背景出现柔和圆形光晕，平滑跟随；颜色自动继承当前主题的 `--glow` / `--glow2`。触屏设备自动关闭。

### 主题化光标

| 位置 | 光标形态 |
|---|---|
| 页面空白处 | 细线箭头（bg 填充 + accent 描边 + 内部高光） |
| 链接 / 按钮 | 四角聚焦框 + 中心点 |
| 终端屏幕内 / 输入框 | I-beam 竖线 + 中心点 |
| 终端标题栏 | 方块 + 单环 |
| 拖拽中 | 方块 + 实线环 + 虚线外环 |

颜色随主题自动变化，切换主题时立即刷新。

### 选中文本

背景 = 主题 `--accent`，文字 = 主题 `--bg`，8 套主题全部自动适配。

### 终端窗口拖动

- 按住终端标题栏拖动
- 双击标题栏或点顶部 **Reset** 按钮归位
- 拖动时终端始终压住其他元素

### 自定义右键菜单

右键弹出终端风格菜单，内容随上下文变化：

| 右键位置 | 菜单项 |
|---|---|
| 任意位置 | Copy / Paste / Select All / Cycle Theme / Minimize / Reset / About / Close |
| 链接上 | 顶部显示 URL，追加 Open Link / Copy Link Address |
| 终端屏幕内 | 追加 Play Snake / Clear Screen |
| 游戏中 | 只显示 Exit Game |

支持键盘导航：`↑↓` 移动、`Enter` 执行、`Esc` 关闭。

## 贪吃蛇玩法

默认是 AI 自动寻路，作为背景氛围层，透明度 55%。

点顶部 **Play** 按钮或输入 `game` 进入玩家模式：

### 桌面端

| 按键 | 作用 |
|---|---|
| `W A S D` / `↑ ↓ ← →` | 移动 |
| `Space` | 暂停 / 继续 |
| `R` | 重开 |
| `Esc` | 退出游戏 |

### 移动端

- **屏幕任意位置滑动** 控制方向
- **右下角虚拟方向键**（仅玩家模式显示）

最高分存在 `localStorage` 的 `leipishu-snake-highscore`。

## 主题定制

### 加一套新主题

**第一步**：在 `css/style.css` 加一段 CSS 变量：

```css
html[data-theme="yourtheme"] {
    --bg: #000; --panel: rgba(...); --panel-bar: rgba(...);
    --border: ...; --fg: ...; --cmd: ...;
    --accent: ...; --link: ...; --link-hi: ...;
    --muted: ...; --dim: ...;
    --glow: ...; --glow2: ...;
    --hover-bg: ...; --scan-opacity: 0.4;
    --shadow: 0 0 90px rgba(...);
}
```

可以复制现有的 `github` 那一段作模板。

**第二步**：在 `config.json` 的 `themes` 里加一条：

```json
{ "id": "yourtheme", "name": "Your Theme", "swatch": "linear-gradient(135deg,#aaa,#bbb)" }
```

JS 不用改，下拉菜单、终端 `theme` 命令、贪吃蛇颜色、光标、选中文字都会自动跟上。

### 关掉某个功能

- 关贪吃蛇：`config.json` 的 `snake.enabled` 设为 `false`
- 关开场动画：`intro.enabled` 设为 `false`
- 关光标 / 光晕 / 右键菜单 / 窗口拖动：`features` 里对应字段设为 `false`
- 关状态栏某个字段：删掉对应文本即可

## 加自定义命令

编辑 `js/commands.js` 的 `registerDefaultCommands()`：

```js
register('hello', function (args) {
    term.print('<span class="out">Hello, ' + escapeHTML(args[0] || 'world') + '!</span>');
});
```

然后在 `config.json` 的 `commands` 里加描述（`help` 会自动列出）：

```json
"hello": "Say hello"
```

如果命令要输出多行或异步输出（比如 fetch 请求），用 `term.printBeforeInput()` 而不是 `term.print()`，输出会落在用户敲下的命令下方、输入框上方。

## 部署到 Vercel

### CLI（最快）

```bash
npm i -g vercel
cd leipishu-terminal
vercel            # 预览
vercel --prod     # 生产
```

### GitHub 自动部署

1. 推送到 GitHub
2. 打开 [vercel.com/new](https://vercel.com/new)，导入仓库
3. Framework Preset 选 **Other**，Build / Output 都留空
4. Deploy

之后 `git push` 会自动重新部署。

### 拖拽

在 [vercel.com/new](https://vercel.com/new) 直接把项目文件夹拖上去。

> Vercel 是标准 HTTP 服务器，ES Modules 和 fetch 都能正常工作，不需要 `vercel.json`。

## 浏览器兼容

- Chrome / Edge / Firefox / Safari 16+
- 使用了 ES Modules、CSS 自定义属性、`backdrop-filter`、SVG data URI 光标
- 不支持 IE

## License

使用MIT协议开源