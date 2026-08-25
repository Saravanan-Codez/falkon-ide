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
import { URI } from "../../../../base/common/uri.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { WebviewInput } from "./webviewEditorInput.js";
import { IWebviewWorkbenchService } from "./webviewWorkbenchService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
let WebviewEditorInputSerializer = class {
  constructor(_webviewWorkbenchService) {
    this._webviewWorkbenchService = _webviewWorkbenchService;
  }
  static {
    this.ID = WebviewInput.typeId;
  }
  canSerialize(input) {
    return this._webviewWorkbenchService.shouldPersist(input);
  }
  serialize(input) {
    if (!this.canSerialize(input)) {
      return void 0;
    }
    const data = this.toJson(input);
    try {
      return JSON.stringify(data);
    } catch {
      return void 0;
    }
  }
  deserialize(_instantiationService, serializedEditorInput) {
    const data = this.fromJson(JSON.parse(serializedEditorInput));
    return this._webviewWorkbenchService.openRevivedWebview({
      webviewInitInfo: {
        providedViewType: data.providedId,
        origin: data.origin,
        title: data.title,
        options: data.webviewOptions,
        contentOptions: data.contentOptions,
        extension: data.extension
      },
      viewType: data.viewType,
      title: data.title,
      iconPath: data.iconPath,
      state: data.state,
      group: data.group
    });
  }
  fromJson(data) {
    return {
      ...data,
      extension: reviveWebviewExtensionDescription(data.extensionId, data.extensionLocation),
      iconPath: reviveWebviewIconPath(data.iconPath),
      state: reviveState(data.state),
      webviewOptions: restoreWebviewOptions(data.options),
      contentOptions: restoreWebviewContentOptions(data.options)
    };
  }
  toJson(input) {
    return {
      origin: input.webview.origin,
      viewType: input.viewType,
      providedId: input.providerId,
      title: input.getName(),
      options: { ...input.webview.options, ...input.webview.contentOptions },
      extensionLocation: input.extension?.location,
      extensionId: input.extension?.id.value,
      state: input.webview.state,
      iconPath: input.iconPath ? ThemeIcon.isThemeIcon(input.iconPath) ? input.iconPath : { light: input.iconPath.light, dark: input.iconPath.dark } : void 0,
      group: input.group
    };
  }
};
WebviewEditorInputSerializer = __decorateClass([
  __decorateParam(0, IWebviewWorkbenchService)
], WebviewEditorInputSerializer);
function reviveWebviewExtensionDescription(extensionId, extensionLocation) {
  if (!extensionId) {
    return void 0;
  }
  const location = reviveUri(extensionLocation);
  if (!location) {
    return void 0;
  }
  return {
    id: new ExtensionIdentifier(extensionId),
    location
  };
}
function reviveWebviewIconPath(data) {
  if (!data) {
    return void 0;
  }
  if (ThemeIcon.isThemeIcon(data)) {
    return data;
  }
  const light = reviveUri(data.light);
  const dark = reviveUri(data.dark);
  return light && dark ? { light, dark } : void 0;
}
function reviveUri(data) {
  if (!data) {
    return void 0;
  }
  try {
    if (typeof data === "string") {
      return URI.parse(data);
    }
    return URI.from(data);
  } catch {
    return void 0;
  }
}
function reviveState(state) {
  return typeof state === "string" ? state : void 0;
}
function restoreWebviewOptions(options) {
  return options;
}
function restoreWebviewContentOptions(options) {
  return {
    ...options,
    forwardUntrustedKeypressEvents: options.forwardUntrustedKeypressEvents ?? true,
    // default to true for backwards compatibility
    localResourceRoots: options.localResourceRoots?.map((uri) => reviveUri(uri))
  };
}
export {
  WebviewEditorInputSerializer,
  restoreWebviewContentOptions,
  restoreWebviewOptions,
  reviveWebviewExtensionDescription,
  reviveWebviewIconPath
};
