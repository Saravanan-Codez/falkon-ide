import { assert } from "../../../../base/common/assert.js";
import { DeferredPromise } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { WellDefinedPrefixTree } from "../../../../base/common/prefixTree.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { TestId, TestIdPathParts } from "./testId.js";
import { TestItemExpandState } from "./testTypes.js";
const ITestService = createDecorator("testService");
const testCollectionIsEmpty = (collection) => !Iterable.some(collection.rootItems, (r) => r.children.size > 0);
const getContextForTestItem = (collection, id) => {
  if (typeof id === "string") {
    id = TestId.fromString(id);
  }
  if (id.isRoot) {
    return { controller: id.toString() };
  }
  const context = { $mid: MarshalledId.TestItemContext, tests: [] };
  for (const i of id.idsFromRoot()) {
    if (!i.isRoot) {
      const test = collection.getNodeById(i.toString());
      if (test) {
        context.tests.push(test);
      }
    }
  }
  return context;
};
const expandAndGetTestById = async (collection, id, ct = CancellationToken.None) => {
  const idPath = [...TestId.fromString(id).idsFromRoot()];
  let expandToLevel = 0;
  for (let i = idPath.length - 1; !ct.isCancellationRequested && i >= expandToLevel; ) {
    const id2 = idPath[i].toString();
    const existing = collection.getNodeById(id2);
    if (!existing) {
      i--;
      continue;
    }
    if (i === idPath.length - 1) {
      return existing;
    }
    if (!existing.children.has(idPath[i + 1].toString())) {
      await collection.expand(id2, 0);
    }
    expandToLevel = i + 1;
    i = idPath.length - 1;
  }
  return void 0;
};
const waitForTestToBeIdle = (testService, test) => {
  if (!test.item.busy) {
    return;
  }
  return new Promise((resolve) => {
    const l = testService.onDidProcessDiff(() => {
      if (testService.collection.getNodeById(test.item.extId)?.item.busy !== true) {
        resolve();
        l.dispose();
      }
    });
  });
};
const testsInFile = async function* (testService, ident, uri, waitForIdle = true, descendInFile = true) {
  const canonicalUri = ident.asCanonicalUri(uri);
  const queue = new LinkedList();
  const existing = [...testService.collection.getNodeByUrl(canonicalUri)].sort((a, b) => a.item.extId.length - b.item.extId.length);
  for (let i = 0; i < existing.length - 1; i++) {
    const prefix = existing[i].item.extId + TestIdPathParts.Delimiter;
    for (let k = i + 1; k < existing.length; k++) {
      if (existing[k].item.extId.startsWith(prefix)) {
        existing.splice(k--, 1);
      }
    }
  }
  queue.push(existing.length ? existing.map((e) => e.item.extId) : testService.collection.rootIds);
  let n = 0;
  let gather = [];
  while (queue.size > 0) {
    const next = queue.pop();
    let ids;
    if (!(next instanceof DeferredPromise)) {
      ids = next;
    } else if (next.isSettled) {
      ids = next.value || Iterable.empty();
    } else {
      if (gather.length) {
        yield gather;
        gather = [];
      }
      ids = await next.p;
    }
    for (const id of ids) {
      n++;
      const test = testService.collection.getNodeById(id);
      if (!test) {
        continue;
      }
      if (!test.item.uri) {
        queue.push(test.children);
        continue;
      }
      if (ident.extUri.isEqual(canonicalUri, test.item.uri)) {
        gather.push(test);
        if (!descendInFile) {
          continue;
        }
      }
      if (ident.extUri.isEqualOrParent(canonicalUri, test.item.uri)) {
        let prom;
        if (test.expand === TestItemExpandState.Expandable) {
          prom = testService.collection.expand(test.item.extId, 1);
        }
        if (waitForIdle) {
          if (prom) {
            prom = prom.then(() => waitForTestToBeIdle(testService, test));
          } else if (test.item.busy) {
            prom = waitForTestToBeIdle(testService, test);
          }
        }
        if (prom) {
          queue.push(DeferredPromise.fromPromise(prom.then(() => test.children)));
        } else if (test.children.size) {
          queue.push(test.children);
        }
      }
    }
  }
  if (gather.length) {
    yield gather;
  }
};
const testsUnderUri = async function* (testService, ident, uri, waitForIdle = true) {
  const queue = [testService.collection.rootIds];
  while (queue.length) {
    for (const testId of queue.pop()) {
      const test = testService.collection.getNodeById(testId);
      if (!test) {
      } else if (test.item.uri && ident.extUri.isEqualOrParent(test.item.uri, uri)) {
        yield test;
      } else if (!test.item.uri || ident.extUri.isEqualOrParent(uri, test.item.uri)) {
        if (test.expand === TestItemExpandState.Expandable) {
          await testService.collection.expand(test.item.extId, 1);
        }
        if (waitForIdle) {
          await waitForTestToBeIdle(testService, test);
        }
        queue.push(test.children.values());
      }
    }
  }
};
const simplifyTestsToExecute = (collection, tests) => {
  if (tests.length < 2) {
    return tests;
  }
  const tree = new WellDefinedPrefixTree();
  for (const test of tests) {
    tree.insert(TestId.fromString(test.item.extId).path, test);
  }
  const out = [];
  const process = (currentId, node) => {
    if (node.value) {
      return node.value;
    }
    assert(!!node.children, "expect to have children");
    const thisChildren = [];
    for (const [part, child] of node.children) {
      currentId.push(part);
      const c = process(currentId, child);
      if (c) {
        thisChildren.push(c);
      }
      currentId.pop();
    }
    if (!thisChildren.length) {
      return;
    }
    const id = new TestId(currentId);
    const test = collection.getNodeById(id.toString());
    if (test?.children.size === thisChildren.length) {
      return test;
    }
    out.push(...thisChildren);
    return;
  };
  for (const [id, node] of tree.entries) {
    const n = process([id], node);
    if (n) {
      out.push(n);
    }
  }
  return out;
};
export {
  ITestService,
  expandAndGetTestById,
  getContextForTestItem,
  simplifyTestsToExecute,
  testCollectionIsEmpty,
  testsInFile,
  testsUnderUri,
  waitForTestToBeIdle
};
