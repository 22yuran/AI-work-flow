#!/usr/bin/env node
/**
 * 间距枚举器 —— 把 Figma `get_metadata` 的布局树转成"整页所有模块间距"的全集。
 *
 * 目的:让"整体页面查间距"的全集由**源自动枚举**得出,而不是 agent 手挑。
 * 每一组同级模块,按位置排序后,相邻两块之间的间距(纵向 next.y-prev.bottom /
 * 横向 next.x-prev.right)全部列出——一条不落。
 *
 * 用法:
 *   node enumerate-gaps.mjs <get_metadata 输出的 xml 文件> [--min 1]
 * 输出:gaps 全集(JSON) + 按值汇总,可直接填进 contract 的 gaps[]。
 */
import fs from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const minGap = Number((args.find((a) => a.startsWith("--min=")) || "--min=1").split("=")[1]);
if (!file) {
  console.error("用法: node enumerate-gaps.mjs <metadata.xml> [--min=1]");
  process.exit(2);
}
const xml = fs.readFileSync(file, "utf8");

// --- 解析 get_metadata 的标签树 ---
function parse(src) {
  const tagRe = /<(\/?)([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*(\/?)>/g;
  const attrRe = /([\w-]+)="([^"]*)"/g;
  const root = { children: [] };
  const stack = [root];
  let m;
  while ((m = tagRe.exec(src))) {
    const [, closing, tag, attrStr, selfClose] = m;
    if (closing) { stack.pop(); continue; }
    const node = { tag, children: [] };
    let a;
    while ((a = attrRe.exec(attrStr))) {
      const [, k, v] = a;
      if (k === "x" || k === "y" || k === "width" || k === "height") node[k] = parseFloat(v);
      else node[k] = v;
    }
    node.hidden = node.hidden === "true";
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root.children[0];
}

// --- 枚举每个父节点下相邻同级模块的间距 ---
const gaps = [];
function label(n) { return `${n.name || n.tag}${n.id ? " <" + n.id + ">" : ""}`; }

function visit(node) {
  if (node.hidden) return; // 不进入隐藏子树(如加载态),只枚举默认可见态的间距
  const kids = (node.children || []).filter(
    (c) => !c.hidden && c.width > 0 && c.height > 0 && c.x != null && c.y != null
  );
  if (kids.length >= 2) {
    // 判定方向:纵向排(y 不重叠)还是横向排(x 不重叠)。默认纵向。
    const byY = [...kids].sort((a, b) => a.y - b.y);
    let vertical = true;
    for (let i = 1; i < byY.length; i++) {
      if (byY[i].y < byY[i - 1].y + byY[i - 1].height - 1) { vertical = false; break; }
    }
    const seq = vertical ? byY : [...kids].sort((a, b) => a.x - b.x);
    for (let i = 1; i < seq.length; i++) {
      const prev = seq[i - 1], cur = seq[i];
      const value = vertical
        ? Math.round(cur.y - (prev.y + prev.height))
        : Math.round(cur.x - (prev.x + prev.width));
      if (value >= minGap) {
        gaps.push({
          parent: label(node),
          from: label(prev),
          to: label(cur),
          value,
          direction: vertical ? "vertical" : "horizontal"
        });
      }
    }
  }
  for (const c of node.children || []) visit(c);
}

const tree = parse(xml);
visit(tree);

// --- 汇总 ---
const byValue = {};
for (const g of gaps) byValue[g.value] = (byValue[g.value] || 0) + 1;

console.log(`整页共枚举出 ${gaps.length} 条模块间距(>= ${minGap}px):`);
console.log("按值汇总:", Object.entries(byValue).sort((a, b) => a[0] - b[0]).map(([v, n]) => `${v}px×${n}`).join(", "));
console.log("---");
for (const g of gaps) {
  console.log(`  ${g.value}px [${g.direction === "vertical" ? "纵" : "横"}]  ${g.from}  →  ${g.to}   (父: ${g.parent})`);
}
// 机器可读:直接可作为 contract gaps 起点
fs.writeFileSync("enumerated-gaps.json", JSON.stringify(gaps, null, 2));
console.log("---\n已写出 enumerated-gaps.json");
