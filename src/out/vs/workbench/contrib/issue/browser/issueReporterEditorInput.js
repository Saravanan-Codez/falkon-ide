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
import { EditorInput } from "../../../common/editor/editorInput.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { ConfirmResult, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { localize } from "../../../../nls.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
const issueReporterIcon = registerIcon("issue-reporter", Codicon.report, localize("issueReporterIcon", "Icon for the issue reporter editor."));
let IssueReporterEditorInput = class extends EditorInput {
  constructor(data, dialogService) {
    super();
    this.dialogService = dialogService;
    this.data = data;
    this.closeHandler = {
      showConfirm: () => !!this.hasUserInputFn?.(),
      confirm: async () => {
        const { confirmed } = await this.dialogService.confirm({
          message: localize("discardIssue", "Discard issue report?"),
          detail: localize("discardIssueDetail", "Your issue report has unsaved changes that will be lost."),
          primaryButton: localize("discard", "Discard"),
          type: "warning"
        });
        return confirmed ? ConfirmResult.DONT_SAVE : ConfirmResult.CANCEL;
      }
    };
  }
  static {
    this.ID = "workbench.input.issueReporter";
  }
  static {
    this.RESOURCE = URI.from({ scheme: "vscode-issue-reporter", path: "reporter" });
  }
  get typeId() {
    return IssueReporterEditorInput.ID;
  }
  get editorId() {
    return this.typeId;
  }
  get resource() {
    return IssueReporterEditorInput.RESOURCE;
  }
  getName() {
    return localize("issueReporterEditorInputName", "Report Issue");
  }
  getIcon() {
    return issueReporterIcon;
  }
  matches(other) {
    return other instanceof IssueReporterEditorInput;
  }
  get capabilities() {
    return EditorInputCapabilities.Singleton | EditorInputCapabilities.Readonly;
  }
};
IssueReporterEditorInput = __decorateClass([
  __decorateParam(1, IDialogService)
], IssueReporterEditorInput);
export {
  IssueReporterEditorInput
};
