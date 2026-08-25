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
import { DeferredPromise } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { pieceToQuery, prepareQuery, scoreFuzzy2 } from "../../../../base/common/fuzzyScorer.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { format, trim } from "../../../../base/common/strings.js";
import { Range } from "../../../common/core/range.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { SymbolKind, SymbolKinds, SymbolTag, getAriaLabelForSymbol } from "../../../common/languages.js";
import { IOutlineModelService } from "../../documentSymbols/browser/outlineModel.js";
import { AbstractEditorNavigationQuickAccessProvider } from "./editorNavigationQuickAccess.js";
import { localize } from "../../../../nls.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { findLast } from "../../../../base/common/arraysFind.js";
let AbstractGotoSymbolQuickAccessProvider = class extends AbstractEditorNavigationQuickAccessProvider {
  constructor(_languageFeaturesService, _outlineModelService, options = /* @__PURE__ */ Object.create(null)) {
    super(options);
    this._languageFeaturesService = _languageFeaturesService;
    this._outlineModelService = _outlineModelService;
    this.options = options;
    this.options.canAcceptInBackground = true;
  }
  static {
    this.PREFIX = "@";
  }
  static {
    this.SCOPE_PREFIX = ":";
  }
  static {
    this.PREFIX_BY_CATEGORY = `${this.PREFIX}${this.SCOPE_PREFIX}`;
  }
  provideWithoutTextEditor(picker) {
    this.provideLabelPick(picker, localize("cannotRunGotoSymbolWithoutEditor", "To go to a symbol, first open a text editor with symbol information."));
    return Disposable.None;
  }
  provideWithTextEditor(context, picker, token, runOptions) {
    const editor = context.editor;
    const model = this.getModel(editor);
    if (!model) {
      return Disposable.None;
    }
    if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
      return this.doProvideWithEditorSymbols(context, model, picker, token, runOptions);
    }
    return this.doProvideWithoutEditorSymbols(context, model, picker, token);
  }
  doProvideWithoutEditorSymbols(context, model, picker, token) {
    const disposables = new DisposableStore();
    this.provideLabelPick(picker, localize("cannotRunGotoSymbolWithoutSymbolProvider", "The active text editor does not provide symbol information."));
    (async () => {
      const result = await this.waitForLanguageSymbolRegistry(model, disposables);
      if (!result || token.isCancellationRequested) {
        return;
      }
      disposables.add(this.doProvideWithEditorSymbols(context, model, picker, token));
    })();
    return disposables;
  }
  provideLabelPick(picker, label) {
    picker.items = [{ label, index: 0, kind: SymbolKind.String }];
    picker.ariaLabel = label;
  }
  async waitForLanguageSymbolRegistry(model, disposables) {
    if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
      return true;
    }
    const symbolProviderRegistryPromise = new DeferredPromise();
    const symbolProviderListener = disposables.add(this._languageFeaturesService.documentSymbolProvider.onDidChange(() => {
      if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
        symbolProviderListener.dispose();
        symbolProviderRegistryPromise.complete(true);
      }
    }));
    disposables.add(toDisposable(() => symbolProviderRegistryPromise.complete(false)));
    return symbolProviderRegistryPromise.p;
  }
  doProvideWithEditorSymbols(context, model, picker, token, runOptions) {
    const editor = context.editor;
    const disposables = new DisposableStore();
    disposables.add(picker.onDidAccept((event) => {
      const [item] = picker.selectedItems;
      if (item && item.range) {
        if (picker.keyMods.shift && item.attach) {
          item.attach(picker.keyMods, event);
          return;
        }
        this.gotoLocation(context, { range: item.range.selection, keyMods: picker.keyMods, preserveFocus: event.inBackground });
        runOptions?.handleAccept?.(item, event.inBackground);
        if (!event.inBackground) {
          picker.hide();
        }
      }
    }));
    disposables.add(picker.onDidTriggerItemButton(({ item }) => {
      if (item && item.range) {
        this.gotoLocation(context, { range: item.range.selection, keyMods: picker.keyMods, forceSideBySide: true });
        picker.hide();
      }
    }));
    const symbolsPromise = this.getDocumentSymbols(model, token);
    const picksCts = disposables.add(new MutableDisposable());
    const updatePickerItems = async (positionToEnclose) => {
      picksCts?.value?.cancel();
      picker.busy = false;
      picksCts.value = new CancellationTokenSource();
      picker.busy = true;
      try {
        const query = prepareQuery(picker.value.substr(AbstractGotoSymbolQuickAccessProvider.PREFIX.length).trim());
        const items = await this.doGetSymbolPicks(symbolsPromise, query, void 0, picksCts.value.token, model);
        if (token.isCancellationRequested) {
          return;
        }
        if (items.length > 0) {
          picker.items = items;
          if (positionToEnclose && query.original.length === 0) {
            const candidate = findLast(items, (item) => Boolean(item.type !== "separator" && item.range && Range.containsPosition(item.range.decoration, positionToEnclose)));
            if (candidate) {
              picker.activeItems = [candidate];
            }
          }
        } else {
          if (query.original.length > 0) {
            this.provideLabelPick(picker, localize("noMatchingSymbolResults", "No matching editor symbols"));
          } else {
            this.provideLabelPick(picker, localize("noSymbolResults", "No editor symbols"));
          }
        }
      } finally {
        if (!token.isCancellationRequested) {
          picker.busy = false;
        }
      }
    };
    disposables.add(picker.onDidChangeValue(() => updatePickerItems(void 0)));
    updatePickerItems(editor.getSelection()?.getPosition());
    disposables.add(picker.onDidChangeActive(() => {
      const [item] = picker.activeItems;
      if (item && item.range) {
        editor.revealRangeInCenter(item.range.selection, ScrollType.Smooth);
        this.addDecorations(editor, item.range.decoration);
      }
    }));
    return disposables;
  }
  async doGetSymbolPicks(symbolsPromise, query, options, token, model) {
    const symbols = await symbolsPromise;
    if (token.isCancellationRequested) {
      return [];
    }
    const filterBySymbolKind = query.original.indexOf(AbstractGotoSymbolQuickAccessProvider.SCOPE_PREFIX) === 0;
    const filterPos = filterBySymbolKind ? 1 : 0;
    let symbolQuery;
    let containerQuery;
    if (query.values && query.values.length > 1) {
      symbolQuery = pieceToQuery(query.values[0]);
      containerQuery = pieceToQuery(query.values.slice(1));
    } else {
      symbolQuery = query;
    }
    let buttons;
    const openSideBySideDirection = this.options?.openSideBySideDirection?.();
    if (openSideBySideDirection) {
      buttons = [{
        iconClass: openSideBySideDirection === "right" ? ThemeIcon.asClassName(Codicon.splitHorizontal) : ThemeIcon.asClassName(Codicon.splitVertical),
        tooltip: openSideBySideDirection === "right" ? localize("openToSide", "Open to the Side") : localize("openToBottom", "Open to the Bottom")
      }];
    }
    const filteredSymbolPicks = [];
    for (let index = 0; index < symbols.length; index++) {
      const symbol = symbols[index];
      const symbolLabel = trim(symbol.name);
      const symbolLabelWithIcon = `$(${SymbolKinds.toIcon(symbol.kind).id}) ${symbolLabel}`;
      const symbolLabelIconOffset = symbolLabelWithIcon.length - symbolLabel.length;
      let containerLabel = symbol.containerName;
      if (options?.extraContainerLabel) {
        if (containerLabel) {
          containerLabel = `${options.extraContainerLabel} \u2022 ${containerLabel}`;
        } else {
          containerLabel = options.extraContainerLabel;
        }
      }
      let symbolScore = void 0;
      let symbolMatches = void 0;
      let containerScore = void 0;
      let containerMatches = void 0;
      if (query.original.length > filterPos) {
        let skipContainerQuery = false;
        if (symbolQuery !== query) {
          [symbolScore, symbolMatches] = scoreFuzzy2(symbolLabelWithIcon, {
            ...query,
            values: void 0
            /* disable multi-query support */
          }, filterPos, symbolLabelIconOffset);
          if (typeof symbolScore === "number") {
            skipContainerQuery = true;
          }
        }
        if (typeof symbolScore !== "number") {
          [symbolScore, symbolMatches] = scoreFuzzy2(symbolLabelWithIcon, symbolQuery, filterPos, symbolLabelIconOffset);
          if (typeof symbolScore !== "number") {
            continue;
          }
        }
        if (!skipContainerQuery && containerQuery) {
          if (containerLabel && containerQuery.original.length > 0) {
            [containerScore, containerMatches] = scoreFuzzy2(containerLabel, containerQuery);
          }
          if (typeof containerScore !== "number") {
            continue;
          }
          if (typeof symbolScore === "number") {
            symbolScore += containerScore;
          }
        }
      }
      const deprecated = symbol.tags && symbol.tags.indexOf(SymbolTag.Deprecated) >= 0;
      filteredSymbolPicks.push({
        index,
        kind: symbol.kind,
        score: symbolScore,
        label: symbolLabelWithIcon,
        ariaLabel: getAriaLabelForSymbol(symbol.name, symbol.kind),
        description: containerLabel,
        highlights: deprecated ? void 0 : {
          label: symbolMatches,
          description: containerMatches
        },
        range: {
          selection: Range.collapseToStart(symbol.selectionRange),
          decoration: symbol.range
        },
        uri: model.uri,
        symbolName: symbolLabel,
        strikethrough: deprecated,
        buttons
      });
    }
    const sortedFilteredSymbolPicks = filteredSymbolPicks.sort(
      (symbolA, symbolB) => filterBySymbolKind ? this.compareByKindAndScore(symbolA, symbolB) : this.compareByScore(symbolA, symbolB)
    );
    let symbolPicks = [];
    if (filterBySymbolKind) {
      let updateLastSeparatorLabel = function() {
        if (lastSeparator && typeof lastSymbolKind === "number" && lastSymbolKindCounter > 0) {
          lastSeparator.label = format(NLS_SYMBOL_KIND_CACHE[lastSymbolKind] || FALLBACK_NLS_SYMBOL_KIND, lastSymbolKindCounter);
        }
      };
      let lastSymbolKind = void 0;
      let lastSeparator = void 0;
      let lastSymbolKindCounter = 0;
      for (const symbolPick of sortedFilteredSymbolPicks) {
        if (lastSymbolKind !== symbolPick.kind) {
          updateLastSeparatorLabel();
          lastSymbolKind = symbolPick.kind;
          lastSymbolKindCounter = 1;
          lastSeparator = { type: "separator" };
          symbolPicks.push(lastSeparator);
        } else {
          lastSymbolKindCounter++;
        }
        symbolPicks.push(symbolPick);
      }
      updateLastSeparatorLabel();
    } else if (sortedFilteredSymbolPicks.length > 0) {
      symbolPicks = [
        { label: localize("symbols", "symbols ({0})", filteredSymbolPicks.length), type: "separator" },
        ...sortedFilteredSymbolPicks
      ];
    }
    return symbolPicks;
  }
  compareByScore(symbolA, symbolB) {
    if (typeof symbolA.score !== "number" && typeof symbolB.score === "number") {
      return 1;
    } else if (typeof symbolA.score === "number" && typeof symbolB.score !== "number") {
      return -1;
    }
    if (typeof symbolA.score === "number" && typeof symbolB.score === "number") {
      if (symbolA.score > symbolB.score) {
        return -1;
      } else if (symbolA.score < symbolB.score) {
        return 1;
      }
    }
    if (symbolA.index < symbolB.index) {
      return -1;
    } else if (symbolA.index > symbolB.index) {
      return 1;
    }
    return 0;
  }
  compareByKindAndScore(symbolA, symbolB) {
    const kindA = NLS_SYMBOL_KIND_CACHE[symbolA.kind] || FALLBACK_NLS_SYMBOL_KIND;
    const kindB = NLS_SYMBOL_KIND_CACHE[symbolB.kind] || FALLBACK_NLS_SYMBOL_KIND;
    const result = kindA.localeCompare(kindB);
    if (result === 0) {
      return this.compareByScore(symbolA, symbolB);
    }
    return result;
  }
  async getDocumentSymbols(document, token) {
    const model = await this._outlineModelService.getOrCreate(document, token);
    return token.isCancellationRequested ? [] : model.asListOfDocumentSymbols();
  }
};
AbstractGotoSymbolQuickAccessProvider = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IOutlineModelService)
], AbstractGotoSymbolQuickAccessProvider);
const FALLBACK_NLS_SYMBOL_KIND = localize("property", "properties ({0})");
const NLS_SYMBOL_KIND_CACHE = {
  [SymbolKind.Method]: localize("method", "methods ({0})"),
  [SymbolKind.Function]: localize("function", "functions ({0})"),
  [SymbolKind.Constructor]: localize("_constructor", "constructors ({0})"),
  [SymbolKind.Variable]: localize("variable", "variables ({0})"),
  [SymbolKind.Class]: localize("class", "classes ({0})"),
  [SymbolKind.Struct]: localize("struct", "structs ({0})"),
  [SymbolKind.Event]: localize("event", "events ({0})"),
  [SymbolKind.Operator]: localize("operator", "operators ({0})"),
  [SymbolKind.Interface]: localize("interface", "interfaces ({0})"),
  [SymbolKind.Namespace]: localize("namespace", "namespaces ({0})"),
  [SymbolKind.Package]: localize("package", "packages ({0})"),
  [SymbolKind.TypeParameter]: localize("typeParameter", "type parameters ({0})"),
  [SymbolKind.Module]: localize("modules", "modules ({0})"),
  [SymbolKind.Property]: localize("property", "properties ({0})"),
  [SymbolKind.Enum]: localize("enum", "enumerations ({0})"),
  [SymbolKind.EnumMember]: localize("enumMember", "enumeration members ({0})"),
  [SymbolKind.String]: localize("string", "strings ({0})"),
  [SymbolKind.File]: localize("file", "files ({0})"),
  [SymbolKind.Array]: localize("array", "arrays ({0})"),
  [SymbolKind.Number]: localize("number", "numbers ({0})"),
  [SymbolKind.Boolean]: localize("boolean", "booleans ({0})"),
  [SymbolKind.Object]: localize("object", "objects ({0})"),
  [SymbolKind.Key]: localize("key", "keys ({0})"),
  [SymbolKind.Field]: localize("field", "fields ({0})"),
  [SymbolKind.Constant]: localize("constant", "constants ({0})")
};
export {
  AbstractGotoSymbolQuickAccessProvider
};
