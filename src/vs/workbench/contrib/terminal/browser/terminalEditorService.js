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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { EditorActivation } from "../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { TerminalLocation } from "../../../../platform/terminal/common/terminal.js";
import { ITerminalInstanceService } from "./terminal.js";
import { TerminalEditorInput } from "./terminalEditorInput.js";
import { getInstanceFromResource } from "./terminalUri.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService, ACTIVE_GROUP, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
let TerminalEditorService = class extends Disposable {
  constructor(_editorService, _editorGroupsService, _terminalInstanceService, _instantiationService, lifecycleService, contextKeyService) {
    super();
    this._editorService = _editorService;
    this._editorGroupsService = _editorGroupsService;
    this._terminalInstanceService = _terminalInstanceService;
    this._instantiationService = _instantiationService;
    this.instances = [];
    this._activeInstanceIndex = -1;
    this._isShuttingDown = false;
    this._editorInputs = /* @__PURE__ */ new Map();
    this._instanceDisposables = /* @__PURE__ */ new Map();
    this._onDidDisposeInstance = this._register(new Emitter());
    this.onDidDisposeInstance = this._onDidDisposeInstance.event;
    this._onDidFocusInstance = this._register(new Emitter());
    this.onDidFocusInstance = this._onDidFocusInstance.event;
    this._onDidChangeInstanceCapability = this._register(new Emitter());
    this.onDidChangeInstanceCapability = this._onDidChangeInstanceCapability.event;
    this._onDidChangeActiveInstance = this._register(new Emitter());
    this.onDidChangeActiveInstance = this._onDidChangeActiveInstance.event;
    this._onDidChangeInstances = this._register(new Emitter());
    this.onDidChangeInstances = this._onDidChangeInstances.event;
    this._terminalEditorActive = TerminalContextKeys.terminalEditorActive.bindTo(contextKeyService);
    this._register(toDisposable(() => {
      for (const d of this._instanceDisposables.values()) {
        dispose(d);
      }
    }));
    this._register(lifecycleService.onWillShutdown(() => this._isShuttingDown = true));
    this._register(this._editorService.onDidActiveEditorChange(() => {
      const activeEditor = this._editorService.activeEditor;
      const instance = activeEditor instanceof TerminalEditorInput ? activeEditor?.terminalInstance : void 0;
      const terminalEditorActive = !!instance && activeEditor instanceof TerminalEditorInput;
      this._terminalEditorActive.set(terminalEditorActive);
      if (terminalEditorActive) {
        activeEditor?.setGroup(this._editorService.activeEditorPane?.group);
        this.setActiveInstance(instance);
      } else {
        for (const instance2 of this.instances) {
          instance2.resetFocusContextKey();
        }
      }
    }));
    this._register(this._editorService.onDidVisibleEditorsChange(() => {
      const knownIds = this.instances.map((i) => i.instanceId);
      const terminalEditors = this._getActiveTerminalEditors();
      const unknownEditor = terminalEditors.find((input) => {
        const inputId = input instanceof TerminalEditorInput ? input.terminalInstance?.instanceId : void 0;
        if (inputId === void 0) {
          return false;
        }
        return !knownIds.includes(inputId);
      });
      if (unknownEditor instanceof TerminalEditorInput && unknownEditor.terminalInstance) {
        this._editorInputs.set(unknownEditor.terminalInstance.resource.path, unknownEditor);
        this.instances.push(unknownEditor.terminalInstance);
      }
    }));
    this._register(this._editorService.onDidCloseEditor((e) => {
      const instance = e.editor instanceof TerminalEditorInput ? e.editor.terminalInstance : void 0;
      if (instance) {
        const instanceIndex = this.instances.findIndex((e2) => e2 === instance);
        if (instanceIndex !== -1) {
          const wasActiveInstance = this.instances[instanceIndex] === this.activeInstance;
          this._removeInstance(instance);
          if (wasActiveInstance) {
            this.setActiveInstance(void 0);
          }
        }
      }
    }));
  }
  _getActiveTerminalEditors() {
    return this._editorService.visibleEditors.filter((e) => e instanceof TerminalEditorInput && e.terminalInstance?.instanceId);
  }
  get activeInstance() {
    if (this.instances.length === 0 || this._activeInstanceIndex === -1) {
      return void 0;
    }
    return this.instances[this._activeInstanceIndex];
  }
  setActiveInstance(instance) {
    this._activeInstanceIndex = instance ? this.instances.findIndex((e) => e === instance) : -1;
    this._onDidChangeActiveInstance.fire(this.activeInstance);
  }
  async focusInstance(instance) {
    if (!this.instances.includes(instance)) {
      return;
    }
    this.setActiveInstance(instance);
    await this._revealEditor(instance);
    await instance.focusWhenReady(true);
  }
  async focusActiveInstance() {
    return this.activeInstance?.focusWhenReady(true);
  }
  async openEditor(instance, editorOptions) {
    const resource = this.resolveResource(instance);
    if (resource) {
      await this._activeOpenEditorRequest?.promise;
      this._activeOpenEditorRequest = {
        instanceId: instance.instanceId,
        promise: this._editorService.openEditor({
          resource,
          description: instance.description || instance.shellLaunchConfig.type,
          options: {
            pinned: true,
            forceReload: true,
            preserveFocus: editorOptions?.preserveFocus,
            auxiliary: editorOptions?.auxiliary
          }
        }, editorOptions?.viewColumn ?? ACTIVE_GROUP)
      };
      await this._activeOpenEditorRequest?.promise;
      this._activeOpenEditorRequest = void 0;
    }
  }
  resolveResource(instance) {
    const resource = instance.resource;
    const inputKey = resource.path;
    const cachedEditor = this._editorInputs.get(inputKey);
    if (cachedEditor) {
      return cachedEditor.resource;
    }
    instance.target = TerminalLocation.Editor;
    const input = this._instantiationService.createInstance(TerminalEditorInput, resource, instance);
    this._registerInstance(inputKey, input, instance);
    return input.resource;
  }
  getInputFromResource(resource) {
    const input = this._editorInputs.get(resource.path);
    if (!input) {
      throw new Error(`Could not get input from resource: ${resource.path}`);
    }
    return input;
  }
  _registerInstance(inputKey, input, instance) {
    this._editorInputs.set(inputKey, input);
    this._instanceDisposables.set(inputKey, [
      instance.onDidFocus(this._onDidFocusInstance.fire, this._onDidFocusInstance),
      instance.onDisposed(this._onDidDisposeInstance.fire, this._onDidDisposeInstance),
      instance.capabilities.onDidChangeCapabilities(() => this._onDidChangeInstanceCapability.fire(instance))
    ]);
    this.instances.push(instance);
    this._onDidChangeInstances.fire();
  }
  _removeInstance(instance) {
    const inputKey = instance.resource.path;
    this._editorInputs.delete(inputKey);
    const instanceIndex = this.instances.findIndex((e) => e === instance);
    if (instanceIndex !== -1) {
      this.instances.splice(instanceIndex, 1);
    }
    const disposables = this._instanceDisposables.get(inputKey);
    this._instanceDisposables.delete(inputKey);
    if (disposables) {
      dispose(disposables);
    }
    this._onDidChangeInstances.fire();
  }
  getInstanceFromResource(resource) {
    return getInstanceFromResource(this.instances, resource);
  }
  async splitInstance(instanceToSplit, shellLaunchConfig = {}) {
    if (instanceToSplit.target === TerminalLocation.Editor) {
      const group = this._editorInputs.get(instanceToSplit.resource.path)?.group;
      if (group) {
        this._editorGroupsService.activateGroup(group);
      }
    }
    const instance = this._terminalInstanceService.createInstance(shellLaunchConfig, TerminalLocation.Editor);
    const resource = this.resolveResource(instance);
    if (resource) {
      await this._editorService.openEditor({
        resource: URI.revive(resource),
        description: instance.description,
        options: {
          pinned: true,
          forceReload: true
        }
      }, SIDE_GROUP);
    }
    return instance;
  }
  reviveInput(deserializedInput) {
    const newDeserializedInput = { ...deserializedInput, findRevivedId: true };
    const instance = this._terminalInstanceService.createInstance({ attachPersistentProcess: newDeserializedInput }, TerminalLocation.Editor);
    const input = this._instantiationService.createInstance(TerminalEditorInput, instance.resource, instance);
    this._registerInstance(instance.resource.path, input, instance);
    return input;
  }
  detachInstance(instance) {
    const inputKey = instance.resource.path;
    const editorInput = this._editorInputs.get(inputKey);
    editorInput?.detachInstance();
    this._removeInstance(instance);
    if (!this._isShuttingDown) {
      editorInput?.dispose();
    }
  }
  async revealActiveEditor(preserveFocus) {
    const instance = this.activeInstance;
    if (!instance) {
      return;
    }
    await this._revealEditor(instance, preserveFocus);
  }
  async _revealEditor(instance, preserveFocus) {
    if (this._activeOpenEditorRequest?.instanceId === instance.instanceId) {
      await this._activeOpenEditorRequest.promise;
      return;
    }
    const editorInput = this._editorInputs.get(instance.resource.path);
    if (!editorInput) {
      return;
    }
    await this._editorService.openEditor(
      editorInput,
      {
        pinned: true,
        forceReload: true,
        preserveFocus,
        activation: EditorActivation.PRESERVE
      }
    );
  }
};
TerminalEditorService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IEditorGroupsService),
  __decorateParam(2, ITerminalInstanceService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILifecycleService),
  __decorateParam(5, IContextKeyService)
], TerminalEditorService);
export {
  TerminalEditorService
};
