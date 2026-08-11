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
import { Lazy } from "../../../base/common/lazy.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { basenameOrAuthority, dirname, hasTrailingPathSeparator } from "../../../base/common/resources.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { isUriComponents, URI } from "../../../base/common/uri.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { FileKind } from "../../../platform/files/common/files.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { ICustomEditorLabelService } from "../../services/editor/common/customEditorLabelService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
let MainThreadQuickOpen = class {
  constructor(extHostContext, quickInputService, labelService, customEditorLabelService, modelService, languageService) {
    this.labelService = labelService;
    this.customEditorLabelService = customEditorLabelService;
    this.modelService = modelService;
    this.languageService = languageService;
    this._items = {};
    // ---- QuickInput
    this.sessions = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostQuickOpen);
    this._quickInputService = quickInputService;
  }
  dispose() {
    for (const [_id, session] of this.sessions) {
      session.store.dispose();
    }
  }
  $show(instance, options, token) {
    const contents = new Promise((resolve, reject) => {
      this._items[instance] = { resolve, reject };
    });
    options = {
      ...options,
      onDidFocus: (el) => {
        if (el) {
          this._proxy.$onItemSelected(el.handle);
        }
      }
    };
    if (options.canPickMany) {
      return this._quickInputService.pick(contents, options, token).then((items) => {
        if (items) {
          return items.map((item) => item.handle);
        }
        return void 0;
      });
    } else {
      return this._quickInputService.pick(contents, options, token).then((item) => {
        if (item) {
          return item.handle;
        }
        return void 0;
      });
    }
  }
  $setItems(instance, items) {
    if (this._items[instance]) {
      items.forEach((item) => this.expandItemProps(item));
      this._items[instance].resolve(items);
      delete this._items[instance];
    }
    return Promise.resolve();
  }
  $setError(instance, error) {
    if (this._items[instance]) {
      this._items[instance].reject(error);
      delete this._items[instance];
    }
    return Promise.resolve();
  }
  // ---- input
  $input(options, validateInput, token) {
    const inputOptions = /* @__PURE__ */ Object.create(null);
    if (options) {
      inputOptions.title = options.title;
      inputOptions.password = options.password;
      inputOptions.placeHolder = options.placeHolder;
      inputOptions.valueSelection = options.valueSelection;
      inputOptions.prompt = options.prompt;
      inputOptions.value = options.value;
      inputOptions.ignoreFocusLost = options.ignoreFocusOut;
    }
    if (validateInput) {
      inputOptions.validateInput = (value) => {
        return this._proxy.$validateInput(value);
      };
    }
    return this._quickInputService.input(inputOptions, token);
  }
  $createOrUpdate(params) {
    const sessionId = params.id;
    let session = this.sessions.get(sessionId);
    if (!session) {
      const store = new DisposableStore();
      const input2 = params.type === "quickPick" ? this._quickInputService.createQuickPick() : this._quickInputService.createInputBox();
      store.add(input2);
      store.add(input2.onDidAccept(() => {
        this._proxy.$onDidAccept(sessionId);
      }));
      store.add(input2.onDidTriggerButton((button) => {
        this._proxy.$onDidTriggerButton(sessionId, button.handle, button.toggle?.checked);
      }));
      store.add(input2.onDidChangeValue((value) => {
        this._proxy.$onDidChangeValue(sessionId, value);
      }));
      store.add(input2.onDidHide(() => {
        this._proxy.$onDidHide(sessionId);
      }));
      if (params.type === "quickPick") {
        const quickPick2 = input2;
        store.add(quickPick2.onDidChangeActive((items) => {
          this._proxy.$onDidChangeActive(sessionId, items.map((item) => item.handle));
        }));
        store.add(quickPick2.onDidChangeSelection((items) => {
          this._proxy.$onDidChangeSelection(sessionId, items.map((item) => item.handle));
        }));
        store.add(quickPick2.onDidTriggerItemButton((e) => {
          const transferButton = e.button;
          this._proxy.$onDidTriggerItemButton(
            sessionId,
            e.item.handle,
            transferButton.handle,
            transferButton.toggle?.checked
          );
        }));
      }
      session = {
        input: input2,
        handlesToItems: /* @__PURE__ */ new Map(),
        store
      };
      this.sessions.set(sessionId, session);
    }
    const { input, handlesToItems } = session;
    const quickPick = input;
    for (const param in params) {
      switch (param) {
        case "id":
        case "type":
          continue;
        case "visible":
          if (params.visible) {
            input.show();
          } else {
            input.hide();
          }
          break;
        case "items": {
          handlesToItems.clear();
          params.items?.forEach((item) => {
            this.expandItemProps(item);
            if (item.type !== "separator") {
              item.buttons?.forEach((button) => this.expandIconPath(button));
              handlesToItems.set(item.handle, item);
            }
          });
          quickPick.items = params.items;
          break;
        }
        case "activeItems":
          quickPick.activeItems = params.activeItems?.map((handle) => handlesToItems.get(handle)).filter(Boolean);
          break;
        case "selectedItems":
          quickPick.selectedItems = params.selectedItems?.map((handle) => handlesToItems.get(handle)).filter(Boolean);
          break;
        case "buttons": {
          const buttons = [];
          for (const button of params.buttons) {
            if (button.handle === -1) {
              buttons.push(this._quickInputService.backButton);
            } else {
              this.expandIconPath(button);
              buttons.push(button);
            }
          }
          input.buttons = buttons;
          break;
        }
        default:
          input[param] = params[param];
          break;
      }
    }
    return Promise.resolve(void 0);
  }
  $dispose(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.store.dispose();
      this.sessions.delete(sessionId);
    }
    return Promise.resolve(void 0);
  }
  /**
  * Derives icon, label and description for Quick Pick items that represent a resource URI.
  */
  expandItemProps(item) {
    if (item.type === "separator") {
      return;
    }
    if (!item.resourceUri) {
      this.expandIconPath(item);
      return;
    }
    const resourceUri = URI.from(item.resourceUri);
    item.label ??= this.customEditorLabelService.getName(resourceUri) || "";
    if (item.label) {
      item.description ??= this.labelService.getUriLabel(resourceUri, { relative: true });
    } else {
      item.label = basenameOrAuthority(resourceUri);
      item.description ??= this.labelService.getUriLabel(dirname(resourceUri), { relative: true });
    }
    const icon = item.iconPathDto;
    if (ThemeIcon.isThemeIcon(icon) && (ThemeIcon.isFile(icon) || ThemeIcon.isFolder(icon))) {
      const fileKind = ThemeIcon.isFolder(icon) || hasTrailingPathSeparator(resourceUri) ? FileKind.FOLDER : FileKind.FILE;
      const iconClasses = new Lazy(() => getIconClasses(this.modelService, this.languageService, resourceUri, fileKind));
      Object.defineProperty(item, "iconClasses", { get: () => iconClasses.value });
    } else {
      this.expandIconPath(item);
    }
  }
  /**
  * Converts IconPath DTO into iconPath/iconClass properties.
  */
  expandIconPath(target) {
    const icon = target.iconPathDto;
    if (!icon) {
      return;
    } else if (ThemeIcon.isThemeIcon(icon)) {
      target.iconClass = ThemeIcon.asClassName(icon);
    } else if (isUriComponents(icon)) {
      const uri = URI.from(icon);
      target.iconPath = { dark: uri, light: uri };
    } else {
      const { dark, light } = icon;
      target.iconPath = { dark: URI.from(dark), light: URI.from(light) };
    }
  }
};
MainThreadQuickOpen = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadQuickOpen),
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, ICustomEditorLabelService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ILanguageService)
], MainThreadQuickOpen);
export {
  MainThreadQuickOpen
};
