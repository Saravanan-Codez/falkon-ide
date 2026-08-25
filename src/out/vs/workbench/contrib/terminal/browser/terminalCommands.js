import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ITerminalGroupService } from "./terminal.js";
function setupTerminalCommands() {
  registerOpenTerminalAtIndexCommands();
}
function registerOpenTerminalAtIndexCommands() {
  for (let i = 0; i < 9; i++) {
    const terminalIndex = i;
    const visibleIndex = i + 1;
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: `workbench.action.terminal.focusAtIndex${visibleIndex}`,
      weight: KeybindingWeight.WorkbenchContrib,
      when: void 0,
      primary: 0,
      handler: (accessor) => {
        accessor.get(ITerminalGroupService).setActiveInstanceByIndex(terminalIndex);
        return accessor.get(ITerminalGroupService).showPanel(true);
      }
    });
  }
}
export {
  setupTerminalCommands
};
