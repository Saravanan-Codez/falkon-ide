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
import * as nls from "../../../../nls.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
const showStartEntryInWeb = new RawContextKey("showRemoteStartEntryInWeb", false);
let RemoteStartEntry = class extends Disposable {
  constructor(commandService, productService, extensionManagementService, extensionEnablementService, telemetryService, contextKeyService) {
    super();
    this.commandService = commandService;
    this.productService = productService;
    this.extensionManagementService = extensionManagementService;
    this.extensionEnablementService = extensionEnablementService;
    this.telemetryService = telemetryService;
    this.contextKeyService = contextKeyService;
    const remoteExtensionTips = this.productService.remoteExtensionTips?.["tunnel"];
    this.startCommand = remoteExtensionTips?.startEntry?.startCommand ?? "";
    this.remoteExtensionId = remoteExtensionTips?.extensionId ?? "";
    this._init();
    this.registerActions();
    this.registerListeners();
  }
  static {
    this.REMOTE_WEB_START_ENTRY_ACTIONS_COMMAND_ID = "workbench.action.remote.showWebStartEntryActions";
  }
  registerActions() {
    const category = nls.localize2("remote.category", "Remote");
    const startEntry = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: RemoteStartEntry.REMOTE_WEB_START_ENTRY_ACTIONS_COMMAND_ID,
          category,
          title: nls.localize2("remote.showWebStartEntryActions", "Show Remote Start Entry for web"),
          f1: false
        });
      }
      async run() {
        await startEntry.showWebRemoteStartActions();
      }
    }));
  }
  registerListeners() {
    this._register(this.extensionEnablementService.onEnablementChanged(async (result) => {
      for (const ext of result) {
        if (ExtensionIdentifier.equals(this.remoteExtensionId, ext.identifier.id)) {
          if (this.extensionEnablementService.isEnabled(ext)) {
            showStartEntryInWeb.bindTo(this.contextKeyService).set(true);
          } else {
            showStartEntryInWeb.bindTo(this.contextKeyService).set(false);
          }
        }
      }
    }));
  }
  async _init() {
    const installed = (await this.extensionManagementService.getInstalled()).find((value) => ExtensionIdentifier.equals(value.identifier.id, this.remoteExtensionId));
    if (installed) {
      if (this.extensionEnablementService.isEnabled(installed)) {
        showStartEntryInWeb.bindTo(this.contextKeyService).set(true);
      }
    }
  }
  async showWebRemoteStartActions() {
    this.commandService.executeCommand(this.startCommand);
    this.telemetryService.publicLog2("workbenchActionExecuted", {
      id: this.startCommand,
      from: "remote start entry"
    });
  }
};
RemoteStartEntry = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IProductService),
  __decorateParam(2, IExtensionManagementService),
  __decorateParam(3, IWorkbenchExtensionEnablementService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IContextKeyService)
], RemoteStartEntry);
export {
  RemoteStartEntry,
  showStartEntryInWeb
};
