import { parse as jsonParse, getNodeType } from "../../../../base/common/json.js";
import { localize } from "../../../../nls.js";
import { extname, basename } from "../../../../base/common/path.js";
import { SnippetParser, Variable, Placeholder, Text } from "../../../../editor/contrib/snippet/browser/snippetParser.js";
import { KnownSnippetVariableNames } from "../../../../editor/contrib/snippet/browser/snippetVariables.js";
import { relativePath } from "../../../../base/common/resources.js";
import { isObject } from "../../../../base/common/types.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { WindowIdleValue, getActiveWindow } from "../../../../base/browser/dom.js";
import { match as matchGlob } from "../../../../base/common/glob.js";
import { Schemas } from "../../../../base/common/network.js";
class SnippetBodyInsights {
  constructor(body) {
    this.isBogous = false;
    this.isTrivial = false;
    this.usesClipboardVariable = false;
    this.usesSelectionVariable = false;
    this.codeSnippet = body;
    const textmateSnippet = new SnippetParser().parse(body, false);
    const placeholders = /* @__PURE__ */ new Map();
    let placeholderMax = 0;
    for (const placeholder of textmateSnippet.placeholders) {
      placeholderMax = Math.max(placeholderMax, placeholder.index);
    }
    if (textmateSnippet.placeholders.length === 0) {
      this.isTrivial = true;
    } else if (placeholderMax === 0) {
      const last = textmateSnippet.children.at(-1);
      this.isTrivial = last instanceof Placeholder && last.isFinalTabstop;
    }
    const stack = [...textmateSnippet.children];
    while (stack.length > 0) {
      const marker = stack.shift();
      if (marker instanceof Variable) {
        if (marker.children.length === 0 && !KnownSnippetVariableNames[marker.name]) {
          const index = placeholders.has(marker.name) ? placeholders.get(marker.name) : ++placeholderMax;
          placeholders.set(marker.name, index);
          const synthetic = new Placeholder(index).appendChild(new Text(marker.name));
          textmateSnippet.replace(marker, [synthetic]);
          this.isBogous = true;
        }
        switch (marker.name) {
          case "CLIPBOARD":
            this.usesClipboardVariable = true;
            break;
          case "SELECTION":
          case "TM_SELECTED_TEXT":
            this.usesSelectionVariable = true;
            break;
        }
      } else {
        stack.push(...marker.children);
      }
    }
    if (this.isBogous) {
      this.codeSnippet = textmateSnippet.toTextmateString();
    }
  }
}
class Snippet {
  constructor(isFileTemplate, scopes, name, prefix, description, body, source, snippetSource, snippetIdentifier, include, exclude, extensionId) {
    this.isFileTemplate = isFileTemplate;
    this.scopes = scopes;
    this.name = name;
    this.prefix = prefix;
    this.description = description;
    this.body = body;
    this.source = source;
    this.snippetSource = snippetSource;
    this.snippetIdentifier = snippetIdentifier;
    this.include = include;
    this.exclude = exclude;
    this.extensionId = extensionId;
    this.prefixLow = prefix.toLowerCase();
    this._bodyInsights = new WindowIdleValue(getActiveWindow(), () => new SnippetBodyInsights(this.body));
  }
  get codeSnippet() {
    return this._bodyInsights.value.codeSnippet;
  }
  get isBogous() {
    return this._bodyInsights.value.isBogous;
  }
  get isTrivial() {
    return this._bodyInsights.value.isTrivial;
  }
  get needsClipboard() {
    return this._bodyInsights.value.usesClipboardVariable;
  }
  get usesSelection() {
    return this._bodyInsights.value.usesSelectionVariable;
  }
  isFileIncluded(resourceUri) {
    const uriPath = resourceUri.scheme === Schemas.file ? resourceUri.fsPath : resourceUri.path;
    const fileName = basename(uriPath);
    const getMatchTarget = (pattern) => {
      return pattern.includes("/") ? uriPath : fileName;
    };
    if (this.exclude) {
      for (const pattern of this.exclude.filter(Boolean)) {
        if (matchGlob(pattern, getMatchTarget(pattern), { ignoreCase: true })) {
          return false;
        }
      }
    }
    if (this.include) {
      for (const pattern of this.include.filter(Boolean)) {
        if (matchGlob(pattern, getMatchTarget(pattern), { ignoreCase: true })) {
          return true;
        }
      }
      return false;
    }
    return true;
  }
}
function isJsonSerializedSnippet(thing) {
  return isObject(thing) && Boolean(thing.body);
}
var SnippetSource = /* @__PURE__ */ ((SnippetSource2) => {
  SnippetSource2[SnippetSource2["User"] = 1] = "User";
  SnippetSource2[SnippetSource2["Workspace"] = 2] = "Workspace";
  SnippetSource2[SnippetSource2["Extension"] = 3] = "Extension";
  return SnippetSource2;
})(SnippetSource || {});
class SnippetFile {
  constructor(source, location, defaultScopes, _extension, _fileService, _extensionResourceLoaderService) {
    this.source = source;
    this.location = location;
    this.defaultScopes = defaultScopes;
    this._extension = _extension;
    this._fileService = _fileService;
    this._extensionResourceLoaderService = _extensionResourceLoaderService;
    this.data = [];
    this.isGlobalSnippets = extname(location.path) === ".code-snippets";
    this.isUserSnippets = !this._extension;
  }
  select(selector, bucket) {
    if (this.isGlobalSnippets || !this.isUserSnippets) {
      this._scopeSelect(selector, bucket);
    } else {
      this._filepathSelect(selector, bucket);
    }
  }
  _filepathSelect(selector, bucket) {
    if (selector + ".json" === basename(this.location.path)) {
      bucket.push(...this.data);
    }
  }
  _scopeSelect(selector, bucket) {
    for (const snippet of this.data) {
      const len = snippet.scopes.length;
      if (len === 0) {
        bucket.push(snippet);
      } else {
        for (let i = 0; i < len; i++) {
          if (snippet.scopes[i] === selector) {
            bucket.push(snippet);
            break;
          }
        }
      }
    }
    const idx = selector.lastIndexOf(".");
    if (idx >= 0) {
      this._scopeSelect(selector.substring(0, idx), bucket);
    }
  }
  async _load() {
    if (this._extension) {
      return this._extensionResourceLoaderService.readExtensionResource(this.location);
    } else {
      const content = await this._fileService.readFile(this.location);
      return content.value.toString();
    }
  }
  load() {
    if (!this._loadPromise) {
      this._loadPromise = Promise.resolve(this._load()).then((content) => {
        const data = jsonParse(content);
        if (getNodeType(data) === "object") {
          for (const [name, scopeOrTemplate] of Object.entries(data)) {
            if (isJsonSerializedSnippet(scopeOrTemplate)) {
              this._parseSnippet(name, scopeOrTemplate, this.data);
            } else {
              for (const [name2, template] of Object.entries(scopeOrTemplate)) {
                this._parseSnippet(name2, template, this.data);
              }
            }
          }
        }
        return this;
      });
    }
    return this._loadPromise;
  }
  reset() {
    this._loadPromise = void 0;
    this.data.length = 0;
  }
  _parseSnippet(name, snippet, bucket) {
    let { isFileTemplate, prefix, body, description } = snippet;
    if (!prefix) {
      prefix = "";
    }
    if (Array.isArray(body)) {
      body = body.join("\n");
    }
    if (typeof body !== "string") {
      return;
    }
    if (Array.isArray(description)) {
      description = description.join("\n");
    }
    let scopes;
    if (this.defaultScopes) {
      scopes = this.defaultScopes;
    } else if (typeof snippet.scope === "string") {
      scopes = snippet.scope.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      scopes = [];
    }
    let include;
    if (snippet.include) {
      if (Array.isArray(snippet.include)) {
        include = snippet.include;
      } else if (typeof snippet.include === "string") {
        include = [snippet.include];
      }
    }
    let exclude;
    if (snippet.exclude) {
      if (Array.isArray(snippet.exclude)) {
        exclude = snippet.exclude;
      } else if (typeof snippet.exclude === "string") {
        exclude = [snippet.exclude];
      }
    }
    let source;
    if (this._extension) {
      source = this._extension.displayName || this._extension.name;
    } else if (this.source === 2 /* Workspace */) {
      source = localize("source.workspaceSnippetGlobal", "Workspace Snippet");
    } else {
      if (this.isGlobalSnippets) {
        source = localize("source.userSnippetGlobal", "Global User Snippet");
      } else {
        source = localize("source.userSnippet", "User Snippet");
      }
    }
    for (const _prefix of Iterable.wrap(prefix)) {
      bucket.push(new Snippet(
        Boolean(isFileTemplate),
        scopes,
        name,
        _prefix,
        description,
        body,
        source,
        this.source,
        this._extension ? `${relativePath(this._extension.extensionLocation, this.location)}/${name}` : `${basename(this.location.path)}/${name}`,
        include,
        exclude,
        this._extension?.identifier
      ));
    }
  }
}
export {
  Snippet,
  SnippetFile,
  SnippetSource
};
