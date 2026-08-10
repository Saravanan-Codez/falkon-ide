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
import "./media/agentEditorCommentsOverlayWidget.css";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
class SubmitCommentsActionRunner extends ActionRunner {
  constructor(_submitActionId, _editorGroup) {
    super();
    this._submitActionId = _submitActionId;
    this._editorGroup = _editorGroup;
  }
  async runAction(action, context) {
    const editorToClose = action.id === this._submitActionId ? this._editorGroup.activeEditor : void 0;
    const didSubmit = await action.run(context);
    if (didSubmit === true && editorToClose) {
      await this._editorGroup.closeEditor(editorToClose);
    }
  }
}
class CommentsActionViewItem extends ActionViewItem {
  constructor(action, options, _overlayOptions, _keybindingService, _commentCount, editorGroup) {
    const isIconOnly = action.id === _overlayOptions.previousActionId || action.id === _overlayOptions.nextActionId;
    super(void 0, action, { ...options, icon: isIconOnly, label: !isIconOnly, keybindingNotRenderedWithLabel: true });
    this._overlayOptions = _overlayOptions;
    this._keybindingService = _keybindingService;
    this._commentCount = _commentCount;
    if (action.id === _overlayOptions.submitActionId && editorGroup) {
      this.actionRunner = this._register(new SubmitCommentsActionRunner(_overlayOptions.submitActionId, editorGroup));
    }
  }
  render(container) {
    super.render(container);
    if (this._action.id === this._overlayOptions.submitActionId) {
      this.element?.classList.add("primary");
      this._store.add(autorun((reader) => {
        this._commentCount.read(reader);
        this.updateLabel();
        this.updateTooltip();
      }));
    }
  }
  updateLabel() {
    if (this._action.id === this._overlayOptions.submitActionId && this.label) {
      this.label.textContent = localize("agentEditorComments.submitCountShort", "Submit {0}", this._commentCount.get());
      return;
    }
    super.updateLabel();
  }
  getTooltip() {
    const value = this._action.id === this._overlayOptions.submitActionId ? localize("agentEditorComments.submitCount", "Submit Feedback ({0})", this._commentCount.get()) : super.getTooltip();
    return value && !this.options.keybinding ? this._keybindingService.appendKeybinding(value, this._action.id) : value;
  }
}
let AgentEditorCommentsOverlayWidget = class extends Disposable {
  constructor(_options, _instantiationService, _keybindingService) {
    super();
    this._options = _options;
    this._instantiationService = _instantiationService;
    this._keybindingService = _keybindingService;
    this._showStore = this._register(new DisposableStore());
    this._navigationBearings = observableValue(this, { activeIdx: -1, totalCount: 0 });
    this._commentCount = observableValue(this, 0);
    this._domNode = document.createElement("div");
    this._domNode.classList.add("agent-editor-comments-overlay-widget");
    this._toolbarNode = document.createElement("div");
    this._toolbarNode.classList.add("agent-editor-comments-overlay-toolbar");
  }
  getDomNode() {
    return this._domNode;
  }
  show(navigationBearings, commentCount, editorGroup) {
    this._showStore.clear();
    this._navigationBearings.set(navigationBearings, void 0);
    this._commentCount.set(commentCount, void 0);
    if (!this._domNode.contains(this._toolbarNode)) {
      this._domNode.appendChild(this._toolbarNode);
    }
    const toolbar = this._showStore.add(this._instantiationService.createInstance(MenuWorkbenchToolBar, this._toolbarNode, this._options.menuId, {
      telemetrySource: this._options.telemetrySource,
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: () => true,
        useSeparatorsInPrimaryActions: true
      },
      menuOptions: { renderShortTitle: true },
      actionViewItemProvider: (action, options) => {
        if (action.id === this._options.navigationBearingActionId) {
          const that = this;
          return new class extends ActionViewItem {
            constructor() {
              super(void 0, action, { ...options, icon: false, label: true, keybindingNotRenderedWithLabel: true });
            }
            render(container) {
              super.render(container);
              container.classList.add("label-item");
              this._store.add(autorun((reader) => {
                if (this.label) {
                  const { activeIdx, totalCount } = that._navigationBearings.read(reader);
                  this.label.innerText = totalCount > 0 ? localize("agentEditorComments.nOfM", "{0}/{1}", activeIdx === -1 ? 1 : activeIdx + 1, totalCount) : localize("agentEditorComments.zero", "0/0");
                }
              }));
            }
          }();
        }
        return new CommentsActionViewItem(action, options, this._options, this._keybindingService, this._commentCount, editorGroup);
      }
    }));
    if (editorGroup) {
      const activeEditor = editorGroup.activeEditor;
      toolbar.context = {
        groupId: editorGroup.id,
        editorIndex: activeEditor ? editorGroup.getIndexOfEditor(activeEditor) : void 0
      };
    }
    this._showStore.add(toDisposable(() => this._toolbarNode.remove()));
  }
  hide() {
    this._showStore.clear();
    this._navigationBearings.set({ activeIdx: -1, totalCount: 0 }, void 0);
    this._commentCount.set(0, void 0);
    this._toolbarNode.remove();
  }
};
AgentEditorCommentsOverlayWidget = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IKeybindingService)
], AgentEditorCommentsOverlayWidget);
export {
  AgentEditorCommentsOverlayWidget
};
