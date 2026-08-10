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
import { Emitter } from "../../../../../base/common/event.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { TestItemTreeElement, TestTreeErrorMessage, getChildrenForParent, testIdentityProvider } from "./index.js";
import { isCollapsedInSerializedTestTree } from "./testingViewState.js";
import { refreshComputedState } from "../../common/getComputedState.js";
import { TestId } from "../../common/testId.js";
import { TestResultItemChangeReason } from "../../common/testResult.js";
import { ITestResultService } from "../../common/testResultService.js";
import { ITestService } from "../../common/testService.js";
import { TestDiffOpType, TestItemExpandState, TestResultState, applyTestItemUpdate } from "../../common/testTypes.js";
const computedStateAccessor = {
  getOwnState: (i) => i instanceof TestItemTreeElement ? i.ownState : TestResultState.Unset,
  getCurrentComputedState: (i) => i.state,
  setComputedState: (i, s) => i.state = s,
  getCurrentComputedDuration: (i) => i.duration,
  getOwnDuration: (i) => i instanceof TestItemTreeElement ? i.ownDuration : void 0,
  setComputedDuration: (i, d) => i.duration = d,
  getChildren: (i) => Iterable.filter(
    i.children.values(),
    (t) => t instanceof TreeTestItemElement
  ),
  *getParents(i) {
    for (let parent = i.parent; parent; parent = parent.parent) {
      yield parent;
    }
  }
};
class TreeTestItemElement extends TestItemTreeElement {
  constructor(test, parent, addedOrRemoved) {
    super({ ...test, item: { ...test.item } }, parent);
    this.addedOrRemoved = addedOrRemoved;
    /**
     * Own, non-computed state.
     * @internal
     */
    this.ownState = TestResultState.Unset;
    this.updateErrorVisibility();
  }
  get description() {
    return this.test.item.description;
  }
  update(patch) {
    applyTestItemUpdate(this.test, patch);
    this.updateErrorVisibility(patch);
    this.fireChange();
  }
  fireChange() {
    this.changeEmitter.fire();
  }
  updateErrorVisibility(patch) {
    if (this.errorChild && (!this.test.item.error || patch?.item?.error)) {
      this.addedOrRemoved(this);
      this.children.delete(this.errorChild);
      this.errorChild = void 0;
    }
    if (this.test.item.error && !this.errorChild) {
      this.errorChild = new TestTreeErrorMessage(this.test.item.error, this);
      this.children.add(this.errorChild);
      this.addedOrRemoved(this);
    }
  }
}
let TreeProjection = class extends Disposable {
  constructor(lastState, testService, results) {
    super();
    this.lastState = lastState;
    this.testService = testService;
    this.results = results;
    this.updateEmitter = this._register(new Emitter());
    this.changedParents = /* @__PURE__ */ new Set();
    this.resortedParents = /* @__PURE__ */ new Set();
    this.items = /* @__PURE__ */ new Map();
    /**
     * @inheritdoc
     */
    this.onUpdate = this.updateEmitter.event;
    this._register(testService.onDidProcessDiff((diff) => this.applyDiff(diff)));
    this._register(results.onResultsChanged((evt) => {
      if (!("removed" in evt)) {
        return;
      }
      for (const inTree of [...this.items.values()].sort((a, b) => b.depth - a.depth)) {
        const lookup = this.results.getStateById(inTree.test.item.extId)?.[1];
        inTree.ownDuration = lookup?.ownDuration;
        refreshComputedState(computedStateAccessor, inTree, lookup?.ownComputedState ?? TestResultState.Unset).forEach((i) => i.fireChange());
      }
    }));
    this._register(results.onTestChanged((ev) => {
      if (ev.reason === TestResultItemChangeReason.NewMessage) {
        return;
      }
      let result = ev.item;
      if (result.ownComputedState === TestResultState.Unset || ev.result !== results.results[0]) {
        const fallback = results.getStateById(result.item.extId);
        if (fallback) {
          result = fallback[1];
        }
      }
      const item = this.items.get(result.item.extId);
      if (!item) {
        return;
      }
      const refreshDuration = ev.reason === TestResultItemChangeReason.OwnStateChange && ev.previousOwnDuration !== result.ownDuration;
      const explicitComputed = item.children.size ? void 0 : result.computedState;
      item.retired = !!result.retired;
      item.ownState = result.ownComputedState;
      item.ownDuration = result.ownDuration;
      item.fireChange();
      refreshComputedState(computedStateAccessor, item, explicitComputed, refreshDuration).forEach((i) => i.fireChange());
    }));
    for (const test of testService.collection.all) {
      this.storeItem(this.createItem(test));
    }
  }
  /**
   * Gets root elements of the tree.
   */
  get rootsWithChildren() {
    const rootsIt = Iterable.map(this.testService.collection.rootItems, (r) => this.items.get(r.item.extId));
    return Iterable.filter(rootsIt, (r) => !!r?.children.size);
  }
  /**
   * @inheritdoc
   */
  getElementByTestId(testId) {
    return this.items.get(testId);
  }
  /**
   * @inheritdoc
   */
  applyDiff(diff) {
    for (const op of diff) {
      switch (op.op) {
        case TestDiffOpType.Add: {
          const item = this.createItem(op.item);
          this.storeItem(item);
          break;
        }
        case TestDiffOpType.Update: {
          const patch = op.item;
          const existing = this.items.get(patch.extId);
          if (!existing) {
            break;
          }
          const needsParentUpdate = existing.test.expand === TestItemExpandState.NotExpandable && patch.expand;
          existing.update(patch);
          if (needsParentUpdate) {
            this.changedParents.add(existing.parent);
          } else {
            this.resortedParents.add(existing.parent);
          }
          break;
        }
        case TestDiffOpType.Remove: {
          const toRemove = this.items.get(op.itemId);
          if (!toRemove) {
            break;
          }
          const parent = toRemove.parent;
          const affectsRootElement = toRemove.depth === 1 && (parent?.children.size === 1 || !Iterable.some(this.rootsWithChildren, (_, i) => i === 1));
          this.changedParents.add(affectsRootElement ? null : parent);
          const queue = [[toRemove]];
          while (queue.length) {
            for (const item of queue.pop()) {
              if (item instanceof TreeTestItemElement) {
                queue.push(this.unstoreItem(item));
              }
            }
          }
          if (parent instanceof TreeTestItemElement) {
            refreshComputedState(computedStateAccessor, parent, void 0, !!parent.duration).forEach((i) => i.fireChange());
          }
        }
      }
    }
    if (diff.length !== 0) {
      this.updateEmitter.fire();
    }
  }
  /**
   * @inheritdoc
   */
  applyTo(tree) {
    for (const parent of this.changedParents) {
      if (!parent || tree.hasElement(parent)) {
        tree.setChildren(parent, getChildrenForParent(this.lastState, this.rootsWithChildren, parent), { diffIdentityProvider: testIdentityProvider });
      }
    }
    for (const parent of this.resortedParents) {
      if (!parent || tree.hasElement(parent)) {
        tree.resort(parent, false);
      }
    }
    this.changedParents.clear();
    this.resortedParents.clear();
  }
  /**
   * @inheritdoc
   */
  expandElement(element, depth) {
    if (!(element instanceof TreeTestItemElement)) {
      return;
    }
    if (element.test.expand === TestItemExpandState.NotExpandable) {
      return;
    }
    this.testService.collection.expand(element.test.item.extId, depth);
  }
  createItem(item) {
    const parentId = TestId.parentId(item.item.extId);
    const parent = parentId ? this.items.get(parentId) : null;
    return new TreeTestItemElement(item, parent, (n) => this.changedParents.add(n));
  }
  unstoreItem(treeElement) {
    const parent = treeElement.parent;
    parent?.children.delete(treeElement);
    this.items.delete(treeElement.test.item.extId);
    return treeElement.children;
  }
  storeItem(treeElement) {
    treeElement.parent?.children.add(treeElement);
    this.items.set(treeElement.test.item.extId, treeElement);
    const affectsParent = treeElement.parent?.children.size === 1;
    const affectedParent = affectsParent ? treeElement.parent.parent : treeElement.parent;
    this.changedParents.add(affectedParent);
    if (affectedParent?.depth === 0) {
      this.changedParents.add(null);
    }
    if (treeElement.depth === 0 || isCollapsedInSerializedTestTree(this.lastState, treeElement.test.item.extId) === false) {
      this.expandElement(treeElement, 0);
    }
    const prevState = this.results.getStateById(treeElement.test.item.extId)?.[1];
    if (prevState) {
      treeElement.retired = !!prevState.retired;
      treeElement.ownState = prevState.computedState;
      treeElement.ownDuration = prevState.ownDuration;
      refreshComputedState(computedStateAccessor, treeElement, void 0, !!treeElement.ownDuration).forEach((i) => i.fireChange());
    }
  }
};
TreeProjection = __decorateClass([
  __decorateParam(1, ITestService),
  __decorateParam(2, ITestResultService)
], TreeProjection);
export {
  TreeProjection
};
