import * as dom from "../../../../base/browser/dom.js";
import { isResponseVM } from "../../../../workbench/contrib/chat/common/model/chatViewModel.js";
const markdownScopeSelector = ".chat-markdown-part";
const excludedAncestorSelectors = [".monaco-editor", ".chat-tool-invocation-part"];
function closestElement(node) {
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement ?? void 0;
}
function isAssistantMarkdownEndpoint(node, widgetDomNode) {
  const element = closestElement(node);
  if (!element || !widgetDomNode.contains(element) || !element.closest(markdownScopeSelector)) {
    return false;
  }
  return !excludedAncestorSelectors.some((selector) => element.closest(selector));
}
function contributingTextEndpoints(range) {
  const container = range.commonAncestorContainer;
  const scope = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
  const doc = scope?.ownerDocument;
  if (!scope || !doc) {
    return void 0;
  }
  const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return NodeFilter.FILTER_ACCEPT;
      }
      const element = node;
      if (element.checkVisibility()) {
        return NodeFilter.FILTER_SKIP;
      }
      const display = dom.getWindow(element).getComputedStyle(element).display;
      return display === "contents" ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_REJECT;
    }
  });
  let first;
  let last;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node;
    if (!range.intersectsNode(text)) {
      continue;
    }
    const start = text === range.startContainer ? range.startOffset : 0;
    const end = text === range.endContainer ? range.endOffset : text.data.length;
    if (!text.data.slice(start, end).trim()) {
      continue;
    }
    first ??= text;
    last = text;
  }
  return first && last ? { first, last } : void 0;
}
function resolveResponseSelection(widget) {
  const nativeSelection = dom.getWindow(widget.domNode).getSelection();
  if (!nativeSelection || nativeSelection.isCollapsed || !nativeSelection.rangeCount || !nativeSelection.toString().trim()) {
    return void 0;
  }
  const range = nativeSelection.getRangeAt(0);
  const endpoints = contributingTextEndpoints(range);
  if (!endpoints || !isAssistantMarkdownEndpoint(endpoints.first, widget.domNode) || !isAssistantMarkdownEndpoint(endpoints.last, widget.domNode)) {
    return void 0;
  }
  const firstElement = closestElement(endpoints.first);
  const lastElement = closestElement(endpoints.last);
  if (!firstElement || !lastElement) {
    return void 0;
  }
  const firstItem = widget.getElementFromNode(firstElement);
  const lastItem = widget.getElementFromNode(lastElement);
  if (!firstItem || firstItem !== lastItem || !isResponseVM(firstItem)) {
    return void 0;
  }
  return { response: firstItem, text: nativeSelection.toString().trimEnd(), range: range.cloneRange() };
}
export {
  resolveResponseSelection
};
