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
import "./media/emptyFileEditor.css";
import { $, append } from "../../../../base/browser/dom.js";
import { Action } from "../../../../base/common/actions.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../../workbench/browser/parts/editor/editorPane.js";
import { CompactButtonActionViewItem } from "../../sessions/browser/sessionsActions.js";
import { EmptyFileEditorInput } from "./emptyFileEditorInput.js";
const QUICK_OPEN_COMMAND_ID = "workbench.action.quickOpen";
class SearchFilesActionViewItem extends CompactButtonActionViewItem {
  get commandId() {
    return QUICK_OPEN_COMMAND_ID;
  }
  get label() {
    return localize("emptyFileEditor.search", "Search Files");
  }
  getHoverContent(keybindingLabel) {
    return keybindingLabel ? localize("emptyFileEditor.searchTooltip", "Search Files ({0})", keybindingLabel) : localize("emptyFileEditor.searchTooltipNoKeybinding", "Search Files");
  }
  getAriaLabel(keybindingAriaLabel) {
    return keybindingAriaLabel ? localize("emptyFileEditor.searchAria", "Search Files ({0})", keybindingAriaLabel) : localize("emptyFileEditor.searchAriaNoKeybinding", "Search Files");
  }
}
let EmptyFileEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, commandService, instantiationService) {
    super(EmptyFileEditor.ID, group, telemetryService, themeService, storageService);
    this.commandService = commandService;
    this.instantiationService = instantiationService;
  }
  static {
    this.ID = EmptyFileEditorInput.EDITOR_ID;
  }
  createEditor(parent) {
    const container = append(parent, $(".empty-file-editor"));
    const content = append(container, $(".empty-file-editor-content"));
    append(content, $(`.empty-file-editor-icon${ThemeIcon.asCSSSelector(EmptyFileEditorInput.ICON)}`));
    const description = append(content, $(".empty-file-editor-description"));
    description.textContent = localize("emptyFileEditor.description", "Select a file from the Files view");
    const actions = append(content, $(".empty-file-editor-actions"));
    const action = this._register(this.createSearchAction());
    const actionViewItem = this._register(this.instantiationService.createInstance(SearchFilesActionViewItem, action));
    actionViewItem.render(actions);
  }
  createSearchAction() {
    return new Action(QUICK_OPEN_COMMAND_ID, localize("emptyFileEditor.search", "Search Files"), void 0, true, () => this.commandService.executeCommand(QUICK_OPEN_COMMAND_ID, ""));
  }
  focus() {
  }
  layout(_dimension) {
  }
};
EmptyFileEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IInstantiationService)
], EmptyFileEditor);
export {
  EmptyFileEditor
};
