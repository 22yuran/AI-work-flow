---
name: design-review
description: 基于 hand-off contract 的开发交付验收（design-delivery acceptance）。当设计师/走查者想核对"开发做出来的页面是否符合设计要求"时用。输入 handoff-contract.json + 开发页面 URL/HTML，输出客观的走查问题清单（模块缺失、宽高/间距/字体/圆角/颜色不符、文案缺失、图片拉伸等）。不是代码 diff，也不是截图猜测——规则给结论，AI 只归纳解释。依赖系统 Chrome，不依赖 Figma。
allowed-tools: Read Write Edit Bash Grep Glob
---

# Design Review（基于 hand-off contract 的开发交付验收）

把设计交付包沉淀出的 **`handoff-contract.json`** 当作**验收基准**，检查开发交付的页面是否满足其中定义的模块、布局、间距、文案、样式 token、状态与边界要求。

**定位**：设计侧的走查提效工具。还原度问题仍由前端修，但设计侧能**更快、更客观**地指出"哪里没还原"，且问题可定位、可追踪。

**为什么不做代码 diff / 截图比对**：前端用 React/TDesign/组件库/动态 class，DOM 与交付包天然不同构，diff 会惩罚"实现方式不同"而非"还原度不够"；截图比对对小元素/抗锯齿/DPR 极敏感，AI 只能猜。本 skill 比的是**离散、可判定的事实**，把 AI 从"判断者"降级成"归纳者"，幻觉大幅减少。

## 与 figma-handoff 的关系（两层）

1. **figma-handoff（生成层）**：从 Figma 生成 `handoff-contract.json`（机器可读验收基准）+ 交付包。
2. **design-review（本 skill · 验收层）**：消费 contract + 开发页面 → 输出问题清单。**不依赖 Figma**，可脱离设计环境跑（含 CI）。

契约规范见 **`${CLAUDE_SKILL_DIR}/CONTRACT.md`**（`contract.schema.json` 可做校验，`contract.example.json` 是样例）。

## 运行流程

完整工作流见 **`${CLAUDE_SKILL_DIR}/WORKFLOW.md`**。简述：

0. **拿到三样输入**：`handoff-contract.json`、开发页面（URL 或本地 `index.html`）、可选的**模块 selector 映射**（强烈建议——它是验收可靠性的天花板）。
1. **装依赖**（一次）：`cd ${CLAUDE_SKILL_DIR}/scripts && npm i`（用 `puppeteer-core`，复用系统 Chrome，不下载浏览器）。
2. **跑引擎**：
   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/review.mjs \
     --contract path/to/handoff-contract.json \
     --url http://localhost:5173/goods \
     --out review-out
   ```
   产出 `review-out/review-findings.json`（客观事实：expected/actual/severity）。
3. **AI 归纳**：读 `review-findings.json`，写成 `design-review-report.md`——按模块分组、标严重级、猜可能原因、给修复建议。**AI 只归纳,不改判 pass/fail**（那是规则的事）。

## 检查项（v1 · 确定性优先）

引擎按 computed style + bounding box 做规则比对（几乎零幻觉）：

- **模块存在/缺失**（mapping 命中与否）
- **bbox** 宽高
- **间距**：padding 四边、auto-layout gap
- **圆角**：逐角 border-radius
- **字体**：字号 / 行高 / 字重 / 字体族（族只做包含匹配）
- **颜色**：解析成 rgba 后按容差比（token 名只供报告，不参与比对）
- **文案**：label 严格比、data 只查存在/格式（压误报）
- **图片**：渲染比 vs 本征比（判拉伸）
- **状态**：`rendered:false` 的设计态列为 info，提示前端补（v1 不驱动交互）

容差集中在 contract 的 `tolerances`（模块可 `toleranceOverrides` 覆盖）。检查开关/严重级在模块 `checks`。

## mapping 是可靠性的天花板（重点）

contract 里每个模块要能定位到开发 DOM。两种方式：
- **selector（首选）**：让开发给关键模块加 `data-review-id`，或走查者提供 selector。可信度高。
- **anchor 兜底**：用唯一文案 + 大致位置锚定。引擎会在 finding 里标 `matchConfidence: "anchor"`，**明确降级**，不假装全自动。

无映射 → 结论可能漏配；报告里据 `matchConfidence` 提示可信度。

## 边界（v1 有意不做）

- **交互态**（hover/点击后的排序 asc·desc）：需脚本驱动，留到 v2。
- **颜色 token 名回收**：前端用自己的 token，拿不回名字——只比解析后的值。
- **响应式**：引擎按 `contract.source.canvas.width` 设 viewport；多断点留到 v2。

## Related
- 生成 contract 与交付包 → `figma-handoff` skill。
