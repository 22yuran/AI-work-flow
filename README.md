# AI-work-flow

AI 工作流插件集。目前包含：

| 插件 | 作用 |
|------|------|
| **figma-handoff** | 把「由占位图区块拼成的 Figma 整页稿」转成标准化的纯 HTML/CSS 前端交付包（每区块一张 PNG 占位、flex 布局，不含交互/业务逻辑）。 |

---

## 在 Claude Code 里安装（一行）

在 Claude Code 中运行：

```
/plugin marketplace add 22yuran/AI-work-flow
/plugin install figma-handoff@ai-work-flow
```

装好后，直接说「把这个 Figma 稿转成 hand-off 交付包」并附上 Figma 节点链接，agent 会自动识别并执行。

> 更新：`/plugin marketplace update ai-work-flow`
> 卸载：`/plugin uninstall figma-handoff`

## 前置依赖（必须具备，否则装了也跑不起来）

1. **Figma 桌面版 + Dev Mode MCP Server 已开启**（Figma → Preferences → 开启 Dev Mode MCP Server，监听 `http://localhost:3845`）。
2. **你的 agent 已接入这个 Figma MCP**。
3. **Python 3 + Pillow**：`pip3 install Pillow`（拼卡脚本用）。
4. **Chrome / Chromium**（截图验收用）。

这个插件的全部输入都来自 Figma MCP——没有第 1、2 条它无法工作。

## 在别的 agent 里用（Cursor / Windsurf / Cline 等）

这些 agent 不支持上面的 `/plugin` 命令，但核心工作流是 **agent 无关** 的——写在
`plugins/figma-handoff/skills/figma-handoff/WORKFLOW.md`。

做法：clone 本仓库，把该 `WORKFLOW.md` 作为对方 agent 的 rule / instruction 文件（放进它约定的规则目录），并把 `scripts/tile_cards.py` 一并带上。只要对方 agent 能调 Figma MCP 工具，就能照做。详见该 skill 目录内的 `README.md`。

## 仓库结构

```
.claude-plugin/marketplace.json          # 市场目录
plugins/figma-handoff/
├── .claude-plugin/plugin.json           # 插件清单
└── skills/figma-handoff/                # skill 本体
    ├── SKILL.md                          # Claude Code 入口
    ├── WORKFLOW.md                       # ⭐ agent 无关的核心工作流
    ├── scripts/tile_cards.py             # 单卡平铺成整行的辅助脚本
    └── README.md                         # 各 agent 接入说明
```

## License

MIT
