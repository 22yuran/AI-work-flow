---
name: design-review
description: V2 · 基于 Figma 基准的「开发交付验收」。设计稿沉淀成机器可读的验收基准(contract)，把前端交付的代码跑成渲染态、逐项比对、输出问题清单反馈前端。当设计师/走查者要核对"前端做出来的页面是否符合设计"时用。不是交付(交付是 V1 figma-handoff)，是验收。规则给结论、AI 只归纳；渲染级(computed style)为准；依赖系统 Chrome，不依赖生产登录。
allowed-tools: Read Write Edit Bash Grep Glob
---

# Design Review（V2 · 开发交付验收）

把设计稿沉淀成**机器可读的验收基准**(`handoff-contract.json`)，用它检查**前端交付的代码**是否满足设计要求，输出**问题清单反馈前端**。

**与 V1 的关系**：V1 `figma-handoff` 负责"把设计转成交付包给前端"，本 skill 完全独立、**不改动 V1**。同一套底层逻辑,用途翻转:交付 → **验收**。

## 底层逻辑(两半)

- **整体页面 → 间距/位置**：即使模块是 PNG 占位,frame 的位置/间距是真实的 → contract 的 `gaps[]`。
- **模块组件 → 内部细节**：真实模块节点的字体/颜色真值/圆角/文案/状态 → contract 的 `modules[]`。

## 为什么渲染级(B)为准

比对的是前端**代码**。有两种口径:
- **静态**(读 `.vue`/CSS 声明值):快,但读到的是"写了什么",受层叠覆盖、继承、token/变量影响,且**间距/位置只有布局后才有**——静态测不了。
- **渲染级 B(computed style,本 skill 采用)**:把前端代码跑成真实 DOM 读 computed style + bbox,是"实际长什么样"。**间距那半必须 B**。

前端代码跑不起来读不了 computed → 用 **mock 渲染 harness**(见 WORKFLOW),不碰生产登录。

## 两阶段

1. **阶段① 生成基准**：读整体页面(`gaps`)+ 模块组件(`modules`)→ 结构化 `handoff-contract.json`。契约规范见 `${CLAUDE_SKILL_DIR}/CONTRACT.md`(schema/example 同目录)。
2. **阶段② 渲染级验收**：把前端代码 mock 跑成 `localhost` → `review.mjs --url` 读 computed → 规则比对 → `review-findings.json` → AI 归纳成 `design-review-report.md`(可视化 HTML 可选)→ 反馈前端。

## 检查项(确定性优先,规则判定)

- **模块间距**(整体页面半):`gaps` 声明的相邻模块间距,测渲染盒子间隙比对。
- **bbox / 内边距 / 圆角 / 字体(字号·行高·字重·族) / 颜色(rgba 真值) / 文案(label 严格·data 宽松) / 图片比例 / 状态**(模块组件半)。

容差集中在 contract `tolerances`(模块可 `toleranceOverrides`)。检查开关/严重级在模块 `checks` 与 `gaps[].severity`。

## mapping 是可靠性天花板

基准里每个模块要能定位到前端 DOM:优先 `selector`(建议前端加 `data-review-id`),兜底 `anchorText`。引擎在 finding 里标 `matchConfidence`,不假装全自动。

## 运行(阶段②)
```bash
cd ${CLAUDE_SKILL_DIR}/scripts && npm i          # 首次，装 puppeteer-core(复用系统 Chrome)
node review.mjs --contract <contract.json> --url <localhost 或 file://> \
  --waitFor "<关键选择器>" --out <目录>
```
认证型 SPA:`--connect http://localhost:9222` 接管已登录 Chrome(见 WORKFLOW 备注)。

## 折叠内容与 CSS 圆点(已支持)
- **折叠态**:默认收起(`display:none`)的内容测不到 → `--expand "<触发器选择器>"` 让引擎先点开再测。
- **CSS 画的圆点/环**:项目符号多是 `::before` 伪元素(选择器抓不到)→ `target` 末尾加 `::before`/`::after`,引擎读其 computed 尺寸/颜色(环验 border-color、填充点验 background-color)。

## 边界(有意不做)
交互态里**折叠可展开**(见上);hover/排序点击后态仍需脚本驱动,留后续。颜色 token 名不回收(只比 rgba 值);多断点响应式按 `canvas.width` 单宽验收。

## Related
- 生成交付包(V1) → `figma-handoff` skill(本 skill 不改它)。
