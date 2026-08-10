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
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { isBash, isZsh } from "../../runInTerminalHelpers.js";
import { TerminalChatAgentToolsSettingId } from "../../../common/terminalChatAgentToolsConfiguration.js";
let CommandLinePreventHistoryRewriter = class extends Disposable {
  constructor(_configurationService) {
    super();
    this._configurationService = _configurationService;
  }
  rewrite(options) {
    const preventShellHistory = this._configurationService.getValue(TerminalChatAgentToolsSettingId.PreventShellHistory) === true;
    if (!preventShellHistory) {
      return void 0;
    }
    if (isBash(options.shell, options.os) || isZsh(options.shell, options.os)) {
      return {
        rewritten: ` ${options.commandLine}`,
        reasoning: "Prepended with a space to exclude from shell history"
      };
    }
    return void 0;
  }
};
CommandLinePreventHistoryRewriter = __decorateClass([
  __decorateParam(0, IConfigurationService)
], CommandLinePreventHistoryRewriter);
export {
  CommandLinePreventHistoryRewriter
};
