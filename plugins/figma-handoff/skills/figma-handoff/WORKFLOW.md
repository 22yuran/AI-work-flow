# Figma Hand-off 工作流：占位图整页稿 → 纯 HTML/CSS 交付包

> 这是一份 **agent 无关** 的工作流说明书。任何支持 MCP 的 AI agent（Claude Code、Cursor、Windsurf、Cline，或自研 agent）都可直接读这份文档执行。各 agent 的入口/触发方式见 `README.md`。

## 目标

把一个 **由占位图区块拼成的 Figma 设计稿**（整页/整屏，区块本就打算以扁平图片交付、而非真实组件）转成标准化的前端交付包。产物是**纯 HTML + CSS**，每个区块是一张 `<img>` 占位图，用 flex 布局。**不含交互、不含业务逻辑、不引框架。**

本工作流只覆盖「读稿 → 取图 → 拼装 → 截图验收」这前半段。若要把某个占位区块**换成真实可交付代码**，那是另一类单模块任务，不在此列。

## 前置依赖（运行环境必须具备）

1. **Figma 桌面版 + Dev Mode MCP Server 已开启**，且当前 agent 已接入该 MCP。工作流依赖这些工具（不同 agent 里工具名前缀可能不同，功能一致）：
   - `get_metadata` — 读区块树 + 每块 x/y/w/h
   - `get_design_context` — 读子图片/SVG 资源 URL、字体、颜色
   - `get_screenshot` — 读节点视觉（供 agent 比对）
   - Figma 本地资源服务器：`http://localhost:3845/assets/<hash>.{png,svg}`
2. **Python 3 + Pillow**（拼卡脚本用）：`pip3 install Pillow`
3. **Chrome / Chromium**（截图验收用，见步骤 6 的跨平台路径）

## 硬约束（交付代码规则）

- **不臆造**交互或业务逻辑。区块是静态图片。
- **不扩架构**成完整应用；**不引入**新依赖。
- 宁可删掉不支持的复杂度，也不用注释去解释它。
- 只处理指定节点/模块区域，不臆造缺失的区块。
- **所有 CSS token 取整数**（px、gap、padding）。SVG `viewBox` 内部小数可保留。
- 用 **flex 自适应**；不用绝对定位、不写死内容宽度——**例外**：页面骨架容器（`.page`、侧边导航、顶部导航）可保留固定宽/绝对定位以对齐 Figma 画布。
- 每条 CSS 规则加头部注释：`/* 区块名 <node-id> — 宽x高 */`。

## 交付包结构（目标产物）

```
handoff-<模块名>/
├── source/
│   ├── index.html          # 语义结构；每个区块 = <img>；注释标 node-id
│   ├── styles.css          # flex 布局；整数 token；每条规则注 node-id + 尺寸
│   └── assets/*.png        # 每区块一张 PNG（语义命名：topnav、m1-card、m2-table…）
├── handoff-manifest.json   # { module, figmaNodeId, type, stack, canvas, assets[] }
├── handoff-audit.md        # 尺寸/间距核对表（取自 Figma 元数据）+「有意未做」
├── preview.png             # 无头 Chrome 整页截图（1:1 验收）
└── README.md               # 包含内容 / 如何运行 / 有意排除
```

**manifest 字段**：`module`、`figmaNodeId`、`type: "placeholder-mockup"`、`stack: ["html","css"]`、`canvas: {width,height}`、`assets: [{file, node, size:[w,h], name}]`。

**index.html 语义骨架示例**（class 词汇表，按需增减）：
`.page`（画布，固定宽、可绝对定位子元素）→ `.content`（内容区，flex 纵向 gap）→ `.stack`（主堆栈 gap 16）→ `.card`（白底圆角 padding 24 gap 24）/ `.card-plain`（无内边距圆角容器）→ `.block-pad`（分块内边距 24）→ `.row`（横排卡片 gap 16）。每个区块是 `<img class="…" src="assets/….png" alt="块名">`，前面加 `<!-- 区块名 <node-id> -->`。

**styles.css 基线**：`* { margin:0; padding:0; box-sizing:border-box }`；`img{display:block}`；`body` 背景 `#f7f7f7`、字体 `-apple-system,"PingFang SC","Microsoft YaHei",sans-serif`。骨架容器给显式 height/`min-height`，避免绝对定位子元素令页面高度塌陷。

## 工作流（6 步）

### 1. 确认目标节点 & 输出位置
- 用户给 Figma dev 链接或 node-id（`?node-id=570-15848` → `570:15848`）。
- **询问用户交付包放哪里**（有意不固定）。在该位置建 `handoff-<模块名>/source/assets/`。

### 2. 读结构
- `get_metadata` → 区块树 + 每块 x/y/w/h（驱动布局 token 和 audit 表）。
- `get_design_context` → 子图片/SVG 资源 URL、字体、颜色。
- `get_screenshot` → 视觉参考，供比对。
- 记下顶层画布宽/高，用于 manifest 和步骤 6 的截图窗口尺寸。

### 3. 取占位图（半自动 —— 唯一非全自动环节）

对每个区块，依次：

1. **自动拉**：若 `get_design_context` 暴露了该区块的资源 hash，下载：
   ```bash
   curl -s -o source/assets/<名>.png "http://localhost:3845/assets/<hash>.png"
   ```
   用 `file source/assets/<名>.png` 验证是真图（应为 `PNG image data …`）。HTTP 500 或极小 body = 该端点无整节点导出，按「未命中」处理。

2. **重复子卡**：一行是 N 张引用同一源图的相同卡片时，只下一张单卡，用脚本平铺成整行：
   ```bash
   python3 <skill目录>/scripts/tile_cards.py <单卡.png> source/assets/<行>.png \
     --card-w 476 --card-h 156 --cols 3 --gap 16 --scale 2
   ```

3. **未命中 → 手动导出清单**：MCP **无法把整个节点导出为 PNG**。把步骤 1 没覆盖的区块汇总成表，让用户在 Figma 里导出（选中节点 → Export → 2x PNG）放进 `source/assets/`，再继续：

   | 区块 | node-id | 目标文件 | 尺寸 @2x |
   |------|---------|----------|----------|

   等用户放好文件再拼装。

### 4. 拼装 source/
- `index.html`：按上面的语义骨架，每区块一张 `<img>` + node-id 注释。
- `styles.css`：用步骤 2 的元数据算 flex 布局；整数 token；每条规则注 `/* 名 <node-id> — 宽x高 */`；骨架容器给显式高度。

### 5. 生成元数据
- `handoff-manifest.json`（字段见上；assets 按视觉顺序）。
- `handoff-audit.md` —— 取自步骤 2 元数据的尺寸/间距核对表 + **有意未做**（无交互、区块未拆组件、无依赖/构建）。
- `README.md` —— 包含内容 / 如何运行（浏览器打开 `source/index.html`，相对路径、无构建）/ 有意排除。

### 6. 验收（1:1）

跨平台定位 Chrome，再截整页：

```bash
# macOS
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Linux:   CHROME=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
# Windows: CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"

"$CHROME" --headless --window-size=<画布宽>,<画布高> --hide-scrollbars \
  --force-device-scale-factor=2 --screenshot=preview.png source/index.html
```

- `<画布高>` 取自 manifest canvas，避免截断。**已知坑**：绝对定位的 `.content`/`.sidenav` 会把 `.page` 高度塌陷为 0 → 底部被裁。修法：给 `.page` 显式 `min-height` 等于真实内容高度。
- 读 preview.png，与 Figma 截图逐区块比对，结果记进 audit 表。
