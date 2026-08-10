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
import { diffSets } from "../../../base/common/collections.js";
import { Emitter } from "../../../base/common/event.js";
import { assertReturnsDefined } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { MainContext, TabInputKind, TabModelOperationKind } from "./extHost.protocol.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import * as typeConverters from "./extHostTypeConverters.js";
import { ChatEditorTabInput, CustomEditorTabInput, InteractiveWindowInput, NotebookDiffEditorTabInput, NotebookEditorTabInput, TerminalEditorTabInput, TextDiffTabInput, TextMergeTabInput, TextTabInput, WebviewEditorTabInput, TextMultiDiffTabInput } from "./extHostTypes.js";
const IExtHostEditorTabs = createDecorator("IExtHostEditorTabs");
class ExtHostEditorTab {
  constructor(dto, parentGroup, activeTabIdGetter) {
    this._activeTabIdGetter = activeTabIdGetter;
    this._parentGroup = parentGroup;
    this.acceptDtoUpdate(dto);
  }
  get apiObject() {
    if (!this._apiObject) {
      const that = this;
      const obj = {
        get isActive() {
          return that._dto.id === that._activeTabIdGetter();
        },
        get label() {
          return that._dto.label;
        },
        get input() {
          return that._input;
        },
        get isDirty() {
          return that._dto.isDirty;
        },
        get isPinned() {
          return that._dto.isPinned;
        },
        get isPreview() {
          return that._dto.isPreview;
        },
        get group() {
          return that._parentGroup.apiObject;
        }
      };
      this._apiObject = Object.freeze(obj);
    }
    return this._apiObject;
  }
  get tabId() {
    return this._dto.id;
  }
  acceptDtoUpdate(dto) {
    this._dto = dto;
    this._input = this._initInput();
  }
  _initInput() {
    switch (this._dto.input.kind) {
      case TabInputKind.TextInput:
        return new TextTabInput(URI.revive(this._dto.input.uri));
      case TabInputKind.TextDiffInput:
        return new TextDiffTabInput(URI.revive(this._dto.input.original), URI.revive(this._dto.input.modified));
      case TabInputKind.TextMergeInput:
        return new TextMergeTabInput(URI.revive(this._dto.input.base), URI.revive(this._dto.input.input1), URI.revive(this._dto.input.input2), URI.revive(this._dto.input.result));
      case TabInputKind.CustomEditorInput:
        return new CustomEditorTabInput(URI.revive(this._dto.input.uri), this._dto.input.viewType);
      case TabInputKind.WebviewEditorInput:
        return new WebviewEditorTabInput(this._dto.input.viewType);
      case TabInputKind.NotebookInput:
        return new NotebookEditorTabInput(URI.revive(this._dto.input.uri), this._dto.input.notebookType);
      case TabInputKind.NotebookDiffInput:
        return new NotebookDiffEditorTabInput(URI.revive(this._dto.input.original), URI.revive(this._dto.input.modified), this._dto.input.notebookType);
      case TabInputKind.TerminalEditorInput:
        return new TerminalEditorTabInput();
      case TabInputKind.InteractiveEditorInput:
        return new InteractiveWindowInput(URI.revive(this._dto.input.uri), URI.revive(this._dto.input.inputBoxUri));
      case TabInputKind.ChatEditorInput:
        return new ChatEditorTabInput();
      case TabInputKind.MultiDiffEditorInput:
        return new TextMultiDiffTabInput(this._dto.input.diffEditors.map((diff) => new TextDiffTabInput(URI.revive(diff.original), URI.revive(diff.modified))));
      default:
        return void 0;
    }
  }
}
class ExtHostEditorTabGroup {
  constructor(dto, activeGroupIdGetter) {
    this._tabs = [];
    this._activeTabId = "";
    this._dto = dto;
    this._activeGroupIdGetter = activeGroupIdGetter;
    this._reconcileTabs(dto);
  }
  get apiObject() {
    if (!this._apiObject) {
      const that = this;
      const obj = {
        get isActive() {
          return that._dto.groupId === that._activeGroupIdGetter();
        },
        get viewColumn() {
          return typeConverters.ViewColumn.to(that._dto.viewColumn);
        },
        get activeTab() {
          return that._tabs.find((tab) => tab.tabId === that._activeTabId)?.apiObject;
        },
        get tabs() {
          return Object.freeze(that._tabs.map((tab) => tab.apiObject));
        }
      };
      this._apiObject = Object.freeze(obj);
    }
    return this._apiObject;
  }
  get groupId() {
    return this._dto.groupId;
  }
  get tabs() {
    return this._tabs;
  }
  acceptGroupDtoUpdate(dto) {
    this._dto = dto;
  }
  /**
   * Accepts a full group dto during a complete tab-model resync, reusing the
   * existing {@link ExtHostEditorTab} instances for tabs that still exist so
   * their (and this group's) frozen `apiObject` keeps a stable identity.
   * Extensions routinely key `Map`/`WeakMap`/`Set` collections by these
   * objects, so recreating them on every resync would break those lookups and
   * leak whatever they retain.
   */
  acceptModelUpdate(dto) {
    this._dto = dto;
    this._reconcileTabs(dto);
  }
  _reconcileTabs(dto) {
    const existingTabsById = /* @__PURE__ */ new Map();
    for (const tab of this._tabs) {
      existingTabsById.set(tab.tabId, tab);
    }
    this._activeTabId = "";
    this._tabs = dto.tabs.map((tabDto) => {
      if (tabDto.isActive) {
        this._activeTabId = tabDto.id;
      }
      const existing = existingTabsById.get(tabDto.id);
      if (existing) {
        existing.acceptDtoUpdate(tabDto);
        return existing;
      }
      return new ExtHostEditorTab(tabDto, this, () => this.activeTabId());
    });
  }
  acceptTabOperation(operation) {
    if (operation.kind === TabModelOperationKind.TAB_OPEN) {
      const tab2 = new ExtHostEditorTab(operation.tabDto, this, () => this.activeTabId());
      this._tabs.splice(operation.index, 0, tab2);
      if (operation.tabDto.isActive) {
        this._activeTabId = tab2.tabId;
      }
      return tab2;
    } else if (operation.kind === TabModelOperationKind.TAB_CLOSE) {
      const tab2 = this._tabs.splice(operation.index, 1)[0];
      if (!tab2) {
        throw new Error(`Tab close updated received for index ${operation.index} which does not exist`);
      }
      if (tab2.tabId === this._activeTabId) {
        this._activeTabId = "";
      }
      return tab2;
    } else if (operation.kind === TabModelOperationKind.TAB_MOVE) {
      if (operation.oldIndex === void 0) {
        throw new Error("Invalid old index on move IPC");
      }
      const tab2 = this._tabs.splice(operation.oldIndex, 1)[0];
      if (!tab2) {
        throw new Error(`Tab move updated received for index ${operation.oldIndex} which does not exist`);
      }
      this._tabs.splice(operation.index, 0, tab2);
      return tab2;
    }
    const tab = this._tabs.find((extHostTab) => extHostTab.tabId === operation.tabDto.id);
    if (!tab) {
      throw new Error("INVALID tab");
    }
    if (operation.tabDto.isActive) {
      this._activeTabId = operation.tabDto.id;
    } else if (this._activeTabId === operation.tabDto.id && !operation.tabDto.isActive) {
      this._activeTabId = "";
    }
    tab.acceptDtoUpdate(operation.tabDto);
    return tab;
  }
  // Not a getter since it must be a function to be used as a callback for the tabs
  activeTabId() {
    return this._activeTabId;
  }
}
let ExtHostEditorTabs = class {
  constructor(extHostRpc) {
    this._onDidChangeTabs = new Emitter();
    this._onDidChangeTabGroups = new Emitter();
    this._extHostTabGroups = [];
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadEditorTabs);
  }
  get tabGroups() {
    if (!this._apiObject) {
      const that = this;
      const obj = {
        // never changes -> simple value
        onDidChangeTabGroups: that._onDidChangeTabGroups.event,
        onDidChangeTabs: that._onDidChangeTabs.event,
        // dynamic -> getters
        get all() {
          return Object.freeze(that._extHostTabGroups.map((group) => group.apiObject));
        },
        get activeTabGroup() {
          const activeTabGroupId = that._activeGroupId;
          const activeTabGroup = assertReturnsDefined(that._extHostTabGroups.find((candidate) => candidate.groupId === activeTabGroupId)?.apiObject);
          return activeTabGroup;
        },
        close: async (tabOrTabGroup, preserveFocus) => {
          const tabsOrTabGroups = Array.isArray(tabOrTabGroup) ? tabOrTabGroup : [tabOrTabGroup];
          if (!tabsOrTabGroups.length) {
            return true;
          }
          if (isTabGroup(tabsOrTabGroups[0])) {
            return this._closeGroups(tabsOrTabGroups, preserveFocus);
          } else {
            return this._closeTabs(tabsOrTabGroups, preserveFocus);
          }
        }
        // move: async (tab: vscode.Tab, viewColumn: ViewColumn, index: number, preserveFocus?: boolean) => {
        // 	const extHostTab = this._findExtHostTabFromApi(tab);
        // 	if (!extHostTab) {
        // 		throw new Error('Invalid tab');
        // 	}
        // 	this._proxy.$moveTab(extHostTab.tabId, index, typeConverters.ViewColumn.from(viewColumn), preserveFocus);
        // 	return;
        // }
      };
      this._apiObject = Object.freeze(obj);
    }
    return this._apiObject;
  }
  $acceptEditorTabModel(tabGroups) {
    const groupIdsBefore = new Set(this._extHostTabGroups.map((group) => group.groupId));
    const groupIdsAfter = new Set(tabGroups.map((dto) => dto.groupId));
    const diff = diffSets(groupIdsBefore, groupIdsAfter);
    const closed = this._extHostTabGroups.filter((group) => diff.removed.includes(group.groupId)).map((group) => group.apiObject);
    const opened = [];
    const changed = [];
    const existingGroupsById = /* @__PURE__ */ new Map();
    for (const group of this._extHostTabGroups) {
      existingGroupsById.set(group.groupId, group);
    }
    this._extHostTabGroups = tabGroups.map((tabGroup) => {
      const existing = existingGroupsById.get(tabGroup.groupId);
      if (existing) {
        existing.acceptModelUpdate(tabGroup);
        changed.push(existing.apiObject);
        return existing;
      }
      const group = new ExtHostEditorTabGroup(tabGroup, () => this._activeGroupId);
      opened.push(group.apiObject);
      return group;
    });
    const activeTabGroupId = assertReturnsDefined(tabGroups.find((group) => group.isActive === true)?.groupId);
    if (activeTabGroupId !== void 0 && this._activeGroupId !== activeTabGroupId) {
      this._activeGroupId = activeTabGroupId;
    }
    this._onDidChangeTabGroups.fire(Object.freeze({ opened, closed, changed }));
  }
  $acceptTabGroupUpdate(groupDto) {
    const group = this._extHostTabGroups.find((group2) => group2.groupId === groupDto.groupId);
    if (!group) {
      throw new Error("Update Group IPC call received before group creation.");
    }
    group.acceptGroupDtoUpdate(groupDto);
    if (groupDto.isActive) {
      this._activeGroupId = groupDto.groupId;
    }
    this._onDidChangeTabGroups.fire(Object.freeze({ changed: [group.apiObject], opened: [], closed: [] }));
  }
  $acceptTabOperation(operation) {
    const group = this._extHostTabGroups.find((group2) => group2.groupId === operation.groupId);
    if (!group) {
      throw new Error("Update Tabs IPC call received before group creation.");
    }
    const tab = group.acceptTabOperation(operation);
    switch (operation.kind) {
      case TabModelOperationKind.TAB_OPEN:
        this._onDidChangeTabs.fire(Object.freeze({
          opened: [tab.apiObject],
          closed: [],
          changed: []
        }));
        return;
      case TabModelOperationKind.TAB_CLOSE:
        this._onDidChangeTabs.fire(Object.freeze({
          opened: [],
          closed: [tab.apiObject],
          changed: []
        }));
        return;
      case TabModelOperationKind.TAB_MOVE:
      case TabModelOperationKind.TAB_UPDATE:
        this._onDidChangeTabs.fire(Object.freeze({
          opened: [],
          closed: [],
          changed: [tab.apiObject]
        }));
        return;
    }
  }
  _findExtHostTabFromApi(apiTab) {
    for (const group of this._extHostTabGroups) {
      for (const tab of group.tabs) {
        if (tab.apiObject === apiTab) {
          return tab;
        }
      }
    }
    return;
  }
  _findExtHostTabGroupFromApi(apiTabGroup) {
    return this._extHostTabGroups.find((candidate) => candidate.apiObject === apiTabGroup);
  }
  async _closeTabs(tabs, preserveFocus) {
    const extHostTabIds = [];
    for (const tab of tabs) {
      const extHostTab = this._findExtHostTabFromApi(tab);
      if (!extHostTab) {
        throw new Error("Tab close: Invalid tab not found!");
      }
      extHostTabIds.push(extHostTab.tabId);
    }
    return this._proxy.$closeTab(extHostTabIds, preserveFocus);
  }
  async _closeGroups(groups, preserverFoucs) {
    const extHostGroupIds = [];
    for (const group of groups) {
      const extHostGroup = this._findExtHostTabGroupFromApi(group);
      if (!extHostGroup) {
        throw new Error("Group close: Invalid group not found!");
      }
      extHostGroupIds.push(extHostGroup.groupId);
    }
    return this._proxy.$closeGroup(extHostGroupIds, preserverFoucs);
  }
};
ExtHostEditorTabs = __decorateClass([
  __decorateParam(0, IExtHostRpcService)
], ExtHostEditorTabs);
function isTabGroup(obj) {
  const tabGroup = obj;
  if (tabGroup.tabs !== void 0) {
    return true;
  }
  return false;
}
export {
  ExtHostEditorTabs,
  IExtHostEditorTabs
};
