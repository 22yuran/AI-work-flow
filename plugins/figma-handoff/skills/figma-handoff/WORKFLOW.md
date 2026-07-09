# Figma Hand-off 工作流：占位图整页稿 → 纯 HTML/CSS 交付包

> 这是一份 **agent 无关** 的工作流说明书。任何支持 MCP 的 AI agent（Claude Code、Cursor、Windsurf、Cline，或自研 agent）都可直接读这份文档执行。各 agent 的入口/触发方式见 `README.md`。

## 目标

把 Figma 设计稿转成前端可直接接入的 hand-off 交付包。最终交付一个**大文件夹**，里面装两类产物：

- **整体页面包**（占位图）：整页由 `<img>` 占位图 + flex 布局拼成，让前端能**定位每个模块的位置、以及模块之间的间距**。产物是纯 HTML/CSS，不含交互/业务逻辑/框架。
- **各新模块包**（真实代码）：前端组件库里没有、需要他们自己做的新模块/组件，逐个转成真实可交付的 HTML/CSS 代码包（而非图片）——因为只给图片会在交付时出很多问题，代码形式对前端 AI 更友好。

## 使用流程（总纲 · 面向使用者的交互脚本）

按下面的顺序与使用者（设计师）交互，不要跳步：

0. **引导贴「整体模块」的 Figma 链接**。告诉使用者：先贴整体页面/整体模块的 Figma 链接来——这样产出的整体代码包能帮前端**定位各模块的位置和模块间距**。

1. **设计师贴出整体链接后，产出整体页面包**（占位图）。按下方「整体页面包工作流（6 步）」执行。

2. **产出后，主动问「有没有问题」**。有 → 修正后再确认；无 → 进入下一步。

3. **问「是否有新模块/组件需要转成代码形式的 hand-off 包」**。解释原因：组件库里没有的新组件，若只给图片，前端自己做时交付易出问题，所以转成真实 HTML/CSS 代码包。

4. **转新模块时，务必提醒使用者「一个一个模块地贴链接」**，不要一次性全部贴上来——一次性信息量太大，转码时容易产生幻觉/出错。逐个转最准确。

5. **逐个把新模块转成真实代码包**。这类包是可交付代码（真实 DOM/CSS 还原该模块），遵循下方同一套「硬约束」，但区块内部要拆成真实结构、还原真实文本/样式，而不是整块 `<img>` 占位。

6. **最终打包成一个大文件夹**：

   ```
   handoff-<项目名>/
   ├── 整体页面/        # 步骤 1 的整页占位图包（source/ + manifest + audit + preview + README）
   ├── <新模块A>/       # 步骤 5 的真实代码包
   ├── <新模块B>/
   └── ...
   ```

---

下面是各步骤要用到的技术细节。

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

## 整体页面包工作流（6 步 · 对应总纲步骤 1）

把整体页面的占位图稿转成一个整页 hand-off 包。产出后回到总纲步骤 2 继续。

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

   > **省事做法**：本仓库自带 Figma 插件 **figma-module-rasterizer**（`tools/figma-module-rasterizer/`）。用户可在 Figma 里选中模块一键导出 PNG（甚至原位替换成图片图层），比逐个手动 Export 快很多。适合区块多、MCP 取不到图的整页稿。

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
