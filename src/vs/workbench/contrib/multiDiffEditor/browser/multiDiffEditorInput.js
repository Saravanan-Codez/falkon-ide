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
import { LazyStatefulPromise, raceTimeout } from "../../../../base/common/async.js";
import { BugIndicatingError, CancellationError, onUnexpectedError } from "../../../../base/common/errors.js";
import { Event, ValueWithChangeEvent } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { parse } from "../../../../base/common/marshalling.js";
import { Schemas } from "../../../../base/common/network.js";
import { deepClone } from "../../../../base/common/objects.js";
import { ObservableLazyPromise, ValueWithChangeEventFromObservable, autorun, constObservable, derived, mapObservableArrayCached, observableFromEvent, observableFromValueWithChangeEvent, observableValue, recomputeInitiallyAndOnChange } from "../../../../base/common/observable.js";
import { isDefined, isObject } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { RefCounted } from "../../../../editor/browser/widget/diffEditor/utils.js";
import { MultiDiffEditorViewModel } from "../../../../editor/browser/widget/multiDiffEditor/multiDiffEditorViewModel.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { localize } from "../../../../nls.js";
import { ConfirmResult } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorInputCapabilities } from "../../../common/editor.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { MultiDiffEditorIcon } from "./icons.contribution.js";
import { IMultiDiffSourceResolverService, MultiDiffEditorItem } from "./multiDiffSourceResolverService.js";
let MultiDiffEditorInput = class extends EditorInput {
  constructor(multiDiffSource, label, initialResources, isTransient = false, _textModelService, _textResourceConfigurationService, _instantiationService, _multiDiffSourceResolverService, _textFileService) {
    super();
    this.multiDiffSource = multiDiffSource;
    this.label = label;
    this.initialResources = initialResources;
    this.isTransient = isTransient;
    this._textModelService = _textModelService;
    this._textResourceConfigurationService = _textResourceConfigurationService;
    this._instantiationService = _instantiationService;
    this._multiDiffSourceResolverService = _multiDiffSourceResolverService;
    this._textFileService = _textFileService;
    this._name = "";
    this._viewModel = new LazyStatefulPromise(async () => {
      const store = new DisposableStore();
      try {
        const model = store.add(await this._createModel());
        if (this._store.isDisposed) {
          throw new CancellationError();
        }
        const vm = store.add(new MultiDiffEditorViewModel(model, this._instantiationService));
        await raceTimeout(vm.waitForDiffOr1s(), 1e3);
        if (this._store.isDisposed) {
          throw new CancellationError();
        }
        this._register(store);
        return vm;
      } catch (error) {
        store.dispose();
        throw error;
      }
    });
    this._resolvedSource = new ObservableLazyPromise(async () => {
      const source = this.initialResources ? { resources: ValueWithChangeEvent.const(this.initialResources) } : await this._multiDiffSourceResolverService.resolve(this.multiDiffSource);
      return {
        source,
        resources: source ? observableFromValueWithChangeEvent(this, source.resources) : constObservable([]),
        label: source?.label ? observableFromValueWithChangeEvent(this, source.label) : void 0
      };
    });
    this.resources = derived(this, (reader) => this._resolvedSource.cachedPromiseResult.read(reader)?.data?.resources.read(reader));
    this.textFileServiceOnDidChange = new FastEventDispatcher(
      this._textFileService.files.onDidChangeDirty,
      (item) => item.resource.toString(),
      (uri) => uri.toString()
    );
    this._isDirtyObservables = mapObservableArrayCached(this, this.resources.map((r) => r ?? []), (res) => {
      const isModifiedDirty = res.modifiedUri ? isUriDirty(this.textFileServiceOnDidChange, this._textFileService, res.modifiedUri) : constObservable(false);
      const isOriginalDirty = res.originalUri ? isUriDirty(this.textFileServiceOnDidChange, this._textFileService, res.originalUri) : constObservable(false);
      return derived((reader) => (
        /** @description modifiedDirty||originalDirty */
        isModifiedDirty.read(reader) || isOriginalDirty.read(reader)
      ));
    }, (i) => i.getKey());
    this._isDirtyObservable = derived(this, (reader) => this._isDirtyObservables.read(reader).some((isDirty) => isDirty.read(reader))).keepObserved(this._store);
    this.onDidChangeDirty = Event.fromObservableLight(this._isDirtyObservable);
    this.closeHandler = {
      // This is a workaround for not having a better way
      // to figure out if the editors this input wraps
      // around are opened or not
      async confirm() {
        return ConfirmResult.DONT_SAVE;
      },
      showConfirm() {
        return false;
      }
    };
    this._register(autorun((reader) => {
      const resources = this.resources.read(reader);
      const resolvedSource = this._resolvedSource.cachedPromiseResult.read(reader)?.data;
      const label2 = resolvedSource?.label?.read(reader) ?? this.label ?? localize("name", "Multi Diff Editor");
      if (resources && resources.length === 1) {
        this._name = localize({ key: "nameWithOneFile", comment: ["{0} is the name of the editor"] }, "{0} (1 file)", label2);
      } else if (resources) {
        this._name = localize({ key: "nameWithFiles", comment: ["{0} is the name of the editor", "{1} is the number of files being shown"] }, "{0} ({1} files)", label2, resources.length);
      } else {
        this._name = label2;
      }
      this._onDidChangeLabel.fire();
    }));
  }
  static fromResourceMultiDiffEditorInput(input, instantiationService) {
    if (!input.multiDiffSource && !input.resources) {
      throw new BugIndicatingError("MultiDiffEditorInput requires either multiDiffSource or resources");
    }
    const multiDiffSource = input.multiDiffSource ?? URI.parse(`multi-diff-editor:${(/* @__PURE__ */ new Date()).getMilliseconds().toString() + Math.random().toString()}`);
    return instantiationService.createInstance(
      MultiDiffEditorInput,
      multiDiffSource,
      input.label,
      input.resources?.map((resource) => {
        return new MultiDiffEditorItem(
          resource.original.resource,
          resource.modified.resource,
          resource.goToFileResource
        );
      }),
      input.isTransient ?? false
    );
  }
  static fromSerialized(data, instantiationService) {
    return instantiationService.createInstance(
      MultiDiffEditorInput,
      URI.parse(data.multiDiffSourceUri),
      data.label,
      data.resources?.map((resource) => new MultiDiffEditorItem(
        resource.originalUri ? URI.parse(resource.originalUri) : void 0,
        resource.modifiedUri ? URI.parse(resource.modifiedUri) : void 0,
        resource.goToFileUri ? URI.parse(resource.goToFileUri) : void 0
      )),
      false
    );
  }
  static {
    this.ID = "workbench.input.multiDiffEditor";
  }
  get resource() {
    return this.multiDiffSource;
  }
  get capabilities() {
    return EditorInputCapabilities.Readonly;
  }
  get typeId() {
    return MultiDiffEditorInput.ID;
  }
  getName() {
    return this._name;
  }
  get editorId() {
    return DEFAULT_EDITOR_ASSOCIATION.id;
  }
  getIcon() {
    return MultiDiffEditorIcon;
  }
  serialize() {
    return {
      label: this.label,
      multiDiffSourceUri: this.multiDiffSource.toString(),
      resources: this.initialResources?.map((resource) => ({
        originalUri: resource.originalUri?.toString(),
        modifiedUri: resource.modifiedUri?.toString(),
        goToFileUri: resource.goToFileUri?.toString()
      }))
    };
  }
  setLanguageId(languageId, source) {
    const activeDiffItem = this._viewModel.requireValue().activeDiffItem.get();
    const value = activeDiffItem?.documentDiffItem;
    if (!value) {
      return;
    }
    const target = value.modified ?? value.original;
    if (!target) {
      return;
    }
    target.setLanguage(languageId, source);
  }
  async getViewModel() {
    return this._viewModel.getPromise();
  }
  async _createModel() {
    const source = await this._resolvedSource.getPromise();
    const textResourceConfigurationService = this._textResourceConfigurationService;
    const documentsWithPromises = mapObservableArrayCached(this, source.resources, async (r, store) => {
      let original;
      let modified;
      const multiDiffItemStore = new DisposableStore();
      const createModelReference = async (resource) => resource ? this._textModelService.createModelReference(resource) : void 0;
      const [originalResult, modifiedResult] = await Promise.allSettled([
        createModelReference(r.originalUri),
        createModelReference(r.modifiedUri)
      ]);
      if (originalResult.status === "fulfilled") {
        original = originalResult.value;
        if (original) {
          multiDiffItemStore.add(original);
        }
      }
      if (modifiedResult.status === "fulfilled") {
        modified = modifiedResult.value;
        if (modified) {
          multiDiffItemStore.add(modified);
        }
      }
      if (store.isDisposed) {
        multiDiffItemStore.dispose();
        return void 0;
      }
      let errorResult;
      if (originalResult.status === "rejected") {
        errorResult = originalResult;
      } else if (modifiedResult.status === "rejected") {
        errorResult = modifiedResult;
      }
      if (errorResult) {
        multiDiffItemStore.dispose();
        console.error(errorResult.reason);
        onUnexpectedError(errorResult.reason);
        return void 0;
      }
      const uri = r.modifiedUri ?? r.originalUri;
      const result2 = {
        multiDiffEditorItem: r,
        original: original?.object.textEditorModel,
        modified: modified?.object.textEditorModel,
        contextKeys: r.contextKeys,
        get options() {
          return {
            ...getReadonlyConfiguration(modified?.object.isReadonly() ?? true),
            ...computeOptions(textResourceConfigurationService.getValue(uri))
          };
        },
        onOptionsDidChange: (h) => this._textResourceConfigurationService.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration(uri, "editor") || e.affectsConfiguration(uri, "diffEditor")) {
            h();
          }
        })
      };
      return store.add(RefCounted.createOfNonDisposable(result2, multiDiffItemStore, this));
    }, (i) => JSON.stringify([i.modifiedUri?.toString(), i.originalUri?.toString()]));
    const documents = observableValue("documents", "loading");
    const updateDocuments = derived(async (reader) => {
      const docsPromises = documentsWithPromises.read(reader);
      const docs = await Promise.all(docsPromises);
      const newDocuments = docs.filter(isDefined);
      documents.set(newDocuments, void 0);
    });
    const a = recomputeInitiallyAndOnChange(updateDocuments);
    await updateDocuments.get();
    const result = {
      dispose: () => a.dispose(),
      documents: new ValueWithChangeEventFromObservable(documents),
      contextKeys: source.source?.contextKeys
    };
    return result;
  }
  matches(otherInput) {
    if (super.matches(otherInput)) {
      return true;
    }
    if (otherInput instanceof MultiDiffEditorInput) {
      return this.multiDiffSource.toString() === otherInput.multiDiffSource.toString();
    }
    return false;
  }
  isDirty() {
    return this._isDirtyObservable.get();
  }
  async save(group, options) {
    await this.doSaveOrRevert("save", group, options);
    return this;
  }
  revert(group, options) {
    return this.doSaveOrRevert("revert", group, options);
  }
  async doSaveOrRevert(mode, group, options) {
    const items = this._viewModel.currentValue?.items.get();
    if (items) {
      await Promise.all(items.map(async (item) => {
        const model = item.diffEditorViewModel.model;
        const handleOriginal = model.original.uri.scheme !== Schemas.untitled && this._textFileService.isDirty(model.original.uri);
        await Promise.all([
          handleOriginal ? mode === "save" ? this._textFileService.save(model.original.uri, options) : this._textFileService.revert(model.original.uri, options) : Promise.resolve(),
          mode === "save" ? this._textFileService.save(model.modified.uri, options) : this._textFileService.revert(model.modified.uri, options)
        ]);
      }));
    }
    return void 0;
  }
};
MultiDiffEditorInput = __decorateClass([
  __decorateParam(4, ITextModelService),
  __decorateParam(5, ITextResourceConfigurationService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IMultiDiffSourceResolverService),
  __decorateParam(8, ITextFileService)
], MultiDiffEditorInput);
class FastEventDispatcher {
  constructor(_event, _getEventArgsKey, _keyToString) {
    this._event = _event;
    this._getEventArgsKey = _getEventArgsKey;
    this._keyToString = _keyToString;
    this._count = 0;
    this._buckets = /* @__PURE__ */ new Map();
    this._handleEventChange = (e) => {
      const key = this._getEventArgsKey(e);
      const bucket = this._buckets.get(key);
      if (bucket) {
        for (const listener of bucket) {
          listener(e);
        }
      }
    };
  }
  filteredEvent(filter) {
    return (listener) => {
      const key = this._keyToString(filter);
      let bucket = this._buckets.get(key);
      if (!bucket) {
        bucket = /* @__PURE__ */ new Set();
        this._buckets.set(key, bucket);
      }
      bucket.add(listener);
      this._count++;
      if (this._count === 1) {
        this._eventSubscription = this._event(this._handleEventChange);
      }
      return {
        dispose: () => {
          bucket.delete(listener);
          if (bucket.size === 0) {
            this._buckets.delete(key);
          }
          this._count--;
          if (this._count === 0) {
            this._eventSubscription?.dispose();
            this._eventSubscription = void 0;
          }
        }
      };
    };
  }
}
function isUriDirty(onDidChangeDirty, textFileService, uri) {
  return observableFromEvent(onDidChangeDirty.filteredEvent(uri), () => textFileService.isDirty(uri));
}
function getReadonlyConfiguration(isReadonly) {
  return {
    readOnly: !!isReadonly,
    readOnlyMessage: typeof isReadonly !== "boolean" ? isReadonly : void 0
  };
}
function computeOptions(configuration) {
  const editorConfiguration = deepClone(configuration.editor);
  if (isObject(configuration.diffEditor)) {
    const diffEditorConfiguration = deepClone(configuration.diffEditor);
    diffEditorConfiguration.diffCodeLens = diffEditorConfiguration.codeLens;
    delete diffEditorConfiguration.codeLens;
    diffEditorConfiguration.diffWordWrap = diffEditorConfiguration.wordWrap;
    delete diffEditorConfiguration.wordWrap;
    Object.assign(editorConfiguration, diffEditorConfiguration);
  }
  return editorConfiguration;
}
let MultiDiffEditorResolverContribution = class extends Disposable {
  static {
    this.ID = "workbench.contrib.multiDiffEditorResolver";
  }
  constructor(editorResolverService, instantiationService) {
    super();
    this._register(editorResolverService.registerEditor(
      `*`,
      {
        id: DEFAULT_EDITOR_ASSOCIATION.id,
        label: DEFAULT_EDITOR_ASSOCIATION.displayName,
        detail: DEFAULT_EDITOR_ASSOCIATION.providerDisplayName,
        priority: RegisteredEditorPriority.builtin
      },
      {},
      {
        createMultiDiffEditorInput: (multiDiffEditor) => {
          return {
            editor: MultiDiffEditorInput.fromResourceMultiDiffEditorInput(multiDiffEditor, instantiationService)
          };
        }
      }
    ));
  }
};
MultiDiffEditorResolverContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService)
], MultiDiffEditorResolverContribution);
class MultiDiffEditorSerializer {
  canSerialize(editor) {
    return editor instanceof MultiDiffEditorInput && !editor.isTransient;
  }
  serialize(editor) {
    if (!this.canSerialize(editor)) {
      return void 0;
    }
    return JSON.stringify(editor.serialize());
  }
  deserialize(instantiationService, serializedEditor) {
    try {
      const data = parse(serializedEditor);
      return MultiDiffEditorInput.fromSerialized(data, instantiationService);
    } catch (err) {
      onUnexpectedError(err);
      return void 0;
    }
  }
}
export {
  MultiDiffEditorInput,
  MultiDiffEditorResolverContribution,
  MultiDiffEditorSerializer
};
