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
import { TerminalChatAgentToolsSettingId } from "../../../common/terminalChatAgentToolsConfiguration.js";
import { ITerminalSandboxService } from "../../../common/terminalSandboxService.js";
let CommandLineSandboxAnalyzer = class extends Disposable {
  constructor(_sandboxService, _configurationService) {
    super();
    this._sandboxService = _sandboxService;
    this._configurationService = _configurationService;
  }
  _isAutoApproveEnabled() {
    return this._configurationService.getValue(TerminalChatAgentToolsSettingId.EnableAutoApprove) !== false;
  }
  async analyze(_options) {
    const isAutoApproveEnabled = this._isAutoApproveEnabled();
    if (!await this._sandboxService.isEnabled()) {
      return {
        isAutoApproveAllowed: isAutoApproveEnabled
      };
    }
    return {
      isAutoApproveAllowed: isAutoApproveEnabled,
      forceAutoApproval: !_options.requiresUnsandboxConfirmation && !_options.requiresAllowNetworkConfirmation && isAutoApproveEnabled
    };
  }
};
CommandLineSandboxAnalyzer = __decorateClass([
  __decorateParam(0, ITerminalSandboxService),
  __decorateParam(1, IConfigurationService)
], CommandLineSandboxAnalyzer);
export {
  CommandLineSandboxAnalyzer
};
