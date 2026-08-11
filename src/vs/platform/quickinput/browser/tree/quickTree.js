import { Emitter, Event } from "../../../../base/common/event.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { setTimeout0 } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { QuickInputType } from "../../common/quickInput.js";
import { QuickInput } from "../quickInput.js";
import { getParentNodeState } from "./quickInputTree.js";
class QuickTree extends QuickInput {
  constructor(ui) {
    super(ui);
    this.type = QuickInputType.QuickTree;
    this._value = observableValue("value", "");
    this._ariaLabel = observableValue("ariaLabel", void 0);
    this._placeholder = observableValue("placeholder", void 0);
    this._matchOnDescription = observableValue("matchOnDescription", false);
    this._matchOnLabel = observableValue("matchOnLabel", true);
    this._sortByLabel = observableValue("sortByLabel", true);
    this._activeItems = observableValue("activeItems", []);
    this._itemTree = observableValue("itemTree", []);
    this.onDidChangeValue = Event.fromObservable(this._value, this._store);
    this.onDidChangeActive = Event.fromObservable(this._activeItems, this._store);
    this._onDidChangeCheckedLeafItems = this._register(new Emitter());
    this.onDidChangeCheckedLeafItems = this._onDidChangeCheckedLeafItems.event;
    this._onDidChangeCheckboxState = this._register(new Emitter());
    this.onDidChangeCheckboxState = this._onDidChangeCheckboxState.event;
    this._onDidAcceptEmitter = this._register(new Emitter());
    this.onDidAccept = Event.any(ui.onDidAccept, this._onDidAcceptEmitter.event);
    this._registerAutoruns();
    this._register(ui.tree.onDidChangeCheckedLeafItems((e) => this._onDidChangeCheckedLeafItems.fire(e)));
    this._register(ui.tree.onDidChangeCheckboxState((e) => this._onDidChangeCheckboxState.fire(e.item)));
    this._register(ui.tree.tree.onDidChangeFocus((e) => {
      this._activeItems.set(ui.tree.getActiveItems(), void 0);
    }));
  }
  static {
    this.DEFAULT_ARIA_LABEL = localize("quickInputBox.ariaLabel", "Type to narrow down results.");
  }
  get value() {
    return this._value.get();
  }
  set value(value) {
    this._value.set(value, void 0);
  }
  get ariaLabel() {
    return this._ariaLabel.get();
  }
  set ariaLabel(ariaLabel) {
    this._ariaLabel.set(ariaLabel, void 0);
  }
  get placeholder() {
    return this._placeholder.get();
  }
  set placeholder(placeholder) {
    this._placeholder.set(placeholder, void 0);
  }
  get matchOnDescription() {
    return this._matchOnDescription.get();
  }
  set matchOnDescription(matchOnDescription) {
    this._matchOnDescription.set(matchOnDescription, void 0);
  }
  get matchOnLabel() {
    return this._matchOnLabel.get();
  }
  set matchOnLabel(matchOnLabel) {
    this._matchOnLabel.set(matchOnLabel, void 0);
  }
  get sortByLabel() {
    return this._sortByLabel.get();
  }
  set sortByLabel(sortByLabel) {
    this._sortByLabel.set(sortByLabel, void 0);
  }
  get activeItems() {
    return this._activeItems.get();
  }
  set activeItems(activeItems) {
    this._activeItems.set(activeItems, void 0);
  }
  get itemTree() {
    return this._itemTree.get();
  }
  get onDidTriggerItemButton() {
    return this.ui.tree.onDidTriggerButton;
  }
  // TODO: Fix the any casting
  // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
  get checkedLeafItems() {
    return this.ui.tree.getCheckedLeafItems();
  }
  setItemTree(itemTree) {
    this._itemTree.set(itemTree, void 0);
  }
  getParent(element) {
    return this.ui.tree.tree.getParentElement(element) ?? void 0;
  }
  expand(element) {
    this.ui.tree.tree.expand(element);
  }
  collapse(element) {
    this.ui.tree.tree.collapse(element);
  }
  isCollapsed(element) {
    return this.ui.tree.tree.isCollapsed(element);
  }
  focusOnInput() {
    this.ui.inputBox.setFocus();
  }
  reveal(element) {
    this.ui.tree.tree.reveal(element);
    this.ui.tree.tree.setFocus([element]);
  }
  show() {
    if (!this.visible) {
      const visibilities = {
        title: !!this.title || !!this.step || !!this.titleButtons.length,
        description: !!this.description,
        checkAll: true,
        checkBox: true,
        inputBox: true,
        progressBar: true,
        visibleCount: true,
        count: true,
        ok: true,
        list: false,
        tree: true,
        message: !!this.validationMessage,
        customButton: false
      };
      this.ui.setVisibilities(visibilities);
      this.visibleDisposables.add(this.ui.inputBox.onDidChange((value) => {
        this._value.set(value, void 0);
      }));
      this.visibleDisposables.add(this.ui.tree.onDidChangeCheckboxState((e) => {
        const checkAllState2 = getParentNodeState([...this.ui.tree.tree.getNode().children]);
        if (this.ui.checkAll.checked !== checkAllState2) {
          this.ui.checkAll.checked = checkAllState2;
        }
      }));
      this.visibleDisposables.add(this.ui.checkAll.onChange((_e) => {
        const checked = this.ui.checkAll.checked;
        this.ui.tree.checkAll(checked);
      }));
      this.visibleDisposables.add(this.ui.tree.onDidChangeCheckedLeafItems((e) => {
        this.ui.count.setCount(e.length);
      }));
    }
    super.show();
    setTimeout0(() => this.ui.count.setCount(this.ui.tree.getCheckedLeafItems().length));
    const checkAllState = getParentNodeState([...this.ui.tree.tree.getNode().children]);
    if (this.ui.checkAll.checked !== checkAllState) {
      this.ui.checkAll.checked = checkAllState;
    }
  }
  update() {
    if (!this.visible) {
      return;
    }
    const visibilities = {
      title: !!this.title || !!this.step || !!this.titleButtons.length,
      description: !!this.description,
      checkAll: true,
      checkBox: true,
      inputBox: true,
      progressBar: true,
      visibleCount: true,
      count: true,
      ok: true,
      tree: true,
      message: !!this.validationMessage
    };
    this.ui.setVisibilities(visibilities);
    super.update();
  }
  _registerListeners() {
  }
  // TODO: Move to using autoruns instead of update function
  _registerAutoruns() {
    this.registerVisibleAutorun((reader) => {
      const value = this._value.read(reader);
      this.ui.inputBox.value = value;
      this.ui.tree.filter(value);
    });
    this.registerVisibleAutorun((reader) => {
      let ariaLabel = this._ariaLabel.read(reader);
      if (!ariaLabel) {
        ariaLabel = this.placeholder || QuickTree.DEFAULT_ARIA_LABEL;
        if (this.title) {
          ariaLabel += ` - ${this.title}`;
        }
      }
      if (this.ui.list.ariaLabel !== ariaLabel) {
        this.ui.list.ariaLabel = ariaLabel ?? null;
      }
      if (this.ui.inputBox.ariaLabel !== ariaLabel) {
        this.ui.inputBox.ariaLabel = ariaLabel ?? "input";
      }
    });
    this.registerVisibleAutorun((reader) => {
      const placeholder = this._placeholder.read(reader);
      if (this.ui.inputBox.placeholder !== placeholder) {
        this.ui.inputBox.placeholder = placeholder ?? "";
      }
    });
    this.registerVisibleAutorun((reader) => {
      const matchOnLabel = this._matchOnLabel.read(reader);
      const matchOnDescription = this._matchOnDescription.read(reader);
      this.ui.tree.updateFilterOptions({ matchOnLabel, matchOnDescription });
    });
    this.registerVisibleAutorun((reader) => {
      const sortByLabel = this._sortByLabel.read(reader);
      this.ui.tree.sortByLabel = sortByLabel;
    });
    this.registerVisibleAutorun((reader) => {
      const itemTree = this._itemTree.read(reader);
      this.ui.tree.setTreeData(itemTree);
    });
  }
  registerVisibleAutorun(fn) {
    this._register(autorun((reader) => {
      if (this._visible.read(reader)) {
        fn(reader);
      }
    }));
  }
  focus(focus) {
    this.ui.tree.focus(focus);
    this.ui.tree.tree.domFocus();
  }
  /**
   * Programmatically accepts an item. Used internally for keyboard navigation.
   * @param inBackground Whether you are accepting an item in the background and keeping the picker open.
   */
  accept(_inBackground) {
    this._onDidAcceptEmitter.fire();
  }
}
export {
  QuickTree
};
