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
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { localize } from "../../../../nls.js";
import { PickerQuickAccessProvider, TriggerAction } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { ThrottledDelayer } from "../../../../base/common/async.js";
import { getWorkspaceSymbols } from "../common/search.js";
import { SymbolKinds, SymbolTag, SymbolKind } from "../../../../editor/common/languages.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { Schemas } from "../../../../base/common/network.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from "../../../services/editor/common/editorService.js";
import { Range } from "../../../../editor/common/core/range.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { getSelectionSearchString } from "../../../../editor/contrib/find/browser/findController.js";
import { prepareQuery, scoreFuzzy2, pieceToQuery } from "../../../../base/common/fuzzyScorer.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
let SymbolsQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(labelService, openerService, editorService, configurationService, codeEditorService, chatWidgetService) {
    super(SymbolsQuickAccessProvider.PREFIX, {
      canAcceptInBackground: true,
      noResultsPick: {
        label: localize("noSymbolResults", "No matching workspace symbols")
      }
    });
    this.labelService = labelService;
    this.openerService = openerService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.codeEditorService = codeEditorService;
    this.chatWidgetService = chatWidgetService;
    this.delayer = this._register(new ThrottledDelayer(SymbolsQuickAccessProvider.TYPING_SEARCH_DELAY));
  }
  static {
    this.PREFIX = "#";
  }
  static {
    this.TYPING_SEARCH_DELAY = 200;
  }
  static {
    // this delay accommodates for the user typing a word and then stops typing to start searching
    this.TREAT_AS_GLOBAL_SYMBOL_TYPES = /* @__PURE__ */ new Set([
      SymbolKind.Class,
      SymbolKind.Enum,
      SymbolKind.File,
      SymbolKind.Interface,
      SymbolKind.Namespace,
      SymbolKind.Package,
      SymbolKind.Module
    ]);
  }
  get defaultFilterValue() {
    const editor = this.codeEditorService.getFocusedCodeEditor();
    if (editor) {
      return getSelectionSearchString(editor) ?? void 0;
    }
    return void 0;
  }
  get configuration() {
    const editorConfig = this.configurationService.getValue().workbench?.editor;
    return {
      openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview,
      openSideBySideDirection: editorConfig?.openSideBySideDirection
    };
  }
  _getPicks(filter, disposables, token) {
    return this.getSymbolPicks(filter, void 0, token);
  }
  async getSymbolPicks(filter, options, token) {
    return this.delayer.trigger(async () => {
      if (token.isCancellationRequested) {
        return [];
      }
      return this.doGetSymbolPicks(prepareQuery(filter), options, token);
    }, options?.delay);
  }
  async doGetSymbolPicks(query, options, token) {
    let symbolQuery;
    let containerQuery;
    if (query.values && query.values.length > 1) {
      symbolQuery = pieceToQuery(query.values[0]);
      containerQuery = pieceToQuery(query.values.slice(1));
    } else {
      symbolQuery = query;
    }
    const workspaceSymbols = await getWorkspaceSymbols(symbolQuery.original, token);
    if (token.isCancellationRequested) {
      return [];
    }
    const symbolPicks = [];
    const openSideBySideDirection = this.configuration.openSideBySideDirection;
    for (const { symbol, provider } of workspaceSymbols) {
      if (options?.skipLocal && !SymbolsQuickAccessProvider.TREAT_AS_GLOBAL_SYMBOL_TYPES.has(symbol.kind) && !!symbol.containerName) {
        continue;
      }
      const symbolLabel = symbol.name;
      let symbolScore = void 0;
      let symbolMatches = void 0;
      let skipContainerQuery = false;
      if (symbolQuery.original.length > 0) {
        if (symbolQuery !== query) {
          [symbolScore, symbolMatches] = scoreFuzzy2(symbolLabel, {
            ...query,
            values: void 0
            /* disable multi-query support */
          }, 0, 0);
          if (typeof symbolScore === "number") {
            skipContainerQuery = true;
          }
        }
        if (typeof symbolScore !== "number") {
          [symbolScore, symbolMatches] = scoreFuzzy2(symbolLabel, symbolQuery, 0, 0);
          if (typeof symbolScore !== "number") {
            continue;
          }
        }
      }
      const symbolUri = symbol.location.uri;
      let containerLabel = void 0;
      if (symbolUri) {
        const containerPath = this.labelService.getUriLabel(symbolUri, { relative: true });
        if (symbol.containerName) {
          containerLabel = `${symbol.containerName} \u2022 ${containerPath}`;
        } else {
          containerLabel = containerPath;
        }
      }
      let containerScore = void 0;
      let containerMatches = void 0;
      if (!skipContainerQuery && containerQuery && containerQuery.original.length > 0) {
        if (containerLabel) {
          [containerScore, containerMatches] = scoreFuzzy2(containerLabel, containerQuery);
        }
        if (typeof containerScore !== "number") {
          continue;
        }
        if (typeof symbolScore === "number") {
          symbolScore += containerScore;
        }
      }
      const deprecated = symbol.tags ? symbol.tags.indexOf(SymbolTag.Deprecated) >= 0 : false;
      symbolPicks.push({
        symbol,
        resource: symbolUri,
        score: symbolScore,
        iconClass: ThemeIcon.asClassName(SymbolKinds.toIcon(symbol.kind)),
        label: symbolLabel,
        ariaLabel: symbolLabel,
        highlights: deprecated ? void 0 : {
          label: symbolMatches,
          description: containerMatches
        },
        description: containerLabel,
        strikethrough: deprecated,
        buttons: [
          {
            iconClass: openSideBySideDirection === "right" ? ThemeIcon.asClassName(Codicon.splitHorizontal) : ThemeIcon.asClassName(Codicon.splitVertical),
            tooltip: openSideBySideDirection === "right" ? localize("openToSide", "Open to the Side") : localize("openToBottom", "Open to the Bottom")
          }
        ],
        trigger: (buttonIndex, keyMods) => {
          this.openSymbol(provider, symbol, token, { keyMods, forceOpenSideBySide: true });
          return TriggerAction.CLOSE_PICKER;
        },
        accept: async (keyMods, event) => this.openSymbol(provider, symbol, token, { keyMods, preserveFocus: event.inBackground, forcePinned: event.inBackground }),
        attach: (keyMods, event) => {
          if (keyMods.shift) {
            const widget = this.chatWidgetService.lastFocusedWidget;
            if (widget) {
              const entry = {
                kind: "symbol",
                id: JSON.stringify({ uri: symbolUri.toString(), range: symbol.location.range }),
                name: symbol.name,
                value: symbol.location,
                symbolKind: symbol.kind
              };
              widget.attachmentModel.addContext(entry);
            }
            return;
          }
          this.openSymbol(provider, symbol, token, { keyMods, preserveFocus: event.inBackground, forcePinned: event.inBackground });
        }
      });
    }
    if (!options?.skipSorting) {
      symbolPicks.sort((symbolA, symbolB) => this.compareSymbols(symbolA, symbolB));
    }
    return symbolPicks;
  }
  async openSymbol(provider, symbol, token, options) {
    let symbolToOpen = symbol;
    if (typeof provider.resolveWorkspaceSymbol === "function") {
      symbolToOpen = await provider.resolveWorkspaceSymbol(symbol, token) || symbol;
      if (token.isCancellationRequested) {
        return;
      }
    }
    if (symbolToOpen.location.uri.scheme === Schemas.http || symbolToOpen.location.uri.scheme === Schemas.https) {
      await this.openerService.open(symbolToOpen.location.uri, { fromUserGesture: true, allowContributedOpeners: true });
    } else {
      await this.editorService.openEditor({
        resource: symbolToOpen.location.uri,
        options: {
          preserveFocus: options?.preserveFocus,
          pinned: options.keyMods.ctrlCmd || options.forcePinned || this.configuration.openEditorPinned,
          selection: symbolToOpen.location.range ? Range.collapseToStart(symbolToOpen.location.range) : void 0
        }
      }, options.keyMods.alt || this.configuration.openEditorPinned && options.keyMods.ctrlCmd || options?.forceOpenSideBySide ? SIDE_GROUP : ACTIVE_GROUP);
    }
  }
  compareSymbols(symbolA, symbolB) {
    if (typeof symbolA.score === "number" && typeof symbolB.score === "number") {
      if (symbolA.score > symbolB.score) {
        return -1;
      }
      if (symbolA.score < symbolB.score) {
        return 1;
      }
    }
    if (symbolA.symbol && symbolB.symbol) {
      const symbolAName = symbolA.symbol.name.toLowerCase();
      const symbolBName = symbolB.symbol.name.toLowerCase();
      const res = symbolAName.localeCompare(symbolBName);
      if (res !== 0) {
        return res;
      }
    }
    if (symbolA.symbol && symbolB.symbol) {
      const symbolAKind = SymbolKinds.toIcon(symbolA.symbol.kind).id;
      const symbolBKind = SymbolKinds.toIcon(symbolB.symbol.kind).id;
      return symbolAKind.localeCompare(symbolBKind);
    }
    return 0;
  }
};
SymbolsQuickAccessProvider = __decorateClass([
  __decorateParam(0, ILabelService),
  __decorateParam(1, IOpenerService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IChatWidgetService)
], SymbolsQuickAccessProvider);
export {
  SymbolsQuickAccessProvider
};
