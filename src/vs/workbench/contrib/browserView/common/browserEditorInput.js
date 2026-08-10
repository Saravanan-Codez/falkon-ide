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
import { Codicon } from "../../../../base/common/codicons.js";
import { truncate } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { BrowserViewUri } from "../../../../platform/browserView/common/browserViewUri.js";
import { BrowserViewSharingState, IBrowserViewWorkbenchService } from "./browserView.js";
import { EditorInputCapabilities, Verbosity } from "../../../common/editor.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { TAB_ACTIVE_FOREGROUND } from "../../../common/theme.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { hasKey } from "../../../../base/common/types.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { logBrowserOpen } from "../../../../platform/browserView/common/browserViewTelemetry.js";
import { LRUCachedFunction } from "../../../../base/common/cache.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../../base/common/event.js";
const LOADING_SPINNER_SVG = (color) => `
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
		<path d="M8 1a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z" fill="${color}" opacity="0.3"/>
		<path d="M8 1a7 7 0 0 1 7 7h-1.5A5.5 5.5 0 0 0 8 2.5V1z" fill="${color}">
			<animateTransform attributeName="transform" type="rotate" dur="1s" repeatCount="indefinite" values="0 8 8;360 8 8"/>
		</path>
	</svg>
`;
const MAX_TITLE_LENGTH = 30;
function stripUrlFragment(url) {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
}
function stripUrlQueryAndFragment(url) {
  const stripped = stripUrlFragment(url);
  const query = stripped.indexOf("?");
  return query === -1 ? stripped : stripped.slice(0, query);
}
let BrowserEditorInput = class extends EditorInput {
  constructor(options, _resolveModel, themeService, instantiationService, telemetryService, browserViewWorkbenchService) {
    super();
    this._resolveModel = _resolveModel;
    this.themeService = themeService;
    this.instantiationService = instantiationService;
    this.telemetryService = telemetryService;
    this.browserViewWorkbenchService = browserViewWorkbenchService;
    this._modelStore = this._register(new DisposableStore());
    this._onBeforeDispose = this._register(new Emitter());
    this.onBeforeDispose = this._onBeforeDispose.event;
    this._onDidResolveModel = this._register(new Emitter());
    this.onDidResolveModel = this._onDidResolveModel.event;
    this.getURLTitles = new LRUCachedFunction((url) => {
      let _short = void 0;
      let _medium = void 0;
      let _long = void 0;
      return {
        // Host only. Derived via the WHATWG URL parser so it matches the
        // host shown by the navbar's raw URL (e.g. punycode for IDNs).
        get [Verbosity.SHORT]() {
          if (_short === void 0) {
            const parsed = URL.parse(url);
            _short = parsed ? parsed.host : stripUrlQueryAndFragment(url);
          }
          return _short;
        },
        // Raw URL without the query/fragment. Computed by string slicing
        // (not a URI round-trip) so the displayed text stays byte-for-byte
        // consistent with the canonical URL shown in the navbar.
        get [Verbosity.MEDIUM]() {
          if (_medium === void 0) {
            _medium = stripUrlQueryAndFragment(url);
          }
          return _medium;
        },
        // Raw URL without the fragment, sliced from the canonical string for
        // the same consistency reason as the medium form.
        get [Verbosity.LONG]() {
          if (_long === void 0) {
            _long = stripUrlFragment(url);
          }
          return _long;
        }
      };
    });
    this._id = options.id;
    this._initialData = options;
  }
  static {
    this.ID = "workbench.editorinputs.browser";
  }
  static {
    this.EDITOR_ID = "workbench.editor.browser";
  }
  static {
    this.DEFAULT_LABEL = localize("browser.editorLabel", "Browser");
  }
  get model() {
    return this._model;
  }
  set model(model) {
    if (this._model === model) {
      return;
    }
    this._modelStore.clear();
    this._model = model;
    this._modelStore.add(this._model.onWillDispose(() => {
      this._modelStore.clear();
      this._model = void 0;
    }));
    this._modelStore.add(this._model.onDidClose(() => {
      this.dispose(true);
    }));
    this._modelStore.add(this._model.onDidChangeTitle(() => this._onDidChangeLabel.fire()));
    this._modelStore.add(this._model.onDidChangeFavicon(() => this._onDidChangeLabel.fire()));
    this._modelStore.add(this._model.onDidChangeLoadingState(() => this._onDidChangeLabel.fire()));
    this._modelStore.add(this._model.onDidNavigate(() => this._onDidChangeLabel.fire()));
    this._onDidChangeLabel.fire();
    this._onDidResolveModel.fire(model);
  }
  onceModelResolves(cb) {
    if (this._model) {
      cb(this._model);
      return Disposable.None;
    } else {
      return Event.once(this.onDidResolveModel)(cb);
    }
  }
  get id() {
    return this._id;
  }
  get url() {
    return this._model ? this._model.url : this._initialData.url;
  }
  get title() {
    return this._model ? this._model.title : this._initialData.title;
  }
  get favicon() {
    return this._model ? this._model.favicon : this._initialData.favicon;
  }
  /**
   * Whether this editor was opened via a default localhost link open (setting
   * not explicitly configured by the user). Transient — not serialized.
   */
  get isDefaultLinkOpen() {
    return !!this._initialData.isDefaultLinkOpen;
  }
  get isSharingAvailable() {
    return this._model ? this._model.sharingState !== BrowserViewSharingState.Unavailable : this.browserViewWorkbenchService.isSharingAvailable;
  }
  navigate(url, options) {
    const destination = url.trim();
    if (this._model) {
      void this._model.loadURL(destination, options);
    } else {
      this._initialData = {
        id: this._id,
        url: destination
      };
      this._onDidChangeLabel.fire();
    }
  }
  async resolve() {
    if (!this._model && !this._modelPromise) {
      this._modelPromise = (async () => {
        this._model = await this._resolveModel();
        this._modelPromise = void 0;
        return this._model;
      })();
    }
    return this._model || this._modelPromise;
  }
  get typeId() {
    return BrowserEditorInput.ID;
  }
  get editorId() {
    return BrowserEditorInput.EDITOR_ID;
  }
  get capabilities() {
    return EditorInputCapabilities.ForceReveal | EditorInputCapabilities.Readonly;
  }
  get resource() {
    return BrowserViewUri.forId(this._id);
  }
  getIcon() {
    if (this._model) {
      if (this._model.loading) {
        const color = this.themeService.getColorTheme().getColor(TAB_ACTIVE_FOREGROUND);
        return URI.parse("data:image/svg+xml;utf8," + encodeURIComponent(LOADING_SPINNER_SVG(color?.toString())));
      }
      if (this._model.favicon) {
        return URI.parse(this._model.favicon);
      }
      return Codicon.globe;
    }
    if (this._initialData.favicon) {
      return URI.parse(this._initialData.favicon);
    }
    return Codicon.globe;
  }
  getName() {
    const hasTitle = this._model ? !!this._model.title : !!this._initialData.title;
    const name = hasTitle ? this.title : this.getDescription(Verbosity.SHORT) || BrowserEditorInput.DEFAULT_LABEL;
    return truncate(name, MAX_TITLE_LENGTH);
  }
  getTitle(verbosity = Verbosity.MEDIUM) {
    const hasTitle = this._model ? !!this._model.title : !!this._initialData.title;
    const description = this.getDescription(verbosity);
    const title = hasTitle ? `${this.title} (${description})` : description;
    return title || BrowserEditorInput.DEFAULT_LABEL;
  }
  getDescription(verbosity = Verbosity.MEDIUM) {
    return this.url && this.getURLTitles.get(this.url)[verbosity];
  }
  canReopen() {
    return true;
  }
  matches(otherInput) {
    if (super.matches(otherInput)) {
      return true;
    }
    if (otherInput instanceof BrowserEditorInput) {
      return this._id === otherInput._id;
    }
    if (hasKey(otherInput, { resource: true }) && otherInput.resource?.scheme === BrowserViewUri.scheme) {
      const parsed = BrowserViewUri.parse(otherInput.resource);
      if (parsed) {
        return this._id === parsed.id;
      }
    }
    return false;
  }
  /**
   * Creates a copy of this browser editor input with a new unique ID, creating an independent browser view with no linked state.
   * This is used during Copy into New Window.
   */
  copy() {
    logBrowserOpen(this.telemetryService, "copyToNewWindow");
    return this.instantiationService.invokeFunction((accessor) => {
      const browserViewWorkbenchService = accessor.get(IBrowserViewWorkbenchService);
      return browserViewWorkbenchService.getOrCreateLazy(generateUuid(), {
        url: this.url,
        title: this.title,
        favicon: this.favicon
      });
    });
  }
  toUntyped() {
    const viewState = {
      url: this.url,
      title: this.title,
      favicon: this.favicon
    };
    return {
      resource: this.resource,
      options: {
        override: BrowserEditorInput.EDITOR_ID,
        viewState
      }
    };
  }
  dispose(force) {
    if (!force) {
      let vetoed = false;
      this._onBeforeDispose.fire({ veto: () => {
        vetoed = true;
      } });
      if (vetoed) {
        return;
      }
    }
    super.dispose();
    if (this._model) {
      this._initialData = {
        id: this._id,
        url: this._model.url,
        title: this._model.title,
        favicon: this._model.favicon
      };
      this._model.dispose();
      this._model = void 0;
    }
  }
  serialize() {
    return {
      id: this._id,
      url: this.url,
      title: this.title,
      favicon: this.favicon
    };
  }
};
BrowserEditorInput = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IBrowserViewWorkbenchService)
], BrowserEditorInput);
class BrowserEditorSerializer {
  canSerialize(editorInput) {
    return editorInput instanceof BrowserEditorInput;
  }
  serialize(editorInput) {
    if (!this.canSerialize(editorInput)) {
      return void 0;
    }
    return JSON.stringify(editorInput.serialize());
  }
  deserialize(instantiationService, serializedEditor) {
    try {
      const data = JSON.parse(serializedEditor);
      return instantiationService.invokeFunction((accessor) => {
        const browserViewWorkbenchService = accessor.get(IBrowserViewWorkbenchService);
        return browserViewWorkbenchService.getOrCreateLazy(data.id, data);
      });
    } catch {
      return void 0;
    }
  }
}
export {
  BrowserEditorInput,
  BrowserEditorSerializer
};
