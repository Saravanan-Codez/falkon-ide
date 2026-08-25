var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
import { memoize } from "./decorators.js";
class LinkedText {
  constructor(nodes) {
    this.nodes = nodes;
  }
  toString() {
    return this.nodes.map((node) => typeof node === "string" ? node : node.label).join("");
  }
}
__decorateClass([
  memoize
], LinkedText.prototype, "toString", 1);
const LINK_REGEX = /\[([^\]]+)\]\(((?:https?:\/\/|command:|file:)[^\)\s]+)(?: (["'])(.+?)(\3))?\)/gi;
function parseLinkedText(text) {
  const result = [];
  let index = 0;
  let match;
  while (match = LINK_REGEX.exec(text)) {
    if (match.index - index > 0) {
      result.push(text.substring(index, match.index));
    }
    const [, label, href, , title] = match;
    if (title) {
      result.push({ label, href, title });
    } else {
      result.push({ label, href });
    }
    index = match.index + match[0].length;
  }
  if (index < text.length) {
    result.push(text.substring(index));
  }
  return new LinkedText(result);
}
export {
  LinkedText,
  parseLinkedText
};
