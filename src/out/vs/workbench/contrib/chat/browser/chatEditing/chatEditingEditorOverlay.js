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
import "./media/chatEditingEditorOverlay.css";
import { combinedDisposable, Disposable, DisposableMap, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, derivedOpts, observableFromEvent, observableSignalFromEvent, observableValue, transaction } from "../../../../../base/common/observable.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../../platform/actions/browser/toolbar.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IChatEditingService, ModifiedFileEntryState } from "../../common/editing/chatEditingService.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { ActionViewItem } from "../../../../../base/browser/ui/actionbar/actionViewItems.js";
import { $, addDisposableGenericMouseMoveListener, append } from "../../../../../base/browser/dom.js";
import { assertType } from "../../../../../base/common/types.js";
import { localize } from "../../../../../nls.js";
import { AcceptAction, navigationBearingFakeActionId, RejectAction } from "./chatEditingEditorActions.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { EditorGroupView } from "../../../../browser/parts/editor/editorGroupView.js";
import { Event } from "../../../../../base/common/event.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { renderIcon } from "../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IWorkbenchEnvironmentService } from "../../../../services/environment/common/environmentService.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
class ChatEditingAcceptRejectActionViewItem extends ActionViewItem {
  constructor(action, options, _entry, _editor, _keybindingService, _primaryActionIds = [AcceptAction.ID]) {
    super(void 0, action, { ...options, icon: false, label: true, keybindingNotRenderedWithLabel: true });
    this._entry = _entry;
    this._editor = _editor;
    this._keybindingService = _keybindingService;
    this._primaryActionIds = _primaryActionIds;
    this._reveal = this._store.add(new MutableDisposable());
  }
  render(container) {
    super.render(container);
    if (this._primaryActionIds.includes(this._action.id)) {
      this.element?.classList.add("primary");
    }
    if (this._action.id === AcceptAction.ID) {
      const listener = this._store.add(new MutableDisposable());
      this._store.add(autorun((r) => {
        assertType(this.label);
        assertType(this.element);
        const ctrl = this._entry.read(r)?.autoAcceptController.read(r);
        if (ctrl) {
          const ratio = -100 * (ctrl.remaining / ctrl.total);
          this.element.style.setProperty("--vscode-action-item-auto-timeout", `${ratio}%`);
          this.element.classList.toggle("auto", true);
          listener.value = addDisposableGenericMouseMoveListener(this.element, () => ctrl.cancel());
        } else {
          this.element.classList.toggle("auto", false);
          listener.clear();
        }
      }));
    }
  }
  set actionRunner(actionRunner) {
    super.actionRunner = actionRunner;
    if (this._editor) {
      this._reveal.value = actionRunner.onWillRun((_e) => {
        this._editor.focus();
      });
    }
  }
  get actionRunner() {
    return super.actionRunner;
  }
  getTooltip() {
    const value = super.getTooltip();
    if (!value) {
      return value;
    }
    return this._keybindingService.appendKeybinding(value, this._action.id);
  }
}
let ChatEditorOverlayWidget = class extends Disposable {
  constructor(_editor, _keybindingService, _instaService) {
    super();
    this._editor = _editor;
    this._keybindingService = _keybindingService;
    this._instaService = _instaService;
    this._showStore = this._store.add(new DisposableStore());
    this._session = observableValue(this, void 0);
    this._entry = observableValue(this, void 0);
    this._navigationBearings = observableValue(this, { changeCount: -1, activeIdx: -1, entriesCount: -1 });
    this._domNode = document.createElement("div");
    this._domNode.classList.add("chat-editor-overlay-widget");
    this._isBusy = derived((r) => {
      const entry = this._entry.read(r);
      return entry?.waitsForLastEdits.read(r);
    });
    const progressNode = document.createElement("div");
    progressNode.classList.add("chat-editor-overlay-progress");
    append(progressNode, renderIcon(ThemeIcon.modify(Codicon.loading, "spin")));
    const textProgress = append(progressNode, $("span.progress-message"));
    this._domNode.appendChild(progressNode);
    this._store.add(autorun((r) => {
      const busy = this._isBusy.read(r);
      this._domNode.classList.toggle("busy", busy);
      textProgress.innerText = "";
    }));
    this._toolbarNode = document.createElement("div");
    this._toolbarNode.classList.add("chat-editor-overlay-toolbar");
  }
  dispose() {
    this.hide();
    super.dispose();
  }
  getDomNode() {
    return this._domNode;
  }
  show(session, entry, indicies) {
    this._showStore.clear();
    transaction((tx) => {
      this._session.set(session, tx);
      this._entry.set(entry, tx);
    });
    this._showStore.add(autorun((r) => {
      const entryIndex = indicies.entryIndex.read(r);
      const changeIndex = indicies.changeIndex.read(r);
      const entries = session.entries.read(r);
      let activeIdx = entryIndex !== void 0 && changeIndex !== void 0 ? changeIndex : -1;
      let totalChangesCount = 0;
      for (let i = 0; i < entries.length; i++) {
        const changesCount = entries[i].changesCount.read(r);
        totalChangesCount += changesCount;
        if (entryIndex !== void 0 && i < entryIndex) {
          activeIdx += changesCount;
        }
      }
      this._navigationBearings.set({ changeCount: totalChangesCount, activeIdx, entriesCount: entries.length }, void 0);
    }));
    this._domNode.appendChild(this._toolbarNode);
    this._showStore.add(toDisposable(() => this._toolbarNode.remove()));
    this._showStore.add(this._instaService.createInstance(MenuWorkbenchToolBar, this._toolbarNode, MenuId.ChatEditingEditorContent, {
      telemetrySource: "chatEditor.overlayToolbar",
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: () => true,
        useSeparatorsInPrimaryActions: true
      },
      menuOptions: { renderShortTitle: true },
      actionViewItemProvider: (action, options) => {
        const that = this;
        if (action.id === navigationBearingFakeActionId) {
          return new class extends ActionViewItem {
            constructor() {
              super(void 0, action, { ...options, icon: false, label: true, keybindingNotRenderedWithLabel: true });
            }
            render(container) {
              super.render(container);
              container.classList.add("label-item");
              this._store.add(autorun((r) => {
                assertType(this.label);
                const { changeCount, activeIdx } = that._navigationBearings.read(r);
                if (changeCount > 0) {
                  const n = activeIdx === -1 ? "1" : `${activeIdx + 1}`;
                  this.label.innerText = localize("nOfM", "{0} of {1}", n, changeCount);
                } else {
                  this.label.innerText = localize("0Of0", "\u2014");
                }
                this.updateTooltip();
              }));
            }
            getTooltip() {
              const { changeCount, entriesCount } = that._navigationBearings.get();
              if (changeCount === -1 || entriesCount === -1) {
                return void 0;
              }
              let result;
              if (changeCount === 1 && entriesCount === 1) {
                result = localize("tooltip_11", "1 change in 1 file");
              } else if (changeCount === 1) {
                result = localize("tooltip_1n", "1 change in {0} files", entriesCount);
              } else if (entriesCount === 1) {
                result = localize("tooltip_n1", "{0} changes in 1 file", changeCount);
              } else {
                result = localize("tooltip_nm", "{0} changes in {1} files", changeCount, entriesCount);
              }
              if (!that._isBusy.get()) {
                return result;
              }
              return localize("tooltip_busy", "{0} - Working...", result);
            }
          }();
        }
        if (action.id === AcceptAction.ID || action.id === RejectAction.ID) {
          return new ChatEditingAcceptRejectActionViewItem(action, options, that._entry, that._editor, that._keybindingService);
        }
        return void 0;
      }
    }));
  }
  hide() {
    transaction((tx) => {
      this._session.set(void 0, tx);
      this._entry.set(void 0, tx);
      this._navigationBearings.set({ changeCount: -1, activeIdx: -1, entriesCount: -1 }, tx);
    });
    this._showStore.clear();
  }
};
ChatEditorOverlayWidget = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IInstantiationService)
], ChatEditorOverlayWidget);
let ChatEditingOverlayController = class {
  constructor(container, group, instaService, chatEditingService) {
    this._store = new DisposableStore();
    this._domNode = document.createElement("div");
    this._domNode.classList.add("chat-editing-editor-overlay");
    this._domNode.style.position = "absolute";
    this._domNode.style.bottom = `24px`;
    this._domNode.style.right = `24px`;
    this._domNode.style.zIndex = `100`;
    const widget = instaService.createInstance(ChatEditorOverlayWidget, group);
    this._domNode.appendChild(widget.getDomNode());
    this._store.add(toDisposable(() => this._domNode.remove()));
    this._store.add(widget);
    const show = () => {
      if (!container.contains(this._domNode)) {
        container.appendChild(this._domNode);
      }
    };
    const hide = () => {
      if (container.contains(this._domNode)) {
        widget.hide();
        this._domNode.remove();
      }
    };
    const activeEditorSignal = observableSignalFromEvent(this, Event.any(group.onDidActiveEditorChange, group.onDidModelChange));
    const activeUriObs = derivedOpts({ equalsFn: isEqual }, (r) => {
      activeEditorSignal.read(r);
      const editor = group.activeEditorPane;
      if (!getCodeEditor(editor?.getControl())) {
        return void 0;
      }
      const uri = EditorResourceAccessor.getOriginalUri(editor?.input, { supportSideBySide: SideBySideEditor.PRIMARY });
      return uri;
    });
    const sessionAndEntry = derived((r) => {
      activeEditorSignal.read(r);
      const uri = activeUriObs.read(r);
      if (!uri) {
        return void 0;
      }
      for (const session of chatEditingService.editingSessionsObs.read(r)) {
        if (!session.isGlobalEditingSession) {
          continue;
        }
        const entry = session.readEntry(uri, r);
        if (entry) {
          return { session, entry };
        }
      }
      return void 0;
    });
    this._store.add(autorun((r) => {
      const data = sessionAndEntry.read(r);
      if (!data) {
        hide();
        return;
      }
      const { session, entry } = data;
      if (entry?.state.read(r) === ModifiedFileEntryState.Modified) {
        const editorPane = group.activeEditorPane;
        assertType(editorPane);
        const changeIndex = derived((r2) => entry ? entry.getEditorIntegration(editorPane).currentIndex.read(r2) : 0);
        const entryIndex = derived(
          (r2) => entry ? session.entries.read(r2).indexOf(entry) : 0
        );
        widget.show(session, entry, { entryIndex, changeIndex });
        show();
      } else {
        hide();
      }
    }));
  }
  dispose() {
    this._store.dispose();
  }
};
ChatEditingOverlayController = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IChatEditingService)
], ChatEditingOverlayController);
let ChatEditingEditorOverlay = class {
  constructor(editorGroupsService, instantiationService, environmentService) {
    this._store = new DisposableStore();
    const editorGroups = observableFromEvent(
      this,
      Event.any(editorGroupsService.onDidAddGroup, editorGroupsService.onDidRemoveGroup),
      () => editorGroupsService.groups
    );
    const overlayWidgets = this._store.add(new DisposableMap());
    this._store.add(autorun((r) => {
      if (environmentService.isSessionsWindow) {
        return;
      }
      const toDelete = new Set(overlayWidgets.keys());
      const groups = editorGroups.read(r);
      for (const group of groups) {
        if (!(group instanceof EditorGroupView)) {
          continue;
        }
        toDelete.delete(group);
        if (!overlayWidgets.has(group)) {
          const scopedInstaService = instantiationService.createChild(
            new ServiceCollection([IContextKeyService, group.scopedContextKeyService])
          );
          const container = group.element;
          const ctrl = scopedInstaService.createInstance(ChatEditingOverlayController, container, group);
          overlayWidgets.set(group, combinedDisposable(ctrl, scopedInstaService));
        }
      }
      for (const group of toDelete) {
        overlayWidgets.deleteAndDispose(group);
      }
    }));
  }
  static {
    this.ID = "chat.edits.editorOverlay";
  }
  dispose() {
    this._store.dispose();
  }
};
ChatEditingEditorOverlay = __decorateClass([
  __decorateParam(0, IEditorGroupsService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkbenchEnvironmentService)
], ChatEditingEditorOverlay);
export {
  ChatEditingAcceptRejectActionViewItem,
  ChatEditingEditorOverlay
};
