var PromptNodeType = /* @__PURE__ */ ((PromptNodeType2) => {
  PromptNodeType2[PromptNodeType2["Piece"] = 1] = "Piece";
  PromptNodeType2[PromptNodeType2["Text"] = 2] = "Text";
  return PromptNodeType2;
})(PromptNodeType || {});
var PieceCtorKind = /* @__PURE__ */ ((PieceCtorKind2) => {
  PieceCtorKind2[PieceCtorKind2["BaseChatMessage"] = 1] = "BaseChatMessage";
  PieceCtorKind2[PieceCtorKind2["Other"] = 2] = "Other";
  PieceCtorKind2[PieceCtorKind2["ImageChatMessage"] = 3] = "ImageChatMessage";
  return PieceCtorKind2;
})(PieceCtorKind || {});
function stringifyPromptElementJSON(element) {
  const strs = [];
  stringifyPromptNodeJSON(element.node, strs);
  return strs.join("");
}
function stringifyPromptNodeJSON(node, strs) {
  if (node.type === 2 /* Text */) {
    if (node.lineBreakBefore) {
      strs.push("\n");
    }
    if (typeof node.text === "string") {
      strs.push(node.text);
    }
  } else if (node.ctor === 3 /* ImageChatMessage */) {
    strs.push("<image>");
  } else if (node.ctor === 1 /* BaseChatMessage */ || node.ctor === 2 /* Other */) {
    for (const child of node.children) {
      stringifyPromptNodeJSON(child, strs);
    }
  }
}
export {
  PieceCtorKind,
  PromptNodeType,
  stringifyPromptElementJSON
};
