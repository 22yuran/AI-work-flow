#!/usr/bin/env node
/**
 * design-review 规则化验收引擎
 *
 * 输入：handoff-contract.json + 开发页面 URL/本地文件
 * 处理：用系统 Chrome（puppeteer-core）加载页面，按 contract 的 mapping 定位每个
 *       模块，抽取 bounding box / computed style / 文本 / 图片本征尺寸，带容差比对。
 * 输出：findings.json —— 客观事实清单（expected/actual/severity）。
 *       归纳成 design-review-report.md 是 AI 的活，本引擎不做主观判断。
 *
 * 用法：
 *   node review.mjs --contract handoff-contract.json --url http://localhost:5173/goods
 *   node review.mjs --contract c.json --url file:///abs/path/index.html --out review-out
 *
 * 依赖：npm i puppeteer-core  （复用系统已装的 Chrome，不下载浏览器）
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import puppeteer from "puppeteer-core";

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith("--")) {
      const name = key.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[name] = next;
        i += 1;
      } else {
        args[name] = true;
      }
    }
  }
  return args;
}

function findChrome(explicit) {
  if (explicit) return explicit;
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ],
    win32: [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser"
    ]
  }[process.platform] || [];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "未找到 Chrome。用 --chrome <路径> 指定，或设置环境变量 CHROME。"
  );
}

// --------------------------------------------------------------------------
// Defaults
// --------------------------------------------------------------------------
const DEFAULT_CHECKS = {
  bbox: "error",
  spacing: "error",
  radius: "warn",
  typography: "error",
  color: "warn",
  text: "error",
  image: "error",
  states: "info"
};

const DEFAULT_TOL = {
  size: { abs: 1 },
  spacing: { abs: 2 },
  radius: { abs: 1 },
  fontSize: { abs: 0 },
  lineHeight: { abs: 1 },
  fontWeight: { abs: 0 },
  color: { perChannel: 4, alpha: 0.04 },
  imageRatio: { pct: 2 }
};

// --------------------------------------------------------------------------
// Small utilities (Node side)
// --------------------------------------------------------------------------
const px = (s) => (typeof s === "string" ? parseFloat(s) : Number(s));
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

function parseColor(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  m = s.match(/^#([0-9a-f]{6})$/);
  if (m) {
    return {
      r: parseInt(m[1].slice(0, 2), 16),
      g: parseInt(m[1].slice(2, 4), 16),
      b: parseInt(m[1].slice(4, 6), 16),
      a: 1
    };
  }
  m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(",").map((v) => v.trim());
    return {
      r: parseFloat(parts[0]),
      g: parseFloat(parts[1]),
      b: parseFloat(parts[2]),
      a: parts[3] === undefined ? 1 : parseFloat(parts[3])
    };
  }
  return null;
}

function within(expected, actual, tol) {
  if (Number.isNaN(actual)) return false;
  const absOk = tol.abs === undefined || Math.abs(expected - actual) <= tol.abs;
  const pctOk =
    tol.pct === undefined ||
    (expected !== 0 && Math.abs(expected - actual) / Math.abs(expected) <= tol.pct / 100);
  // Pass if any provided bound is satisfied; if only one bound is set, use it.
  if (tol.abs !== undefined && tol.pct !== undefined) return absOk || pctOk;
  if (tol.abs !== undefined) return absOk;
  if (tol.pct !== undefined) return pctOk;
  return expected === actual;
}

function colorWithin(exp, act, tol) {
  if (!exp || !act) return false;
  const chOk =
    Math.abs(exp.r - act.r) <= tol.perChannel &&
    Math.abs(exp.g - act.g) <= tol.perChannel &&
    Math.abs(exp.b - act.b) <= tol.perChannel;
  const aOk = Math.abs(exp.a - act.a) <= (tol.alpha ?? 0.04);
  return chOk && aOk;
}

// --------------------------------------------------------------------------
// In-page extraction (runs inside the browser)
// --------------------------------------------------------------------------
/* eslint-disable */
function pageExtract(spec) {
  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const out = {
      w: Math.round(r.width),
      h: Math.round(r.height),
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      fontWeight: cs.fontWeight,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      borderColor: cs.borderTopColor,
      r_tl: cs.borderTopLeftRadius,
      r_tr: cs.borderTopRightRadius,
      r_br: cs.borderBottomRightRadius,
      r_bl: cs.borderBottomLeftRadius,
      p_t: cs.paddingTop,
      p_r: cs.paddingRight,
      p_b: cs.paddingBottom,
      p_l: cs.paddingLeft,
      columnGap: cs.columnGap,
      rowGap: cs.rowGap,
      text: (el.textContent || "").replace(/\s+/g, " ").trim()
    };
    if (el.tagName === "IMG") {
      out.naturalW = el.naturalWidth;
      out.naturalH = el.naturalHeight;
      out.renderedW = Math.round(r.width);
      out.renderedH = Math.round(r.height);
    }
    return out;
  }

  function findByAnchor(anchorText, near) {
    const all = Array.from(document.querySelectorAll("body *"));
    const hits = all.filter((e) => (e.textContent || "").includes(anchorText));
    if (!hits.length) return null;
    const area = (e) => {
      const r = e.getBoundingClientRect();
      return r.width * r.height;
    };
    if (near) {
      const cx = near.x + near.w / 2;
      const cy = near.y + near.h / 2;
      const dist = (e) => {
        const r = e.getBoundingClientRect();
        return Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
      };
      hits.sort((a, b) => dist(a) - dist(b) || area(a) - area(b));
    } else {
      // Most specific = smallest element still containing the text.
      hits.sort((a, b) => area(a) - area(b));
    }
    return hits[0];
  }

  const results = [];
  for (const m of spec) {
    let root = null;
    let via = null;
    if (m.selector) {
      root = document.querySelector(m.selector);
      if (root) via = "selector";
    }
    if (!root && m.fallback && m.fallback.anchorText) {
      root = findByAnchor(m.fallback.anchorText, m.fallback.nearBBox || null);
      if (root) via = "anchor";
    }
    if (!root) {
      results.push({ moduleId: m.moduleId, found: false, via: null });
      continue;
    }
    const targets = {};
    for (const sel of m.targetSelectors) {
      if (sel === "self") {
        targets.self = box(root);
      } else {
        targets[sel] = box(root.querySelector(sel));
      }
    }
    results.push({
      moduleId: m.moduleId,
      found: true,
      via,
      root: box(root),
      targets,
      text: (root.textContent || "").replace(/\s+/g, " ").trim()
    });
  }
  return results;
}
/* eslint-enable */

// --------------------------------------------------------------------------
// Comparison (Node side)
// --------------------------------------------------------------------------
function resolveTargetBox(measured, target) {
  if (!target || target === "self") return measured.root;
  return measured.targets[target] || null;
}

function compareModule(mod, measured, tol) {
  const findings = [];
  const checks = { ...DEFAULT_CHECKS, ...(mod.checks || {}) };
  const sev = (name) => checks[name] || "off";
  const add = (check, target, severity, expected, actual, message) =>
    findings.push({
      moduleId: mod.moduleId,
      moduleName: mod.name || mod.moduleId,
      matchConfidence: measured.via || "none",
      check,
      target: target || "self",
      severity,
      expected,
      actual,
      message
    });

  if (!measured.found) {
    add("mapping", "self", "error", "present", "missing", "未在页面中定位到该模块");
    return findings;
  }

  const root = measured.root;

  // bbox
  if (mod.bbox && sev("bbox") !== "off") {
    for (const dim of ["w", "h"]) {
      if (mod.bbox[dim] === undefined) continue;
      if (!within(mod.bbox[dim], root[dim], tol.size)) {
        add("bbox", "self", sev("bbox"), { [dim]: mod.bbox[dim] }, { [dim]: root[dim] },
          `${dim === "w" ? "宽" : "高"} ${mod.bbox[dim]} → 实际 ${root[dim]}`);
      }
    }
  }

  // spacing (padding + gap)
  if (mod.spacing && sev("spacing") !== "off") {
    const pad = mod.spacing.padding;
    if (pad) {
      const map = { top: "p_t", right: "p_r", bottom: "p_b", left: "p_l" };
      for (const side of Object.keys(map)) {
        if (pad[side] === undefined) continue;
        const actual = px(root[map[side]]);
        if (!within(pad[side], actual, tol.spacing)) {
          add("spacing", "self", sev("spacing"),
            { ["padding-" + side]: pad[side] }, { ["padding-" + side]: actual },
            `padding-${side} ${pad[side]} → 实际 ${actual}`);
        }
      }
    }
    if (mod.spacing.gap !== undefined) {
      const horizontal = mod.spacing.layoutMode !== "VERTICAL";
      const gapRaw = horizontal ? root.columnGap : root.rowGap;
      const actual = gapRaw === "normal" ? 0 : px(gapRaw);
      if (!within(mod.spacing.gap, actual, tol.spacing)) {
        add("spacing", "self", sev("spacing"),
          { gap: mod.spacing.gap }, { gap: actual }, `gap ${mod.spacing.gap} → 实际 ${actual}`);
      }
    }
  }

  // radius
  if (mod.radius && sev("radius") !== "off") {
    const map = { tl: "r_tl", tr: "r_tr", br: "r_br", bl: "r_bl" };
    for (const corner of Object.keys(map)) {
      if (mod.radius[corner] === undefined) continue;
      const actual = px(root[map[corner]]);
      if (!within(mod.radius[corner], actual, tol.radius)) {
        add("radius", "self", sev("radius"),
          { [corner]: mod.radius[corner] }, { [corner]: actual },
          `圆角 ${corner} ${mod.radius[corner]} → 实际 ${actual}`);
      }
    }
  }

  // typography
  if (mod.typography && sev("typography") !== "off") {
    for (const t of mod.typography) {
      const b = resolveTargetBox(measured, t.target);
      if (!b) {
        add("typography", t.target, sev("typography"), t, "missing", "文本目标未找到");
        continue;
      }
      if (t.size !== undefined && !within(t.size, px(b.fontSize), tol.fontSize)) {
        add("typography", t.target, sev("typography"),
          { size: t.size }, { size: px(b.fontSize) }, `字号 ${t.size} → 实际 ${px(b.fontSize)}`);
      }
      if (t.lineHeight !== undefined) {
        const lh = b.lineHeight === "normal" ? NaN : px(b.lineHeight);
        if (!within(t.lineHeight, lh, tol.lineHeight)) {
          add("typography", t.target, sev("typography"),
            { lineHeight: t.lineHeight }, { lineHeight: b.lineHeight }, `行高 ${t.lineHeight} → 实际 ${b.lineHeight}`);
        }
      }
      if (t.weight !== undefined && !within(t.weight, px(b.fontWeight), tol.fontWeight)) {
        add("typography", t.target, sev("typography"),
          { weight: t.weight }, { weight: px(b.fontWeight) }, `字重 ${t.weight} → 实际 ${b.fontWeight}`);
      }
      if (t.family && !b.fontFamily.toLowerCase().includes(t.family.toLowerCase())) {
        add("typography", t.target, "warn",
          { family: t.family }, { family: b.fontFamily }, `字体 ${t.family} 不在实际栈 ${b.fontFamily}`);
      }
    }
  }

  // color
  if (mod.colors && sev("color") !== "off") {
    const propMap = { color: "color", "background-color": "backgroundColor", "border-color": "borderColor" };
    for (const c of mod.colors) {
      const b = resolveTargetBox(measured, c.target);
      if (!b) {
        add("color", c.target, sev("color"), c, "missing", "颜色目标未找到");
        continue;
      }
      const exp = parseColor(c.value);
      const act = parseColor(b[propMap[c.prop]]);
      if (!colorWithin(exp, act, tol.color)) {
        add("color", c.target, sev("color"),
          { [c.prop]: c.value + (c.token ? ` (${c.token})` : "") },
          { [c.prop]: b[propMap[c.prop]] },
          `${c.prop} 期望 ${c.value} → 实际 ${b[propMap[c.prop]]}`);
      }
    }
  }

  // text (label strict, data loose)
  if (mod.texts && sev("text") !== "off") {
    const haystack = norm(measured.text);
    for (const t of mod.texts) {
      if (t.kind === "label") {
        if (!haystack.includes(norm(t.content))) {
          add("text", "self", sev("text"),
            { label: t.content }, { text: haystack.slice(0, 60) }, `缺少文案「${t.content}」`);
        }
      } else if (t.kind === "data") {
        // Only check that some non-empty content exists (data差异不算问题)。
        if (!haystack) {
          add("text", "self", "warn", { data: t.content }, { text: "" }, "数据文本区域为空");
        }
      }
    }
  }

  // image (ratio / stretch)
  if (mod.images && sev("image") !== "off") {
    for (const im of mod.images) {
      const b = resolveTargetBox(measured, im.target);
      if (!b || b.naturalW === undefined) {
        add("image", im.target, sev("image"), im, "missing", "图片目标未找到或非 <img>");
        continue;
      }
      const [iw, ih] = im.intrinsic;
      if (iw && ih && b.renderedW && b.renderedH) {
        const expRatio = iw / ih;
        const actRatio = b.renderedW / b.renderedH;
        if (!within(expRatio, actRatio, tol.imageRatio)) {
          add("image", im.target, sev("image"),
            { ratio: `${iw}x${ih}` }, { ratio: `${b.renderedW}x${b.renderedH}` },
            `图片比例失真：期望 ${iw}x${ih} → 渲染 ${b.renderedW}x${b.renderedH}`);
        }
      }
    }
  }

  // states (report-only: list undesigned states so frontend knows to fill them)
  if (mod.states && sev("states") !== "off") {
    for (const st of mod.states) {
      if (st.rendered === false) {
        add("states", "self", "info",
          { state: st.name }, null, `状态「${st.name}」设计未提供${st.note ? "：" + st.note : ""}`);
      }
    }
  }

  return findings;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv);
  if (!args.contract || !args.url) {
    console.error("用法：node review.mjs --contract <contract.json> --url <URL|file://...> [--out <dir>] [--chrome <path>]");
    process.exit(2);
  }

  const contract = JSON.parse(fs.readFileSync(args.contract, "utf8"));
  const tol = { ...DEFAULT_TOL, ...(contract.tolerances || {}) };
  const canvas = (contract.source && contract.source.canvas) || { width: 1280, height: 900 };
  const outDir = args.out || ".";
  fs.mkdirSync(outDir, { recursive: true });

  const chrome = findChrome(args.chrome);
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    args: ["--no-sandbox", "--hide-scrollbars"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: Math.round(canvas.width),
      height: Math.round(canvas.height) || 900,
      deviceScaleFactor: 1
    });
    await page.goto(args.url, {
      waitUntil: "networkidle2",
      timeout: Number(args.timeout) || 30000
    });

    // Build a serializable spec for in-page extraction.
    const spec = contract.modules.map((m) => {
      const selectors = new Set();
      for (const arr of [m.typography, m.colors, m.images]) {
        for (const item of arr || []) {
          selectors.add(item.target || "self");
        }
      }
      return {
        moduleId: m.moduleId,
        selector: m.mapping && m.mapping.selector,
        fallback: m.mapping && m.mapping.fallback,
        targetSelectors: Array.from(selectors)
      };
    });

    const measuredList = await page.evaluate(pageExtract, spec);
    const byId = new Map(measuredList.map((x) => [x.moduleId, x]));

    const findings = [];
    for (const mod of contract.modules) {
      const measured = byId.get(mod.moduleId) || { moduleId: mod.moduleId, found: false, via: null };
      const modTol = mod.toleranceOverrides ? mergeTol(tol, mod.toleranceOverrides) : tol;
      findings.push(...compareModule(mod, measured, modTol));
    }

    const summary = {
      modules: contract.modules.length,
      matched: measuredList.filter((m) => m.found).length,
      unmatched: measuredList.filter((m) => !m.found).length,
      error: findings.filter((f) => f.severity === "error").length,
      warn: findings.filter((f) => f.severity === "warn").length,
      info: findings.filter((f) => f.severity === "info").length
    };

    const report = {
      reviewedAt: new Date().toISOString(),
      devTarget: args.url,
      contract: path.resolve(args.contract),
      summary,
      findings
    };
    const outPath = path.join(outDir, "review-findings.json");
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

    console.log(`模块 ${summary.modules} · 命中 ${summary.matched} · 未命中 ${summary.unmatched}`);
    console.log(`问题：error ${summary.error} · warn ${summary.warn} · info ${summary.info}`);
    console.log(`已写出 ${outPath}`);
  } finally {
    await browser.close();
  }
}

function mergeTol(base, override) {
  const out = { ...base };
  for (const k of Object.keys(override)) {
    out[k] = { ...(base[k] || {}), ...override[k] };
  }
  return out;
}

main().catch((err) => {
  console.error("验收失败：", err.message);
  process.exit(1);
});
