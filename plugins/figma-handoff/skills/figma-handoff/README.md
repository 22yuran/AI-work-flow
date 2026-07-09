# figma-handoff

把「由占位图区块拼成的 Figma 整页稿」转成标准化的纯 HTML/CSS 前端交付包。产物是每个区块一张 `<img>` 占位图、flex 布局，**不含交互/业务逻辑/框架**——供前端做视觉实现参考。

核心工作流写在 **`WORKFLOW.md`**（agent 无关，任何支持 MCP 的 agent 都能读）。本目录其余文件是各 agent 的入口和工具。

```
figma-handoff/
├── WORKFLOW.md          # ⭐ 核心：6 步流程 + 约束 + 包结构（谁都能读）
├── SKILL.md             # Claude Code 入口（frontmatter 自动触发 → 指向 WORKFLOW.md）
├── scripts/tile_cards.py# 把单卡平铺成整行的辅助脚本
└── README.md            # 本文件
```

## 前置依赖（三台电脑都要有）

1. **Figma 桌面版 + Dev Mode MCP Server 已开启**，且你的 agent 已接入该 MCP。
   - Figma 里：Preferences → 开启 Dev Mode MCP Server（会监听 `http://localhost:3845`）。
2. **agent 支持 MCP** 并已配置这个 Figma MCP server。
3. **Python 3 + Pillow**：`pip3 install Pillow`（拼卡脚本用）。
4. **Chrome / Chromium**（截图验收用）。

> 没有第 1、2 条，这个能力无法运行——它的全部输入都来自 Figma MCP。

## 在不同 agent 上用

### Claude Code
拷整个 `figma-handoff/` 文件夹到 `~/.claude/skills/`（或项目的 `.claude/skills/`）。
之后说「把这个 Figma 稿转成 hand-off 交付包」+ 给节点链接即可自动触发。`${CLAUDE_SKILL_DIR}` 会自动解析到本目录。

### Cursor
- 把 Figma MCP 配到 `.cursor/mcp.json`。
- 新建 `.cursor/rules/figma-handoff.mdc`，内容写：`遇到「Figma 稿转 hand-off 包」类请求，读并遵循 <本目录>/WORKFLOW.md 执行。` 并把 `WORKFLOW.md` 一并放进项目。

### Windsurf / Cline / Roo / 其他支持 MCP 的 agent
- 先把 Figma MCP 接到该 agent。
- 把 `WORKFLOW.md` 作为该 agent 的 rule / instruction 文件（各家机制不同，放进它约定的规则目录即可）。
- `scripts/tile_cards.py` 随目录一起带上；WORKFLOW.md 里的 `<skill目录>` 换成实际路径。

### 任意 agent（手动/临时）
直接把 `WORKFLOW.md` 全文粘给对方 agent 当任务说明，附上目标 Figma 节点链接。只要它能调 Figma MCP 工具，就能照做。

## 分发

- **一两个人**：把 `figma-handoff/` 打包成 zip 发过去。
- **团队/跟项目**：放进某仓库的 `.claude/skills/`（或对应 agent 的规则目录），别人 clone 即得。
- **多人长期**：做成 Claude Code plugin，走 git/marketplace 安装（需要时再说，可再帮你搭）。

## 边界

- 只做「占位图整页稿 → 交付包」。把区块换成**真实可交付代码**是另一类单模块任务，不在此列。
- 交付物是视觉参考代码，不是生产集成代码。
