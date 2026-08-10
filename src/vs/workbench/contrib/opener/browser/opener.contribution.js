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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { REVEAL_IN_EXPLORER_COMMAND_ID } from "../../files/browser/fileConstants.js";
let WorkbenchOpenerContribution = class extends Disposable {
  constructor(openerService, commandService, fileService, workspaceContextService) {
    super();
    this.commandService = commandService;
    this.fileService = fileService;
    this.workspaceContextService = workspaceContextService;
    this._register(openerService.registerOpener(this));
  }
  static {
    this.ID = "workbench.contrib.opener";
  }
  async open(link, options) {
    try {
      if (options?.openExternal) {
        return false;
      }
      const uri = typeof link === "string" ? URI.parse(link) : link;
      if (this.workspaceContextService.isInsideWorkspace(uri)) {
        if ((await this.fileService.stat(uri)).isDirectory) {
          await this.commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, uri);
          return true;
        }
      }
    } catch {
    }
    return false;
  }
};
WorkbenchOpenerContribution = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IWorkspaceContextService)
], WorkbenchOpenerContribution);
registerWorkbenchContribution2(WorkbenchOpenerContribution.ID, WorkbenchOpenerContribution, WorkbenchPhase.Eventually);
