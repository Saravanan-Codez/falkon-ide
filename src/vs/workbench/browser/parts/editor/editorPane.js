import { Composite } from "../../composite.js";
import { isEditorInput } from "../../../common/editor.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { LRUCache, Touch } from "../../../../base/common/map.js";
import { URI } from "../../../../base/common/uri.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { isEmptyObject } from "../../../../base/common/types.js";
import { DEFAULT_EDITOR_MIN_DIMENSIONS, DEFAULT_EDITOR_MAX_DIMENSIONS } from "./editor.js";
import { joinPath, isEqual } from "../../../../base/common/resources.js";
import { indexOfPath } from "../../../../base/common/extpath.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { getWindowById } from "../../../../base/browser/dom.js";
class EditorPane extends Composite {
  constructor(id, group, telemetryService, themeService, storageService) {
    super(id, telemetryService, themeService, storageService);
    this.group = group;
    //#region Events
    this.onDidChangeSizeConstraints = Event.None;
    this._onDidChangeControl = this._register(new Emitter());
    this.onDidChangeControl = this._onDidChangeControl.event;
  }
  static {
    //#endregion
    this.EDITOR_MEMENTOS = /* @__PURE__ */ new Map();
  }
  get minimumWidth() {
    return DEFAULT_EDITOR_MIN_DIMENSIONS.width;
  }
  get maximumWidth() {
    return DEFAULT_EDITOR_MAX_DIMENSIONS.width;
  }
  get minimumHeight() {
    return DEFAULT_EDITOR_MIN_DIMENSIONS.height;
  }
  get maximumHeight() {
    return DEFAULT_EDITOR_MAX_DIMENSIONS.height;
  }
  get input() {
    return this._input;
  }
  get options() {
    return this._options;
  }
  get window() {
    return getWindowById(this.group.windowId, true).window;
  }
  /**
   * Should be overridden by editors that have their own ScopedContextKeyService
   */
  get scopedContextKeyService() {
    return void 0;
  }
  create(parent) {
    super.create(parent);
    this.createEditor(parent);
  }
  /**
   * Note: Clients should not call this method, the workbench calls this
   * method. Calling it otherwise may result in unexpected behavior.
   *
   * Sets the given input with the options to the editor. The input is guaranteed
   * to be different from the previous input that was set using the `input.matches()`
   * method.
   *
   * The provided context gives more information around how the editor was opened.
   *
   * The provided cancellation token should be used to test if the operation
   * was cancelled.
   */
  async setInput(input, options, context, token) {
    this._input = input;
    this._options = options;
  }
  /**
   * Called to indicate to the editor that the input should be cleared and
   * resources associated with the input should be freed.
   *
   * This method can be called based on different contexts, e.g. when opening
   * a different input or different editor control or when closing all editors
   * in a group.
   *
   * To monitor the lifecycle of editor inputs, you should not rely on this
   * method, rather refer to the listeners on `IEditorGroup` via `IEditorGroupsService`.
   */
  clearInput() {
    this._input = void 0;
    this._options = void 0;
  }
  /**
   * Note: Clients should not call this method, the workbench calls this
   * method. Calling it otherwise may result in unexpected behavior.
   *
   * Sets the given options to the editor. Clients should apply the options
   * to the current input.
   */
  setOptions(options) {
    this._options = options;
  }
  setVisible(visible) {
    super.setVisible(visible);
    this.setEditorVisible(visible);
  }
  /**
   * Indicates that the editor control got visible or hidden.
   *
   * @param visible the state of visibility of this editor
   */
  setEditorVisible(visible) {
  }
  setBoundarySashes(_sashes) {
  }
  getEditorMemento(editorGroupService, configurationService, key, limit = 10) {
    const mementoKey = `${this.getId()}${key}`;
    let editorMemento = EditorPane.EDITOR_MEMENTOS.get(mementoKey);
    if (!editorMemento) {
      editorMemento = this._register(new EditorMemento(this.getId(), key, this.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE), limit, editorGroupService, configurationService));
      EditorPane.EDITOR_MEMENTOS.set(mementoKey, editorMemento);
    }
    return editorMemento;
  }
  getViewState() {
    return void 0;
  }
  saveState() {
    for (const [, editorMemento] of EditorPane.EDITOR_MEMENTOS) {
      if (editorMemento.id === this.getId()) {
        editorMemento.saveState();
      }
    }
    super.saveState();
  }
  dispose() {
    this._input = void 0;
    this._options = void 0;
    super.dispose();
  }
}
class EditorMemento extends Disposable {
  constructor(id, key, memento, limit, editorGroupService, configurationService) {
    super();
    this.id = id;
    this.key = key;
    this.memento = memento;
    this.limit = limit;
    this.editorGroupService = editorGroupService;
    this.configurationService = configurationService;
    this.cleanedUp = false;
    this.shareEditorState = false;
    this.updateConfiguration(void 0);
    this.registerListeners();
  }
  static {
    this.SHARED_EDITOR_STATE = -1;
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.updateConfiguration(e)));
  }
  updateConfiguration(e) {
    if (!e || e.affectsConfiguration(void 0, "workbench.editor.sharedViewState")) {
      this.shareEditorState = this.configurationService.getValue(void 0, "workbench.editor.sharedViewState") === true;
    }
  }
  saveEditorState(group, resourceOrEditor, state) {
    const resource = this.doGetResource(resourceOrEditor);
    if (!resource || !group) {
      return;
    }
    const cache = this.doLoad();
    let mementosForResource = cache.get(resource.toString());
    if (!mementosForResource) {
      mementosForResource = /* @__PURE__ */ Object.create(null);
      cache.set(resource.toString(), mementosForResource);
    }
    mementosForResource[group.id] = state;
    if (this.shareEditorState) {
      mementosForResource[EditorMemento.SHARED_EDITOR_STATE] = state;
    }
    if (isEditorInput(resourceOrEditor)) {
      this.clearEditorStateOnDispose(resource, resourceOrEditor);
    }
  }
  loadEditorState(group, resourceOrEditor) {
    const resource = this.doGetResource(resourceOrEditor);
    if (!resource || !group) {
      return;
    }
    const cache = this.doLoad();
    const mementosForResource = cache.get(resource.toString());
    if (mementosForResource) {
      const mementoForResourceAndGroup = mementosForResource[group.id];
      if (mementoForResourceAndGroup) {
        return mementoForResourceAndGroup;
      }
      if (this.shareEditorState) {
        return mementosForResource[EditorMemento.SHARED_EDITOR_STATE];
      }
    }
    return void 0;
  }
  clearEditorState(resourceOrEditor, group) {
    if (isEditorInput(resourceOrEditor)) {
      this.editorDisposables?.delete(resourceOrEditor);
    }
    const resource = this.doGetResource(resourceOrEditor);
    if (resource) {
      const cache = this.doLoad();
      if (group) {
        const mementosForResource = cache.get(resource.toString());
        if (mementosForResource) {
          delete mementosForResource[group.id];
          if (isEmptyObject(mementosForResource)) {
            cache.delete(resource.toString());
          }
        }
      } else {
        cache.delete(resource.toString());
      }
    }
  }
  clearEditorStateOnDispose(resource, editor) {
    if (!this.editorDisposables) {
      this.editorDisposables = /* @__PURE__ */ new Map();
    }
    if (!this.editorDisposables.has(editor)) {
      this.editorDisposables.set(editor, Event.once(editor.onWillDispose)(() => {
        this.clearEditorState(resource);
        this.editorDisposables?.delete(editor);
      }));
    }
  }
  moveEditorState(source, target, comparer) {
    const cache = this.doLoad();
    const cacheKeys = [...cache.keys()];
    for (const cacheKey of cacheKeys) {
      const resource = URI.parse(cacheKey);
      if (!comparer.isEqualOrParent(resource, source)) {
        continue;
      }
      let targetResource;
      if (isEqual(source, resource)) {
        targetResource = target;
      } else {
        const index = indexOfPath(resource.path, source.path);
        targetResource = joinPath(target, resource.path.substr(index + source.path.length + 1));
      }
      const value = cache.get(cacheKey, Touch.None);
      if (value) {
        cache.delete(cacheKey);
        cache.set(targetResource.toString(), value);
      }
    }
  }
  doGetResource(resourceOrEditor) {
    if (isEditorInput(resourceOrEditor)) {
      return resourceOrEditor.resource;
    }
    return resourceOrEditor;
  }
  doLoad() {
    if (!this.cache) {
      this.cache = new LRUCache(this.limit);
      const rawEditorMemento = this.memento[this.key];
      if (Array.isArray(rawEditorMemento)) {
        this.cache.fromJSON(rawEditorMemento);
      }
    }
    return this.cache;
  }
  saveState() {
    const cache = this.doLoad();
    if (!this.cleanedUp) {
      this.cleanUp();
      this.cleanedUp = true;
    }
    this.memento[this.key] = cache.toJSON();
  }
  cleanUp() {
    const cache = this.doLoad();
    const entries = [...cache.entries()];
    for (const [resource, mapGroupToMementos] of entries) {
      for (const group of Object.keys(mapGroupToMementos)) {
        const groupId = Number(group);
        if (groupId === EditorMemento.SHARED_EDITOR_STATE && this.shareEditorState) {
          continue;
        }
        if (!this.editorGroupService.getGroup(groupId)) {
          delete mapGroupToMementos[groupId];
          if (isEmptyObject(mapGroupToMementos)) {
            cache.delete(resource);
          }
        }
      }
    }
  }
}
export {
  EditorMemento,
  EditorPane
};
