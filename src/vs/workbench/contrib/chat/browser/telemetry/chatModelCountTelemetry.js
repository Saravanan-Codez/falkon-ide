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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../../common/contributions.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { IChatWidgetService } from "../chat.js";
let ChatModelCountTelemetry = class extends Disposable {
  constructor(chatService, chatWidgetService, telemetryService) {
    super();
    this.chatService = chatService;
    this.chatWidgetService = chatWidgetService;
    this.telemetryService = telemetryService;
    this.logStartupTelemetry();
    this._register(this.chatService.onDidCreateModel((model) => this.onDidCreateModel(model.initialLocation)));
  }
  static {
    this.ID = "workbench.contrib.chatModelCountTelemetry";
  }
  logStartupTelemetry() {
    this.telemetryService.publicLog2("chat.modelsAtStartup", this.getSnapshot());
  }
  onDidCreateModel(newModelLocation) {
    const snapshot = this.getSnapshot();
    if (snapshot.totalModels <= 1) {
      return;
    }
    this.telemetryService.publicLog2("chat.modelCreatedStats", {
      ...snapshot,
      newModelLocation
    });
  }
  getSnapshot() {
    const snapshot = this.chatService.getChatModelReferenceDebugInfo();
    let modelsOpenInWidgets = 0;
    let backgroundModels = 0;
    let backgroundModels_modifiedEditsKeepAlive = 0;
    let backgroundModels_requestInProgressKeepAlive = 0;
    let backgroundModels_otherHolders = 0;
    for (const model of snapshot.models) {
      if (this.chatWidgetService.getWidgetBySessionResource(model.sessionResource)) {
        modelsOpenInWidgets++;
      } else {
        backgroundModels++;
        let hasOther = false;
        for (const { holder } of model.holders) {
          if (holder === "ChatModel#modifiedEditsKeepAlive") {
            backgroundModels_modifiedEditsKeepAlive++;
          } else if (holder === "ChatModel#requestInProgressKeepAlive") {
            backgroundModels_requestInProgressKeepAlive++;
          } else {
            hasOther = true;
          }
        }
        if (hasOther) {
          backgroundModels_otherHolders++;
        }
      }
    }
    return {
      totalModels: snapshot.totalModels,
      modelsOpenInWidgets,
      backgroundModels,
      backgroundModels_modifiedEditsKeepAlive,
      backgroundModels_requestInProgressKeepAlive,
      backgroundModels_otherHolders
    };
  }
};
ChatModelCountTelemetry = __decorateClass([
  __decorateParam(0, IChatService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, ITelemetryService)
], ChatModelCountTelemetry);
registerWorkbenchContribution2(ChatModelCountTelemetry.ID, ChatModelCountTelemetry, WorkbenchPhase.AfterRestored);
export {
  ChatModelCountTelemetry
};
