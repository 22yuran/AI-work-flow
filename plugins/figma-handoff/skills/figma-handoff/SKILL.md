---
name: figma-handoff
description: Convert a placeholder-mockup Figma design (a full page/screen assembled from block-level placeholder images) into a standard pure HTML/CSS hand-off package. Use when the user wants to turn a Figma node/dev-link into a delivery package (交付包 / hand-off 包 / 展位图交付) made of PNG placeholders laid out with flex — no real interaction or business logic. Reads the node via Figma MCP, pulls block images from the local Figma asset server (falling back to a manual-export list), assembles source/index.html + styles.css, and produces manifest + audit + preview.
allowed-tools: Read Write Edit Bash Grep Glob
---

# Figma Hand-off (Placeholder Mockup → Pure HTML/CSS Package)

Turn a **placeholder-mockup Figma page** — one whose blocks ship as flat images, not real components — into a standardized hand-off package for frontend visual reference. Output is pure HTML + CSS, every block an `<img>` placeholder in a flex layout. **No interaction, no business logic, no framework.**

## How to run

The full, agent-agnostic workflow, constraints, package shape, and the 6 steps live in **`${CLAUDE_SKILL_DIR}/WORKFLOW.md`** — read it and follow it. This file is just the Claude Code entry point.

Key points (details in WORKFLOW.md):
- Read the node via Figma MCP (`get_metadata` / `get_design_context` / `get_screenshot`); requires Figma desktop Dev Mode MCP + `localhost:3845`.
- Placeholder images are **semi-automatic**: auto-pull from `localhost:3845`; blocks that miss go into a manual-export list for the user (MCP cannot export a whole node as PNG).
- Repeated identical cards: download one, tile with `${CLAUDE_SKILL_DIR}/scripts/tile_cards.py`.
- Ask the user where the package goes; produce `source/` + manifest + audit + README + preview.
- Verify 1:1 with a headless-Chrome screenshot (cross-platform Chrome path in WORKFLOW.md).

## Constraints (hard rules)

Integer CSS tokens; flex auto-sizing (no absolute positioning / hardcoded content widths except page skeleton); no invented logic; no new deps; no full-app scaffolding; per-rule `/* block <node-id> — WxH */` comments. Full list in WORKFLOW.md.

## Out of scope
- Turning a block into **real deliverable** HTML/CSS (single-module build).
- Cleaning/simplifying **already-generated** code into a package → if the `design-code-packager` skill is installed, use it; otherwise apply the same constraints inline.
