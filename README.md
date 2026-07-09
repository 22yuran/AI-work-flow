# AI-work-flow

AI 工作流插件集。目前包含：

| 组件 | 类型 | 作用 |
|------|------|------|
| **figma-handoff** | Claude Code 插件 / 工作流 | 把「由占位图区块拼成的 Figma 整页稿」转成标准化的纯 HTML/CSS 前端交付包（每区块一张 PNG 占位、flex 布局，不含交互/业务逻辑）。 |
| **figma-module-rasterizer** | Figma 插件 | 在 Figma 里选中一个模块，一键导出为 PNG 并**原位替换**成图片图层——把要占位的模块「栅格化」。是上面工作流取占位图的推荐前置工具。 |

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

这些 agent 不支持上面的 `/plugin` 命令，但核心工作流是 **agent 无关** 的。最简单的用法——**把工作流的链接甩给对方 agent，让它自己读**：

> 读这个工作流，帮我把这个 Figma 稿转成 HTML 交付包：
> https://github.com/22yuran/AI-work-flow/blob/main/plugins/figma-handoff/skills/figma-handoff/WORKFLOW.md
> Figma 链接：<你的节点链接>

不用 clone、不用配置。只要对方 agent 能读文档、能调 Figma MCP 工具，就能照做。（`tile_cards.py` 脚本可无视——用到时 agent 自己会写几行拼图代码。）

## Figma 插件：figma-module-rasterizer（取占位图更省事）

工作流最麻烦的一步是取占位图——MCP 不能整节点导出 PNG，只能手动在 Figma 里 Export。这个 Figma 插件把这步做成了一键操作：**选中模块 → 导出 PNG → 原位替换成图片图层**。

安装（Figma 桌面版）：
1. 下载 `tools/figma-module-rasterizer/module-rasterizer-dev.zip` 并解压（或直接用 `tools/figma-module-rasterizer/` 目录）。
2. Figma → `Plugins → Development → Import plugin from manifest...`，选该目录里的 `manifest.json`。
3. `Plugins → Development → Module Rasterizer` 运行。

用法：选中 Frame/Component/Instance/组 → 选导出倍率 → `Download PNG` 导出图片，或 `Replace with PNG` 原位替换。详见 `tools/figma-module-rasterizer/README.md`。

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
tools/figma-module-rasterizer/           # Figma 插件：模块一键栅格化
├── manifest.json / ui.html / dist/code.js
├── src/code.ts                           # 源码
└── module-rasterizer-dev.zip             # 打包好的分发版
```

## License

MIT
