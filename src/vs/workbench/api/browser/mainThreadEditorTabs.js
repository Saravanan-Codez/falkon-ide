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
import { Event } from "../../../base/common/event.js";
import { DisposableMap, DisposableStore } from "../../../base/common/lifecycle.js";
import { isEqual } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ExtHostContext, MainContext, TabInputKind, TabModelOperationKind } from "../common/extHost.protocol.js";
import { EditorResourceAccessor, GroupModelChangeKind, SideBySideEditor } from "../../common/editor.js";
import { DiffEditorInput } from "../../common/editor/diffEditorInput.js";
import { isGroupEditorMoveEvent } from "../../common/editor/editorGroupModel.js";
import { SideBySideEditorInput } from "../../common/editor/sideBySideEditorInput.js";
import { AbstractTextResourceEditorInput } from "../../common/editor/textResourceEditorInput.js";
import { ChatEditorInput } from "../../contrib/chat/browser/widgetHosts/editor/chatEditorInput.js";
import { CustomEditorInput } from "../../contrib/customEditor/browser/customEditorInput.js";
import { InteractiveEditorInput } from "../../contrib/interactive/browser/interactiveEditorInput.js";
import { MergeEditorInput } from "../../contrib/mergeEditor/browser/mergeEditorInput.js";
import { MultiDiffEditorInput } from "../../contrib/multiDiffEditor/browser/multiDiffEditorInput.js";
import { NotebookEditorInput } from "../../contrib/notebook/common/notebookEditorInput.js";
import { TerminalEditorInput } from "../../contrib/terminal/browser/terminalEditorInput.js";
import { WebviewInput } from "../../contrib/webviewPanel/browser/webviewEditorInput.js";
import { columnToEditorGroup, editorGroupToColumn } from "../../services/editor/common/editorGroupColumn.js";
import { GroupDirection, IEditorGroupsService, preferredSideBySideGroupDirection } from "../../services/editor/common/editorGroupsService.js";
import { IEditorService, SIDE_GROUP } from "../../services/editor/common/editorService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
let MainThreadEditorTabs = class {
  constructor(extHostContext, _editorGroupsService, _configurationService, _logService, editorService) {
    this._editorGroupsService = _editorGroupsService;
    this._configurationService = _configurationService;
    this._logService = _logService;
    this._dispoables = new DisposableStore();
    // List of all groups and their corresponding tabs, this is **the** model
    this._tabGroupModel = [];
    // Lookup table for finding group by id
    this._groupLookup = /* @__PURE__ */ new Map();
    // Lookup table for finding tab by id
    this._tabInfoLookup = /* @__PURE__ */ new Map();
    // Tracks the currently open MultiDiffEditorInputs to listen to resource changes
    this._multiDiffEditorInputListeners = new DisposableMap();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostEditorTabs);
    this._dispoables.add(editorService.onDidEditorsChange((event) => {
      try {
        this._updateTabsModel(event);
      } catch {
        this._logService.error("Failed to update model, rebuilding");
        this._createTabsModel();
      }
    }));
    this._dispoables.add(this._multiDiffEditorInputListeners);
    this._dispoables.add(this._editorGroupsService.onDidAddGroup(() => this._createTabsModel()));
    this._dispoables.add(this._editorGroupsService.onDidRemoveGroup(() => this._createTabsModel()));
    this._editorGroupsService.whenReady.then(() => this._createTabsModel());
  }
  dispose() {
    this._groupLookup.clear();
    this._tabInfoLookup.clear();
    this._dispoables.dispose();
  }
  /**
   * Creates a tab object with the correct properties
   * @param editor The editor input represented by the tab
   * @param group The group the tab is in
   * @returns A tab object
   */
  _buildTabObject(group, editor, editorIndex) {
    const editorId = editor.editorId;
    const tab = {
      id: this._generateTabId(editor, group.id),
      label: editor.getName(),
      editorId,
      input: this._editorInputToDto(editor),
      isPinned: group.isSticky(editorIndex),
      isPreview: !group.isPinned(editorIndex),
      isActive: group.isActive(editor),
      isDirty: editor.isDirty()
    };
    return tab;
  }
  _editorInputToDto(editor) {
    if (editor instanceof MergeEditorInput) {
      return {
        kind: TabInputKind.TextMergeInput,
        base: editor.base,
        input1: editor.input1.uri,
        input2: editor.input2.uri,
        result: editor.resource
      };
    }
    if (editor instanceof AbstractTextResourceEditorInput) {
      return {
        kind: TabInputKind.TextInput,
        uri: editor.resource
      };
    }
    if (editor instanceof SideBySideEditorInput && !(editor instanceof DiffEditorInput)) {
      const primaryResource = editor.primary.resource;
      const secondaryResource = editor.secondary.resource;
      if (editor.primary instanceof AbstractTextResourceEditorInput && editor.secondary instanceof AbstractTextResourceEditorInput && isEqual(primaryResource, secondaryResource) && primaryResource && secondaryResource) {
        return {
          kind: TabInputKind.TextInput,
          uri: primaryResource
        };
      }
      return { kind: TabInputKind.UnknownInput };
    }
    if (editor instanceof NotebookEditorInput) {
      return {
        kind: TabInputKind.NotebookInput,
        notebookType: editor.viewType,
        uri: editor.resource
      };
    }
    if (editor instanceof CustomEditorInput) {
      return {
        kind: TabInputKind.CustomEditorInput,
        viewType: editor.viewType,
        uri: editor.resource
      };
    }
    if (editor instanceof WebviewInput) {
      return {
        kind: TabInputKind.WebviewEditorInput,
        viewType: editor.viewType
      };
    }
    if (editor instanceof TerminalEditorInput) {
      return {
        kind: TabInputKind.TerminalEditorInput
      };
    }
    if (editor instanceof DiffEditorInput) {
      if (editor.modified instanceof AbstractTextResourceEditorInput && editor.original instanceof AbstractTextResourceEditorInput) {
        return {
          kind: TabInputKind.TextDiffInput,
          modified: editor.modified.resource,
          original: editor.original.resource
        };
      }
      if (editor.modified instanceof NotebookEditorInput && editor.original instanceof NotebookEditorInput) {
        return {
          kind: TabInputKind.NotebookDiffInput,
          notebookType: editor.original.viewType,
          modified: editor.modified.resource,
          original: editor.original.resource
        };
      }
    }
    if (editor instanceof InteractiveEditorInput) {
      return {
        kind: TabInputKind.InteractiveEditorInput,
        uri: editor.resource,
        inputBoxUri: editor.inputResource
      };
    }
    if (editor instanceof ChatEditorInput) {
      return {
        kind: TabInputKind.ChatEditorInput
      };
    }
    if (editor instanceof MultiDiffEditorInput) {
      const diffEditors = [];
      for (const resource of editor?.resources.get() ?? []) {
        if (resource.originalUri && resource.modifiedUri) {
          diffEditors.push({
            kind: TabInputKind.TextDiffInput,
            original: resource.originalUri,
            modified: resource.modifiedUri
          });
        }
      }
      return {
        kind: TabInputKind.MultiDiffEditorInput,
        diffEditors
      };
    }
    return { kind: TabInputKind.UnknownInput };
  }
  /**
   * Generates a unique id for a tab
   * @param editor The editor input
   * @param groupId The group id
   * @returns A unique identifier for a specific tab
   */
  _generateTabId(editor, groupId) {
    let resourceString;
    const resource = EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.BOTH });
    if (resource instanceof URI) {
      resourceString = resource.toString();
    } else {
      resourceString = `${resource?.primary?.toString()}-${resource?.secondary?.toString()}`;
    }
    return `${groupId}~${editor.editorId}-${editor.typeId}-${resourceString} `;
  }
  /**
   * Called whenever a group activates, updates the model by marking the group as active an notifies the extension host
   */
  _onDidGroupActivate() {
    const activeGroupId = this._editorGroupsService.activeGroup.id;
    const activeGroup = this._groupLookup.get(activeGroupId);
    if (activeGroup) {
      activeGroup.isActive = true;
      this._proxy.$acceptTabGroupUpdate(activeGroup);
    }
  }
  /**
   * Called when the tab label changes
   * @param groupId The id of the group the tab exists in
   * @param editorInput The editor input represented by the tab
   */
  _onDidTabLabelChange(groupId, editorInput, editorIndex) {
    const tabId = this._generateTabId(editorInput, groupId);
    const tabInfo = this._tabInfoLookup.get(tabId);
    if (tabInfo) {
      tabInfo.tab.label = editorInput.getName();
      this._proxy.$acceptTabOperation({
        groupId,
        index: editorIndex,
        tabDto: tabInfo.tab,
        kind: TabModelOperationKind.TAB_UPDATE
      });
    } else {
      this._logService.error("Invalid model for label change, rebuilding");
      this._createTabsModel();
    }
  }
  /**
   * Called when a new tab is opened
   * @param groupId The id of the group the tab is being created in
   * @param editorInput The editor input being opened
   * @param editorIndex The index of the editor within that group
   */
  _onDidTabOpen(groupId, editorInput, editorIndex) {
    const group = this._editorGroupsService.getGroup(groupId);
    const groupInModel = this._groupLookup.get(groupId) !== void 0;
    if (!group || !groupInModel) {
      this._createTabsModel();
      return;
    }
    const tabs = this._groupLookup.get(groupId)?.tabs;
    if (!tabs) {
      return;
    }
    const tabObject = this._buildTabObject(group, editorInput, editorIndex);
    tabs.splice(editorIndex, 0, tabObject);
    const tabId = this._generateTabId(editorInput, groupId);
    this._tabInfoLookup.set(tabId, { group, editorInput, tab: tabObject });
    if (editorInput instanceof MultiDiffEditorInput) {
      this._multiDiffEditorInputListeners.set(editorInput, Event.fromObservableLight(editorInput.resources)(() => {
        const tabInfo = this._tabInfoLookup.get(tabId);
        if (!tabInfo) {
          return;
        }
        tabInfo.tab = this._buildTabObject(group, editorInput, editorIndex);
        this._proxy.$acceptTabOperation({
          groupId,
          index: editorIndex,
          tabDto: tabInfo.tab,
          kind: TabModelOperationKind.TAB_UPDATE
        });
      }));
    }
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: tabObject,
      kind: TabModelOperationKind.TAB_OPEN
    });
  }
  /**
   * Called when a tab is closed
   * @param groupId The id of the group the tab is being removed from
   * @param editorIndex The index of the editor within that group
   */
  _onDidTabClose(groupId, editorIndex) {
    const group = this._editorGroupsService.getGroup(groupId);
    const tabs = this._groupLookup.get(groupId)?.tabs;
    if (!group || !tabs) {
      this._createTabsModel();
      return;
    }
    const removedTab = tabs.splice(editorIndex, 1);
    if (removedTab.length === 0) {
      return;
    }
    this._tabInfoLookup.delete(removedTab[0]?.id ?? "");
    if (removedTab[0]?.input instanceof MultiDiffEditorInput) {
      this._multiDiffEditorInputListeners.deleteAndDispose(removedTab[0]?.input);
    }
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: removedTab[0],
      kind: TabModelOperationKind.TAB_CLOSE
    });
  }
  /**
   * Called when the active tab changes
   * @param groupId The id of the group the tab is contained in
   * @param editorIndex The index of the tab
   */
  _onDidTabActiveChange(groupId, editorIndex) {
    const tabs = this._groupLookup.get(groupId)?.tabs;
    if (!tabs) {
      return;
    }
    const activeTab = tabs[editorIndex];
    activeTab.isActive = true;
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: activeTab,
      kind: TabModelOperationKind.TAB_UPDATE
    });
  }
  /**
   * Called when the dirty indicator on the tab changes
   * @param groupId The id of the group the tab is in
   * @param editorIndex The index of the tab
   * @param editor The editor input represented by the tab
   */
  _onDidTabDirty(groupId, editorIndex, editor) {
    const tabId = this._generateTabId(editor, groupId);
    const tabInfo = this._tabInfoLookup.get(tabId);
    if (!tabInfo) {
      this._logService.error("Invalid model for dirty change, rebuilding");
      this._createTabsModel();
      return;
    }
    tabInfo.tab.isDirty = editor.isDirty();
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: tabInfo.tab,
      kind: TabModelOperationKind.TAB_UPDATE
    });
  }
  /**
   * Called when the tab is pinned/unpinned
   * @param groupId The id of the group the tab is in
   * @param editorIndex The index of the tab
   * @param editor The editor input represented by the tab
   */
  _onDidTabPinChange(groupId, editorIndex, editor) {
    const tabId = this._generateTabId(editor, groupId);
    const tabInfo = this._tabInfoLookup.get(tabId);
    const group = tabInfo?.group;
    const tab = tabInfo?.tab;
    if (!group || !tab) {
      this._logService.error("Invalid model for sticky change, rebuilding");
      this._createTabsModel();
      return;
    }
    tab.isPinned = group.isSticky(editorIndex);
    this._proxy.$acceptTabOperation({
      groupId,
      index: editorIndex,
      tabDto: tab,
      kind: TabModelOperationKind.TAB_UPDATE
    });
  }
  /**
  * Called when the tab is preview / unpreviewed
  * @param groupId The id of the group the tab is in
  * @param editorIndex The index of the tab
  * @param editor The editor input represented by the tab
  */
  _onDidTabPreviewChange(groupId, editorIndex, editor) {
    const tabId = this._generateTabId(editor, groupId);
    const tabInfo = this._tabInfoLookup.get(tabId);
    const group = tabInfo?.group;
    const tab = tabInfo?.tab;
    if (!group || !tab) {
      this._logService.error("Invalid model for sticky change, rebuilding");
      this._createTabsModel();
      return;
    }
    tab.isPreview = !group.isPinned(editorIndex);
    this._proxy.$acceptTabOperation({
      kind: TabModelOperationKind.TAB_UPDATE,
      groupId,
      tabDto: tab,
      index: editorIndex
    });
  }
  _onDidTabMove(groupId, editorIndex, oldEditorIndex, editor) {
    const tabs = this._groupLookup.get(groupId)?.tabs;
    if (!tabs) {
      this._logService.error("Invalid model for move change, rebuilding");
      this._createTabsModel();
      return;
    }
    const removedTab = tabs.splice(oldEditorIndex, 1);
    if (removedTab.length === 0) {
      return;
    }
    tabs.splice(editorIndex, 0, removedTab[0]);
    this._proxy.$acceptTabOperation({
      kind: TabModelOperationKind.TAB_MOVE,
      groupId,
      tabDto: removedTab[0],
      index: editorIndex,
      oldIndex: oldEditorIndex
    });
  }
  /**
   * Builds the model from scratch based on the current state of the editor service.
   */
  _createTabsModel() {
    if (this._editorGroupsService.groups.length === 0) {
      return;
    }
    this._tabGroupModel = [];
    this._groupLookup.clear();
    this._tabInfoLookup.clear();
    let tabs = [];
    for (const group of this._editorGroupsService.groups) {
      const currentTabGroupModel = {
        groupId: group.id,
        isActive: group.id === this._editorGroupsService.activeGroup.id,
        viewColumn: editorGroupToColumn(this._editorGroupsService, group),
        tabs: []
      };
      group.editors.forEach((editor, editorIndex) => {
        const tab = this._buildTabObject(group, editor, editorIndex);
        tabs.push(tab);
        this._tabInfoLookup.set(this._generateTabId(editor, group.id), {
          group,
          tab,
          editorInput: editor
        });
      });
      currentTabGroupModel.tabs = tabs;
      this._tabGroupModel.push(currentTabGroupModel);
      this._groupLookup.set(group.id, currentTabGroupModel);
      tabs = [];
    }
    this._proxy.$acceptEditorTabModel(this._tabGroupModel);
  }
  /**
   * The main handler for the tab events
   * @param events The list of events to process
   */
  _updateTabsModel(changeEvent) {
    const event = changeEvent.event;
    const groupId = changeEvent.groupId;
    switch (event.kind) {
      case GroupModelChangeKind.GROUP_ACTIVE:
        if (groupId === this._editorGroupsService.activeGroup.id) {
          this._onDidGroupActivate();
          break;
        } else {
          return;
        }
      case GroupModelChangeKind.EDITOR_LABEL:
        if (event.editor !== void 0 && event.editorIndex !== void 0) {
          this._onDidTabLabelChange(groupId, event.editor, event.editorIndex);
          break;
        }
      case GroupModelChangeKind.EDITOR_OPEN:
        if (event.editor !== void 0 && event.editorIndex !== void 0) {
          this._onDidTabOpen(groupId, event.editor, event.editorIndex);
          break;
        }
      case GroupModelChangeKind.EDITOR_CLOSE:
        if (event.editorIndex !== void 0) {
          this._onDidTabClose(groupId, event.editorIndex);
          break;
        }
      case GroupModelChangeKind.EDITOR_ACTIVE:
        if (event.editorIndex !== void 0) {
          this._onDidTabActiveChange(groupId, event.editorIndex);
          break;
        }
      case GroupModelChangeKind.EDITOR_DIRTY:
        if (event.editorIndex !== void 0 && event.editor !== void 0) {
          this._onDidTabDirty(groupId, event.editorIndex, event.editor);
          break;
        }
      case GroupModelChangeKind.EDITOR_STICKY:
        if (event.editorIndex !== void 0 && event.editor !== void 0) {
          this._onDidTabPinChange(groupId, event.editorIndex, event.editor);
          break;
        }
      case GroupModelChangeKind.EDITOR_PIN:
        if (event.editorIndex !== void 0 && event.editor !== void 0) {
          this._onDidTabPreviewChange(groupId, event.editorIndex, event.editor);
          break;
        }
      case GroupModelChangeKind.EDITOR_TRANSIENT:
        break;
      case GroupModelChangeKind.EDITORS_SELECTION:
        break;
      case GroupModelChangeKind.EDITOR_MOVE:
        if (isGroupEditorMoveEvent(event) && event.editor && event.editorIndex !== void 0 && event.oldEditorIndex !== void 0) {
          this._onDidTabMove(groupId, event.editorIndex, event.oldEditorIndex, event.editor);
          break;
        }
      default:
        this._createTabsModel();
    }
  }
  //#region Messages received from Ext Host
  $moveTab(tabId, index, viewColumn, preserveFocus) {
    const groupId = columnToEditorGroup(this._editorGroupsService, this._configurationService, viewColumn);
    const tabInfo = this._tabInfoLookup.get(tabId);
    const tab = tabInfo?.tab;
    if (!tab) {
      throw new Error(`Attempted to close tab with id ${tabId} which does not exist`);
    }
    let targetGroup;
    const sourceGroup = this._editorGroupsService.getGroup(tabInfo.group.id);
    if (!sourceGroup) {
      return;
    }
    if (this._groupLookup.get(groupId) === void 0) {
      let direction = GroupDirection.RIGHT;
      if (viewColumn === SIDE_GROUP) {
        direction = preferredSideBySideGroupDirection(this._configurationService);
      }
      targetGroup = this._editorGroupsService.addGroup(this._editorGroupsService.groups[this._editorGroupsService.groups.length - 1], direction);
    } else {
      targetGroup = this._editorGroupsService.getGroup(groupId);
    }
    if (!targetGroup) {
      return;
    }
    if (index < 0 || index > targetGroup.editors.length) {
      index = targetGroup.editors.length;
    }
    const editorInput = tabInfo?.editorInput;
    if (!editorInput) {
      return;
    }
    sourceGroup.moveEditor(editorInput, targetGroup, { index, preserveFocus });
    return;
  }
  async $closeTab(tabIds, preserveFocus) {
    const groups = /* @__PURE__ */ new Map();
    for (const tabId of tabIds) {
      const tabInfo = this._tabInfoLookup.get(tabId);
      const tab = tabInfo?.tab;
      const group = tabInfo?.group;
      const editorTab = tabInfo?.editorInput;
      if (!group || !tab || !tabInfo || !editorTab) {
        continue;
      }
      const groupEditors = groups.get(group);
      if (!groupEditors) {
        groups.set(group, [editorTab]);
      } else {
        groupEditors.push(editorTab);
      }
    }
    const results = [];
    for (const [group, editors] of groups) {
      results.push(await group.closeEditors(editors, { preserveFocus }));
    }
    return results.every((result) => result);
  }
  async $closeGroup(groupIds, preserveFocus) {
    const groupCloseResults = [];
    for (const groupId of groupIds) {
      const group = this._editorGroupsService.getGroup(groupId);
      if (group) {
        groupCloseResults.push(await group.closeAllEditors());
        if (group.count === 0 && this._editorGroupsService.getGroup(group.id)) {
          this._editorGroupsService.removeGroup(group);
        }
      }
    }
    return groupCloseResults.every((result) => result);
  }
  //#endregion
};
MainThreadEditorTabs = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadEditorTabs),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IEditorService)
], MainThreadEditorTabs);
export {
  MainThreadEditorTabs
};
