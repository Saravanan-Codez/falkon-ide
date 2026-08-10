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
import { StatusbarAlignment, IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { parseKeyboardLayoutDescription, areKeyboardLayoutsEqual, getKeyboardLayoutId, IKeyboardLayoutService } from "../../../../platform/keyboardLayout/common/keyboardLayout.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { KEYBOARD_LAYOUT_OPEN_PICKER } from "../common/preferences.js";
import { isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
let KeyboardLayoutPickerContribution = class extends Disposable {
  constructor(keyboardLayoutService, statusbarService) {
    super();
    this.keyboardLayoutService = keyboardLayoutService;
    this.statusbarService = statusbarService;
    this.pickerElement = this._register(new MutableDisposable());
    const name = nls.localize("status.workbench.keyboardLayout", "Keyboard Layout");
    const layout = this.keyboardLayoutService.getCurrentKeyboardLayout();
    if (layout) {
      const layoutInfo = parseKeyboardLayoutDescription(layout);
      const text = nls.localize("keyboardLayout", "Layout: {0}", layoutInfo.label);
      this.pickerElement.value = this.statusbarService.addEntry(
        {
          name,
          text,
          ariaLabel: text,
          command: KEYBOARD_LAYOUT_OPEN_PICKER
        },
        "status.workbench.keyboardLayout",
        StatusbarAlignment.RIGHT
      );
    }
    this._register(this.keyboardLayoutService.onDidChangeKeyboardLayout(() => {
      const layout2 = this.keyboardLayoutService.getCurrentKeyboardLayout();
      const layoutInfo = parseKeyboardLayoutDescription(layout2);
      if (this.pickerElement.value) {
        const text = nls.localize("keyboardLayout", "Layout: {0}", layoutInfo.label);
        this.pickerElement.value.update({
          name,
          text,
          ariaLabel: text,
          command: KEYBOARD_LAYOUT_OPEN_PICKER
        });
      } else {
        const text = nls.localize("keyboardLayout", "Layout: {0}", layoutInfo.label);
        this.pickerElement.value = this.statusbarService.addEntry(
          {
            name,
            text,
            ariaLabel: text,
            command: KEYBOARD_LAYOUT_OPEN_PICKER
          },
          "status.workbench.keyboardLayout",
          StatusbarAlignment.RIGHT
        );
      }
    }));
  }
  static {
    this.ID = "workbench.contrib.keyboardLayoutPicker";
  }
};
KeyboardLayoutPickerContribution = __decorateClass([
  __decorateParam(0, IKeyboardLayoutService),
  __decorateParam(1, IStatusbarService)
], KeyboardLayoutPickerContribution);
registerWorkbenchContribution2(KeyboardLayoutPickerContribution.ID, KeyboardLayoutPickerContribution, WorkbenchPhase.BlockStartup);
const DEFAULT_CONTENT = [
  `// ${nls.localize("displayLanguage", "Defines the keyboard layout used in VS Code in the browser environment.")}`,
  `// ${nls.localize("doc", 'Open VS Code and run "Developer: Inspect Key Mappings (JSON)" from Command Palette.')}`,
  ``,
  `// Once you have the keyboard layout info, please paste it below.`,
  "\n"
].join("\n");
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: KEYBOARD_LAYOUT_OPEN_PICKER,
      title: nls.localize2("keyboard.chooseLayout", "Change Keyboard Layout"),
      f1: true
    });
  }
  async run(accessor) {
    const keyboardLayoutService = accessor.get(IKeyboardLayoutService);
    const quickInputService = accessor.get(IQuickInputService);
    const configurationService = accessor.get(IConfigurationService);
    const environmentService = accessor.get(IEnvironmentService);
    const editorService = accessor.get(IEditorService);
    const fileService = accessor.get(IFileService);
    const layouts = keyboardLayoutService.getAllKeyboardLayouts();
    const currentLayout = keyboardLayoutService.getCurrentKeyboardLayout();
    const layoutConfig = configurationService.getValue("keyboard.layout");
    const isAutoDetect = layoutConfig === "autodetect";
    const picks = layouts.map((layout) => {
      const picked = !isAutoDetect && areKeyboardLayoutsEqual(currentLayout, layout);
      const layoutInfo = parseKeyboardLayoutDescription(layout);
      return {
        layout,
        label: [layoutInfo.label, layout && layout.isUserKeyboardLayout ? "(User configured layout)" : ""].join(" "),
        id: layout.text || layout.lang || layout.layout,
        description: layoutInfo.description + (picked ? " (Current layout)" : ""),
        picked: !isAutoDetect && areKeyboardLayoutsEqual(currentLayout, layout)
      };
    }).sort((a, b) => {
      return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
    });
    if (picks.length > 0) {
      const platform = isMacintosh ? "Mac" : isWindows ? "Win" : "Linux";
      picks.unshift({ type: "separator", label: nls.localize("layoutPicks", "Keyboard Layouts ({0})", platform) });
    }
    const configureKeyboardLayout = { label: nls.localize("configureKeyboardLayout", "Configure Keyboard Layout") };
    picks.unshift(configureKeyboardLayout);
    const autoDetectMode = {
      label: nls.localize("autoDetect", "Auto Detect"),
      description: isAutoDetect ? `Current: ${parseKeyboardLayoutDescription(currentLayout).label}` : void 0,
      picked: isAutoDetect ? true : void 0
    };
    picks.unshift(autoDetectMode);
    const pick = await quickInputService.pick(picks, { placeHolder: nls.localize("pickKeyboardLayout", "Select Keyboard Layout"), matchOnDescription: true });
    if (!pick) {
      return;
    }
    if (pick === autoDetectMode) {
      configurationService.updateValue("keyboard.layout", "autodetect");
      return;
    }
    if (pick === configureKeyboardLayout) {
      const file = environmentService.keyboardLayoutResource;
      await fileService.stat(file).then(void 0, () => {
        return fileService.createFile(file, VSBuffer.fromString(DEFAULT_CONTENT));
      }).then((stat) => {
        if (!stat) {
          return void 0;
        }
        return editorService.openEditor({
          resource: stat.resource,
          languageId: "jsonc",
          options: { pinned: true }
        });
      }, (error) => {
        throw new Error(nls.localize("fail.createSettings", "Unable to create '{0}' ({1}).", file.toString(), error));
      });
      return Promise.resolve();
    }
    configurationService.updateValue("keyboard.layout", getKeyboardLayoutId(pick.layout));
  }
});
export {
  KeyboardLayoutPickerContribution
};
