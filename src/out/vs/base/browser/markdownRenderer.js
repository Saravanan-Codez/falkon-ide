import { onUnexpectedError } from "../common/errors.js";
import { escapeDoubleQuotes, isPortableLinkTarget, parseHrefAndDimensions, removeMarkdownEscapes } from "../common/htmlContent.js";
import { markdownEscapeEscapedIcons } from "../common/iconLabels.js";
import { defaultGenerator } from "../common/idGenerator.js";
import { KeyCode } from "../common/keyCodes.js";
import { DisposableStore } from "../common/lifecycle.js";
import * as marked from "../common/marked/marked.js";
import { parse } from "../common/marshalling.js";
import { FileAccess, Schemas } from "../common/network.js";
import { cloneAndChange } from "../common/objects.js";
import { basename as pathBasename } from "../common/path.js";
import { basename, dirname, resolvePath } from "../common/resources.js";
import { escape } from "../common/strings.js";
import { URI } from "../common/uri.js";
import * as DOM from "./dom.js";
import * as domSanitize from "./domSanitize.js";
import { convertTagToPlaintext } from "./domSanitize.js";
import { StandardKeyboardEvent } from "./keyboardEvent.js";
import { StandardMouseEvent } from "./mouseEvent.js";
import { renderIcon, renderLabelWithIcons } from "./ui/iconLabel/iconLabels.js";
function getLinkTitle(href) {
  try {
    const parsed = URI.parse(href);
    if (parsed.scheme === Schemas.file) {
      const path = parsed.fsPath;
      const fragment = parsed.fragment;
      return escapeDoubleQuotes(fragment ? `${path}#${fragment}` : path);
    }
  } catch {
  }
  return "";
}
function renderImage({ href, title, text }, transformUri) {
  let dimensions = [];
  let attributes = [];
  if (href) {
    ({ href, dimensions } = parseHrefAndDimensions(href));
    href = transformUri?.(href) ?? href;
    attributes.push(`src="${escapeDoubleQuotes(href)}"`);
  }
  if (text) {
    attributes.push(`alt="${escapeDoubleQuotes(text)}"`);
  }
  if (title) {
    attributes.push(`title="${escapeDoubleQuotes(title)}"`);
  }
  if (dimensions.length) {
    attributes = attributes.concat(dimensions);
  }
  return "<img " + attributes.join(" ") + ">";
}
const defaultMarkedRenderers = Object.freeze({
  image: renderImage,
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>`;
  },
  link({ href, title, tokens }) {
    let text = this.parser.parseInline(tokens);
    if (typeof href !== "string") {
      return "";
    }
    if (href === text) {
      text = removeMarkdownEscapes(text);
    }
    title = typeof title === "string" ? escapeDoubleQuotes(removeMarkdownEscapes(title)) : "";
    href = removeMarkdownEscapes(href);
    if (!title && href.startsWith(`${Schemas.file}:`)) {
      title = getLinkTitle(href);
    }
    const isCommandUri = href.startsWith(`${Schemas.command}:`);
    href = href.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const effectiveTitle = title || (isCommandUri ? "" : href);
    return `<a href="${href}" title="${effectiveTitle}" draggable="false">${text}</a>`;
  }
});
function createAlertBlockquoteRenderer(fallbackRenderer) {
  return function(token) {
    const { tokens } = token;
    const firstToken = tokens[0];
    if (firstToken?.type !== "paragraph") {
      return fallbackRenderer.call(this, token);
    }
    const paragraphTokens = firstToken.tokens;
    if (!paragraphTokens || paragraphTokens.length === 0) {
      return fallbackRenderer.call(this, token);
    }
    const firstTextToken = paragraphTokens[0];
    if (firstTextToken?.type !== "text") {
      return fallbackRenderer.call(this, token);
    }
    const pattern = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*?\n*/i;
    const match = firstTextToken.raw.match(pattern);
    if (!match) {
      return fallbackRenderer.call(this, token);
    }
    firstTextToken.raw = firstTextToken.raw.replace(pattern, "");
    firstTextToken.text = firstTextToken.text.replace(pattern, "");
    const alertIcons = {
      "note": "info",
      "tip": "light-bulb",
      "important": "comment",
      "warning": "alert",
      "caution": "stop"
    };
    const type = match[1];
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    const severity = type.toLowerCase();
    const iconHtml = renderIcon({ id: alertIcons[severity] }).outerHTML;
    const content = this.parser.parse(tokens);
    return `<blockquote data-severity="${severity}"><p><span>${iconHtml}${typeCapitalized}</span>${content.substring(3)}</blockquote>
`;
  };
}
function renderMarkdown(markdown, options = {}, target) {
  const disposables = new DisposableStore();
  let isDisposed = false;
  const markedInstance = new marked.Marked(...options.markedExtensions ?? []);
  const { renderer, codeBlocks, syncCodeBlocks } = createMarkdownRenderer(markedInstance, options, markdown);
  const value = preprocessMarkdownString(markdown);
  let renderedMarkdown;
  if (options.fillInIncompleteTokens) {
    const opts = {
      ...markedInstance.defaults,
      ...options.markedOptions,
      renderer
    };
    const tokens = markedInstance.lexer(value, opts);
    const newTokens = fillInIncompleteTokens(tokens);
    renderedMarkdown = markedInstance.parser(newTokens, opts);
  } else {
    renderedMarkdown = markedInstance.parse(value, { ...options?.markedOptions, renderer, async: false });
  }
  if (markdown.supportThemeIcons) {
    const elements = renderLabelWithIcons(renderedMarkdown);
    renderedMarkdown = elements.map((e) => typeof e === "string" ? e : e.outerHTML).join("");
  }
  const renderedContent = document.createElement("div");
  const sanitizerConfig = getDomSanitizerConfig(markdown, options.sanitizerConfig ?? {});
  domSanitize.safeSetInnerHtml(renderedContent, renderedMarkdown, sanitizerConfig);
  rewriteRenderedLinks(markdown, options, renderedContent);
  let outElement;
  if (target) {
    outElement = target;
    DOM.reset(target, ...renderedContent.childNodes);
  } else {
    outElement = renderedContent;
  }
  if (codeBlocks.length > 0) {
    Promise.all(codeBlocks).then((tuples) => {
      if (isDisposed) {
        return;
      }
      const renderedElements = new Map(tuples);
      const placeholderElements = outElement.querySelectorAll(`div[data-code]`);
      for (const placeholderElement of placeholderElements) {
        const renderedElement = renderedElements.get(placeholderElement.dataset["code"] ?? "");
        if (renderedElement) {
          DOM.reset(placeholderElement, renderedElement);
        }
      }
      options.asyncRenderCallback?.();
    });
  } else if (syncCodeBlocks.length > 0) {
    const renderedElements = new Map(syncCodeBlocks);
    const placeholderElements = outElement.querySelectorAll(`div[data-code]`);
    for (const placeholderElement of placeholderElements) {
      const renderedElement = renderedElements.get(placeholderElement.dataset["code"] ?? "");
      if (renderedElement) {
        DOM.reset(placeholderElement, renderedElement);
      }
    }
  }
  if (options.asyncRenderCallback) {
    for (const img of outElement.getElementsByTagName("img")) {
      const listener = disposables.add(DOM.addDisposableListener(img, "load", () => {
        listener.dispose();
        options.asyncRenderCallback();
      }));
    }
  }
  if (options.actionHandler) {
    const clickCb = (e) => {
      const mouseEvent = new StandardMouseEvent(DOM.getWindow(outElement), e);
      if (!mouseEvent.leftButton && !mouseEvent.middleButton) {
        return;
      }
      activateLink(markdown, options, mouseEvent);
    };
    disposables.add(DOM.addDisposableListener(outElement, "click", clickCb));
    disposables.add(DOM.addDisposableListener(outElement, "auxclick", clickCb));
    disposables.add(DOM.addDisposableListener(outElement, "keydown", (e) => {
      const keyboardEvent = new StandardKeyboardEvent(e);
      if (!keyboardEvent.equals(KeyCode.Space) && !keyboardEvent.equals(KeyCode.Enter)) {
        return;
      }
      activateLink(markdown, options, keyboardEvent);
    }));
  }
  for (const input of [...outElement.getElementsByTagName("input")]) {
    if (input.attributes.getNamedItem("type")?.value === "checkbox") {
      input.setAttribute("disabled", "");
    } else {
      if (options.sanitizerConfig?.replaceWithPlaintext) {
        const replacement = convertTagToPlaintext(input);
        if (replacement) {
          input.parentElement?.replaceChild(replacement, input);
        } else {
          input.remove();
        }
      } else {
        input.remove();
      }
    }
  }
  return {
    element: outElement,
    dispose: () => {
      isDisposed = true;
      disposables.dispose();
    }
  };
}
function rewriteRenderedLinks(markdown, options, root) {
  for (const el of root.querySelectorAll("img, audio, video, source")) {
    const src = el.getAttribute("src");
    if (src) {
      let href = src;
      try {
        if (markdown.baseUri) {
          href = resolveWithBaseUri(URI.from(markdown.baseUri), href);
        }
      } catch (err) {
      }
      el.setAttribute("src", massageHref(markdown, href, true));
      if (options.sanitizerConfig?.remoteImageIsAllowed) {
        const uri = URI.parse(href);
        if (uri.scheme !== Schemas.file && uri.scheme !== Schemas.data && !options.sanitizerConfig.remoteImageIsAllowed(uri)) {
          el.replaceWith(DOM.$("", void 0, el.outerHTML));
        }
      }
    }
  }
  for (const el of root.querySelectorAll("a")) {
    const href = el.getAttribute("href");
    el.setAttribute("href", "");
    if (!href || /^data:|javascript:/i.test(href) || /^command:/i.test(href) && !markdown.isTrusted || /^command:(\/\/\/)?_workbench\.downloadResource/i.test(href)) {
      el.replaceWith(...el.childNodes);
    } else {
      let resolvedHref = massageHref(markdown, href, false);
      if (markdown.baseUri) {
        resolvedHref = resolveWithBaseUri(URI.from(markdown.baseUri), href);
      }
      el.dataset.href = resolvedHref;
      if (options.actionHandler && isPortableLinkTarget(resolvedHref)) {
        el.setAttribute("href", resolvedHref);
      }
    }
  }
}
function createMarkdownRenderer(marked2, options, markdown) {
  const renderer = new marked2.Renderer(options.markedOptions);
  renderer.image = (token) => renderImage(token, (href) => options.transformUri?.(href, "image") ?? href);
  renderer.link = (token) => defaultMarkedRenderers.link.call(renderer, {
    ...token,
    href: options.transformUri?.(token.href, "link") ?? token.href
  });
  renderer.paragraph = defaultMarkedRenderers.paragraph;
  if (markdown.supportAlertSyntax) {
    renderer.blockquote = createAlertBlockquoteRenderer(renderer.blockquote);
  }
  const codeBlocks = [];
  const syncCodeBlocks = [];
  if (options.codeBlockRendererSync) {
    renderer.code = ({ text, lang, raw }) => {
      const id = defaultGenerator.nextId();
      const value = options.codeBlockRendererSync(postProcessCodeBlockLanguageId(lang), text, raw);
      syncCodeBlocks.push([id, value]);
      return `<div class="code" data-code="${id}">${escape(text)}</div>`;
    };
  } else if (options.codeBlockRenderer) {
    renderer.code = ({ text, lang }) => {
      const id = defaultGenerator.nextId();
      const value = options.codeBlockRenderer(postProcessCodeBlockLanguageId(lang), text);
      codeBlocks.push(value.then((element) => [id, element]));
      return `<div class="code" data-code="${id}">${escape(text)}</div>`;
    };
  }
  if (!markdown.supportHtml) {
    renderer.html = ({ text }) => {
      if (options.sanitizerConfig?.replaceWithPlaintext) {
        return escape(text);
      }
      const match = markdown.isTrusted ? text.match(/^(<span[^>]+>)|(<\/\s*span>)$/) : void 0;
      return match ? text : "";
    };
  }
  return { renderer, codeBlocks, syncCodeBlocks };
}
function preprocessMarkdownString(markdown) {
  let value = markdown.value;
  if (value.length > 1e5) {
    value = `${value.substr(0, 1e5)}\u2026`;
  }
  if (markdown.supportThemeIcons) {
    value = markdownEscapeEscapedIcons(value);
  }
  return value;
}
function activateLink(mdStr, options, event) {
  const target = event.target.closest("a[data-href]");
  if (!DOM.isHTMLElement(target)) {
    return;
  }
  try {
    let href = target.dataset["href"];
    if (href) {
      if (mdStr.baseUri) {
        href = resolveWithBaseUri(URI.from(mdStr.baseUri), href);
      }
      options.actionHandler?.(href, mdStr);
    }
  } catch (err) {
    onUnexpectedError(err);
  } finally {
    event.preventDefault();
    event.stopPropagation();
  }
}
function uriMassage(markdown, part) {
  let data;
  try {
    data = parse(decodeURIComponent(part));
  } catch (e) {
  }
  if (!data) {
    return part;
  }
  data = cloneAndChange(data, (value) => {
    if (markdown.uris && markdown.uris[value]) {
      return URI.revive(markdown.uris[value]);
    } else {
      return void 0;
    }
  });
  return encodeURIComponent(JSON.stringify(data));
}
function massageHref(markdown, href, isDomUri) {
  const data = markdown.uris && markdown.uris[href];
  let uri = URI.revive(data);
  if (isDomUri) {
    if (href.startsWith(Schemas.data + ":")) {
      return href;
    }
    if (!uri) {
      uri = URI.parse(href);
    }
    return FileAccess.uriToBrowserUri(uri).toString(true);
  }
  if (!uri) {
    return href;
  }
  if (URI.parse(href).toString() === uri.toString()) {
    return href;
  }
  if (uri.query) {
    uri = uri.with({ query: uriMassage(markdown, uri.query) });
  }
  return uri.toString();
}
function postProcessCodeBlockLanguageId(lang) {
  if (!lang) {
    return "";
  }
  const parts = lang.split(/[\s+|:|,|\{|\?]/, 1);
  if (parts.length) {
    return parts[0];
  }
  return lang;
}
function resolveWithBaseUri(baseUri, href) {
  const hasScheme = /^\w[\w\d+.-]*:/.test(href);
  if (hasScheme) {
    return href;
  }
  if (baseUri.path.endsWith("/")) {
    return resolvePath(baseUri, href).toString();
  } else {
    return resolvePath(dirname(baseUri), href).toString();
  }
}
function sanitizeRenderedMarkdown(renderedMarkdown, originalMdStrConfig, options = {}) {
  const sanitizerConfig = getDomSanitizerConfig(originalMdStrConfig, options);
  return domSanitize.sanitizeHtml(renderedMarkdown, sanitizerConfig);
}
const allowedMarkdownHtmlTags = Object.freeze([
  ...domSanitize.basicMarkupHtmlTags,
  "input"
  // Allow inputs for rendering checkboxes. Other types of inputs are removed and the inputs are always disabled
]);
const allowedMarkdownHtmlAttributes = Object.freeze([
  "align",
  "autoplay",
  "alt",
  "colspan",
  "controls",
  "draggable",
  "height",
  "href",
  "loop",
  "muted",
  "playsinline",
  "poster",
  "rowspan",
  "src",
  "target",
  "title",
  "type",
  "width",
  "start",
  // Input (For disabled inputs)
  "checked",
  "disabled",
  "value",
  // Custom markdown attributes
  "data-code",
  "data-href",
  "data-severity",
  // Only allow very specific styles
  {
    attributeName: "style",
    shouldKeep: (element, data) => {
      if (element.tagName === "SPAN") {
        if (data.attrName === "style") {
          return /^(color\:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z0-9]+)+\));)?(background-color\:(#[0-9a-fA-F]+|var\(--vscode(-[a-zA-Z0-9]+)+\));)?(border-radius:[0-9]+px;)?$/.test(data.attrValue);
        }
      }
      return false;
    }
  },
  // Only allow codicons for classes
  {
    attributeName: "class",
    shouldKeep: (element, data) => {
      if (element.tagName === "SPAN") {
        if (data.attrName === "class") {
          return /^codicon codicon-[a-z\-]+( codicon-modifier-[a-z\-]+)?$/.test(data.attrValue);
        }
      }
      return false;
    }
  }
]);
function getDomSanitizerConfig(mdStrConfig, options) {
  const isTrusted = mdStrConfig.isTrusted ?? false;
  const allowedLinkSchemes = [
    Schemas.http,
    Schemas.https,
    Schemas.mailto,
    Schemas.file,
    Schemas.vscodeFileResource,
    Schemas.vscodeRemote,
    Schemas.vscodeRemoteResource,
    Schemas.vscodeNotebookCell,
    // For links that are handled entirely by the action handler
    Schemas.internal
  ];
  if (isTrusted) {
    allowedLinkSchemes.push(Schemas.command);
  }
  if (options.allowedLinkSchemes?.augment) {
    allowedLinkSchemes.push(...options.allowedLinkSchemes.augment);
  }
  return {
    // allowedTags should included everything that markdown renders to.
    // Since we have our own sanitize function for marked, it's possible we missed some tag so let dompurify make sure.
    // HTML tags that can result from markdown are from reading https://spec.commonmark.org/0.29/
    // HTML table tags that can result from markdown are from https://github.github.com/gfm/#tables-extension-
    allowedTags: {
      override: options.allowedTags?.override ?? allowedMarkdownHtmlTags
    },
    allowedAttributes: {
      override: options.allowedAttributes?.override ?? allowedMarkdownHtmlAttributes
    },
    allowedLinkProtocols: {
      override: allowedLinkSchemes
    },
    allowRelativeLinkPaths: !!mdStrConfig.baseUri,
    allowedMediaProtocols: {
      override: [
        Schemas.http,
        Schemas.https,
        Schemas.data,
        Schemas.file,
        Schemas.vscodeFileResource,
        Schemas.vscodeRemote,
        Schemas.vscodeRemoteResource
      ]
    },
    allowRelativeMediaPaths: !!mdStrConfig.baseUri,
    replaceWithPlaintext: options.replaceWithPlaintext
  };
}
function renderAsPlaintext(str, options) {
  if (typeof str === "string") {
    return str;
  }
  let value = str.value ?? "";
  if (value.length > 1e5) {
    value = `${value.substr(0, 1e5)}\u2026`;
  }
  const renderer = createPlainTextRenderer();
  if (options?.includeCodeBlocksFences) {
    renderer.code = codeBlockFences;
  }
  if (options?.useLinkFormatter) {
    renderer.link = linkFormatter;
  }
  const html = marked.parse(value, { async: false, renderer });
  return sanitizeRenderedMarkdown(html, { isTrusted: false }, {}).toString().replace(/&(#\d+|[a-zA-Z]+);/g, (m) => unescapeInfo.get(m) ?? m).trim();
}
const unescapeInfo = /* @__PURE__ */ new Map([
  ["&quot;", '"'],
  ["&nbsp;", " "],
  ["&amp;", "&"],
  ["&#39;", "'"],
  ["&lt;", "<"],
  ["&gt;", ">"]
]);
function createPlainTextRenderer() {
  const renderer = new marked.Renderer();
  renderer.code = ({ text }) => {
    return escape(text);
  };
  renderer.blockquote = ({ text }) => {
    return text + "\n";
  };
  renderer.html = (_) => {
    return "";
  };
  renderer.heading = function({ tokens }) {
    return this.parser.parseInline(tokens) + "\n";
  };
  renderer.hr = () => {
    return "";
  };
  renderer.list = function({ items }) {
    return items.map((x) => this.listitem(x)).join("\n") + "\n";
  };
  renderer.listitem = ({ text }) => {
    return text + "\n";
  };
  renderer.paragraph = function({ tokens }) {
    return this.parser.parseInline(tokens) + "\n";
  };
  renderer.table = function({ header, rows }) {
    return header.map((cell) => this.tablecell(cell)).join(" ") + "\n" + rows.map((cells) => cells.map((cell) => this.tablecell(cell)).join(" ")).join("\n") + "\n";
  };
  renderer.tablerow = ({ text }) => {
    return text;
  };
  renderer.tablecell = function({ tokens }) {
    return this.parser.parseInline(tokens);
  };
  renderer.strong = ({ text }) => {
    return text;
  };
  renderer.em = ({ text }) => {
    return text;
  };
  renderer.codespan = ({ text }) => {
    return text;
  };
  renderer.br = (_) => {
    return "\n";
  };
  renderer.del = ({ text }) => {
    return text;
  };
  renderer.image = (_) => {
    return "";
  };
  renderer.text = ({ text }) => {
    return text;
  };
  renderer.link = ({ text }) => {
    return text;
  };
  return renderer;
}
const codeBlockFences = ({ text }) => {
  return `
\`\`\`
${escape(text)}
\`\`\`
`;
};
const linkFormatter = ({ text, href }) => {
  try {
    if (href) {
      const uri = URI.parse(href);
      return text.trim() || basename(uri);
    }
  } catch (e) {
    return text.trim() || pathBasename(href);
  }
  return text;
};
function mergeRawTokenText(tokens) {
  let mergedTokenText = "";
  tokens.forEach((token) => {
    mergedTokenText += token.raw;
  });
  return mergedTokenText;
}
function completeSingleLinePattern(token) {
  if (!token.tokens) {
    return void 0;
  }
  for (let i = token.tokens.length - 1; i >= 0; i--) {
    const subtoken = token.tokens[i];
    if (subtoken.type === "text") {
      const lines = subtoken.raw.split("\n");
      const lastLine = lines[lines.length - 1];
      if (
        // Text with start of link target
        hasLinkTextAndStartOfLinkTarget(lastLine) || // This token doesn't have the link text, eg if it contains other markdown constructs that are in other subtokens.
        // But some preceding token does have an unbalanced [ at least
        hasStartOfLinkTargetAndNoLinkText(lastLine) && token.tokens.slice(0, i).some((t) => t.type === "text" && t.raw.match(/\[[^\]]*$/))
      ) {
        const nextTwoSubTokens = token.tokens.slice(i + 1);
        if (
          // If the link was parsed as a link, then look for a link token and a text token with a quote
          nextTwoSubTokens[0]?.type === "link" && nextTwoSubTokens[1]?.type === "text" && nextTwoSubTokens[1].raw.match(/^ *"[^"]*$/) || // And if the link was not parsed as a link (eg command link), just look for a single quote in this token
          lastLine.match(/^[^"]* +"[^"]*$/)
        ) {
          return completeLinkTargetArg(token);
        }
        return completeLinkTarget(token);
      } else if (lastLine.includes("`")) {
        return completeCodespan(token);
      } else if (lastLine.includes("**")) {
        return completeDoublestar(token);
      } else if (lastLine.match(/\*\w/)) {
        return completeStar(token);
      } else if (lastLine.match(/(^|\s)__\w/)) {
        return completeDoubleUnderscore(token);
      } else if (lastLine.match(/(^|\s)_\w/)) {
        return completeUnderscore(token);
      } else if (lastLine.match(/(^|\s)\[\w*[^\]]*$/)) {
        return completeLinkText(token);
      }
    }
  }
  return void 0;
}
function hasLinkTextAndStartOfLinkTarget(str) {
  return !!str.match(/(?:^|[\s(*_~])\[.*\]\(\w*/);
}
function hasStartOfLinkTargetAndNoLinkText(str) {
  return !!str.match(/^[^\[]*\]\([^\)]*$/);
}
function completeBlockquotePattern(blockquote, links) {
  let lastInterestingIndex = blockquote.tokens.length - 1;
  while (lastInterestingIndex >= 0 && blockquote.tokens[lastInterestingIndex].type === "space") {
    lastInterestingIndex--;
  }
  const lastToken = blockquote.tokens[lastInterestingIndex];
  if (lastToken?.type !== "paragraph") {
    return void 0;
  }
  const completedToken = completeSingleLinePattern(lastToken);
  if (!completedToken) {
    return void 0;
  }
  const completion = completedToken.raw.slice(lastToken.raw.trimEnd().length);
  const trailingQuoteOnlyLines = blockquote.raw.match(/(?:\n[ \t]*>[ \t]*(?=\n|$))+\n?$/)?.[0] ?? "";
  const insertionIndex = blockquote.raw.length - trailingQuoteOnlyLines.length;
  const completedRaw = blockquote.raw.slice(0, insertionIndex) + completion + trailingQuoteOnlyLines;
  const lexer = new marked.Lexer();
  lexer.tokens.links = links;
  const completedBlockquote = lexer.lex(completedRaw)[0];
  if (completedBlockquote.type === "blockquote") {
    return completedBlockquote;
  }
  return void 0;
}
function completeListItemPattern(list) {
  const lastListItem = list.items[list.items.length - 1];
  const lastListSubToken = lastListItem.tokens ? lastListItem.tokens[lastListItem.tokens.length - 1] : void 0;
  const listEndsInHeading = (list2) => {
    const lastItem = list2.items.at(-1);
    const lastToken = lastItem?.tokens.at(-1);
    return lastToken?.type === "heading" || lastToken?.type === "list" && listEndsInHeading(lastToken);
  };
  let newToken;
  if (lastListSubToken?.type === "text" && !("inRawBlock" in lastListItem)) {
    newToken = completeSingleLinePattern(lastListSubToken);
  } else if (listEndsInHeading(list)) {
    const newList2 = marked.lexer(list.raw.trim() + " &nbsp;")[0];
    if (newList2.type !== "list") {
      return;
    }
    return newList2;
  }
  if (!newToken || newToken.type !== "paragraph") {
    return;
  }
  const previousListItemsText = mergeRawTokenText(list.items.slice(0, -1));
  const lastListItemLead = lastListItem.raw.match(/^(\s*(-|\d+\.|\*) +)/)?.[0];
  if (!lastListItemLead) {
    return;
  }
  const newListItemText = lastListItemLead + mergeRawTokenText(lastListItem.tokens.slice(0, -1)) + newToken.raw;
  const newList = marked.lexer(previousListItemsText + newListItemText)[0];
  if (newList.type !== "list") {
    return;
  }
  return newList;
}
function completeHeading(token, fullRawText) {
  if (token.raw.match(/-\s*$/)) {
    return marked.lexer(fullRawText + " &nbsp;");
  }
}
const maxIncompleteTokensFixRounds = 3;
function fillInIncompleteTokens(tokens) {
  for (let i = 0; i < maxIncompleteTokensFixRounds; i++) {
    const newTokens = fillInIncompleteTokensOnce(tokens);
    if (newTokens) {
      tokens = newTokens;
    } else {
      break;
    }
  }
  return tokens;
}
function fillInIncompleteTokensOnce(tokens) {
  let i;
  let newTokens;
  for (i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === "paragraph" && token.raw.match(/(\n|^)\|/)) {
      newTokens = completeTable(tokens.slice(i));
      break;
    }
  }
  let lastInterestingIdx = tokens.length - 1;
  while (lastInterestingIdx >= 0 && (tokens[lastInterestingIdx].type === "space" || tokens[lastInterestingIdx].type === "html")) {
    lastInterestingIdx--;
  }
  const lastInterestingToken = lastInterestingIdx >= 0 ? tokens[lastInterestingIdx] : void 0;
  const trailingTokens = tokens.slice(lastInterestingIdx + 1);
  if (!newTokens && lastInterestingToken?.type === "list") {
    const newListToken = completeListItemPattern(lastInterestingToken);
    if (newListToken) {
      newTokens = [newListToken, ...trailingTokens];
      i = lastInterestingIdx;
    }
  }
  if (!newTokens && lastInterestingToken?.type === "blockquote") {
    const newBlockquoteToken = completeBlockquotePattern(lastInterestingToken, tokens.links);
    if (newBlockquoteToken) {
      newTokens = [newBlockquoteToken, ...trailingTokens];
      i = lastInterestingIdx;
    }
  }
  if (!newTokens && lastInterestingToken?.type === "paragraph") {
    const newToken = completeSingleLinePattern(lastInterestingToken);
    if (newToken) {
      newTokens = [newToken, ...trailingTokens];
      i = lastInterestingIdx;
    }
  }
  if (newTokens) {
    const newTokensList = [
      ...tokens.slice(0, i),
      ...newTokens
    ];
    newTokensList.links = tokens.links;
    return newTokensList;
  }
  const lastToken = tokens.at(-1);
  if (lastToken?.type === "heading") {
    const completeTokens = completeHeading(lastToken, mergeRawTokenText(tokens));
    if (completeTokens) {
      return completeTokens;
    }
  }
  return null;
}
function completeCodespan(token) {
  return completeWithString(token, "`");
}
function completeStar(tokens) {
  return completeWithString(tokens, "*");
}
function completeUnderscore(tokens) {
  return completeWithString(tokens, "_");
}
function completeLinkTarget(tokens) {
  return completeWithString(tokens, ")", false);
}
function completeLinkTargetArg(tokens) {
  return completeWithString(tokens, '")', false);
}
function completeLinkText(tokens) {
  return completeWithString(tokens, "](https://microsoft.com)", false);
}
function completeDoublestar(tokens) {
  return completeWithString(tokens, "**");
}
function completeDoubleUnderscore(tokens) {
  return completeWithString(tokens, "__");
}
function completeWithString(tokens, closingString, shouldTrim = true) {
  const mergedRawText = mergeRawTokenText(Array.isArray(tokens) ? tokens : [tokens]);
  const trimmedRawText = shouldTrim ? mergedRawText.trimEnd() : mergedRawText;
  return marked.lexer(trimmedRawText + closingString)[0];
}
function completeTable(tokens) {
  const mergedRawText = mergeRawTokenText(tokens);
  const lines = mergedRawText.split("\n");
  let numCols;
  let hasSeparatorRow = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (typeof numCols === "undefined" && line.match(/^\s*\|/)) {
      const line1Matches = line.match(/(\|[^\|]+)(?=\||$)/g);
      if (line1Matches) {
        numCols = line1Matches.length;
      }
    } else if (typeof numCols === "number") {
      if (line.match(/^\s*\|/)) {
        if (i !== lines.length - 1) {
          return void 0;
        }
        hasSeparatorRow = true;
      } else {
        return void 0;
      }
    }
  }
  if (typeof numCols === "number" && numCols > 0) {
    const prefixText = hasSeparatorRow ? lines.slice(0, -1).join("\n") : mergedRawText;
    const line1EndsInPipe = !!prefixText.match(/\|\s*$/);
    const newRawText = prefixText + (line1EndsInPipe ? "" : "|") + `
|${" --- |".repeat(numCols)}`;
    return marked.lexer(newRawText);
  }
  return void 0;
}
export {
  allowedMarkdownHtmlAttributes,
  allowedMarkdownHtmlTags,
  fillInIncompleteTokens,
  renderAsPlaintext,
  renderMarkdown
};
