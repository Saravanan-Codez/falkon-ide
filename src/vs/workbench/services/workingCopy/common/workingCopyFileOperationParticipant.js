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
import { ILogService } from "../../../../platform/log/common/log.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
let WorkingCopyFileOperationParticipant = class extends Disposable {
  constructor(logService, configurationService) {
    super();
    this.logService = logService;
    this.configurationService = configurationService;
    this.participants = new LinkedList();
  }
  addFileOperationParticipant(participant) {
    const remove = this.participants.push(participant);
    return toDisposable(() => remove());
  }
  async participate(files, operation, undoInfo, token) {
    const timeout = this.configurationService.getValue("files.participants.timeout");
    if (typeof timeout !== "number" || timeout <= 0) {
      return;
    }
    for (const participant of this.participants) {
      try {
        await participant.participate(files, operation, undoInfo, timeout, token);
      } catch (err) {
        this.logService.warn(err);
      }
    }
  }
  dispose() {
    this.participants.clear();
    super.dispose();
  }
};
WorkingCopyFileOperationParticipant = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IConfigurationService)
], WorkingCopyFileOperationParticipant);
export {
  WorkingCopyFileOperationParticipant
};
