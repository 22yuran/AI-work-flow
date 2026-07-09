---
name: figma-handoff
description: Convert a Figma design into a frontend hand-off package. Use when a designer wants to turn a Figma page/module into a delivery package (交付包 / hand-off 包 / 展位图交付). Produces one big folder containing an overall-page package (PNG placeholders in a flex layout, so frontend can locate each module and the spacing between modules) plus per-new-module packages (real HTML/CSS for components missing from the frontend component library). Reads nodes via Figma MCP. Follow the interaction script: guide the user to paste the overall link first, produce the page package, then convert new modules one at a time.
allowed-tools: Read Write Edit Bash Grep Glob
---

# Figma Hand-off (Figma 设计稿 → 前端交付包)

Turn a Figma design into a frontend hand-off package. Final deliverable is **one big folder** with two kinds of contents:
- **Overall-page package** (placeholder images): the full page as `<img>` placeholders in a flex layout, so frontend can locate each module's position and the spacing between modules.
- **Per-new-module packages** (real code): modules missing from the frontend component library, each converted to real deliverable HTML/CSS (not images).

## How to run

The full workflow — the **user-interaction script (总纲)**, constraints, package shape, and the 6-step page-package sub-process — lives in **`${CLAUDE_SKILL_DIR}/WORKFLOW.md`**. Read it and follow it. Follow the 总纲 interaction order exactly; do not skip steps. This file is just the Claude Code entry point.

Interaction script in brief (details in WORKFLOW.md):
0. Guide the user to paste the **overall module** Figma link first (so the page package helps frontend locate modules + spacing).
1. Produce the **overall-page package** (placeholder images) via the 6-step sub-process.
2. Ask "any problems?" — fix if so.
3. Ask whether there are **new modules** needing real-code packages (components the frontend library lacks).
4. When converting new modules, **remind the user to paste links one module at a time** — bulk upload causes transcoding hallucinations.
5. Convert each new module into a real-code package.
6. Assemble everything into one big folder: `整体页面/` + one folder per new module.

Technical key points:
- Read nodes via Figma MCP (`get_metadata` / `get_design_context` / `get_screenshot`); requires Figma desktop Dev Mode MCP + `localhost:3845`.
- Placeholder images are **semi-automatic**: auto-pull from `localhost:3845`; misses go into a manual-export list (MCP cannot export a whole node as PNG). The bundled Figma plugin **figma-module-rasterizer** speeds this up.
- Repeated identical cards: download one, tile with `${CLAUDE_SKILL_DIR}/scripts/tile_cards.py`.
- Verify 1:1 with a headless-Chrome screenshot (cross-platform Chrome path in WORKFLOW.md).

## Constraints (hard rules)

Integer CSS tokens; flex auto-sizing (no absolute positioning / hardcoded content widths except page skeleton); no invented logic; no new deps; no full-app scaffolding; per-rule `/* block <node-id> — WxH */` comments. Full list in WORKFLOW.md.

## Related
- Cleaning/simplifying **already-generated** code into a package → if the `design-code-packager` skill is installed, use it; otherwise apply the same constraints inline.
