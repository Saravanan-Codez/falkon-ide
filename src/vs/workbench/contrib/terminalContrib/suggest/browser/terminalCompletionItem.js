import { basename } from "../../../../../base/common/path.js";
import { CompletionItemKind } from "../../../../../editor/common/languages.js";
import { SimpleCompletionItem } from "../../../../services/suggest/browser/simpleCompletionItem.js";
var TerminalCompletionItemKind = /* @__PURE__ */ ((TerminalCompletionItemKind2) => {
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["File"] = 0] = "File";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Folder"] = 1] = "Folder";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Method"] = 2] = "Method";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Alias"] = 3] = "Alias";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Argument"] = 4] = "Argument";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Option"] = 5] = "Option";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["OptionValue"] = 6] = "OptionValue";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Flag"] = 7] = "Flag";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["SymbolicLinkFile"] = 8] = "SymbolicLinkFile";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["SymbolicLinkFolder"] = 9] = "SymbolicLinkFolder";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Commit"] = 10] = "Commit";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Branch"] = 11] = "Branch";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Tag"] = 12] = "Tag";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Stash"] = 13] = "Stash";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["Remote"] = 14] = "Remote";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["PullRequest"] = 15] = "PullRequest";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["PullRequestDone"] = 16] = "PullRequestDone";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["InlineSuggestion"] = 100] = "InlineSuggestion";
  TerminalCompletionItemKind2[TerminalCompletionItemKind2["InlineSuggestionAlwaysOnTop"] = 101] = "InlineSuggestionAlwaysOnTop";
  return TerminalCompletionItemKind2;
})(TerminalCompletionItemKind || {});
function mapLspKindToTerminalKind(lspKind) {
  switch (lspKind) {
    case CompletionItemKind.File:
      return 0 /* File */;
    case CompletionItemKind.Folder:
      return 1 /* Folder */;
    case CompletionItemKind.Method:
      return 2 /* Method */;
    case CompletionItemKind.Text:
      return 4 /* Argument */;
    // consider adding new type?
    case CompletionItemKind.Variable:
      return 4 /* Argument */;
    // ""
    case CompletionItemKind.EnumMember:
      return 6 /* OptionValue */;
    // ""
    case CompletionItemKind.Keyword:
      return 3 /* Alias */;
    default:
      return 2 /* Method */;
  }
}
class TerminalCompletionItem extends SimpleCompletionItem {
  constructor(completion, pathSeparator) {
    super(completion);
    this.completion = completion;
    /**
     * The file extension part from {@link labelLow}.
     */
    this.fileExtLow = "";
    /**
     * A penalty that applies to completions that are comprised of only punctuation characters or
     * that applies to files or folders starting with the underscore character.
     */
    this.punctuationPenalty = 0;
    const detectedSeparator = pathSeparator ?? (this.labelLow.includes("\\") ? "\\" : void 0);
    const useWindowsStylePath = detectedSeparator === "\\";
    this.labelLowExcludeFileExt = this.labelLow;
    this.labelLowNormalizedPath = this.labelLow;
    if (isFile(completion) || completion.kind === 11 /* Branch */) {
      if (useWindowsStylePath) {
        this.labelLow = this.labelLow.replaceAll("/", "\\");
      }
    }
    if (isFile(completion)) {
      const extIndex = this.labelLow.lastIndexOf(".");
      if (extIndex > 0) {
        this.labelLowExcludeFileExt = this.labelLow.substring(0, extIndex);
        this.fileExtLow = this.labelLow.substring(extIndex + 1);
      }
    }
    if (isFile(completion) || completion.kind === 1 /* Folder */) {
      if (useWindowsStylePath) {
        this.labelLowNormalizedPath = this.labelLow.replaceAll("\\", "/");
      }
      if (completion.kind === 1 /* Folder */) {
        this.labelLowNormalizedPath = this.labelLowNormalizedPath.replace(/\/$/, "");
      }
    }
    this.punctuationPenalty = shouldPenalizeForPunctuation(this.labelLowExcludeFileExt) ? 1 : 0;
  }
  /**
   * Resolves the completion item's details lazily when needed.
   */
  async resolve(token) {
    if (this.resolveCache) {
      return this.resolveCache;
    }
    const unresolvedItem = this.completion._unresolvedItem;
    const provider = this.completion._resolveProvider;
    if (!unresolvedItem || !provider || !provider.resolveCompletionItem) {
      return;
    }
    this.resolveCache = (async () => {
      try {
        const resolved = await provider.resolveCompletionItem(unresolvedItem, token);
        if (resolved) {
          if (resolved.detail) {
            this.completion.detail = resolved.detail;
          }
          if (resolved.documentation) {
            this.completion.documentation = resolved.documentation;
          }
        }
      } catch (error) {
        return;
      }
    })();
    return this.resolveCache;
  }
}
function isFile(completion) {
  return !!(completion.kind === 0 /* File */ || completion.isFileOverride);
}
function shouldPenalizeForPunctuation(label) {
  return basename(label).startsWith("_") || /^[\[\]\{\}\(\)\.,;:!?\/\\\-_@#~*%^=$]+$/.test(label);
}
export {
  TerminalCompletionItem,
  TerminalCompletionItemKind,
  mapLspKindToTerminalKind
};
