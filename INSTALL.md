# 安装指南

`figma-handoff` 是一个 Claude Code 插件（也可作为「与 agent 无关」的工作流用在其它 MCP agent 上）。

> ⚠️ 没有"点一下自动安装"的 URL —— Claude Code / Cursor / Windsurf 等都不支持那种协议。所谓安装 = **在 agent 里跑一条命令**或**把文件夹放到约定目录**。下面每一段都是可直接复制粘贴的命令。

---

## 前置依赖（所有 agent 通用，缺了跑不起来）

1. **Figma 桌面版 + Dev Mode MCP Server 已开启**：Figma → Preferences → 开启 *Dev Mode MCP Server*（监听 `http://localhost:3845`）。
2. **你的 agent 已接入这个 Figma MCP**。
3. **Python 3 + Pillow**（拼卡脚本用）：`pip3 install Pillow`
4. **Chrome / Chromium**（截图验收用）。

工作流的全部输入都来自 Figma MCP，第 1、2 条是硬性前提。

---

## Claude Code（推荐 · 仓库已是标准插件市场结构）

在 Claude Code 里依次输入这两条 slash 命令：

```
/plugin marketplace add 22yuran/AI-work-flow
```
```
/plugin install figma-handoff@ai-work-flow
```

- 第一条：把本 GitHub 仓库加为插件源（`ai-work-flow` 是 marketplace 名）。
- 第二条：安装 `figma-handoff` 插件。

装好后，直接说「把这个 Figma 稿转成 hand-off 交付包」+ 贴节点链接，即自动触发。

更新到最新版：
```
/plugin marketplace update ai-work-flow
```

卸载：
```
/plugin uninstall figma-handoff@ai-work-flow
```

### 手动方式（不走市场）
把 skill 目录拷到 Claude Code 的 skills 目录即可：
```bash
git clone https://github.com/22yuran/AI-work-flow.git
mkdir -p ~/.claude/skills
cp -r AI-work-flow/plugins/figma-handoff/skills/figma-handoff ~/.claude/skills/figma-handoff
```

---

## Cursor

Cursor 没有插件市场，靠"规则文件 + MCP"。

```bash
git clone https://github.com/22yuran/AI-work-flow.git
mkdir -p .cursor/rules
cp AI-work-flow/plugins/figma-handoff/skills/figma-handoff/WORKFLOW.md .cursor/rules/figma-handoff-workflow.md
```

再新建 `.cursor/rules/figma-handoff.mdc`，内容写：

```
遇到「Figma 稿转 hand-off 包」类请求，读并严格遵循 figma-handoff-workflow.md 执行。
```

并把 Figma MCP 配到 `.cursor/mcp.json`。

---

## Windsurf / Cline / Roo / 其它支持 MCP 的 agent

1. 先把 Figma Dev Mode MCP 接到该 agent。
2. 把 `WORKFLOW.md` 作为该 agent 的 rule / instruction 文件，放进它约定的规则目录：

```bash
git clone https://github.com/22yuran/AI-work-flow.git
# 把这份 WORKFLOW.md 放进你 agent 的规则/指令目录
cat AI-work-flow/plugins/figma-handoff/skills/figma-handoff/WORKFLOW.md
```

3. 附带 `scripts/tile_cards.py`（重复卡片平铺用），并把 WORKFLOW.md 里的 `<skill目录>` 换成实际路径。

---

## 任意 agent（临时 / 手动）

直接把 `WORKFLOW.md` 全文粘给对方 agent 当任务说明，附上目标 Figma 节点链接。只要它能调 Figma MCP 工具，就能照做。

---

## 验证装好了

对 agent 说：

```
把这个 Figma 稿转成 hand-off 交付包：<你的 Figma dev 链接>
```

agent 应引导你先贴「整体模块」链接，再按 6 步产出整页占位图交付包。
