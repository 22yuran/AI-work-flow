#!/usr/bin/env node
/**
 * 几何自校验 —— 交付代码 vs Figma 布局，防"图省事"。
 *
 * 原则:抓真问题(结构/位置/尺寸偏差、元素缺失) · 复用一次渲染 · 零重复。
 * 用法:
 *   node verify-geometry.mjs --metadata <get_metadata.xml> --url <file://.../index.html> \
 *        --root 431:14815 [--tol 2] [--chrome <path>]
 * 交付 HTML 里给要校验的块加 data-node-id="<figma-node-id>" 即可被对账。
 * 只校验 metadata 里出现、且 HTML 里带 data-node-id 的节点;
 * metadata 有、HTML 无 → 记为「缺失」(如把两段线合并成一条,第二段就缺失)。
 */
import fs from "node:fs";
import process from "node:process";
import puppeteer from "puppeteer-core";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) { const n = a.slice(2); const v = process.argv[i + 1]; if (v && !v.startsWith("--")) { args[n] = v; i++; } else args[n] = true; }
}
const tol = Number(args.tol || 2);
if (!args.metadata || !args.url || !args.root) {
  console.error("用法: node verify-geometry.mjs --metadata <xml> --url <file://...> --root <nodeId> [--tol 2]");
  process.exit(2);
}

// --- 解析 get_metadata 树 ---
function parse(src) {
  const tagRe = /<(\/?)([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*(\/?)>/g;
  const attrRe = /([\w-]+)="([^"]*)"/g;
  const root = { children: [] }; const stack = [root]; let m;
  while ((m = tagRe.exec(src))) {
    const [, closing, tag, attrStr, self] = m;
    if (closing) { stack.pop(); continue; }
    const node = { tag, children: [] }; let a;
    while ((a = attrRe.exec(attrStr))) { const [, k, v] = a; node[k] = (k === "x" || k === "y" || k === "width" || k === "height") ? parseFloat(v) : v; }
    node.hidden = node.hidden === "true";
    stack[stack.length - 1].children.push(node);
    if (!self) stack.push(node);
  }
  return root.children[0];
}

// 找 root 节点,计算每个可见后代相对 root 左上角的位置 + 尺寸
function collect(tree, rootId) {
  let root = null;
  (function find(n) { if (n.id === rootId) root = n; else (n.children || []).forEach(find); })(tree);
  if (!root) throw new Error("metadata 里找不到 root 节点 " + rootId);
  const out = {}; // id -> {x,y,w,h} 相对 root(root 自身作原点 0,0)
  (function walk(n, ax, ay) {
    const x = ax + (n.x || 0), y = ay + (n.y || 0);
    if (n !== root && n.id && !n.hidden) out[n.id] = { x: Math.round(x), y: Math.round(y), w: Math.round(n.width), h: Math.round(n.height) };
    (n.children || []).forEach((c) => walk(c, n === root ? 0 : x, n === root ? 0 : y));
  })(root, 0, 0);
  return out;
}

const tree = parse(fs.readFileSync(args.metadata, "utf8"));
const expected = collect(tree, args.root);

const chrome = args.chrome || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 700, deviceScaleFactor: 1 });
  await page.goto(args.url, { waitUntil: "networkidle2", timeout: 30000 });

  const ids = Object.keys(expected);
  const measured = await page.evaluate((rootId, ids) => {
    const rootEl = document.querySelector(`[data-node-id="${rootId}"]`);
    const rb = rootEl ? rootEl.getBoundingClientRect() : { left: 0, top: 0 };
    const res = {};
    for (const id of ids) {
      const el = document.querySelector(`[data-node-id="${id}"]`);
      if (!el) { res[id] = null; continue; }
      const r = el.getBoundingClientRect();
      res[id] = { x: Math.round(r.left - rb.left), y: Math.round(r.top - rb.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return res;
  }, args.root, ids);

  const findings = [];
  let ok = 0, miss = 0, bad = 0;
  for (const id of ids) {
    const e = expected[id], a = measured[id];
    if (!a) { miss++; findings.push(`✗ 缺失  ${id}  期望 @(${e.x},${e.y}) ${e.w}x${e.h}，HTML 无 data-node-id`); continue; }
    const d = (k) => Math.abs(e[k] - a[k]);
    const off = ["x", "y", "w", "h"].filter((k) => d(k) > tol);
    if (off.length) { bad++; findings.push(`⚠ 偏差  ${id}  期望 @(${e.x},${e.y}) ${e.w}x${e.h} → 实际 @(${a.x},${a.y}) ${a.w}x${a.h}  [${off.join(",")}]`); }
    else ok++;
  }
  console.log(`几何自校验(容差 ${tol}px):校验 ${ids.length} 个节点 · 通过 ${ok} · 偏差 ${bad} · 缺失 ${miss}`);
  findings.forEach((f) => console.log("  " + f));
  if (bad + miss === 0) console.log("  全部与 Figma 布局一致 ✓");
} finally {
  await browser.close();
}
