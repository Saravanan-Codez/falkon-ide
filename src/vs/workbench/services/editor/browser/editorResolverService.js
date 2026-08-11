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
import { distinct, insert } from "../../../../base/common/arrays.js";
import { PauseableEmitter } from "../../../../base/common/event.js";
import * as glob from "../../../../base/common/glob.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename, extname, isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { EditorActivation, EditorResolution } from "../../../../platform/editor/common/editor.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorResourceAccessor, isEditorInputWithOptions, isEditorInputWithOptionsAndGroup, isResourceDiffEditorInput, isResourceMergeEditorInput, isResourceMultiDiffEditorInput, isResourceSideBySideEditorInput, isUntitledResourceEditorInput, SideBySideEditor } from "../../../common/editor.js";
import { SideBySideEditorInput } from "../../../common/editor/sideBySideEditorInput.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { findGroup } from "../common/editorGroupFinder.js";
import { IEditorGroupsService } from "../common/editorGroupsService.js";
import { diffEditorsAssociationsSettingId, editorsAssociationsSettingId, globMatchesResource, IEditorResolverService, priorityToRank, RegisteredEditorPriority, ResolvedStatus, toRegisteredEditorPriorityInfo } from "../common/editorResolverService.js";
function normalizeRegisteredEditorInfo(editorInfo) {
  return {
    id: editorInfo.id,
    label: editorInfo.label,
    detail: editorInfo.detail,
    priority: toRegisteredEditorPriorityInfo(editorInfo.priority)
  };
}
var EditorAssociationType = /* @__PURE__ */ ((EditorAssociationType2) => {
  EditorAssociationType2[EditorAssociationType2["Editor"] = 0] = "Editor";
  EditorAssociationType2[EditorAssociationType2["DiffEditor"] = 1] = "DiffEditor";
  EditorAssociationType2[EditorAssociationType2["MergeEditor"] = 2] = "MergeEditor";
  return EditorAssociationType2;
})(EditorAssociationType || {});
let EditorResolverService = class extends Disposable {
  constructor(editorGroupService, instantiationService, configurationService, quickInputService, notificationService, storageService, extensionService, logService) {
    super();
    this.editorGroupService = editorGroupService;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.quickInputService = quickInputService;
    this.notificationService = notificationService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.logService = logService;
    // Events
    this._onDidChangeEditorRegistrations = this._register(new PauseableEmitter());
    this.onDidChangeEditorRegistrations = this._onDidChangeEditorRegistrations.event;
    // Data Stores
    this._editors = /* @__PURE__ */ new Map();
    this._flattenedEditors = /* @__PURE__ */ new Map();
    this._shouldReFlattenEditors = true;
    this.cache = new Set(JSON.parse(this.storageService.get(EditorResolverService.cacheStorageID, StorageScope.PROFILE, JSON.stringify([]))));
    this.storageService.remove(EditorResolverService.cacheStorageID, StorageScope.PROFILE);
    this._register(this.storageService.onWillSaveState(() => {
      this.cacheEditors();
    }));
    this._register(this.extensionService.onDidRegisterExtensions(() => {
      this.cache = void 0;
    }));
  }
  static {
    // Constants
    this.configureDefaultID = "promptOpenWith.configureDefault";
  }
  static {
    this.configureDefaultDiffID = "promptOpenWith.configureDefaultDiff";
  }
  static {
    this.cacheStorageID = "editorOverrideService.cache";
  }
  static {
    this.conflictingDefaultsStorageID = "editorOverrideService.conflictingDefaults";
  }
  resolveUntypedInputAndGroup(editor, preferredGroup) {
    const untypedEditor = editor;
    const findGroupResult = this.instantiationService.invokeFunction(findGroup, untypedEditor, preferredGroup);
    if (findGroupResult instanceof Promise) {
      return findGroupResult.then(([group, activation]) => [untypedEditor, group, activation]);
    } else {
      const [group, activation] = findGroupResult;
      return [untypedEditor, group, activation];
    }
  }
  async resolveEditor(editor, preferredGroup) {
    this._flattenedEditors = this._flattenEditorsMap();
    if (isResourceSideBySideEditorInput(editor)) {
      return this.doResolveSideBySideEditor(editor, preferredGroup);
    }
    let resolvedUntypedAndGroup;
    const resolvedUntypedAndGroupResult = this.resolveUntypedInputAndGroup(editor, preferredGroup);
    if (resolvedUntypedAndGroupResult instanceof Promise) {
      resolvedUntypedAndGroup = await resolvedUntypedAndGroupResult;
    } else {
      resolvedUntypedAndGroup = resolvedUntypedAndGroupResult;
    }
    if (!resolvedUntypedAndGroup) {
      return ResolvedStatus.NONE;
    }
    const [untypedEditor, group, activation] = resolvedUntypedAndGroup;
    if (activation) {
      untypedEditor.options = { ...untypedEditor.options, activation };
    }
    let resource = EditorResourceAccessor.getCanonicalUri(untypedEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    const editorAssociationType = isResourceDiffEditorInput(untypedEditor) ? 1 /* DiffEditor */ : isResourceMergeEditorInput(untypedEditor) ? 2 /* MergeEditor */ : 0 /* Editor */;
    if (this.cache && resource && (this.resourceMatchesCache(resource) || this.resourceMatchesUserAssociation(resource, editorAssociationType))) {
      await this.extensionService.whenInstalledExtensionsRegistered();
    }
    if (resource === void 0) {
      resource = URI.from({ scheme: Schemas.untitled });
    } else if (resource.scheme === void 0 || resource === null) {
      return ResolvedStatus.NONE;
    }
    if (untypedEditor.options?.override === EditorResolution.PICK) {
      const picked = await this.doPickEditor(untypedEditor);
      if (!picked) {
        return ResolvedStatus.ABORT;
      }
      untypedEditor.options = picked;
    }
    let { editor: selectedEditor, conflictingDefault } = this.getEditor(resource, untypedEditor.options?.override, editorAssociationType);
    if (!selectedEditor && (untypedEditor.options?.override || isEditorInputWithOptions(editor))) {
      return ResolvedStatus.NONE;
    } else if (!selectedEditor) {
      const resolvedEditor = this.getEditor(resource, DEFAULT_EDITOR_ASSOCIATION.id, editorAssociationType);
      selectedEditor = resolvedEditor?.editor;
      conflictingDefault = resolvedEditor?.conflictingDefault;
      if (!selectedEditor) {
        return ResolvedStatus.NONE;
      }
    }
    if (isResourceDiffEditorInput(untypedEditor) && untypedEditor.options?.override === void 0) {
      let resource2 = EditorResourceAccessor.getCanonicalUri(untypedEditor, { supportSideBySide: SideBySideEditor.SECONDARY });
      if (!resource2) {
        resource2 = URI.from({ scheme: Schemas.untitled });
      }
      const { editor: selectedEditor2 } = this.getEditor(resource2, void 0, editorAssociationType);
      if (!selectedEditor2 || selectedEditor.editorInfo.id !== selectedEditor2.editorInfo.id) {
        const { editor: selectedDiff, conflictingDefault: conflictingDefaultDiff } = this.getEditor(resource, DEFAULT_EDITOR_ASSOCIATION.id, editorAssociationType);
        selectedEditor = selectedDiff;
        conflictingDefault = conflictingDefaultDiff;
      }
      if (!selectedEditor) {
        return ResolvedStatus.NONE;
      }
    }
    untypedEditor.options = { override: selectedEditor.editorInfo.id, ...untypedEditor.options };
    if (selectedEditor.editorFactoryObject.createDiffEditorInput === void 0 && isResourceDiffEditorInput(untypedEditor)) {
      return ResolvedStatus.NONE;
    }
    const input = await this.doResolveEditor(untypedEditor, group, selectedEditor);
    if (conflictingDefault && input) {
      await this.doHandleConflictingDefaults(resource, selectedEditor.editorInfo.label, untypedEditor, input.editor, group);
    }
    if (input) {
      if (input.editor.editorId !== selectedEditor.editorInfo.id) {
        this.logService.warn(`Editor ID Mismatch: ${input.editor.editorId} !== ${selectedEditor.editorInfo.id}. This will cause bugs. Please ensure editorInput.editorId matches the registered id`);
      }
      return { ...input, group };
    }
    return ResolvedStatus.ABORT;
  }
  async doResolveSideBySideEditor(editor, preferredGroup) {
    const primaryResolvedEditor = await this.resolveEditor(editor.primary, preferredGroup);
    if (!isEditorInputWithOptionsAndGroup(primaryResolvedEditor)) {
      return ResolvedStatus.NONE;
    }
    const secondaryResolvedEditor = await this.resolveEditor(editor.secondary, primaryResolvedEditor.group ?? preferredGroup);
    if (!isEditorInputWithOptionsAndGroup(secondaryResolvedEditor)) {
      return ResolvedStatus.NONE;
    }
    return {
      group: primaryResolvedEditor.group ?? secondaryResolvedEditor.group,
      editor: this.instantiationService.createInstance(SideBySideEditorInput, editor.label, editor.description, secondaryResolvedEditor.editor, primaryResolvedEditor.editor),
      options: editor.options
    };
  }
  bufferChangeEvents(callback) {
    this._onDidChangeEditorRegistrations.pause();
    try {
      callback();
    } finally {
      this._onDidChangeEditorRegistrations.resume();
    }
  }
  registerEditor(globPattern, editorInfo, options, editorFactoryObject) {
    const registeredEditorInfo = normalizeRegisteredEditorInfo(editorInfo);
    let registeredEditor = this._editors.get(globPattern);
    if (registeredEditor === void 0) {
      registeredEditor = /* @__PURE__ */ new Map();
      this._editors.set(globPattern, registeredEditor);
    }
    let editorsWithId = registeredEditor.get(registeredEditorInfo.id);
    if (editorsWithId === void 0) {
      editorsWithId = [];
    }
    const remove = insert(editorsWithId, {
      globPattern,
      editorInfo: registeredEditorInfo,
      options,
      editorFactoryObject
    });
    registeredEditor.set(registeredEditorInfo.id, editorsWithId);
    this._shouldReFlattenEditors = true;
    this._onDidChangeEditorRegistrations.fire();
    return toDisposable(() => {
      remove();
      if (editorsWithId && editorsWithId.length === 0) {
        registeredEditor?.delete(editorInfo.id);
      }
      this._shouldReFlattenEditors = true;
      this._onDidChangeEditorRegistrations.fire();
    });
  }
  getAssociationsForResource(resource) {
    return this.getAssociationsForResourceFromSetting(resource, editorsAssociationsSettingId);
  }
  getConfiguredDefaultEditor(resource, forDiffEditor) {
    const settingId = forDiffEditor ? diffEditorsAssociationsSettingId : editorsAssociationsSettingId;
    return this.getAssociationsForResourceFromSetting(resource, settingId)[0]?.viewType;
  }
  getAssociationsForResourceByType(resource, associationType) {
    if (associationType === 0 /* Editor */) {
      return this.getAssociationsForResource(resource);
    }
    const modeAssociations = this.getAssociationsForResourceFromSetting(resource, diffEditorsAssociationsSettingId);
    if (modeAssociations.length) {
      return modeAssociations;
    }
    return this.getAssociationsForResource(resource).filter((association) => !this.isExplicitForAssociationType(association.viewType, associationType));
  }
  /**
   * Whether the editor requires an association for the given input kind instead of inheriting one
   * from another input kind.
   */
  isExplicitForAssociationType(viewType, associationType) {
    const editor = this._registeredEditors.filter((editor2) => editor2.editorInfo.id === viewType).at(0);
    return !!editor && this.getEffectivePriority(editor.editorInfo, associationType) === RegisteredEditorPriority.explicit;
  }
  getAssociationsForResourceFromSetting(resource, settingId) {
    const matchingAssociations = this.getRawAssociationsForResourceFromSetting(resource, settingId);
    const allEditors = this._registeredEditors;
    return matchingAssociations.filter((association) => allEditors.find((c) => c.editorInfo.id === association.viewType));
  }
  getRawAssociationsForResourceByType(resource, associationType) {
    if (associationType === 0 /* Editor */) {
      return this.getRawAssociationsForResourceFromSetting(resource, editorsAssociationsSettingId);
    }
    const diffAssociations = this.getRawAssociationsForResourceFromSetting(resource, diffEditorsAssociationsSettingId);
    return diffAssociations.length ? diffAssociations : this.getRawAssociationsForResourceFromSetting(resource, editorsAssociationsSettingId);
  }
  getRawAssociationsForResourceFromSetting(resource, settingId) {
    const associations = this.getAllUserAssociationsForSetting(settingId);
    const matchingAssociations = associations.filter((association) => association.filenamePattern && globMatchesResource(association.filenamePattern, resource));
    return matchingAssociations.sort((a, b) => (b.filenamePattern?.length ?? 0) - (a.filenamePattern?.length ?? 0));
  }
  getAllUserAssociations() {
    return this.getAllUserAssociationsForSetting(editorsAssociationsSettingId);
  }
  getAllUserAssociationsForSetting(settingId) {
    const inspectedEditorAssociations = this.configurationService.inspect(settingId) || {};
    const defaultAssociations = inspectedEditorAssociations.defaultValue ?? {};
    const workspaceAssociations = inspectedEditorAssociations.workspaceValue ?? {};
    const userAssociations = inspectedEditorAssociations.userValue ?? {};
    const rawAssociations = { ...workspaceAssociations };
    for (const [key, value] of Object.entries({ ...defaultAssociations, ...userAssociations })) {
      if (rawAssociations[key] === void 0) {
        rawAssociations[key] = value;
      }
    }
    const associations = [];
    for (const [key, value] of Object.entries(rawAssociations)) {
      const association = {
        filenamePattern: key,
        viewType: value
      };
      associations.push(association);
    }
    return associations;
  }
  /**
   * Given the nested nature of the editors map, we merge factories of the same glob and id to make it flat
   * and easier to work with
   */
  _flattenEditorsMap() {
    if (!this._shouldReFlattenEditors) {
      return this._flattenedEditors;
    }
    this._shouldReFlattenEditors = false;
    const editors = /* @__PURE__ */ new Map();
    for (const [glob2, value] of this._editors) {
      const registeredEditors = [];
      for (const editors2 of value.values()) {
        let registeredEditor = void 0;
        for (const editor of editors2) {
          if (!registeredEditor) {
            registeredEditor = {
              editorInfo: editor.editorInfo,
              globPattern: editor.globPattern,
              options: {},
              editorFactoryObject: {}
            };
          }
          registeredEditor.options = { ...registeredEditor.options, ...editor.options };
          registeredEditor.editorFactoryObject = { ...registeredEditor.editorFactoryObject, ...editor.editorFactoryObject };
        }
        if (registeredEditor) {
          registeredEditors.push(registeredEditor);
        }
      }
      editors.set(glob2, registeredEditors);
    }
    return editors;
  }
  /**
   * Returns all editors as an array. Possible to contain duplicates
   */
  get _registeredEditors() {
    return Array.from(this._flattenedEditors.values()).flat();
  }
  updateUserAssociations(globPattern, editorID, forDiffEditor) {
    this.updateUserAssociationsForSetting(forDiffEditor ? diffEditorsAssociationsSettingId : editorsAssociationsSettingId, globPattern, editorID);
  }
  updateUserAssociationsForType(associationType, globPattern, editorID) {
    this.updateUserAssociationsForSetting(associationType === 1 /* DiffEditor */ ? diffEditorsAssociationsSettingId : editorsAssociationsSettingId, globPattern, editorID);
  }
  updateUserAssociationsForSetting(settingId, globPattern, editorID) {
    const newAssociation = { viewType: editorID, filenamePattern: globPattern };
    const currentAssociations = this.getAllUserAssociationsForSetting(settingId);
    const newSettingObject = /* @__PURE__ */ Object.create(null);
    for (const association of [...currentAssociations, newAssociation]) {
      if (association.filenamePattern) {
        newSettingObject[association.filenamePattern] = association.viewType;
      }
    }
    this.configurationService.updateValue(settingId, newSettingObject);
  }
  removeUserAssociationForSetting(settingId, globPattern) {
    const currentAssociations = this.getAllUserAssociationsForSetting(settingId);
    if (!currentAssociations.some((association) => association.filenamePattern === globPattern)) {
      return;
    }
    const newSettingObject = /* @__PURE__ */ Object.create(null);
    for (const association of currentAssociations) {
      if (association.filenamePattern && association.filenamePattern !== globPattern) {
        newSettingObject[association.filenamePattern] = association.viewType;
      }
    }
    this.configurationService.updateValue(settingId, newSettingObject);
  }
  findMatchingEditors(resource, associationType = 0 /* Editor */) {
    const userSettings = this.getAssociationsForResourceByType(resource, associationType);
    const matchingEditors = [];
    for (const [key, editors] of this._flattenedEditors) {
      for (const editor of editors) {
        if (associationType === 1 /* DiffEditor */ && !editor.editorFactoryObject.createDiffEditorInput) {
          continue;
        }
        if (associationType === 2 /* MergeEditor */ && !editor.editorFactoryObject.createMergeEditorInput) {
          continue;
        }
        const foundInSettings = userSettings.find((setting) => setting.viewType === editor.editorInfo.id);
        if (foundInSettings && this.getEffectivePriority(editor.editorInfo, associationType) !== RegisteredEditorPriority.exclusive || globMatchesResource(key, resource)) {
          matchingEditors.push(editor);
        }
      }
    }
    return matchingEditors.sort((a, b) => {
      const aPriority = this.getEffectivePriority(a.editorInfo, associationType);
      const bPriority = this.getEffectivePriority(b.editorInfo, associationType);
      if (priorityToRank(bPriority) === priorityToRank(aPriority) && typeof b.globPattern === "string" && typeof a.globPattern === "string") {
        return b.globPattern.length - a.globPattern.length;
      }
      return priorityToRank(bPriority) - priorityToRank(aPriority);
    });
  }
  getEditors(resource) {
    this._flattenedEditors = this._flattenEditorsMap();
    if (URI.isUri(resource)) {
      const editors = this.findMatchingEditors(resource);
      if (editors.find((e) => e.editorInfo.priority.editor === RegisteredEditorPriority.exclusive)) {
        return [];
      }
      return editors.map((editor) => editor.editorInfo);
    }
    return distinct(this._registeredEditors.map((editor) => editor.editorInfo), (editor) => editor.id);
  }
  getBinaryDiffFallbackEditor(resource) {
    this._flattenedEditors = this._flattenEditorsMap();
    const editors = this.findMatchingEditors(resource, 1 /* DiffEditor */).filter((editor) => editor.editorInfo.id !== DEFAULT_EDITOR_ASSOCIATION.id);
    return editors[0]?.editorInfo.id;
  }
  /**
   * Given a resource and an editorId selects the best possible editor
   * @returns The editor and whether there was another default which conflicted with it
   */
  getEditor(resource, editorId, associationType) {
    const findMatchingEditor = (editors2, viewType) => {
      return editors2.find((editor) => {
        if (associationType === 1 /* DiffEditor */ && !editor.editorFactoryObject.createDiffEditorInput) {
          return false;
        }
        if (associationType === 2 /* MergeEditor */ && !editor.editorFactoryObject.createMergeEditorInput) {
          return false;
        }
        if (editor.options?.canSupportResource !== void 0) {
          return editor.editorInfo.id === viewType && editor.options.canSupportResource(resource);
        }
        return editor.editorInfo.id === viewType;
      });
    };
    if (editorId && editorId !== EditorResolution.EXCLUSIVE_ONLY) {
      const registeredEditors = this._registeredEditors;
      return {
        editor: findMatchingEditor(registeredEditors, editorId),
        conflictingDefault: false
      };
    }
    const editors = this.findMatchingEditors(resource, associationType);
    const associationsFromSetting = this.getAssociationsForResourceByType(resource, associationType);
    const minPriority = editorId === EditorResolution.EXCLUSIVE_ONLY ? RegisteredEditorPriority.exclusive : RegisteredEditorPriority.builtin;
    let possibleEditors = editors.filter((editor) => priorityToRank(this.getEffectivePriority(editor.editorInfo, associationType)) >= priorityToRank(minPriority) && editor.editorInfo.id !== DEFAULT_EDITOR_ASSOCIATION.id);
    if (possibleEditors.length === 0) {
      return {
        editor: associationsFromSetting[0] && minPriority !== RegisteredEditorPriority.exclusive ? findMatchingEditor(editors, associationsFromSetting[0].viewType) : void 0,
        conflictingDefault: false
      };
    }
    const selectedViewType = this.getEffectivePriority(possibleEditors[0].editorInfo, associationType) === RegisteredEditorPriority.exclusive ? possibleEditors[0].editorInfo.id : associationsFromSetting[0]?.viewType || possibleEditors.find((editor) => !editor.options?.canSupportResource || editor.options.canSupportResource(resource))?.editorInfo.id || possibleEditors[0].editorInfo.id;
    let conflictingDefault = false;
    possibleEditors = possibleEditors.filter((editor) => this.getEffectivePriority(editor.editorInfo, associationType) !== RegisteredEditorPriority.exclusive).filter((editor) => !editor.options?.canSupportResource || editor.options.canSupportResource(resource));
    if (associationsFromSetting.length === 0 && possibleEditors.length > 1) {
      conflictingDefault = true;
    }
    return {
      editor: findMatchingEditor(editors, selectedViewType),
      conflictingDefault
    };
  }
  getEffectivePriority(editorInfo, associationType) {
    switch (associationType) {
      case 1 /* DiffEditor */:
        return editorInfo.priority.diff;
      case 2 /* MergeEditor */:
        return editorInfo.priority.merge;
      default:
        return editorInfo.priority.editor;
    }
  }
  async doResolveEditor(editor, group, selectedEditor) {
    let options = editor.options;
    const resource = EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (options && typeof options.activation === "undefined") {
      options = { ...options, activation: options.preserveFocus ? EditorActivation.RESTORE : void 0 };
    }
    if (isResourceMergeEditorInput(editor)) {
      if (!selectedEditor.editorFactoryObject.createMergeEditorInput) {
        return;
      }
      const inputWithOptions2 = await selectedEditor.editorFactoryObject.createMergeEditorInput(editor, group);
      return { editor: inputWithOptions2.editor, options: inputWithOptions2.options ?? options };
    }
    if (isResourceDiffEditorInput(editor)) {
      if (!selectedEditor.editorFactoryObject.createDiffEditorInput) {
        return;
      }
      const inputWithOptions2 = await selectedEditor.editorFactoryObject.createDiffEditorInput(editor, group);
      return { editor: inputWithOptions2.editor, options: inputWithOptions2.options ?? options };
    }
    if (isResourceMultiDiffEditorInput(editor)) {
      if (!selectedEditor.editorFactoryObject.createMultiDiffEditorInput) {
        return;
      }
      const inputWithOptions2 = await selectedEditor.editorFactoryObject.createMultiDiffEditorInput(editor, group);
      return { editor: inputWithOptions2.editor, options: inputWithOptions2.options ?? options };
    }
    if (isResourceSideBySideEditorInput(editor)) {
      throw new Error(`Untyped side by side editor input not supported here.`);
    }
    if (isUntitledResourceEditorInput(editor)) {
      if (!selectedEditor.editorFactoryObject.createUntitledEditorInput) {
        return;
      }
      const inputWithOptions2 = await selectedEditor.editorFactoryObject.createUntitledEditorInput(editor, group);
      return { editor: inputWithOptions2.editor, options: inputWithOptions2.options ?? options };
    }
    if (resource === void 0) {
      throw new Error(`Undefined resource on non untitled editor input.`);
    }
    const singleEditorPerResource = typeof selectedEditor.options?.singlePerResource === "function" ? selectedEditor.options.singlePerResource() : selectedEditor.options?.singlePerResource;
    if (singleEditorPerResource) {
      const existingEditors = this.findExistingEditorsForResource(resource, selectedEditor.editorInfo.id);
      if (existingEditors.length) {
        const editor2 = await this.moveExistingEditorForResource(existingEditors, group);
        if (editor2) {
          return { editor: editor2, options };
        } else {
          return;
        }
      }
    }
    if (!selectedEditor.editorFactoryObject.createEditorInput) {
      return;
    }
    const inputWithOptions = await selectedEditor.editorFactoryObject.createEditorInput(editor, group);
    options = inputWithOptions.options ?? options;
    const input = inputWithOptions.editor;
    return { editor: input, options };
  }
  /**
   * Moves the first existing editor for a resource to the target group unless already opened there.
   * Additionally will close any other editors that are open for that resource and viewtype besides the first one found
   * @param resource The resource of the editor
   * @param viewType the viewtype of the editor
   * @param targetGroup The group to move it to
   * @returns The moved editor input or `undefined` if the editor could not be moved
   */
  async moveExistingEditorForResource(existingEditorsForResource, targetGroup) {
    const editorToUse = existingEditorsForResource[0];
    for (const { editor, group } of existingEditorsForResource) {
      if (editor !== editorToUse.editor) {
        const closed = await group.closeEditor(editor);
        if (!closed) {
          return;
        }
      }
    }
    if (targetGroup.id !== editorToUse.group.id) {
      const moved = editorToUse.group.moveEditor(editorToUse.editor, targetGroup);
      if (!moved) {
        return;
      }
    }
    return editorToUse.editor;
  }
  /**
   * Given a resource and an editorId, returns all editors open for that resource and editorId.
   * @param resource The resource specified
   * @param editorId The editorID
   * @returns A list of editors
   */
  findExistingEditorsForResource(resource, editorId) {
    const out = [];
    const orderedGroups = distinct([
      ...this.editorGroupService.groups
    ]);
    for (const group of orderedGroups) {
      for (const editor of group.editors) {
        if (isEqual(editor.resource, resource) && editor.editorId === editorId) {
          out.push({ editor, group });
        }
      }
    }
    return out;
  }
  async doHandleConflictingDefaults(resource, editorName, untypedInput, currentEditor, group) {
    const associationType = isResourceDiffEditorInput(untypedInput) ? 1 /* DiffEditor */ : isResourceMergeEditorInput(untypedInput) ? 2 /* MergeEditor */ : 0 /* Editor */;
    const editors = this.findMatchingEditors(resource, associationType);
    const storedChoices = JSON.parse(this.storageService.get(EditorResolverService.conflictingDefaultsStorageID, StorageScope.PROFILE, "{}"));
    const globForResource = `*${extname(resource)}`;
    const writeCurrentEditorsToStorage = () => {
      storedChoices[globForResource] = [];
      editors.forEach((editor) => storedChoices[globForResource].push(editor.editorInfo.id));
      this.storageService.store(EditorResolverService.conflictingDefaultsStorageID, JSON.stringify(storedChoices), StorageScope.PROFILE, StorageTarget.MACHINE);
    };
    if (storedChoices[globForResource]?.find((editorID) => editorID === currentEditor.editorId)) {
      return;
    }
    const handle = this.notificationService.prompt(
      Severity.Warning,
      localize("editorResolver.conflictingDefaults", "There are multiple default editors available for the resource."),
      [
        {
          label: localize("editorResolver.configureDefault", "Configure Default"),
          run: async () => {
            const picked = await this.doPickEditor(untypedInput, true);
            if (!picked) {
              return;
            }
            untypedInput.options = picked;
            const replacementEditor = await this.resolveEditor(untypedInput, group);
            if (replacementEditor === ResolvedStatus.ABORT || replacementEditor === ResolvedStatus.NONE) {
              return;
            }
            group.replaceEditors([
              {
                editor: currentEditor,
                replacement: replacementEditor.editor,
                options: replacementEditor.options ?? picked
              }
            ]);
          }
        },
        {
          label: localize("editorResolver.keepDefault", "Keep {0}", editorName),
          run: writeCurrentEditorsToStorage
        }
      ]
    );
    const onCloseListener = handle.onDidClose(() => {
      writeCurrentEditorsToStorage();
      onCloseListener.dispose();
    });
  }
  mapEditorsToQuickPickEntry(resource, showDefaultPicker, associationType) {
    const currentEditor = this.editorGroupService.activeGroup.findEditors(resource).at(0);
    let registeredEditors = resource.scheme === Schemas.untitled ? this._registeredEditors.filter((e) => e.editorInfo.priority.editor !== RegisteredEditorPriority.exclusive) : this.findMatchingEditors(resource, associationType);
    if (associationType === 1 /* DiffEditor */) {
      registeredEditors = registeredEditors.filter((editor) => !!editor.editorFactoryObject.createDiffEditorInput);
    }
    registeredEditors = distinct(registeredEditors, (c) => c.editorInfo.id);
    const defaultSetting = this.getAssociationsForResourceByType(resource, associationType)[0]?.viewType;
    registeredEditors = registeredEditors.sort((a, b) => {
      if (a.editorInfo.id === DEFAULT_EDITOR_ASSOCIATION.id) {
        return -1;
      } else if (b.editorInfo.id === DEFAULT_EDITOR_ASSOCIATION.id) {
        return 1;
      } else {
        return priorityToRank(this.getEffectivePriority(b.editorInfo, associationType)) - priorityToRank(this.getEffectivePriority(a.editorInfo, associationType));
      }
    });
    const quickPickEntries = [];
    const currentlyActiveLabel = localize("promptOpenWith.currentlyActive", "Active");
    const currentDefaultLabel = localize("promptOpenWith.currentDefault", "Default");
    const currentDefaultAndActiveLabel = localize("promptOpenWith.currentDefaultAndActive", "Active and Default");
    let defaultViewType = defaultSetting;
    if (!defaultViewType && registeredEditors.length > 2 && this.getEffectivePriority(registeredEditors[1].editorInfo, associationType) !== RegisteredEditorPriority.option) {
      defaultViewType = registeredEditors[1]?.editorInfo.id;
    }
    if (!defaultViewType) {
      defaultViewType = DEFAULT_EDITOR_ASSOCIATION.id;
    }
    registeredEditors.forEach((editor) => {
      const currentViewType = currentEditor?.editorId ?? DEFAULT_EDITOR_ASSOCIATION.id;
      const isActive = currentEditor ? editor.editorInfo.id === currentViewType : false;
      const isDefault = editor.editorInfo.id === defaultViewType;
      const quickPickEntry = {
        id: editor.editorInfo.id,
        label: editor.editorInfo.label,
        description: isActive && isDefault ? currentDefaultAndActiveLabel : isActive ? currentlyActiveLabel : isDefault ? currentDefaultLabel : void 0,
        detail: editor.editorInfo.detail ?? editor.editorInfo.priority.editor
      };
      quickPickEntries.push(quickPickEntry);
    });
    if (!showDefaultPicker && extname(resource) !== "") {
      const separator = { type: "separator" };
      quickPickEntries.push(separator);
      const configureDefaultEntry = {
        id: EditorResolverService.configureDefaultID,
        label: localize("promptOpenWith.configureDefault", "Configure default editor for '{0}'...", `*${extname(resource)}`)
      };
      quickPickEntries.push(configureDefaultEntry);
      if (associationType === 1 /* DiffEditor */) {
        const configureDefaultDiffEntry = {
          id: EditorResolverService.configureDefaultDiffID,
          label: localize("promptOpenWith.configureDefaultDiff", "Configure default editor (diff only) for '{0}'...", `*${extname(resource)}`)
        };
        quickPickEntries.push(configureDefaultDiffEntry);
      }
    }
    return quickPickEntries;
  }
  async doPickEditor(editor, showDefaultPicker, updateAssociationType) {
    let resource = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (resource === void 0) {
      resource = URI.from({ scheme: Schemas.untitled });
    }
    const associationType = isResourceDiffEditorInput(editor) ? 1 /* DiffEditor */ : 0 /* Editor */;
    const updateSettingType = updateAssociationType ?? associationType;
    const persistDefaultAssociation = (editorID) => {
      const globPattern = `*${extname(resource)}`;
      this.updateUserAssociationsForType(updateSettingType, globPattern, editorID);
      if (updateSettingType === 0 /* Editor */ && associationType === 1 /* DiffEditor */) {
        this.removeUserAssociationForSetting(diffEditorsAssociationsSettingId, globPattern);
      }
    };
    const editorPicks = this.mapEditorsToQuickPickEntry(resource, showDefaultPicker, associationType);
    const disposables = new DisposableStore();
    const editorPicker = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    const placeHolderMessage = showDefaultPicker ? updateSettingType === 1 /* DiffEditor */ ? localize("promptOpenWith.updateDefaultDiffPlaceHolder", "Select new default editor (diff only) for '{0}'", `*${extname(resource)}`) : localize("promptOpenWith.updateDefaultPlaceHolder", "Select new default editor for '{0}'", `*${extname(resource)}`) : localize("promptOpenWith.placeHolder", "Select editor for '{0}'", basename(resource));
    editorPicker.placeholder = placeHolderMessage;
    editorPicker.canAcceptInBackground = true;
    editorPicker.items = editorPicks;
    const firstItem = editorPicker.items.find((item) => item.type === "item");
    if (firstItem) {
      editorPicker.selectedItems = [firstItem];
    }
    const picked = await new Promise((resolve) => {
      disposables.add(editorPicker.onDidAccept((e) => {
        let result = void 0;
        if (editorPicker.selectedItems.length === 1) {
          result = {
            item: editorPicker.selectedItems[0],
            keyMods: editorPicker.keyMods,
            openInBackground: e.inBackground
          };
        }
        if (resource && showDefaultPicker && result?.item.id) {
          persistDefaultAssociation(result.item.id);
        }
        resolve(result);
      }));
      disposables.add(editorPicker.onDidHide(() => {
        disposables.dispose();
        resolve(void 0);
      }));
      disposables.add(editorPicker.onDidTriggerItemButton((e) => {
        resolve({ item: e.item, openInBackground: false });
        if (resource && e.item?.id) {
          persistDefaultAssociation(e.item.id);
        }
      }));
      editorPicker.show();
    });
    editorPicker.dispose();
    if (picked) {
      if (picked.item.id === EditorResolverService.configureDefaultID) {
        return this.doPickEditor(editor, true, 0 /* Editor */);
      }
      if (picked.item.id === EditorResolverService.configureDefaultDiffID) {
        return this.doPickEditor(editor, true, 1 /* DiffEditor */);
      }
      const targetOptions = {
        ...editor.options,
        override: picked.item.id,
        preserveFocus: picked.openInBackground || editor.options?.preserveFocus
      };
      return targetOptions;
    }
    return void 0;
  }
  cacheEditors() {
    const cacheStorage = /* @__PURE__ */ new Set();
    for (const [globPattern, contribPoint] of this._flattenedEditors) {
      const nonOptional = !!contribPoint.find((c) => c.editorInfo.priority.editor !== RegisteredEditorPriority.option && c.editorInfo.id !== DEFAULT_EDITOR_ASSOCIATION.id);
      if (!nonOptional) {
        continue;
      }
      if (glob.isRelativePattern(globPattern)) {
        cacheStorage.add(`${globPattern.pattern}`);
      } else {
        cacheStorage.add(globPattern);
      }
    }
    const userAssociations = [
      ...this.getAllUserAssociations(),
      ...this.getAllUserAssociationsForSetting(diffEditorsAssociationsSettingId)
    ];
    for (const association of userAssociations) {
      if (association.filenamePattern) {
        cacheStorage.add(association.filenamePattern);
      }
    }
    this.storageService.store(EditorResolverService.cacheStorageID, JSON.stringify(Array.from(cacheStorage)), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  /**
   * Checks if a resource matches any user-configured editor association that
   * points to a non-default editor. This ensures that on first startup (when
   * the cache is empty), we still wait for extensions to register before
   * resolving the editor, so that user-configured custom editors are available.
   */
  resourceMatchesUserAssociation(resource, associationType) {
    const userAssociations = this.getRawAssociationsForResourceByType(resource, associationType);
    for (const association of userAssociations) {
      if (association.viewType !== DEFAULT_EDITOR_ASSOCIATION.id) {
        return true;
      }
    }
    return false;
  }
  resourceMatchesCache(resource) {
    if (!this.cache) {
      return false;
    }
    for (const cacheEntry of this.cache) {
      if (globMatchesResource(cacheEntry, resource)) {
        return true;
      }
    }
    return false;
  }
};
EditorResolverService = __decorateClass([
  __decorateParam(0, IEditorGroupsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, ILogService)
], EditorResolverService);
registerSingleton(IEditorResolverService, EditorResolverService, InstantiationType.Eager);
export {
  EditorResolverService
};
