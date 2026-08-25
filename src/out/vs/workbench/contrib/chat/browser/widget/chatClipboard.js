import { appendEscapedMarkdownInlineCode, isPortableLinkTarget, isPortableMarkdownTarget } from "../../../../../base/common/htmlContent.js";
import { markdownTokensToPlainText, rewriteMarkdownLinks } from "../../../../../base/common/markdownLinks.js";
function getLinkTarget(element) {
  return (element.getAttribute("data-href") || element.getAttribute("href") || "").trim();
}
function replaceWithLabel(element, label) {
  if (!label.trim()) {
    element.remove();
    return;
  }
  const code = element.ownerDocument.createElement("code");
  code.textContent = label;
  element.replaceWith(code);
}
function sanitizeChatClipboardFragment(fragment) {
  let changed = false;
  for (const anchor of Array.from(fragment.querySelectorAll("a"))) {
    const target = getLinkTarget(anchor);
    if (isPortableLinkTarget(target)) {
      anchor.setAttribute("href", target);
      anchor.removeAttribute("data-href");
      continue;
    }
    replaceWithLabel(anchor, anchor.textContent ?? "");
    changed = true;
  }
  for (const image of Array.from(fragment.querySelectorAll("img"))) {
    if (!isPortableLinkTarget(image.getAttribute("src") ?? "")) {
      replaceWithLabel(image, image.getAttribute("alt") ?? "");
      changed = true;
    }
  }
  for (const element of Array.from(fragment.querySelectorAll("[data-href]"))) {
    element.removeAttribute("data-href");
  }
  return changed;
}
function overlapsCode(start, end, codeRanges) {
  return codeRanges.some((range) => start < range.end && end > range.start);
}
function toPortableMarkdown(markdown) {
  return rewriteMarkdownLinks(markdown, {
    rewriteLink(token) {
      const target = token.href ?? "";
      if (!isPortableMarkdownTarget(target)) {
        const label = markdownTokensToPlainText(token.tokens ?? []).trim() || (token.text ?? "").trim();
        return label ? appendEscapedMarkdownInlineCode(label) : "";
      }
      if (!token.raw.includes(target)) {
        const title = token.title ? ` "${token.title}"` : "";
        return `${token.type === "image" ? "!" : ""}[${token.text}](${target}${title})`;
      }
      return void 0;
    },
    additionalEdits(source, { codeRanges, definitionRanges, unlocatable }) {
      const edits = [];
      for (const token of unlocatable) {
        const target = token.href ?? "";
        if (isPortableMarkdownTarget(target)) {
          continue;
        }
        const needle = `](${target})`;
        for (let at = source.indexOf(needle); at >= 0; at = source.indexOf(needle, at + 1)) {
          if (!overlapsCode(at, at + needle.length, codeRanges)) {
            edits.push({ start: at, end: at + needle.length, replacement: "]()" });
          }
        }
      }
      edits.push(...definitionRanges.map((range) => ({ ...range, replacement: "" })));
      return edits;
    }
  });
}
export {
  sanitizeChatClipboardFragment,
  toPortableMarkdown
};
