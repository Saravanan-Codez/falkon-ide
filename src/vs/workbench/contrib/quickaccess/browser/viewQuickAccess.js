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
import { localize, localize2 } from "../../../../nls.js";
import { IQuickInputService, ItemActivation } from "../../../../platform/quickinput/common/quickInput.js";
import { PickerQuickAccessProvider } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { ITerminalGroupService, ITerminalService } from "../../terminal/browser/terminal.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { matchesFuzzy } from "../../../../base/common/filters.js";
import { fuzzyContains } from "../../../../base/common/strings.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Action2 } from "../../../../platform/actions/common/actions.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { IDebugService, REPL_VIEW_ID } from "../../debug/common/debug.js";
let ViewQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(viewDescriptorService, viewsService, outputService, terminalService, terminalGroupService, debugService, paneCompositeService, contextKeyService) {
    super(ViewQuickAccessProvider.PREFIX, {
      noResultsPick: {
        label: localize("noViewResults", "No matching views"),
        containerLabel: ""
      }
    });
    this.viewDescriptorService = viewDescriptorService;
    this.viewsService = viewsService;
    this.outputService = outputService;
    this.terminalService = terminalService;
    this.terminalGroupService = terminalGroupService;
    this.debugService = debugService;
    this.paneCompositeService = paneCompositeService;
    this.contextKeyService = contextKeyService;
  }
  static {
    this.PREFIX = "view ";
  }
  _getPicks(filter) {
    const filteredViewEntries = this.doGetViewPickItems().filter((entry) => {
      if (!filter) {
        return true;
      }
      entry.highlights = { label: matchesFuzzy(filter, entry.label, true) ?? void 0 };
      return entry.highlights.label || fuzzyContains(entry.containerLabel, filter);
    });
    const mapEntryToContainer = /* @__PURE__ */ new Map();
    for (const entry of filteredViewEntries) {
      if (!mapEntryToContainer.has(entry.label)) {
        mapEntryToContainer.set(entry.label, entry.containerLabel);
      }
    }
    const filteredViewEntriesWithSeparators = [];
    let lastContainer = void 0;
    for (const entry of filteredViewEntries) {
      if (lastContainer !== entry.containerLabel) {
        lastContainer = entry.containerLabel;
        let separatorLabel;
        if (mapEntryToContainer.has(lastContainer)) {
          separatorLabel = `${mapEntryToContainer.get(lastContainer)} / ${lastContainer}`;
        } else {
          separatorLabel = lastContainer;
        }
        filteredViewEntriesWithSeparators.push({ type: "separator", label: separatorLabel });
      }
      filteredViewEntriesWithSeparators.push(entry);
    }
    return filteredViewEntriesWithSeparators;
  }
  doGetViewPickItems() {
    const viewEntries = [];
    const getViewEntriesForPaneComposite = (paneComposite, viewContainer) => {
      const viewContainerModel = this.viewDescriptorService.getViewContainerModel(viewContainer);
      const result = [];
      for (const view of viewContainerModel.allViewDescriptors) {
        if (this.contextKeyService.contextMatchesRules(view.when)) {
          result.push({
            label: view.name.value,
            containerLabel: viewContainerModel.title,
            accept: () => this.viewsService.openView(view.id, true)
          });
        }
      }
      return result;
    };
    const addPaneComposites = (location, containerLabel) => {
      const paneComposites = this.paneCompositeService.getPaneComposites(location);
      const visiblePaneCompositeIds = this.paneCompositeService.getVisiblePaneCompositeIds(location);
      paneComposites.sort((a, b) => {
        let aIndex = visiblePaneCompositeIds.findIndex((id) => a.id === id);
        let bIndex = visiblePaneCompositeIds.findIndex((id) => b.id === id);
        if (aIndex < 0) {
          aIndex = paneComposites.indexOf(a) + visiblePaneCompositeIds.length;
        }
        if (bIndex < 0) {
          bIndex = paneComposites.indexOf(b) + visiblePaneCompositeIds.length;
        }
        return aIndex - bIndex;
      });
      for (const paneComposite of paneComposites) {
        if (this.includeViewContainer(paneComposite)) {
          const viewContainer = this.viewDescriptorService.getViewContainerById(paneComposite.id);
          if (viewContainer) {
            viewEntries.push({
              label: this.viewDescriptorService.getViewContainerModel(viewContainer).title,
              containerLabel,
              accept: () => this.paneCompositeService.openPaneComposite(paneComposite.id, location, true)
            });
          }
        }
      }
    };
    addPaneComposites(ViewContainerLocation.Sidebar, localize("views", "Side Bar"));
    addPaneComposites(ViewContainerLocation.Panel, localize("panels", "Panel"));
    addPaneComposites(ViewContainerLocation.AuxiliaryBar, localize("secondary side bar", "Secondary Side Bar"));
    const addPaneCompositeViews = (location) => {
      const paneComposites = this.paneCompositeService.getPaneComposites(location);
      for (const paneComposite of paneComposites) {
        const viewContainer = this.viewDescriptorService.getViewContainerById(paneComposite.id);
        if (viewContainer) {
          viewEntries.push(...getViewEntriesForPaneComposite(paneComposite, viewContainer));
        }
      }
    };
    addPaneCompositeViews(ViewContainerLocation.Sidebar);
    addPaneCompositeViews(ViewContainerLocation.Panel);
    addPaneCompositeViews(ViewContainerLocation.AuxiliaryBar);
    this.terminalGroupService.groups.forEach((group, groupIndex) => {
      group.terminalInstances.forEach((terminal, terminalIndex) => {
        const label = localize("terminalTitle", "{0}: {1}", `${groupIndex + 1}.${terminalIndex + 1}`, terminal.title);
        viewEntries.push({
          label,
          containerLabel: localize("terminals", "Terminal"),
          accept: async () => {
            await this.terminalGroupService.showPanel(true);
            this.terminalService.setActiveInstance(terminal);
          }
        });
      });
    });
    this.debugService.getModel().getSessions(true).filter((s) => s.hasSeparateRepl()).forEach((session, _) => {
      const label = session.name;
      viewEntries.push({
        label,
        containerLabel: localize("debugConsoles", "Debug Console"),
        accept: async () => {
          await this.debugService.focusStackFrame(void 0, void 0, session, { explicit: true });
          if (!this.viewsService.isViewVisible(REPL_VIEW_ID)) {
            await this.viewsService.openView(REPL_VIEW_ID, true);
          }
        }
      });
    });
    const channels = this.outputService.getChannelDescriptors();
    for (const channel of channels) {
      viewEntries.push({
        label: channel.label,
        containerLabel: localize("channels", "Output"),
        accept: () => this.outputService.showChannel(channel.id)
      });
    }
    return viewEntries;
  }
  includeViewContainer(container) {
    const viewContainer = this.viewDescriptorService.getViewContainerById(container.id);
    if (viewContainer?.hideIfEmpty) {
      return this.viewDescriptorService.getViewContainerModel(viewContainer).activeViewDescriptors.length > 0;
    }
    return true;
  }
};
ViewQuickAccessProvider = __decorateClass([
  __decorateParam(0, IViewDescriptorService),
  __decorateParam(1, IViewsService),
  __decorateParam(2, IOutputService),
  __decorateParam(3, ITerminalService),
  __decorateParam(4, ITerminalGroupService),
  __decorateParam(5, IDebugService),
  __decorateParam(6, IPaneCompositePartService),
  __decorateParam(7, IContextKeyService)
], ViewQuickAccessProvider);
class OpenViewPickerAction extends Action2 {
  static {
    this.ID = "workbench.action.openView";
  }
  constructor() {
    super({
      id: OpenViewPickerAction.ID,
      title: localize2("openView", "Open View"),
      category: Categories.View,
      f1: true
    });
  }
  async run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(ViewQuickAccessProvider.PREFIX);
  }
}
class QuickAccessViewPickerAction extends Action2 {
  static {
    this.ID = "workbench.action.quickOpenView";
  }
  static {
    this.KEYBINDING = {
      primary: KeyMod.CtrlCmd | KeyCode.KeyQ,
      mac: { primary: KeyMod.WinCtrl | KeyCode.KeyQ },
      linux: { primary: 0 }
    };
  }
  constructor() {
    super({
      id: QuickAccessViewPickerAction.ID,
      title: localize2("quickOpenView", "Quick Open View"),
      category: Categories.View,
      f1: false,
      // hide quick pickers from command palette to not confuse with the other entry that shows a input field
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: void 0,
        ...QuickAccessViewPickerAction.KEYBINDING
      }
    });
  }
  async run(accessor) {
    const keybindingService = accessor.get(IKeybindingService);
    const quickInputService = accessor.get(IQuickInputService);
    const keys = keybindingService.lookupKeybindings(QuickAccessViewPickerAction.ID);
    quickInputService.quickAccess.show(ViewQuickAccessProvider.PREFIX, { quickNavigateConfiguration: { keybindings: keys }, itemActivation: ItemActivation.FIRST });
  }
}
export {
  OpenViewPickerAction,
  QuickAccessViewPickerAction,
  ViewQuickAccessProvider
};
