# Design Review 工作流：hand-off contract → 开发交付验收清单

> **agent 无关**的工作流说明书。任何支持文件读写 + 能跑 Node 的 agent 都可执行。
> 定位：设计侧走查提效。**规则给结论，AI 只归纳解释**——这是相较"截图比对/代码 diff"幻觉大幅减少的根本原因。

## 目标

输入设计侧沉淀的 `handoff-contract.json`（机器可读验收基准）+ 开发交付页面，输出**客观、可定位、可追踪**的走查问题清单：哪个模块、哪一项（尺寸/间距/字体/圆角/颜色/文案/图片/状态）、期望值 vs 实际值、严重级。

## 前置依赖

1. **Node 18+**。
2. **系统 Chrome / Chromium**（引擎用 `puppeteer-core` 复用它，不下载浏览器）。
   - macOS：`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
   - Linux：`google-chrome` / `chromium`
   - Windows：`C:/Program Files/Google/Chrome/Application/chrome.exe`
   - 找不到时用 `--chrome <路径>` 或环境变量 `CHROME` 指定。
3. **首次装依赖**：`cd ${SKILL_DIR}/scripts && npm i`。

## 输入（三样）

1. **`handoff-contract.json`** —— 由 `figma-handoff` 生成，规范见 `CONTRACT.md`。
2. **开发交付页面** —— `http(s)://` URL，或本地 `file:///abs/path/index.html`。
3. **（强烈建议）模块 selector 映射** —— 见下"mapping"。**它决定验收可靠性的上限。**

## 使用流程（总纲）

0. **确认三样输入齐全**。缺 contract → 先回 `figma-handoff` 生成;缺 selector 映射 → 走 anchor 兜底,但要在报告里如实标注可信度下降。
1. **装依赖**（首次）：`cd ${SKILL_DIR}/scripts && npm i`。
2. **跑引擎**：
   ```bash
   node ${SKILL_DIR}/scripts/review.mjs \
     --contract <contract路径> \
     --url <URL 或 file://...> \
     --out <输出目录，默认当前目录>
   ```
   产出 `<out>/review-findings.json`。
3. **AI 归纳报告**：读 `review-findings.json`，产出 `design-review-report.md`：
   - 按**模块**分组，组内按严重级(error→warn→info)。
   - 每条列 **期望 / 实际 / 可能原因 / 建议**。
   - 顶部放 summary（模块数、命中率、error/warn/info 计数）。
   - **不改判**引擎结论；只做归类、去重、猜因、提修复方向。
4. **可信度提示**：凡 `matchConfidence != "selector"` 的 finding,在报告里标注"该结论基于文案锚定,可能漏配,建议加 selector 复核"。

## mapping —— 可靠性天花板（务必读）

contract 里每个模块必须能对应到开发页面的一个 DOM 元素。DOM 与交付包不同构,所以：

- **首选 selector**：推动开发给关键模块加 `data-review-id="xxx"`（或走查者提供稳定 selector）。写进 contract 的 `mapping.selector`。可信度 ~95%。
- **anchor 兜底**：`mapping.fallback.anchorText` + 可选 `nearBBox`。引擎找"包含该文案、且离该位置最近、面积最小"的元素。可信度较低,引擎标 `matchConfidence: "anchor"`。
- 子目标（typography/colors/images 的 `target`）是**相对模块根**的选择器；`"self"` 或缺省表示模块自身。

> 经验：验收成败 80% 在 mapping,20% 在规则。规则很好写,mapping 是真问题。第一次跑若大量"未命中",优先补 selector,而不是调容差。

## 检查项与判定（引擎做,确定性优先）

| 检查 | 取值来源 | 判定 |
|---|---|---|
| mapping | querySelector / anchor | 命中与否 |
| bbox | `getBoundingClientRect` | 宽高在 `tolerances.size` 内 |
| spacing | computed padding / gap | 四边 padding、gap(按 layoutMode 取 column/rowGap)在 `tolerances.spacing` 内 |
| radius | computed 四角 border-radius | 每角在 `tolerances.radius` 内 |
| typography | computed font-* | 字号/行高/字重在各自容差内;字体族做包含匹配(warn) |
| color | computed color/bg/border | 解析 rgba 后逐通道 `tolerances.color`;token 名仅供报告 |
| text | 模块 textContent | label 归一化后包含;data 仅查非空/格式 |
| image | `<img>` natural + 渲染尺寸 | 渲染比 vs 本征比在 `tolerances.imageRatio` 内(判拉伸) |
| states | contract 声明 | `rendered:false` 列 info,提示前端补(不驱动交互) |

严重级：模块 `checks` 覆盖全局默认(`bbox/spacing/typography/text/image=error, radius/color=warn, states=info`)。`off` 跳过。

## 输出结构

`review-findings.json`（引擎产,客观）：
```jsonc
{
  "reviewedAt": "...", "devTarget": "...", "contract": "...",
  "summary": { "modules", "matched", "unmatched", "error", "warn", "info" },
  "findings": [ { "moduleId","moduleName","matchConfidence","check","target","severity","expected","actual","message" } ]
}
```

`design-review-report.md`（AI 产,给人看):按模块归类的走查清单 + summary + 可信度提示。

## 边界（v1 有意不做,避免假装能做）

- 交互态(hover / 排序 asc·desc 点击态):需 Playwright 驱动,留 v2。
- 颜色 token 名回收:前端用自己 token,拿不回名 → 只比值。
- 多断点响应式:引擎按 `canvas.width` 单宽度验收。
- 文案 data 内容比对:动态数据不比原文(设计占位≠线上真值),只查存在/格式。

## 常见坑

- **大量未命中** → mapping 问题,补 selector,别调容差。
- **颜色全 warn** → 可能 alpha 合成/取整;先看 `tolerances.color.perChannel` 是否过严,或改用 deltaE(v1.5)。
- **行高报 normal** → 开发用了 `line-height: normal`,与设计的固定行高无法数值比对 → 视为不符(提示前端设固定行高)。
- **viewport 宽度不对** → 引擎已按 `canvas.width` 设;若开发页面强响应式,确认两边同宽再看 bbox。
