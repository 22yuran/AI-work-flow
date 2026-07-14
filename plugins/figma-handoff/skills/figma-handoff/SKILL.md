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
5. Convert each new module into a real-code package. **If one node actually contains several heterogeneous sub-modules (e.g. tab + table row + dialog, or things on different layers/reuse boundaries), split them into separate packages — one merged package blurs semantics for the frontend and dilutes small-element verification.**
6. Assemble everything into one big folder: `整体页面/` + one folder per new module.

Technical key points:
- Read nodes via Figma MCP (`get_metadata` / `get_design_context` / `get_screenshot`); requires Figma desktop Dev Mode MCP + `localhost:3845`.
- Placeholder images are **semi-automatic**: auto-pull from `localhost:3845`; misses go into a manual-export list (MCP cannot export a whole node as PNG). The bundled Figma plugin **figma-module-rasterizer** speeds this up.
- Repeated identical cards: download one, tile with `${CLAUDE_SKILL_DIR}/scripts/tile_cards.py`.
- Verify 1:1 with a headless-Chrome screenshot (cross-platform Chrome path in WORKFLOW.md).

## Constraints (hard rules)

Integer CSS tokens (px, gap, padding, sizes) — **except border/divider widths, which keep Figma's actual value: a `0.5px` hairline stays `0.5px`, never rounded up**; flex auto-sizing (no absolute positioning / hardcoded content widths except page skeleton); no invented logic; no new deps; no full-app scaffolding; **when sibling elements have different Figma values (size/weight/color/spacing), reproduce each per its actual value — never blanket one style across them**; **use real bound colors, never the `#xxx` fallback inside `var(--token, #xxx)`**; **render icons at their SVG viewBox aspect ratio and verify orientation (a frame/viewBox ratio mismatch means a rotation the export dropped — never `preserveAspectRatio:none` stretch)**; per-rule `/* block <node-id> — WxH */` comments. **Verify by re-screenshotting after any change and zooming in on <24px elements (icons, dots, radios, dashes).** Full list in WORKFLOW.md.

## Calibration signals (help the frontend's AI re-implement more accurately)

The deliverable is visual-reference input that the frontend will feed to their own AI to port into their stack (e.g. React + TDesign). Three signals sharply improve that mapping — **and they live ONLY in HTML comments, `data-ui` markers, or `handoff-audit.md`, never in rendered code**. Adding them must not change the visible DOM or `styles.css` by a single pixel/line:
1. **Component-intent notes** (in each block's node-id comment): frame-agnostic "what component / pattern is this" so the frontend maps it to their own library — write the *intent* ("sortable table header"), never a specific library component name.
2. **Design-token table** (in `handoff-audit.md`): the named tokens `get_design_context` already returns (e.g. `Palette/FG/…/55%`, `Text/正文`), so the frontend matches their design system instead of reverse-guessing raw rgba.
3. **State/variant list** (in `handoff-audit.md`): list the component's states (default/hover/selected/sort asc·desc·none); render only default, record the rest as text.

Anti-pattern to resist: do NOT write business logic, state machines, or event handlers into the hand-off — that's the frontend's job and only adds noise. Full detail in WORKFLOW.md.

## Machine-readable acceptance contract (feeds the `design-review` skill)

The same metadata already gathered for `handoff-audit.md` should also be emitted as **`handoff-contract.json`** — a structured, machine-readable acceptance baseline. It is not a frontend burden; it is the datum the **`design-review`** skill uses to auto-check whether the delivered page matches the design (module presence, bbox, spacing, radius, typography, color values, static copy, image ratios, declared states). Schema + field-by-field spec live in the design-review skill's `CONTRACT.md`. In short: promote the audit table from prose to `{ contractVersion, source{canvas}, tolerances, modules[...] }`. This is what turns the hand-off package from "extra work for the frontend" into "the acceptance basis for the delivery".

## Related
- Cleaning/simplifying **already-generated** code into a package → if the `design-code-packager` skill is installed, use it; otherwise apply the same constraints inline.
- **Accepting a frontend delivery against this hand-off** → use the `design-review` skill with the emitted `handoff-contract.json`.
