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
import { getErrorMessage } from "../../../base/common/errors.js";
import { isDefined } from "../../../base/common/types.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService, LogLevel } from "../../log/common/log.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { ExtensionSignatureVerificationCode } from "../common/extensionManagement.js";
const IExtensionSignatureVerificationService = createDecorator("IExtensionSignatureVerificationService");
let ExtensionSignatureVerificationService = class {
  constructor(logService, telemetryService) {
    this.logService = logService;
    this.telemetryService = telemetryService;
  }
  vsceSign() {
    if (!this.moduleLoadingPromise) {
      this.moduleLoadingPromise = this.resolveVsceSign();
    }
    return this.moduleLoadingPromise;
  }
  async resolveVsceSign() {
    const mod = "@vscode/vsce-sign";
    return import(mod);
  }
  async verify(extensionId, version, vsixFilePath, signatureArchiveFilePath, clientTargetPlatform) {
    let module;
    try {
      module = await this.vsceSign();
    } catch (error) {
      this.logService.error("Could not load vsce-sign module", getErrorMessage(error));
      this.logService.info(`Extension signature verification is not done: ${extensionId}`);
      return void 0;
    }
    const startTime = (/* @__PURE__ */ new Date()).getTime();
    let result;
    try {
      this.logService.trace(`Verifying extension signature for ${extensionId}...`);
      result = await module.verify(vsixFilePath, signatureArchiveFilePath, this.logService.getLevel() === LogLevel.Trace);
    } catch (e) {
      result = {
        code: ExtensionSignatureVerificationCode.UnknownError,
        didExecute: false,
        output: getErrorMessage(e)
      };
    }
    const duration = (/* @__PURE__ */ new Date()).getTime() - startTime;
    this.logService.info(`Extension signature verification result for ${extensionId}: ${result.code}. ${isDefined(result.internalCode) ? `Internal Code: ${result.internalCode}. ` : ""}Executed: ${result.didExecute}. Duration: ${duration}ms.`);
    this.logService.trace(`Extension signature verification output for ${extensionId}:
${result.output}`);
    this.telemetryService.publicLog2("extensionsignature:verification", {
      extensionId,
      extensionVersion: version,
      code: result.code,
      internalCode: result.internalCode,
      duration,
      didExecute: result.didExecute,
      clientTargetPlatform
    });
    return { code: result.code };
  }
};
ExtensionSignatureVerificationService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, ITelemetryService)
], ExtensionSignatureVerificationService);
export {
  ExtensionSignatureVerificationService,
  IExtensionSignatureVerificationService
};
