# Hand-off Contract 规范（v1.0）

> `handoff-contract.json` 是设计交付的**机器可读验收基准**：由 `figma-handoff` 生成，由 `design-review` 消费。
> 它只存"可判定的事实"——每个字段都能被一条规则拿去和开发页面比对。意图、说明、状态解释等散文留在 `handoff-audit.md`，不进 contract。

## 设计原则

1. **只存可判定事实**，不存意图散文。
2. **存解析后的值**（rgba、px），不用 token 名做比对——前端拿不回 Figma token 名；token 名仅供报告给人看。
3. **label / data 分离**：静态标签严格比，动态数据只比存在/格式。压误报的关键。
4. **mapping 是一等公民**：每个模块必须能定位到开发 DOM，否则规则无从谈起。
5. **容差集中声明**：全局默认 + 模块级覆盖，规则不写死阈值。

---

## 顶层结构

```jsonc
{
  "contractVersion": "1.0",
  "project": "商品列表页",
  "source": {
    "figmaFileKey": "",            // 可空（公共插件拿不到 fileKey）
    "pageName": "Page 1",
    "rootNodeId": "570:15848",
    "canvas": { "width": 1280, "height": 3200 }   // 验收 viewport 宽度取 canvas.width
  },
  "tolerances": { /* 见下 · 全局默认 */ },
  "modules": [ /* 每模块一条 */ ]
}
```

`canvas.width` 必须等于设计稿宽度：验收层据此设置浏览器 viewport，否则响应式布局下 bbox 全错。

---

## 单模块字段

| 字段 | 类型 | 含义 | 数据来源 |
|---|---|---|---|
| `moduleId` | string | Figma node id（稳定主键） | `get_metadata` / plugin payload |
| `name` | string | 人读名称 | 同上 |
| `role` | string | 框架无关的组件意图（如 `sortable-table-header`） | audit 注释（校准信号①） |
| `parentId` | string \| null | 最近被捕获的父模块 | plugin payload.parentId |
| `mapping` | object | 如何在开发 DOM 里定位（见下） | 设计约定 / 开发标注 |
| `bbox` | `{w,h}` | 期望宽高（px） | `get_metadata` / payload.frame |
| `spacing` | object | `{layoutMode, gap, padding{top,right,bottom,left}}` | payload.spacing |
| `radius` | `{tl,tr,br,bl}` | 逐角圆角（px） | cornerRadius（**需新采集**） |
| `typography` | array | 每种文本样式一条（见下） | `get_design_context` |
| `colors` | array | 期望颜色（存 value）（见下） | `get_design_context` |
| `texts` | array | label / data 文案（见下） | 文本节点内容（**需新采集**） |
| `images` | array | 图片本征尺寸/填充（见下） | 资源实际尺寸 |
| `states` | array | 声明的状态；v1 只报告不比对 | audit 状态清单（校准信号③） |
| `checks` | object | 本模块跑哪些检查 + 严重级；省略=全局默认 | — |
| `toleranceOverrides` | object | 可选，覆盖全局容差 | — |

### mapping（验收可靠性的天花板）

```jsonc
"mapping": {
  "selector": "[data-review-id='table-header']",   // 首选：开发标注或走查者提供
  "fallback": {                                     // 无 selector 时兜底（可能漏配）
    "anchorText": "商品名称",
    "nearBBox": { "x": 48, "y": 320, "w": 1184, "h": 44 }
  }
}
```
- `selector` 存在 → 可信度高；只能靠 `fallback` → 引擎在 findings 里标 `matchConfidence: "anchor"`，明确降级，绝不假装全自动。

### typography（一个模块可有多种文本样式）

```jsonc
"typography": [
  { "target": "[data-review-id='th-title']",  // 相对模块的子选择器；缺省/"self"=模块自身
    "family": "PingFang SC", "size": 14, "lineHeight": 20, "weight": 400 }
]
```

### colors（只比 value，token 供报告）

```jsonc
"colors": [
  { "target": "self", "prop": "background-color", "token": "BG/Container", "value": "#ffffff" },
  { "target": "[data-review-id='th-title']", "prop": "color",
    "token": "Text/正文", "value": "rgba(0,0,0,0.9)" }
]
```
`prop` ∈ `color` | `background-color` | `border-color`。`value` 接受 `#rgb`/`#rrggbb`/`rgb()`/`rgba()`。

### texts（label / data 分离）

```jsonc
"texts": [
  { "content": "商品名称", "kind": "label" },                   // 严格比（归一化后包含）
  { "content": "￥1,299",  "kind": "data", "format": "currency-cny" }  // 只比存在/格式，不比原文
]
```
- `kind:"label"` → 严格：归一化空白后，模块文本须包含该串。
- `kind:"data"` → 宽松：仅检查该处有非空文本；给了 `format` 则按格式（如 `currency-cny`/`number`/`date`）校验，不比对设计里的占位内容。

### images

```jsonc
"images": [
  { "target": "[data-review-id='avatar']", "intrinsic": [56, 56], "fit": "cover" }
]
```
- 比对**渲染宽高比 vs 本征宽高比**（判拉伸），并核对渲染尺寸接近 `intrinsic`。

### states（v1 只报告）

```jsonc
"states": [
  { "name": "default",  "rendered": true },
  { "name": "sort-asc", "rendered": false, "note": "设计未提供，前端补" }
]
```
v1 不驱动交互；仅把 `rendered:false` 的状态作为 `info` 列入报告，提示前端补。

### checks（严重级）

```jsonc
"checks": {
  "bbox": "error", "spacing": "error", "radius": "warn",
  "typography": "error", "color": "warn", "text": "error",
  "image": "error", "states": "info"
}
```
值 ∈ `error` | `warn` | `info` | `off`。省略某项 → 用全局默认（见引擎默认表）。

---

## 容差（tolerances）

```jsonc
"tolerances": {
  "size":       { "abs": 1 },                    // bbox 宽高 ±1px
  "spacing":    { "abs": 2 },                     // gap/padding ±2px
  "radius":     { "abs": 1 },
  "fontSize":   { "abs": 0 },                     // 字号严格
  "lineHeight": { "abs": 1 },
  "fontWeight": { "abs": 0 },
  "color":      { "perChannel": 4, "alpha": 0.04 },  // rgba 逐通道 ±4，alpha ±0.04
  "imageRatio": { "pct": 2 }                      // 渲染比 vs 本征比 ±2%
}
```
颜色默认逐通道容差（简单够用）；`fontFamily` 只做包含匹配（大小写不敏感），默认 `warn`。

模块级可用 `toleranceOverrides` 覆盖任意键。

---

## findings.json（引擎输出，配套）

规则填客观事实，AI 再据此归纳 `design-review-report.md`：

```jsonc
{
  "reviewedAt": "2026-07-14T09:00:00Z",
  "devTarget": "http://localhost:5173/goods",
  "contract": "handoff-contract.json",
  "summary": { "modules": 12, "matched": 11, "unmatched": 1, "error": 5, "warn": 8, "info": 3 },
  "findings": [
    {
      "moduleId": "85:5505", "moduleName": "表格标题行",
      "matchConfidence": "selector",           // selector | anchor | none
      "check": "typography", "target": "[data-review-id='th-title']",
      "severity": "error",
      "expected": { "size": 14, "lineHeight": 20 },
      "actual":   { "size": 12, "lineHeight": 18 },
      "message": "字号 14/20 → 实际 12/18"
    }
  ]
}
```

**分工铁律**：规则填 `expected`/`actual`/`severity`（客观），AI 只做 summary、按模块归类、猜可能原因——这是幻觉锐减的机制。
