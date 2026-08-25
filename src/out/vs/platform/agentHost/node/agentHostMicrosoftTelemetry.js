import { Disposable, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { OneDataSystemAppender } from "../../telemetry/node/1dsAppender.js";
const INTERNAL_LARGE_STORAGE_ARIA_KEY = "ec712b3202c5462fb6877acae7f1f9d7-c19ad55e-3e3c-4f99-984b-827f6d95bd9e-6917";
const INTERNAL_EVENT_PREFIX = "GitHub.copilot-chat";
const INTERNAL_EXTENSION_ID = "GitHub.copilot-chat";
function getInternalCommonProperties(commonProperties, extensionVersion) {
  if (!commonProperties) {
    return void 0;
  }
  const result = /* @__PURE__ */ Object.create(null);
  Object.defineProperties(result, Object.getOwnPropertyDescriptors(commonProperties));
  result["common.extname"] = INTERNAL_EXTENSION_ID;
  result["common.extversion"] = extensionVersion;
  result["common.vscodemachineid"] = commonProperties["common.machineId"];
  result["common.vscodesessionid"] = commonProperties["sessionID"];
  result["common.vscodecommithash"] = commonProperties["commitHash"];
  result["common.vscodeversion"] = commonProperties["version"];
  return result;
}
class InternalTelemetryAppender extends Disposable {
  constructor(appender) {
    super();
    this.appender = appender;
    this._register(toDisposable(() => {
      void appender.flush();
    }));
  }
}
class AgentHostInternalTelemetrySender extends Disposable {
  constructor(_options = {}) {
    super();
    this._options = _options;
    this._appender = this._register(new MutableDisposable());
  }
  setContext(context) {
    this._context = context?.isInternal ? context : void 0;
    if (!this._context) {
      this._appender.clear();
      return;
    }
    const createAppender = this._options.createAppender ?? ((requestService, commonProperties) => new OneDataSystemAppender(requestService, true, INTERNAL_EVENT_PREFIX, commonProperties ?? null, INTERNAL_LARGE_STORAGE_ARIA_KEY));
    this._appender.value ??= new InternalTelemetryAppender(createAppender(this._options.requestService, getInternalCommonProperties(this._options.commonProperties, this._options.extensionVersion), INTERNAL_EVENT_PREFIX));
  }
  send(eventName, properties, measurements) {
    if (!this._context) {
      return;
    }
    this.sendForContext(this._context, eventName, properties, measurements);
  }
  sendForContext(context, eventName, properties, measurements) {
    if (!context.isInternal) {
      return;
    }
    const createAppender = this._options.createAppender ?? ((requestService, commonProperties) => new OneDataSystemAppender(requestService, true, INTERNAL_EVENT_PREFIX, commonProperties ?? null, INTERNAL_LARGE_STORAGE_ARIA_KEY));
    this._appender.value ??= new InternalTelemetryAppender(createAppender(this._options.requestService, getInternalCommonProperties(this._options.commonProperties, this._options.extensionVersion), INTERNAL_EVENT_PREFIX));
    this._appender.value.appender.log(eventName, {
      ...properties,
      ...measurements,
      "common.tid": context.trackingId,
      "common.userName": context.userName ?? "undefined",
      "common.isVscodeTeamMember": context.isVscodeTeamMember ? 1 : 0
    });
  }
}
export {
  AgentHostInternalTelemetrySender
};
