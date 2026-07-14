# Design Review 工作流（V2 · 开发交付验收）

> **agent 无关**说明书。目标:用 Figma 沉淀的验收基准,检查前端交付代码,输出可定位、可反馈的问题清单。**规则给结论,AI 只归纳**——这是相较截图/代码 diff 幻觉大幅减少的根本。
> V1 `figma-handoff`(交付)**不改动**;本 skill 是独立的验收层。

## 前置依赖
1. **Figma 桌面 + Dev Mode MCP**(阶段① 读设计基准用)。
2. **Node 18+ 与系统 Chrome/Chromium**(阶段② 渲染 + 读 computed;引擎用 `puppeteer-core` 复用系统 Chrome,不下载浏览器)。找不到 Chrome 用 `--chrome <路径>` 或环境变量 `CHROME`。
3. 首次:`cd ${SKILL_DIR}/scripts && npm i`。

---

## 阶段① 生成验收基准(handoff-contract.json)

底层逻辑两半,分别产出:

### A. 整体页面 → 间距/位置(`gaps` + 各模块 `bbox`)
- 从整体页面(可用插件生成的副本/整页,或原始设计稿)用 `get_metadata` 读布局树(每块 x/y/w/h)。
- **间距全集必须靠枚举、不许手挑**(手挑必漏):把 `get_metadata` 输出存成文件,喂给
  `node ${SKILL_DIR}/scripts/enumerate-gaps.mjs <tree.xml>` → 自动列出**每一组同级模块的相邻间距全集**
  (纵/横向、跳过隐藏子树、模块粒度不产生噪声),产出 `enumerated-gaps.json` 作为 `gaps[]` 的完整起点。
- 每个模块的 `bbox` 写进 `modules[]`。
- **完整性铁律**:`gaps[]` 来自枚举器全集;凡是没纳入检查或映射不到 dev 的,必须在报告里**列出来**(覆盖 X/N),禁止把子集当全集。**即使模块是 PNG 占位,位置/间距也是真实的**。

### B. 模块组件 → 内部细节(`modules[]` 其余字段)
- 对每个真实模块节点用 `get_design_context` 读:字体(family/size/lineHeight/weight)、颜色**真值**(rgba,不抄 `var(--token,#xxx)` 的 fallback)、圆角、文案(分 `label`/`data`)、状态。
- 逐个模块地读(一次太多易错),对应 V1"一个一个贴链接"的习惯。

### C. mapping
- 每个模块补 `mapping.selector`(建议前端加 `data-review-id`)或 `fallback.anchorText`。这是验收可靠性的天花板。

产出 `handoff-contract.json`,字段/schema 见 `CONTRACT.md` + `contract.schema.json`。

---

## 阶段② 渲染级验收

### 1. 把前端代码跑成渲染态(取 computed style 的关键)
前端交付常是**组件源码或认证型 SPA**,直接读不到 computed。三种拿到渲染态的方式,按可行性选:

- **① mock 渲染 harness(推荐,内部 SPA 最稳)**:很多组件内置 mock(如 `USE_MOCK` + `MOCK_OUTPUT`)。搭最小 Vite 环境挂真实组件、stub 掉项目内部 import、开 mock 即时渲染 → `localhost`。**不碰生产登录/DevTools**。(本仓库 aiDiagnosis 案例即用此法验证。)
- **② 可直达的本地/测试 URL**:前端 dev server 起的地址,直接 `--url`。
- **③ 接管已登录 Chrome**:`--connect http://localhost:9222`(Chrome 以 `--remote-debugging-port=9222 --user-data-dir=<独立目录>` 启动并登录;新版 Chrome 默认资料禁远程调试,需独立 user-data-dir)。

### 2. 跑引擎
```bash
node ${SKILL_DIR}/scripts/review.mjs \
  --contract <contract.json> \
  --url <localhost 或 file://...>（或 --connect <cdp>） \
  --waitFor "<客户端渲染出现的关键选择器，如 .collapse-label>" \
  --expand "<可选：要点开的折叠触发器，如 .collapse-trigger>" \
  --delay <毫秒，可选> \
  --out <输出目录>
```
产出 `<out>/review-findings.json`(客观:expected/actual/severity/matchConfidence)。

**折叠态**:默认收起的内容(`display:none`)测不到 → 用 `--expand "<触发器选择器>"` 让引擎先逐个点开,再测。

**CSS 画的圆点/环(伪元素)**:项目符号常是 `::before`,无法用选择器抓 → 在 `typography`/`colors` 的 `target` 末尾加 `::before`/`::after`,引擎用 `getComputedStyle(el, '::before')` 读它(尺寸取 computed width/height,颜色取 border-color/background-color)。例:环形项目符号验描边色 →
`{ "target": ".collapse-content > li::before", "prop": "border-color", "value": "#fa5151" }`。

### 3. AI 归纳报告
读 `review-findings.json` → 写 `design-review-report.md`(可选 HTML 可视化:色块对比、✓/⚠/ℹ 徽章):
- 按**模块**分组,组内按严重级(error→warn→info);每条列 期望/实际/可能原因/修复建议。
- 顶部 summary(模块数、命中率、间距问题数、error/warn/info)。
- `matchConfidence != "selector"` 的项标注"基于文案锚定,可能漏配,建议加 selector 复核"。
- **不改判**规则结论;只归类、去重、猜因、给方向。这份就是**反馈给前端**的清单。

---

## 检查项与判定(引擎)

| 检查 | 归属 | 判定 |
|---|---|---|
| **gap** | 整体页面半 | 按 `gaps[]` 测两模块渲染盒子间隙(纵向 `to.top-from.bottom`;横向 `to.left-from.right`),`tolerances.spacing` |
| bbox | 模块组件半 | `getBoundingClientRect` 宽高,`tolerances.size` |
| spacing | 模块组件半 | 元素自身 padding / auto-layout gap |
| radius | 模块组件半 | 四角 border-radius |
| typography | 模块组件半 | 字号/行高/字重各自容差;字体族包含匹配(warn) |
| color | 模块组件半 | computed rgba 逐通道 `tolerances.color`;token 名仅供报告 |
| text | 模块组件半 | label 归一化后包含;data 仅查非空/格式 |
| image | 模块组件半 | 渲染比 vs 本征比,`tolerances.imageRatio` |
| states | 模块组件半 | `rendered:false` 列 info,提示前端补 |

严重级:模块 `checks` / `gaps[].severity` 覆盖全局默认。`off` 跳过。

## 边界(有意不做,避免假装能做)
- 交互态(hover/排序点击态):需 Playwright 驱动,留后续。
- 颜色 token 名回收:前端用自己 token,拿不回名 → 只比 rgba 值。
- 多断点响应式:按 `canvas.width` 单宽度验收。
- 文案 data 内容:动态数据不比原文,只查存在/格式。

## 常见坑
- **大量未命中** → mapping 问题,补 selector,别调容差。
- **间距全不对** → 确认 viewport 宽 = `canvas.width`;确认 `gaps` 的 from/to 都能映射到 dev DOM。
- **行高报 normal** → 前端用了 `line-height: normal`,与固定行高无法数值比 → 视为不符。
- **客户端渲染测到空** → 用 `--waitFor` 等关键选择器出现;必要时 `--delay`。
