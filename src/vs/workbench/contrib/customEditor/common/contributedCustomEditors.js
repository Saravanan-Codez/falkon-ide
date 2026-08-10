import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import * as nls from "../../../../nls.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Memento } from "../../../common/memento.js";
import { CustomEditorInfo, CustomEditorPriority } from "./customEditor.js";
import { customEditorsExtensionPoint } from "./extensionPoint.js";
import { RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
class ContributedCustomEditors extends Disposable {
  constructor(storageService) {
    super();
    this._editors = /* @__PURE__ */ new Map();
    this._onChange = this._register(new Emitter());
    this.onChange = this._onChange.event;
    this._memento = new Memento(ContributedCustomEditors.CUSTOM_EDITORS_STORAGE_ID, storageService);
    const mementoObject = this._memento.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    for (const info of mementoObject[ContributedCustomEditors.CUSTOM_EDITORS_ENTRY_ID] || []) {
      this.add(new CustomEditorInfo(normalizeStoredCustomEditorDescriptor(info)));
    }
    this._register(customEditorsExtensionPoint.setHandler((extensions) => {
      this.update(extensions);
    }));
  }
  static {
    this.CUSTOM_EDITORS_STORAGE_ID = "customEditors";
  }
  static {
    this.CUSTOM_EDITORS_ENTRY_ID = "editors";
  }
  update(extensions) {
    this._editors.clear();
    for (const extension of extensions) {
      for (const webviewEditorContribution of extension.value) {
        const priority = getPriorityFromContribution(webviewEditorContribution.priority, extension.description);
        this.add(new CustomEditorInfo({
          id: webviewEditorContribution.viewType,
          displayName: webviewEditorContribution.displayName,
          providerDisplayName: extension.description.isBuiltin ? nls.localize("builtinProviderDisplayName", "Built-in") : extension.description.displayName || extension.description.identifier.value,
          selector: webviewEditorContribution.selector || [],
          priority
        }));
      }
    }
    const mementoObject = this._memento.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    mementoObject[ContributedCustomEditors.CUSTOM_EDITORS_ENTRY_ID] = Array.from(this._editors.values());
    this._memento.saveMemento();
    this._onChange.fire();
  }
  [Symbol.iterator]() {
    return this._editors.values();
  }
  get(viewType) {
    return this._editors.get(viewType);
  }
  getContributedEditors(resource) {
    return Array.from(this._editors.values()).filter((customEditor) => customEditor.matches(resource));
  }
  add(info) {
    if (this._editors.has(info.id)) {
      console.error(`Custom editor with id '${info.id}' already registered`);
      return;
    }
    this._editors.set(info.id, info);
  }
}
function normalizeStoredCustomEditorDescriptor(descriptor) {
  return {
    id: descriptor.id,
    displayName: descriptor.displayName,
    providerDisplayName: descriptor.providerDisplayName,
    selector: descriptor.selector,
    priority: typeof descriptor.priority === "string" ? {
      editor: descriptor.priority,
      diff: RegisteredEditorPriority.explicit
    } : {
      editor: descriptor.priority.editor,
      diff: descriptor.priority.diff ?? RegisteredEditorPriority.explicit
    }
  };
}
function getPriorityFromContribution(contribution, extension) {
  const editorPriority = getSinglePriorityFromContribution(typeof contribution === "string" ? contribution : contribution?.textEditor, extension) ?? RegisteredEditorPriority.default;
  return {
    editor: editorPriority,
    diff: (typeof contribution === "string" ? void 0 : getSinglePriorityFromContribution(contribution?.diffEditor, extension)) ?? RegisteredEditorPriority.explicit
  };
}
function getSinglePriorityFromContribution(value, extension) {
  switch (value) {
    case CustomEditorPriority.default:
      return RegisteredEditorPriority.default;
    case CustomEditorPriority.option:
      return RegisteredEditorPriority.option;
    case CustomEditorPriority.explicit:
      return RegisteredEditorPriority.explicit;
    case CustomEditorPriority.builtin:
      return extension.isBuiltin ? RegisteredEditorPriority.builtin : RegisteredEditorPriority.default;
    default:
      return void 0;
  }
}
export {
  ContributedCustomEditors
};
