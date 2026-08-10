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
import { localize, localize2 } from "../../../../../nls.js";
import { $ } from "../../../../../base/browser/dom.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { HoverPosition } from "../../../../../base/browser/ui/hover/hoverWidget.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { WorkbenchHoverDelegate } from "../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { QuickInputButtonLocation } from "../../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { BrowserViewCommandId } from "../../../../../platform/browserView/common/browserView.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import {
  BROWSER_EDITOR_ACTIVE,
  BrowserActionCategory,
  BrowserActionGroup,
  BrowserEditor,
  BrowserEditorContribution,
  BrowserWidgetLocation,
  CONTEXT_BROWSER_HAS_URL
} from "../browserEditor.js";
const CONTEXT_BROWSER_URL_IS_FAVORITED = new RawContextKey("browserUrlIsFavorited", false, localize("browser.urlIsFavorited", "Whether the current browser URL is a favorite"));
class FavoriteIndicator extends Disposable {
  constructor(instantiationService, _keybindingService) {
    super();
    this._keybindingService = _keybindingService;
    this._onDidClick = this._register(new Emitter());
    this.onDidClick = this._onDidClick.event;
    const hoverDelegate = this._register(instantiationService.createInstance(
      WorkbenchHoverDelegate,
      "element",
      void 0,
      { position: { hoverPosition: HoverPosition.ABOVE } }
    ));
    this.element = $(".browser-favorite-indicator-container");
    this.element.style.display = "none";
    this._button = this._register(new Button(this.element, {
      supportIcons: true,
      title: this._tooltip(),
      small: true,
      hoverDelegate
    }));
    this._button.element.classList.add("browser-favorite-indicator");
    this._button.label = `$(${Codicon.starFull.id})`;
    this._button.element.setAttribute("aria-label", localize("browser.removeFavorite", "Remove from Favorites"));
    this._register(this._button.onDidClick(() => this._onDidClick.fire()));
    this._register(this._keybindingService.onDidUpdateKeybindings(() => {
      this._button.setTitle(this._tooltip());
    }));
  }
  _tooltip() {
    const kb = this._keybindingService.lookupKeybinding(BrowserViewCommandId.ToggleFavorite)?.getLabel();
    return kb ? localize("browser.removeFavoriteWithKb", "Remove from Favorites ({0})", kb) : localize("browser.removeFavorite", "Remove from Favorites");
  }
  setVisible(visible) {
    this.element.style.display = visible ? "" : "none";
  }
}
let BrowserFavoritesFeature = class extends BrowserEditorContribution {
  constructor(editor, _storageService, instantiationService, contextKeyService, _keybindingService) {
    super(editor);
    this._storageService = _storageService;
    this._keybindingService = _keybindingService;
    this._onDidChangeState = this._register(new Emitter());
    this._urls = /* @__PURE__ */ new Set();
    this._load();
    this._isFavoriteContext = CONTEXT_BROWSER_URL_IS_FAVORITED.bindTo(contextKeyService);
    this._indicator = this._register(new FavoriteIndicator(instantiationService, this._keybindingService));
    this._register(this._indicator.onDidClick(() => this.toggleCurrent()));
    const storageListenerStore = this._register(new DisposableStore());
    this._register(this._storageService.onDidChangeValue(
      StorageScope.WORKSPACE,
      BrowserFavoritesFeature.STORAGE_KEY,
      storageListenerStore
    )(() => {
      this._load();
      this._refresh();
      this._onDidChangeState.fire();
    }));
    this._suggestionProvider = {
      label: localize("browser.favorites", "Favorites"),
      order: 50,
      actions: [],
      onDidChange: this._onDidChangeState.event,
      getSuggestions: async ({ input }) => {
        const suggestions = [];
        const current = input.url;
        for (const url of this._urls) {
          if (url === current) {
            continue;
          }
          const deleteAction = {
            id: "browser.favorites.delete",
            iconClass: ThemeIcon.asClassName(Codicon.trash),
            tooltip: localize("browser.removeFavorite", "Remove from Favorites"),
            run: () => this._remove(url)
          };
          suggestions.push({
            id: "favorite:" + url,
            label: url,
            icon: Codicon.star,
            apply: (target) => target.navigate(url),
            actions: [deleteAction]
          });
        }
        return suggestions;
      }
    };
    this._actionProvider = {
      onDidChange: this._onDidChangeState.event,
      getActions: (input) => {
        const url = input.url;
        if (!url) {
          return [];
        }
        const favorite = this._urls.has(url);
        const tooltip = favorite ? localize("browser.removeFavorite", "Remove from Favorites") : localize("browser.addFavorite", "Add to Favorites");
        const action = {
          id: "browser.toggleFavorite",
          iconClass: ThemeIcon.asClassName(favorite ? Codicon.starFull : Codicon.star),
          tooltip,
          alwaysVisible: true,
          toggle: { checked: favorite },
          location: QuickInputButtonLocation.Input,
          run: (target) => {
            const u = target.url;
            if (u) {
              this._toggle(u);
            }
          }
        };
        return [action];
      }
    };
  }
  static {
    this.STORAGE_KEY = "workbench.browser.favorites";
  }
  get widgets() {
    return [{ location: BrowserWidgetLocation.PostUrl, element: this._indicator.element, order: 60 }];
  }
  get urlSuggestionProviders() {
    return [this._suggestionProvider];
  }
  get urlPickerActionProviders() {
    return [this._actionProvider];
  }
  onModelAttached(model, store) {
    store.add(model.onDidNavigate(() => {
      this._refresh();
      this._onDidChangeState.fire();
    }));
    this._refresh();
  }
  onModelDetached() {
    this._isFavoriteContext.reset();
    this._indicator.setVisible(false);
  }
  isFavorite(url) {
    return this._urls.has(url);
  }
  toggleCurrent() {
    const url = this.editor.model?.url;
    if (url) {
      this._toggle(url);
    }
  }
  _refresh() {
    const url = this.editor.model?.url ?? "";
    const favorite = !!url && this._urls.has(url);
    this._isFavoriteContext.set(favorite);
    this._indicator.setVisible(favorite);
  }
  _load() {
    const raw = this._storageService.get(BrowserFavoritesFeature.STORAGE_KEY, StorageScope.WORKSPACE);
    if (!raw) {
      this._urls = /* @__PURE__ */ new Set();
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      this._urls = new Set(
        Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : []
      );
    } catch {
      this._urls = /* @__PURE__ */ new Set();
    }
  }
  _toggle(url) {
    if (this._urls.has(url)) {
      this._urls.delete(url);
    } else {
      this._urls.add(url);
    }
    this._storageService.store(
      BrowserFavoritesFeature.STORAGE_KEY,
      JSON.stringify([...this._urls]),
      StorageScope.WORKSPACE,
      StorageTarget.USER
    );
    this._refresh();
    this._onDidChangeState.fire();
  }
  // Idempotent: callers that should never re-add a favorite (e.g. the per-item
  // delete button on suggestions) must use this rather than `_toggle`.
  _remove(url) {
    if (!this._urls.has(url)) {
      return;
    }
    this._urls.delete(url);
    this._storageService.store(
      BrowserFavoritesFeature.STORAGE_KEY,
      JSON.stringify([...this._urls]),
      StorageScope.WORKSPACE,
      StorageTarget.USER
    );
    this._refresh();
    this._onDidChangeState.fire();
  }
};
BrowserFavoritesFeature = __decorateClass([
  __decorateParam(1, IStorageService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService)
], BrowserFavoritesFeature);
BrowserEditor.registerContribution(BrowserFavoritesFeature);
class ToggleFavoriteAction extends Action2 {
  static {
    this.ID = BrowserViewCommandId.ToggleFavorite;
  }
  constructor() {
    super({
      id: ToggleFavoriteAction.ID,
      title: localize2("browser.addFavoriteAction", "Add to Favorites"),
      category: BrowserActionCategory,
      icon: Codicon.star,
      f1: true,
      precondition: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_HAS_URL),
      toggled: {
        condition: CONTEXT_BROWSER_URL_IS_FAVORITED,
        icon: Codicon.starFull
      },
      menu: {
        id: MenuId.BrowserActionsToolbar,
        group: BrowserActionGroup.Data,
        order: 2,
        isHiddenByDefault: true
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(BROWSER_EDITOR_ACTIVE, CONTEXT_BROWSER_HAS_URL),
        primary: KeyMod.CtrlCmd | KeyCode.KeyD
      }
    });
  }
  async run(accessor, browserEditor = accessor.get(IEditorService).activeEditorPane) {
    if (browserEditor instanceof BrowserEditor) {
      browserEditor.getContribution(BrowserFavoritesFeature)?.toggleCurrent();
    }
  }
}
registerAction2(ToggleFavoriteAction);
export {
  BrowserFavoritesFeature
};
