import { Barrier, isThenable, RunOnceScheduler } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { assertNever } from "../../../../base/common/assert.js";
import { applyTestItemUpdate, namespaceTestTag, TestDiffOpType, TestItemExpandState } from "./testTypes.js";
import { TestId } from "./testId.js";
var TestItemEventOp = /* @__PURE__ */ ((TestItemEventOp2) => {
  TestItemEventOp2[TestItemEventOp2["Upsert"] = 0] = "Upsert";
  TestItemEventOp2[TestItemEventOp2["SetTags"] = 1] = "SetTags";
  TestItemEventOp2[TestItemEventOp2["UpdateCanResolveChildren"] = 2] = "UpdateCanResolveChildren";
  TestItemEventOp2[TestItemEventOp2["RemoveChild"] = 3] = "RemoveChild";
  TestItemEventOp2[TestItemEventOp2["SetProp"] = 4] = "SetProp";
  TestItemEventOp2[TestItemEventOp2["Bulk"] = 5] = "Bulk";
  TestItemEventOp2[TestItemEventOp2["DocumentSynced"] = 6] = "DocumentSynced";
  return TestItemEventOp2;
})(TestItemEventOp || {});
const strictEqualComparator = (a, b) => a === b;
const diffableProps = {
  range: (a, b) => {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return a.equalsRange(b);
  },
  busy: strictEqualComparator,
  label: strictEqualComparator,
  description: strictEqualComparator,
  error: strictEqualComparator,
  sortText: strictEqualComparator,
  tags: (a, b) => {
    if (a.length !== b.length) {
      return false;
    }
    if (a.some((t1) => !b.includes(t1))) {
      return false;
    }
    return true;
  }
};
const diffableEntries = Object.entries(diffableProps);
const diffTestItems = (a, b) => {
  let output;
  for (const [key, cmp] of diffableEntries) {
    if (!cmp(a[key], b[key])) {
      if (output) {
        output[key] = b[key];
      } else {
        output = { [key]: b[key] };
      }
    }
  }
  return output;
};
class TestItemCollection extends Disposable {
  constructor(options) {
    super();
    this.options = options;
    this.debounceSendDiff = this._register(new RunOnceScheduler(() => this.flushDiff(), 200));
    this.diffOpEmitter = this._register(new Emitter());
    this.tree = /* @__PURE__ */ new Map();
    this.tags = /* @__PURE__ */ new Map();
    this.diff = [];
    /**
     * Fires when an operation happens that should result in a diff.
     */
    this.onDidGenerateDiff = this.diffOpEmitter.event;
    this.root.canResolveChildren = true;
    this.upsertItem(this.root, void 0);
  }
  get root() {
    return this.options.root;
  }
  /**
   * Handler used for expanding test items.
   */
  set resolveHandler(handler) {
    this._resolveHandler = handler;
    for (const test of this.tree.values()) {
      this.updateExpandability(test);
    }
  }
  get resolveHandler() {
    return this._resolveHandler;
  }
  /**
   * Gets a diff of all changes that have been made, and clears the diff queue.
   */
  collectDiff() {
    const diff = this.diff;
    this.diff = [];
    return diff;
  }
  /**
   * Pushes a new diff entry onto the collected diff list.
   */
  pushDiff(diff) {
    switch (diff.op) {
      case TestDiffOpType.DocumentSynced: {
        for (const existing of this.diff) {
          if (existing.op === TestDiffOpType.DocumentSynced && existing.uri === diff.uri) {
            existing.docv = diff.docv;
            return;
          }
        }
        break;
      }
      case TestDiffOpType.Update: {
        const last = this.diff[this.diff.length - 1];
        if (last) {
          if (last.op === TestDiffOpType.Update && last.item.extId === diff.item.extId) {
            applyTestItemUpdate(last.item, diff.item);
            return;
          }
          if (last.op === TestDiffOpType.Add && last.item.item.extId === diff.item.extId) {
            applyTestItemUpdate(last.item, diff.item);
            return;
          }
        }
        break;
      }
    }
    this.diff.push(diff);
    if (!this.debounceSendDiff.isScheduled()) {
      this.debounceSendDiff.schedule();
    }
  }
  /**
   * Expands the test and the given number of `levels` of children. If levels
   * is < 0, then all children will be expanded. If it's 0, then only this
   * item will be expanded.
   */
  expand(testId, levels) {
    const internal = this.tree.get(testId);
    if (!internal) {
      return;
    }
    if (internal.expandLevels === void 0 || levels > internal.expandLevels) {
      internal.expandLevels = levels;
    }
    if (internal.expand === TestItemExpandState.Expandable) {
      const r = this.resolveChildren(internal);
      return !r.isOpen() ? r.wait().then(() => this.expandChildren(internal, levels - 1)) : this.expandChildren(internal, levels - 1);
    } else if (internal.expand === TestItemExpandState.Expanded) {
      return internal.resolveBarrier?.isOpen() === false ? internal.resolveBarrier.wait().then(() => this.expandChildren(internal, levels - 1)) : this.expandChildren(internal, levels - 1);
    }
  }
  dispose() {
    for (const item of this.tree.values()) {
      this.options.getApiFor(item.actual).listener = void 0;
    }
    this.tree.clear();
    this.diff = [];
    super.dispose();
  }
  onTestItemEvent(internal, evt) {
    switch (evt.op) {
      case 3 /* RemoveChild */:
        this.removeItem(TestId.joinToString(internal.fullId, evt.id));
        break;
      case 0 /* Upsert */:
        this.upsertItem(evt.item, internal);
        break;
      case 5 /* Bulk */:
        for (const op of evt.ops) {
          this.onTestItemEvent(internal, op);
        }
        break;
      case 1 /* SetTags */:
        this.diffTagRefs(evt.new, evt.old, internal.fullId.toString());
        break;
      case 2 /* UpdateCanResolveChildren */:
        this.updateExpandability(internal);
        break;
      case 4 /* SetProp */:
        this.pushDiff({
          op: TestDiffOpType.Update,
          item: {
            extId: internal.fullId.toString(),
            item: evt.update
          }
        });
        break;
      case 6 /* DocumentSynced */:
        this.documentSynced(internal.actual.uri);
        break;
      default:
        assertNever(evt);
    }
  }
  documentSynced(uri) {
    if (uri) {
      this.pushDiff({
        op: TestDiffOpType.DocumentSynced,
        uri,
        docv: this.options.getDocumentVersion(uri)
      });
    }
  }
  upsertItem(actual, parent) {
    const fullId = TestId.fromExtHostTestItem(actual, this.root.id, parent?.actual);
    const privateApi = this.options.getApiFor(actual);
    if (privateApi.parent && privateApi.parent !== parent?.actual) {
      this.options.getChildren(privateApi.parent).delete(actual.id);
    }
    let internal = this.tree.get(fullId.toString());
    if (!internal) {
      internal = {
        fullId,
        actual,
        expandLevels: parent?.expandLevels ? parent.expandLevels - 1 : void 0,
        expand: TestItemExpandState.NotExpandable
        // updated by `connectItemAndChildren`
      };
      actual.tags.forEach(this.incrementTagRefs, this);
      this.tree.set(internal.fullId.toString(), internal);
      this.setItemParent(actual, parent);
      this.pushDiff({
        op: TestDiffOpType.Add,
        item: {
          controllerId: this.options.controllerId,
          expand: internal.expand,
          item: this.options.toITestItem(actual)
        }
      });
      this.connectItemAndChildren(actual, internal, parent);
      return;
    }
    if (internal.actual === actual) {
      this.connectItem(actual, internal, parent);
      return;
    }
    if (internal.actual.uri?.toString() !== actual.uri?.toString()) {
      this.removeItem(fullId.toString());
      return this.upsertItem(actual, parent);
    }
    const oldChildren = this.options.getChildren(internal.actual);
    const oldActual = internal.actual;
    const update = diffTestItems(this.options.toITestItem(oldActual), this.options.toITestItem(actual));
    this.options.getApiFor(oldActual).listener = void 0;
    internal.actual = actual;
    internal.resolveBarrier = void 0;
    internal.expand = TestItemExpandState.NotExpandable;
    if (update) {
      if (update.hasOwnProperty("tags")) {
        this.diffTagRefs(actual.tags, oldActual.tags, fullId.toString());
        delete update.tags;
      }
      this.onTestItemEvent(internal, { op: 4 /* SetProp */, update });
    }
    this.connectItemAndChildren(actual, internal, parent);
    for (const [_, child] of oldChildren) {
      if (!this.options.getChildren(actual).get(child.id)) {
        this.removeItem(TestId.joinToString(fullId, child.id));
      }
    }
    const expandLevels = internal.expandLevels;
    if (expandLevels !== void 0) {
      queueMicrotask(() => {
        if (internal.expand === TestItemExpandState.Expandable) {
          internal.expandLevels = void 0;
          this.expand(fullId.toString(), expandLevels);
        }
      });
    }
    this.documentSynced(internal.actual.uri);
  }
  diffTagRefs(newTags, oldTags, extId) {
    const toDelete = new Set(oldTags.map((t) => t.id));
    for (const tag of newTags) {
      if (!toDelete.delete(tag.id)) {
        this.incrementTagRefs(tag);
      }
    }
    this.pushDiff({
      op: TestDiffOpType.Update,
      item: { extId, item: { tags: newTags.map((v) => namespaceTestTag(this.options.controllerId, v.id)) } }
    });
    toDelete.forEach(this.decrementTagRefs, this);
  }
  incrementTagRefs(tag) {
    const existing = this.tags.get(tag.id);
    if (existing) {
      existing.refCount++;
    } else {
      this.tags.set(tag.id, { refCount: 1 });
      this.pushDiff({
        op: TestDiffOpType.AddTag,
        tag: {
          id: namespaceTestTag(this.options.controllerId, tag.id)
        }
      });
    }
  }
  decrementTagRefs(tagId) {
    const existing = this.tags.get(tagId);
    if (existing && !--existing.refCount) {
      this.tags.delete(tagId);
      this.pushDiff({ op: TestDiffOpType.RemoveTag, id: namespaceTestTag(this.options.controllerId, tagId) });
    }
  }
  setItemParent(actual, parent) {
    this.options.getApiFor(actual).parent = parent && parent.actual !== this.root ? parent.actual : void 0;
  }
  connectItem(actual, internal, parent) {
    this.setItemParent(actual, parent);
    const api = this.options.getApiFor(actual);
    api.parent = parent?.actual;
    api.listener = (evt) => this.onTestItemEvent(internal, evt);
    this.updateExpandability(internal);
  }
  connectItemAndChildren(actual, internal, parent) {
    this.connectItem(actual, internal, parent);
    for (const [_, child] of this.options.getChildren(actual)) {
      this.upsertItem(child, internal);
    }
  }
  /**
   * Updates the `expand` state of the item. Should be called whenever the
   * resolved state of the item changes. Can automatically expand the item
   * if requested by a consumer.
   */
  updateExpandability(internal) {
    let newState;
    if (!this._resolveHandler) {
      newState = TestItemExpandState.NotExpandable;
    } else if (internal.resolveBarrier) {
      newState = internal.resolveBarrier.isOpen() ? TestItemExpandState.Expanded : TestItemExpandState.BusyExpanding;
    } else {
      newState = internal.actual.canResolveChildren ? TestItemExpandState.Expandable : TestItemExpandState.NotExpandable;
    }
    if (newState === internal.expand) {
      return;
    }
    internal.expand = newState;
    this.pushDiff({ op: TestDiffOpType.Update, item: { extId: internal.fullId.toString(), expand: newState } });
    if (newState === TestItemExpandState.Expandable && internal.expandLevels !== void 0) {
      this.resolveChildren(internal);
    }
  }
  /**
   * Expands all children of the item, "levels" deep. If levels is 0, only
   * the children will be expanded. If it's 1, the children and their children
   * will be expanded. If it's <0, it's a no-op.
   */
  expandChildren(internal, levels) {
    if (levels < 0) {
      return;
    }
    const expandRequests = [];
    for (const [_, child] of this.options.getChildren(internal.actual)) {
      const promise = this.expand(TestId.joinToString(internal.fullId, child.id), levels);
      if (isThenable(promise)) {
        expandRequests.push(promise);
      }
    }
    if (expandRequests.length) {
      return Promise.all(expandRequests).then(() => {
      });
    }
  }
  /**
   * Calls `discoverChildren` on the item, refreshing all its tests.
   */
  resolveChildren(internal) {
    if (internal.resolveBarrier) {
      return internal.resolveBarrier;
    }
    if (!this._resolveHandler) {
      const b = new Barrier();
      b.open();
      return b;
    }
    internal.expand = TestItemExpandState.BusyExpanding;
    this.pushExpandStateUpdate(internal);
    const barrier = internal.resolveBarrier = new Barrier();
    const applyError = (err) => {
      console.error(`Unhandled error in resolveHandler of test controller "${this.options.controllerId}"`, err);
    };
    let r;
    try {
      r = this._resolveHandler(internal.actual === this.root ? void 0 : internal.actual);
    } catch (err) {
      applyError(err);
    }
    if (isThenable(r)) {
      r.catch(applyError).then(() => {
        barrier.open();
        this.updateExpandability(internal);
      });
    } else {
      barrier.open();
      this.updateExpandability(internal);
    }
    return internal.resolveBarrier;
  }
  pushExpandStateUpdate(internal) {
    this.pushDiff({ op: TestDiffOpType.Update, item: { extId: internal.fullId.toString(), expand: internal.expand } });
  }
  removeItem(childId) {
    const childItem = this.tree.get(childId);
    if (!childItem) {
      throw new Error("attempting to remove non-existent child");
    }
    this.pushDiff({ op: TestDiffOpType.Remove, itemId: childId });
    const queue = [childItem];
    while (queue.length) {
      const item = queue.pop();
      if (!item) {
        continue;
      }
      this.options.getApiFor(item.actual).listener = void 0;
      for (const tag of item.actual.tags) {
        this.decrementTagRefs(tag.id);
      }
      this.tree.delete(item.fullId.toString());
      for (const [_, child] of this.options.getChildren(item.actual)) {
        queue.push(this.tree.get(TestId.joinToString(item.fullId, child.id)));
      }
    }
  }
  /**
   * Immediately emits any pending diffs on the collection.
   */
  flushDiff() {
    const diff = this.collectDiff();
    if (diff.length) {
      this.diffOpEmitter.fire(diff);
    }
  }
}
class DuplicateTestItemError extends Error {
  constructor(id) {
    super(`Attempted to insert a duplicate test item ID ${id}`);
  }
}
class InvalidTestItemError extends Error {
  constructor(id) {
    super(`TestItem with ID "${id}" is invalid. Make sure to create it from the createTestItem method.`);
  }
}
class MixedTestItemController extends Error {
  constructor(id, ctrlA, ctrlB) {
    super(`TestItem with ID "${id}" is from controller "${ctrlA}" and cannot be added as a child of an item from controller "${ctrlB}".`);
  }
}
const createTestItemChildren = (api, getApi, checkCtor) => {
  let mapped = /* @__PURE__ */ new Map();
  return {
    /** @inheritdoc */
    get size() {
      return mapped.size;
    },
    /** @inheritdoc */
    forEach(callback, thisArg) {
      for (const item of mapped.values()) {
        callback.call(thisArg, item, this);
      }
    },
    /** @inheritdoc */
    [Symbol.iterator]() {
      return mapped.entries();
    },
    /** @inheritdoc */
    replace(items) {
      const newMapped = /* @__PURE__ */ new Map();
      const toDelete = new Set(mapped.keys());
      const bulk = { op: 5 /* Bulk */, ops: [] };
      for (const item of items) {
        if (!(item instanceof checkCtor)) {
          throw new InvalidTestItemError(item.id);
        }
        const itemController = getApi(item).controllerId;
        if (itemController !== api.controllerId) {
          throw new MixedTestItemController(item.id, itemController, api.controllerId);
        }
        if (newMapped.has(item.id)) {
          throw new DuplicateTestItemError(item.id);
        }
        newMapped.set(item.id, item);
        toDelete.delete(item.id);
        bulk.ops.push({ op: 0 /* Upsert */, item });
      }
      for (const id of toDelete.keys()) {
        bulk.ops.push({ op: 3 /* RemoveChild */, id });
      }
      api.listener?.(bulk);
      mapped = newMapped;
    },
    /** @inheritdoc */
    add(item) {
      if (!(item instanceof checkCtor)) {
        throw new InvalidTestItemError(item.id);
      }
      mapped.set(item.id, item);
      api.listener?.({ op: 0 /* Upsert */, item });
    },
    /** @inheritdoc */
    delete(id) {
      if (mapped.delete(id)) {
        api.listener?.({ op: 3 /* RemoveChild */, id });
      }
    },
    /** @inheritdoc */
    get(itemId) {
      return mapped.get(itemId);
    },
    /** JSON serialization function. */
    toJSON() {
      return Array.from(mapped.values());
    }
  };
};
export {
  DuplicateTestItemError,
  InvalidTestItemError,
  MixedTestItemController,
  TestItemCollection,
  TestItemEventOp,
  createTestItemChildren
};
