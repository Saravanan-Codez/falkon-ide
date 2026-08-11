import { localize } from "../../nls.js";
import { assertReturnsDefined } from "../../base/common/types.js";
import { URI } from "../../base/common/uri.js";
import { Disposable, toDisposable } from "../../base/common/lifecycle.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../platform/registry/common/platform.js";
import { FileType } from "../../platform/files/common/files.js";
import { Schemas } from "../../base/common/network.js";
import { createErrorWithActions, isErrorWithActions } from "../../base/common/errorMessage.js";
import { toAction } from "../../base/common/actions.js";
import Severity from "../../base/common/severity.js";
const EditorExtensions = {
  EditorPane: "workbench.contributions.editors",
  EditorFactory: "workbench.contributions.editor.inputFactories"
};
const DEFAULT_EDITOR_ASSOCIATION = {
  id: "default",
  displayName: localize("promptOpenWith.defaultEditor.displayName", "Text Editor"),
  providerDisplayName: localize("builtinProviderDisplayName", "Built-in")
};
const SIDE_BY_SIDE_EDITOR_ID = "workbench.editor.sidebysideEditor";
const TEXT_DIFF_EDITOR_ID = "workbench.editors.textDiffEditor";
const BINARY_DIFF_EDITOR_ID = "workbench.editors.binaryResourceDiffEditor";
var EditorPaneSelectionChangeReason = /* @__PURE__ */ ((EditorPaneSelectionChangeReason2) => {
  EditorPaneSelectionChangeReason2[EditorPaneSelectionChangeReason2["PROGRAMMATIC"] = 1] = "PROGRAMMATIC";
  EditorPaneSelectionChangeReason2[EditorPaneSelectionChangeReason2["USER"] = 2] = "USER";
  EditorPaneSelectionChangeReason2[EditorPaneSelectionChangeReason2["EDIT"] = 3] = "EDIT";
  EditorPaneSelectionChangeReason2[EditorPaneSelectionChangeReason2["NAVIGATION"] = 4] = "NAVIGATION";
  EditorPaneSelectionChangeReason2[EditorPaneSelectionChangeReason2["JUMP"] = 5] = "JUMP";
  return EditorPaneSelectionChangeReason2;
})(EditorPaneSelectionChangeReason || {});
var EditorPaneSelectionCompareResult = /* @__PURE__ */ ((EditorPaneSelectionCompareResult2) => {
  EditorPaneSelectionCompareResult2[EditorPaneSelectionCompareResult2["IDENTICAL"] = 1] = "IDENTICAL";
  EditorPaneSelectionCompareResult2[EditorPaneSelectionCompareResult2["SIMILAR"] = 2] = "SIMILAR";
  EditorPaneSelectionCompareResult2[EditorPaneSelectionCompareResult2["DIFFERENT"] = 3] = "DIFFERENT";
  return EditorPaneSelectionCompareResult2;
})(EditorPaneSelectionCompareResult || {});
function isEditorPaneWithSelection(editorPane) {
  const candidate = editorPane;
  return !!candidate && typeof candidate.getSelection === "function" && !!candidate.onDidChangeSelection;
}
function isEditorPaneWithScrolling(editorPane) {
  const candidate = editorPane;
  return !!candidate && typeof candidate.getScrollPosition === "function" && typeof candidate.setScrollPosition === "function" && !!candidate.onDidChangeScroll;
}
function findViewStateForEditor(input, group, editorService) {
  for (const editorPane of editorService.visibleEditorPanes) {
    if (editorPane.group.id === group && input.matches(editorPane.input)) {
      return editorPane.getViewState();
    }
  }
  return void 0;
}
function isResourceEditorInput(editor) {
  if (isEditorInput(editor)) {
    return false;
  }
  const candidate = editor;
  return URI.isUri(candidate?.resource);
}
function isResourceDiffEditorInput(editor) {
  if (isEditorInput(editor)) {
    return false;
  }
  const candidate = editor;
  return candidate?.original !== void 0 && candidate.modified !== void 0;
}
function isResourceMultiDiffEditorInput(editor) {
  if (isEditorInput(editor)) {
    return false;
  }
  const candidate = editor;
  if (!candidate) {
    return false;
  }
  if (candidate.resources && !Array.isArray(candidate.resources)) {
    return false;
  }
  return !!candidate.resources || !!candidate.multiDiffSource;
}
function isResourceSideBySideEditorInput(editor) {
  if (isEditorInput(editor)) {
    return false;
  }
  if (isResourceDiffEditorInput(editor)) {
    return false;
  }
  const candidate = editor;
  return candidate?.primary !== void 0 && candidate.secondary !== void 0;
}
function isUntitledResourceEditorInput(editor) {
  if (isEditorInput(editor)) {
    return false;
  }
  const candidate = editor;
  if (!candidate) {
    return false;
  }
  return candidate.resource === void 0 || candidate.resource.scheme === Schemas.untitled || candidate.forceUntitled === true;
}
function isResourceMergeEditorInput(editor) {
  if (isEditorInput(editor)) {
    return false;
  }
  const candidate = editor;
  return URI.isUri(candidate?.base?.resource) && URI.isUri(candidate?.input1?.resource) && URI.isUri(candidate?.input2?.resource) && URI.isUri(candidate?.result?.resource);
}
var Verbosity = /* @__PURE__ */ ((Verbosity2) => {
  Verbosity2[Verbosity2["SHORT"] = 0] = "SHORT";
  Verbosity2[Verbosity2["MEDIUM"] = 1] = "MEDIUM";
  Verbosity2[Verbosity2["LONG"] = 2] = "LONG";
  return Verbosity2;
})(Verbosity || {});
var SaveReason = /* @__PURE__ */ ((SaveReason2) => {
  SaveReason2[SaveReason2["EXPLICIT"] = 1] = "EXPLICIT";
  SaveReason2[SaveReason2["AUTO"] = 2] = "AUTO";
  SaveReason2[SaveReason2["FOCUS_CHANGE"] = 3] = "FOCUS_CHANGE";
  SaveReason2[SaveReason2["WINDOW_CHANGE"] = 4] = "WINDOW_CHANGE";
  return SaveReason2;
})(SaveReason || {});
class SaveSourceFactory {
  constructor() {
    this.mapIdToSaveSource = /* @__PURE__ */ new Map();
  }
  /**
   * Registers a `SaveSource` with an identifier and label
   * to the registry so that it can be used in save operations.
   */
  registerSource(id, label) {
    let sourceDescriptor = this.mapIdToSaveSource.get(id);
    if (!sourceDescriptor) {
      sourceDescriptor = { source: id, label };
      this.mapIdToSaveSource.set(id, sourceDescriptor);
    }
    return sourceDescriptor.source;
  }
  getSourceLabel(source) {
    return this.mapIdToSaveSource.get(source)?.label ?? source;
  }
}
const SaveSourceRegistry = new SaveSourceFactory();
var EditorInputCapabilities = /* @__PURE__ */ ((EditorInputCapabilities2) => {
  EditorInputCapabilities2[EditorInputCapabilities2["None"] = 0] = "None";
  EditorInputCapabilities2[EditorInputCapabilities2["Readonly"] = 2] = "Readonly";
  EditorInputCapabilities2[EditorInputCapabilities2["Untitled"] = 4] = "Untitled";
  EditorInputCapabilities2[EditorInputCapabilities2["Singleton"] = 8] = "Singleton";
  EditorInputCapabilities2[EditorInputCapabilities2["RequiresTrust"] = 16] = "RequiresTrust";
  EditorInputCapabilities2[EditorInputCapabilities2["CanSplitInGroup"] = 32] = "CanSplitInGroup";
  EditorInputCapabilities2[EditorInputCapabilities2["ForceDescription"] = 64] = "ForceDescription";
  EditorInputCapabilities2[EditorInputCapabilities2["CanDropIntoEditor"] = 128] = "CanDropIntoEditor";
  EditorInputCapabilities2[EditorInputCapabilities2["MultipleEditors"] = 256] = "MultipleEditors";
  EditorInputCapabilities2[EditorInputCapabilities2["Scratchpad"] = 512] = "Scratchpad";
  EditorInputCapabilities2[EditorInputCapabilities2["ForceReveal"] = 1024] = "ForceReveal";
  EditorInputCapabilities2[EditorInputCapabilities2["RequiresModal"] = 2048] = "RequiresModal";
  EditorInputCapabilities2[EditorInputCapabilities2["ExcludeFromEditorLimit"] = 4096] = "ExcludeFromEditorLimit";
  EditorInputCapabilities2[EditorInputCapabilities2["CannotClose"] = 8192] = "CannotClose";
  return EditorInputCapabilities2;
})(EditorInputCapabilities || {});
class AbstractEditorInput extends Disposable {
  // Marker class for implementing `isEditorInput`
}
function isEditorInput(editor) {
  return editor instanceof AbstractEditorInput;
}
function isEditorInputWithPreferredResource(editor) {
  const candidate = editor;
  return URI.isUri(candidate?.preferredResource);
}
function isSideBySideEditorInput(editor) {
  const candidate = editor;
  return isEditorInput(candidate?.primary) && isEditorInput(candidate?.secondary);
}
function isDiffEditorInput(editor) {
  const candidate = editor;
  return isEditorInput(candidate?.modified) && isEditorInput(candidate?.original);
}
function isEditorInputWithDiffResources(editor) {
  const candidate = editor;
  return URI.isUri(candidate?.diffResources?.original) && URI.isUri(candidate.diffResources.modified);
}
function createTooLargeFileError(group, input, options, message, preferencesService) {
  return createEditorOpenError(message, [
    toAction({
      id: "workbench.action.openLargeFile",
      label: localize("openLargeFile", "Open Anyway"),
      run: () => {
        const fileEditorOptions = {
          ...options,
          limits: {
            size: Number.MAX_VALUE
          }
        };
        group.openEditor(input, fileEditorOptions);
      }
    }),
    toAction({
      id: "workbench.action.configureEditorLargeFileConfirmation",
      label: localize("configureEditorLargeFileConfirmation", "Configure Limit"),
      run: () => {
        return preferencesService.openUserSettings({ query: "workbench.editorLargeFileConfirmation" });
      }
    })
  ], {
    forceMessage: true,
    forceSeverity: Severity.Warning
  });
}
function isEditorInputWithOptions(editor) {
  const candidate = editor;
  return isEditorInput(candidate?.editor);
}
function isEditorInputWithOptionsAndGroup(editor) {
  const candidate = editor;
  return isEditorInputWithOptions(editor) && candidate?.group !== void 0;
}
function isEditorIdentifier(identifier) {
  const candidate = identifier;
  return typeof candidate?.groupId === "number" && isEditorInput(candidate.editor);
}
function isEditorCommandsContext(context) {
  const candidate = context;
  return typeof candidate?.groupId === "number";
}
var EditorCloseContext = /* @__PURE__ */ ((EditorCloseContext2) => {
  EditorCloseContext2[EditorCloseContext2["UNKNOWN"] = 0] = "UNKNOWN";
  EditorCloseContext2[EditorCloseContext2["REPLACE"] = 1] = "REPLACE";
  EditorCloseContext2[EditorCloseContext2["MOVE"] = 2] = "MOVE";
  EditorCloseContext2[EditorCloseContext2["UNPIN"] = 3] = "UNPIN";
  return EditorCloseContext2;
})(EditorCloseContext || {});
var GroupModelChangeKind = /* @__PURE__ */ ((GroupModelChangeKind2) => {
  GroupModelChangeKind2[GroupModelChangeKind2["GROUP_ACTIVE"] = 0] = "GROUP_ACTIVE";
  GroupModelChangeKind2[GroupModelChangeKind2["GROUP_INDEX"] = 1] = "GROUP_INDEX";
  GroupModelChangeKind2[GroupModelChangeKind2["GROUP_LABEL"] = 2] = "GROUP_LABEL";
  GroupModelChangeKind2[GroupModelChangeKind2["GROUP_LOCKED"] = 3] = "GROUP_LOCKED";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITORS_SELECTION"] = 4] = "EDITORS_SELECTION";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_OPEN"] = 5] = "EDITOR_OPEN";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_CLOSE"] = 6] = "EDITOR_CLOSE";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_MOVE"] = 7] = "EDITOR_MOVE";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_ACTIVE"] = 8] = "EDITOR_ACTIVE";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_LABEL"] = 9] = "EDITOR_LABEL";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_CAPABILITIES"] = 10] = "EDITOR_CAPABILITIES";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_PIN"] = 11] = "EDITOR_PIN";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_TRANSIENT"] = 12] = "EDITOR_TRANSIENT";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_STICKY"] = 13] = "EDITOR_STICKY";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_DIRTY"] = 14] = "EDITOR_DIRTY";
  GroupModelChangeKind2[GroupModelChangeKind2["EDITOR_WILL_DISPOSE"] = 15] = "EDITOR_WILL_DISPOSE";
  return GroupModelChangeKind2;
})(GroupModelChangeKind || {});
var SideBySideEditor = /* @__PURE__ */ ((SideBySideEditor2) => {
  SideBySideEditor2[SideBySideEditor2["PRIMARY"] = 1] = "PRIMARY";
  SideBySideEditor2[SideBySideEditor2["SECONDARY"] = 2] = "SECONDARY";
  SideBySideEditor2[SideBySideEditor2["BOTH"] = 3] = "BOTH";
  SideBySideEditor2[SideBySideEditor2["ANY"] = 4] = "ANY";
  return SideBySideEditor2;
})(SideBySideEditor || {});
class EditorResourceAccessorImpl {
  getOriginalUri(editor, options) {
    if (!editor) {
      return void 0;
    }
    if (isResourceMergeEditorInput(editor)) {
      return EditorResourceAccessor.getOriginalUri(editor.result, options);
    }
    if (options?.supportSideBySide) {
      const { primary, secondary } = this.getSideEditors(editor);
      if (primary && secondary) {
        if (options?.supportSideBySide === 3 /* BOTH */) {
          return {
            primary: this.getOriginalUri(primary, { filterByScheme: options.filterByScheme }),
            secondary: this.getOriginalUri(secondary, { filterByScheme: options.filterByScheme })
          };
        } else if (options?.supportSideBySide === 4 /* ANY */) {
          return this.getOriginalUri(primary, { filterByScheme: options.filterByScheme }) ?? this.getOriginalUri(secondary, { filterByScheme: options.filterByScheme });
        }
        editor = options.supportSideBySide === 1 /* PRIMARY */ ? primary : secondary;
      }
    }
    if (isResourceDiffEditorInput(editor) || isResourceMultiDiffEditorInput(editor) || isResourceSideBySideEditorInput(editor) || isResourceMergeEditorInput(editor)) {
      return void 0;
    }
    const originalResource = isEditorInputWithPreferredResource(editor) ? editor.preferredResource : editor.resource;
    if (!originalResource || !options?.filterByScheme) {
      return originalResource;
    }
    return this.filterUri(originalResource, options.filterByScheme);
  }
  getSideEditors(editor) {
    if (isSideBySideEditorInput(editor) || isResourceSideBySideEditorInput(editor)) {
      return { primary: editor.primary, secondary: editor.secondary };
    }
    if (isDiffEditorInput(editor) || isResourceDiffEditorInput(editor)) {
      return { primary: editor.modified, secondary: editor.original };
    }
    return { primary: void 0, secondary: void 0 };
  }
  getCanonicalUri(editor, options) {
    if (!editor) {
      return void 0;
    }
    if (isResourceMergeEditorInput(editor)) {
      return EditorResourceAccessor.getCanonicalUri(editor.result, options);
    }
    if (options?.supportSideBySide) {
      const { primary, secondary } = this.getSideEditors(editor);
      if (primary && secondary) {
        if (options?.supportSideBySide === 3 /* BOTH */) {
          return {
            primary: this.getCanonicalUri(primary, { filterByScheme: options.filterByScheme }),
            secondary: this.getCanonicalUri(secondary, { filterByScheme: options.filterByScheme })
          };
        } else if (options?.supportSideBySide === 4 /* ANY */) {
          return this.getCanonicalUri(primary, { filterByScheme: options.filterByScheme }) ?? this.getCanonicalUri(secondary, { filterByScheme: options.filterByScheme });
        }
        editor = options.supportSideBySide === 1 /* PRIMARY */ ? primary : secondary;
      }
    }
    if (isResourceDiffEditorInput(editor) || isResourceMultiDiffEditorInput(editor) || isResourceSideBySideEditorInput(editor) || isResourceMergeEditorInput(editor)) {
      return void 0;
    }
    const canonicalResource = editor.resource;
    if (!canonicalResource || !options?.filterByScheme) {
      return canonicalResource;
    }
    return this.filterUri(canonicalResource, options.filterByScheme);
  }
  filterUri(resource, filter) {
    if (Array.isArray(filter)) {
      if (filter.some((scheme) => resource.scheme === scheme)) {
        return resource;
      }
    } else {
      if (filter === resource.scheme) {
        return resource;
      }
    }
    return void 0;
  }
}
var EditorCloseMethod = /* @__PURE__ */ ((EditorCloseMethod2) => {
  EditorCloseMethod2[EditorCloseMethod2["UNKNOWN"] = 0] = "UNKNOWN";
  EditorCloseMethod2[EditorCloseMethod2["KEYBOARD"] = 1] = "KEYBOARD";
  EditorCloseMethod2[EditorCloseMethod2["MOUSE"] = 2] = "MOUSE";
  return EditorCloseMethod2;
})(EditorCloseMethod || {});
function preventEditorClose(group, editor, method, configuration) {
  if (!group.isSticky(editor)) {
    return false;
  }
  switch (configuration.preventPinnedEditorClose) {
    case "keyboardAndMouse":
      return method === 2 /* MOUSE */ || method === 1 /* KEYBOARD */;
    case "mouse":
      return method === 2 /* MOUSE */;
    case "keyboard":
      return method === 1 /* KEYBOARD */;
  }
  return false;
}
const EditorResourceAccessor = new EditorResourceAccessorImpl();
var CloseDirection = /* @__PURE__ */ ((CloseDirection2) => {
  CloseDirection2[CloseDirection2["LEFT"] = 0] = "LEFT";
  CloseDirection2[CloseDirection2["RIGHT"] = 1] = "RIGHT";
  return CloseDirection2;
})(CloseDirection || {});
class EditorFactoryRegistry {
  constructor() {
    this.editorSerializerConstructors = /* @__PURE__ */ new Map();
    this.editorSerializerInstances = /* @__PURE__ */ new Map();
  }
  start(accessor) {
    const instantiationService = this.instantiationService = accessor.get(IInstantiationService);
    for (const [key, ctor] of this.editorSerializerConstructors) {
      this.createEditorSerializer(key, ctor, instantiationService);
    }
    this.editorSerializerConstructors.clear();
  }
  createEditorSerializer(editorTypeId, ctor, instantiationService) {
    const instance = instantiationService.createInstance(ctor);
    this.editorSerializerInstances.set(editorTypeId, instance);
  }
  registerFileEditorFactory(factory) {
    if (this.fileEditorFactory) {
      throw new Error("Can only register one file editor factory.");
    }
    this.fileEditorFactory = factory;
  }
  getFileEditorFactory() {
    return assertReturnsDefined(this.fileEditorFactory);
  }
  registerEditorSerializer(editorTypeId, ctor) {
    if (this.editorSerializerConstructors.has(editorTypeId) || this.editorSerializerInstances.has(editorTypeId)) {
      throw new Error(`A editor serializer with type ID '${editorTypeId}' was already registered.`);
    }
    if (!this.instantiationService) {
      this.editorSerializerConstructors.set(editorTypeId, ctor);
    } else {
      this.createEditorSerializer(editorTypeId, ctor, this.instantiationService);
    }
    return toDisposable(() => {
      this.editorSerializerConstructors.delete(editorTypeId);
      this.editorSerializerInstances.delete(editorTypeId);
    });
  }
  getEditorSerializer(arg1) {
    return this.editorSerializerInstances.get(typeof arg1 === "string" ? arg1 : arg1.typeId);
  }
}
Registry.add(EditorExtensions.EditorFactory, new EditorFactoryRegistry());
async function pathsToEditors(paths, fileService, logService) {
  if (!paths?.length) {
    return [];
  }
  return await Promise.all(paths.map(async (path) => {
    const resource = URI.revive(path.fileUri);
    if (!resource) {
      logService.info("Cannot resolve the path because it is not valid.", path);
      return void 0;
    }
    const canHandleResource = await fileService.canHandleResource(resource);
    if (!canHandleResource) {
      logService.info("Cannot resolve the path because it cannot be handled", path);
      return void 0;
    }
    let exists = path.exists;
    let type = path.type;
    if (typeof exists !== "boolean" || typeof type !== "number") {
      try {
        type = (await fileService.stat(resource)).isDirectory ? FileType.Directory : FileType.Unknown;
        exists = true;
      } catch (error) {
        logService.error(error);
        exists = false;
      }
    }
    if (!exists && path.openOnlyIfExists) {
      logService.info("Cannot resolve the path because it does not exist", path);
      return void 0;
    }
    if (type === FileType.Directory) {
      logService.info("Cannot resolve the path because it is a directory", path);
      return void 0;
    }
    const options = {
      ...path.options,
      pinned: true
    };
    if (!exists) {
      return { resource, options, forceUntitled: true };
    }
    return { resource, options };
  }));
}
var EditorsOrder = /* @__PURE__ */ ((EditorsOrder2) => {
  EditorsOrder2[EditorsOrder2["MOST_RECENTLY_ACTIVE"] = 0] = "MOST_RECENTLY_ACTIVE";
  EditorsOrder2[EditorsOrder2["SEQUENTIAL"] = 1] = "SEQUENTIAL";
  return EditorsOrder2;
})(EditorsOrder || {});
function isTextEditorViewState(candidate) {
  const viewState = candidate;
  if (!viewState) {
    return false;
  }
  const diffEditorViewState = viewState;
  if (diffEditorViewState.modified) {
    return isTextEditorViewState(diffEditorViewState.modified);
  }
  const codeEditorViewState = viewState;
  return !!(codeEditorViewState.contributionsState && codeEditorViewState.viewState && Array.isArray(codeEditorViewState.cursorState));
}
function isEditorOpenError(obj) {
  return isErrorWithActions(obj);
}
function createEditorOpenError(messageOrError, actions, options) {
  const error = createErrorWithActions(messageOrError, actions);
  error.forceMessage = options?.forceMessage;
  error.forceSeverity = options?.forceSeverity;
  error.allowDialog = options?.allowDialog;
  return error;
}
export {
  AbstractEditorInput,
  BINARY_DIFF_EDITOR_ID,
  CloseDirection,
  DEFAULT_EDITOR_ASSOCIATION,
  EditorCloseContext,
  EditorCloseMethod,
  EditorExtensions,
  EditorInputCapabilities,
  EditorPaneSelectionChangeReason,
  EditorPaneSelectionCompareResult,
  EditorResourceAccessor,
  EditorsOrder,
  GroupModelChangeKind,
  SIDE_BY_SIDE_EDITOR_ID,
  SaveReason,
  SaveSourceRegistry,
  SideBySideEditor,
  TEXT_DIFF_EDITOR_ID,
  Verbosity,
  createEditorOpenError,
  createTooLargeFileError,
  findViewStateForEditor,
  isDiffEditorInput,
  isEditorCommandsContext,
  isEditorIdentifier,
  isEditorInput,
  isEditorInputWithDiffResources,
  isEditorInputWithOptions,
  isEditorInputWithOptionsAndGroup,
  isEditorOpenError,
  isEditorPaneWithScrolling,
  isEditorPaneWithSelection,
  isResourceDiffEditorInput,
  isResourceEditorInput,
  isResourceMergeEditorInput,
  isResourceMultiDiffEditorInput,
  isResourceSideBySideEditorInput,
  isSideBySideEditorInput,
  isTextEditorViewState,
  isUntitledResourceEditorInput,
  pathsToEditors,
  preventEditorClose
};
