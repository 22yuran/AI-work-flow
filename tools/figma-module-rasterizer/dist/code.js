"use strict";
(() => {
  // src/code.ts
  var CANDIDATE_TYPES = /* @__PURE__ */ new Set([
    "FRAME",
    "COMPONENT",
    "INSTANCE",
    "COMPONENT_SET",
    "GROUP"
  ]);
  figma.showUI(__html__, {
    width: 380,
    height: 560,
    themeColors: true
  });
  figma.on("selectionchange", () => {
    void sendState();
  });
  figma.ui.onmessage = async (message) => {
    try {
      if (message.type === "scan") {
        await sendState();
        return;
      }
      if (message.type === "focus") {
        const node = await getExportableNode(message.id);
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
        await sendState();
        return;
      }
      if (message.type === "download") {
        const node = await getTargetNode(message.id);
        const bytes = await exportNode(node, message.scale);
        figma.ui.postMessage({
          type: "download",
          fileName: `${safeFileName(node.name)}@${message.scale}x.png`,
          bytes
        });
        figma.notify(`Exported ${node.name} as PNG`);
        return;
      }
      if (message.type === "replace") {
        const node = await getTargetNode(message.id);
        const sourceName = node.name;
        const imageNode = await replaceWithPng(node, {
          scale: message.scale,
          keepOriginal: message.keepOriginal
        });
        figma.currentPage.selection = [imageNode];
        figma.viewport.scrollAndZoomIntoView([imageNode]);
        figma.notify(`Replaced ${sourceName} with a PNG layer`);
        await sendState();
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unknown plugin error";
      figma.notify(messageText, { error: true });
      figma.ui.postMessage({ type: "error", message: messageText });
    }
  };
  void sendState();
  async function sendState() {
    await figma.currentPage.loadAsync();
    const selection = figma.currentPage.selection.filter(isExportableNode);
    const candidates = collectCandidates();
    const selected = selection[0] ? toCandidate(selection[0], 0) : null;
    figma.ui.postMessage({
      type: "state",
      selected,
      candidates
    });
  }
  function collectCandidates() {
    const roots = figma.currentPage.selection.length > 0 ? figma.currentPage.selection.filter(isScanRoot) : [figma.currentPage];
    const selectedIds = new Set(figma.currentPage.selection.map((node) => node.id));
    const candidates = [];
    for (const root of roots) {
      if (isCandidateNode(root)) {
        candidates.push(toCandidate(root, getDepth(root), selectedIds.has(root.id)));
      }
      if ("findAll" in root) {
        for (const node of root.findAll((child) => isCandidateNode(child))) {
          candidates.push(toCandidate(node, getDepth(node), selectedIds.has(node.id)));
          if (candidates.length >= 300) {
            return candidates;
          }
        }
      }
    }
    return dedupeCandidates(candidates).slice(0, 300);
  }
  function dedupeCandidates(candidates) {
    const seen = /* @__PURE__ */ new Set();
    return candidates.filter((candidate) => {
      if (seen.has(candidate.id)) {
        return false;
      }
      seen.add(candidate.id);
      return true;
    });
  }
  function isScanRoot(node) {
    return isExportableNode(node) || "findAll" in node;
  }
  function isCandidateNode(node) {
    return isExportableNode(node) && CANDIDATE_TYPES.has(node.type) && node.visible && node.width > 0 && node.height > 0 && !node.name.startsWith("[PNG]");
  }
  function isExportableNode(node) {
    return "exportAsync" in node && "visible" in node && "width" in node && "height" in node;
  }
  async function getTargetNode(id) {
    if (id) {
      return getExportableNode(id);
    }
    const [node] = figma.currentPage.selection;
    if (!node || !isExportableNode(node)) {
      throw new Error("Select a frame, component, instance, component set, or group first.");
    }
    return node;
  }
  async function getExportableNode(id) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node || !isExportableNode(node)) {
      throw new Error("That layer can no longer be exported.");
    }
    return node;
  }
  async function exportNode(node, scale) {
    return node.exportAsync({
      format: "PNG",
      constraint: {
        type: "SCALE",
        value: scale
      }
    });
  }
  async function replaceWithPng(node, options) {
    const parent = node.parent;
    if (!parent || !("insertChild" in parent) || !("children" in parent)) {
      throw new Error("This layer cannot be replaced in place.");
    }
    const index = parent.children.indexOf(node);
    if (index < 0) {
      throw new Error("Could not find the layer inside its parent.");
    }
    const bytes = await exportNode(node, options.scale);
    const image = figma.createImage(bytes);
    const replacement = figma.createRectangle();
    replacement.name = `[PNG] ${node.name}`;
    replacement.resizeWithoutConstraints(node.width, node.height);
    replacement.fills = [
      {
        type: "IMAGE",
        imageHash: image.hash,
        scaleMode: "FILL"
      }
    ];
    replacement.strokes = [];
    replacement.effects = [];
    setOptionalPluginData(replacement, {
      sourceNodeId: node.id,
      sourceNodeName: node.name,
      rasterScale: String(options.scale)
    });
    parent.insertChild(index, replacement);
    copyPositionAndLayout(node, replacement);
    if (options.keepOriginal) {
      node.visible = false;
    } else {
      node.remove();
    }
    return replacement;
  }
  function setOptionalPluginData(node, data) {
    for (const [key, value] of Object.entries(data)) {
      try {
        node.setPluginData(key, value);
      } catch (e) {
      }
    }
  }
  function copyPositionAndLayout(source, target) {
    const sourceAny = source;
    const targetAny = target;
    const props = [
      "x",
      "y",
      "rotation",
      "layoutAlign",
      "layoutGrow",
      "layoutPositioning",
      "layoutSizingHorizontal",
      "layoutSizingVertical",
      "minWidth",
      "maxWidth",
      "minHeight",
      "maxHeight",
      "constraints"
    ];
    for (const prop of props) {
      if (prop in sourceAny && prop in targetAny) {
        try {
          targetAny[prop] = sourceAny[prop];
        } catch (e) {
        }
      }
    }
  }
  function toCandidate(node, depth = 0, selected = false) {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      width: Math.round(node.width),
      height: Math.round(node.height),
      depth,
      path: getPath(node),
      selected
    };
  }
  function getDepth(node) {
    let depth = 0;
    let current = node.parent;
    while (current && current.type !== "PAGE") {
      depth += 1;
      current = current.parent;
    }
    return depth;
  }
  function getPath(node) {
    const parts = [node.name];
    let current = node.parent;
    while (current && current.type !== "PAGE") {
      parts.unshift(current.name);
      current = current.parent;
    }
    return parts.join(" / ");
  }
  function safeFileName(name) {
    return name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "module";
  }
})();
