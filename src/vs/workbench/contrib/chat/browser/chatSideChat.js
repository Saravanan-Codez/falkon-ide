import * as dom from "../../../../base/browser/dom.js";
function captureSideChatSelection(widget) {
  if (!widget) {
    return void 0;
  }
  const nativeSelection = dom.getActiveWindow().getSelection();
  const selectedText = nativeSelection?.toString();
  if (!nativeSelection || !selectedText || !selectedText.trim()) {
    return void 0;
  }
  const { anchorNode, focusNode } = nativeSelection;
  if (!anchorNode || !focusNode || !dom.isAncestor(anchorNode, widget.domNode) || !dom.isAncestor(focusNode, widget.domNode)) {
    return void 0;
  }
  const inputEditorDomNode = widget.inputEditor.getDomNode();
  if (inputEditorDomNode && (dom.isAncestor(anchorNode, inputEditorDomNode) || dom.isAncestor(focusNode, inputEditorDomNode))) {
    return void 0;
  }
  return { text: selectedText };
}
export {
  captureSideChatSelection
};
