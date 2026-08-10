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
import { Event } from "../../../../base/common/event.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { EditorPane } from "./editorPane.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { DisposableMap, MutableDisposable } from "../../../../base/common/lifecycle.js";
let AbstractEditorWithViewState = class extends EditorPane {
  constructor(id, group, viewStateStorageKey, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService) {
    super(id, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.editorService = editorService;
    this.editorGroupService = editorGroupService;
    this.groupListener = this._register(new MutableDisposable());
    this.viewState = this.getEditorMemento(editorGroupService, textResourceConfigurationService, viewStateStorageKey, 100);
  }
  setEditorVisible(visible) {
    this.groupListener.value = this.group.onWillCloseEditor((e) => this.onWillCloseEditor(e));
    super.setEditorVisible(visible);
  }
  onWillCloseEditor(e) {
    const editor = e.editor;
    if (editor === this.input) {
      this.updateEditorViewState(editor);
    }
  }
  clearInput() {
    this.updateEditorViewState(this.input);
    super.clearInput();
  }
  saveState() {
    this.updateEditorViewState(this.input);
    super.saveState();
  }
  /**
   * Persist the current input's view state now. Useful for editors that can be
   * hidden/backgrounded without being cleared or closed (e.g. when another
   * editor becomes active), where the state would otherwise only be captured
   * on close or shutdown.
   */
  saveCurrentEditorViewState() {
    this.updateEditorViewState(this.input);
  }
  updateEditorViewState(input) {
    if (!input || !this.tracksEditorViewState(input)) {
      return;
    }
    const resource = this.toEditorViewStateResource(input);
    if (!resource) {
      return;
    }
    if (!this.tracksDisposedEditorViewState()) {
      if (!this.editorViewStateDisposables) {
        this.editorViewStateDisposables = this._register(new DisposableMap());
      }
      if (!this.editorViewStateDisposables.has(input)) {
        this.editorViewStateDisposables.set(input, Event.once(input.onWillDispose)(() => {
          this.clearEditorViewState(resource, this.group);
          this.editorViewStateDisposables?.deleteAndDispose(input);
        }));
      }
    }
    if (input.isDisposed() && !this.tracksDisposedEditorViewState() || !this.shouldRestoreEditorViewState(input) && !this.group.contains(input)) {
      this.clearEditorViewState(resource, this.group);
      this.editorViewStateDisposables?.deleteAndDispose(input);
    } else if (!input.isDisposed()) {
      this.saveEditorViewState(resource);
    }
  }
  shouldRestoreEditorViewState(input, context) {
    if (context?.newInGroup) {
      return this.textResourceConfigurationService.getValue(EditorResourceAccessor.getOriginalUri(input, { supportSideBySide: SideBySideEditor.PRIMARY }), "workbench.editor.restoreViewState") !== false;
    }
    return true;
  }
  getViewState() {
    const input = this.input;
    if (!input || !this.tracksEditorViewState(input)) {
      return;
    }
    const resource = this.toEditorViewStateResource(input);
    if (!resource) {
      return;
    }
    return this.computeEditorViewState(resource);
  }
  saveEditorViewState(resource) {
    const editorViewState = this.computeEditorViewState(resource);
    if (!editorViewState) {
      return;
    }
    this.viewState.saveEditorState(this.group, resource, editorViewState);
  }
  loadEditorViewState(input, context) {
    if (!input) {
      return void 0;
    }
    if (!this.tracksEditorViewState(input)) {
      return void 0;
    }
    if (!this.shouldRestoreEditorViewState(input, context)) {
      return void 0;
    }
    const resource = this.toEditorViewStateResource(input);
    if (!resource) {
      return;
    }
    return this.viewState.loadEditorState(this.group, resource);
  }
  moveEditorViewState(source, target, comparer) {
    return this.viewState.moveEditorState(source, target, comparer);
  }
  clearEditorViewState(resource, group) {
    this.viewState.clearEditorState(resource, group);
  }
  /**
   * Whether view state should be tracked even when the editor is
   * disposed.
   *
   * Subclasses should override this if the input can be restored
   * from the resource at a later point, e.g. if backed by files.
   */
  tracksDisposedEditorViewState() {
    return false;
  }
  //#endregion
};
AbstractEditorWithViewState = __decorateClass([
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ITextResourceConfigurationService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, IEditorGroupsService)
], AbstractEditorWithViewState);
export {
  AbstractEditorWithViewState
};
