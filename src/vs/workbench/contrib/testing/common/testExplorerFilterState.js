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
import { splitGlobAware } from "../../../../base/common/glob.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { MutableObservableValue } from "./observableValue.js";
import { StoredValue } from "./storedValue.js";
import { namespaceTestTag } from "./testTypes.js";
const ITestExplorerFilterState = createDecorator("testingFilterState");
const tagRe = /!?@([^ ,:]+)/g;
const trimExtraWhitespace = (str) => str.replace(/\s\s+/g, " ").trim();
let TestExplorerFilterState = class extends Disposable {
  constructor(storageService) {
    super();
    this.focusEmitter = this._register(new Emitter());
    /**
     * Mapping of terms to whether they're included in the text.
     */
    this.termFilterState = {};
    /** @inheritdoc */
    this.globList = [];
    /** @inheritdoc */
    this.includeTags = /* @__PURE__ */ new Set();
    /** @inheritdoc */
    this.excludeTags = /* @__PURE__ */ new Set();
    /** @inheritdoc */
    this.text = this._register(new MutableObservableValue(""));
    this.reveal = observableValue("TestExplorerFilterState.reveal", void 0);
    this.onDidRequestInputFocus = this.focusEmitter.event;
    this.selectTestInExplorerEmitter = this._register(new Emitter());
    this.onDidSelectTestInExplorer = this.selectTestInExplorerEmitter.event;
    this.fuzzy = this._register(MutableObservableValue.stored(new StoredValue({
      key: "testHistoryFuzzy",
      scope: StorageScope.PROFILE,
      target: StorageTarget.USER
    }, storageService), false));
  }
  /** @inheritdoc */
  didSelectTestInExplorer(testId) {
    this.selectTestInExplorerEmitter.fire(testId);
  }
  /** @inheritdoc */
  focusInput() {
    this.focusEmitter.fire();
  }
  /** @inheritdoc */
  setText(text) {
    if (text === this.text.value) {
      return;
    }
    this.termFilterState = {};
    this.globList = [];
    this.includeTags.clear();
    this.excludeTags.clear();
    let globText = "";
    let lastIndex = 0;
    for (const match of text.matchAll(tagRe)) {
      let nextIndex = match.index + match[0].length;
      const tag = match[0];
      const isFilterTerm = allTestFilterTerms.includes(tag);
      if (isFilterTerm) {
        this.termFilterState[tag] = true;
      }
      let isTag = false;
      if (text[nextIndex] === ":") {
        isTag = true;
        nextIndex++;
        let delimiter = text[nextIndex];
        if (delimiter !== `"` && delimiter !== `'`) {
          delimiter = " ";
        } else {
          nextIndex++;
        }
        let tagId = "";
        while (nextIndex < text.length && text[nextIndex] !== delimiter) {
          if (text[nextIndex] === "\\") {
            tagId += text[nextIndex + 1];
            nextIndex += 2;
          } else {
            tagId += text[nextIndex];
            nextIndex++;
          }
        }
        if (match[0].startsWith("!")) {
          this.excludeTags.add(namespaceTestTag(match[1], tagId));
        } else {
          this.includeTags.add(namespaceTestTag(match[1], tagId));
        }
        nextIndex++;
      }
      if (!isFilterTerm && !isTag) {
        continue;
      }
      globText += text.slice(lastIndex, match.index);
      lastIndex = nextIndex;
    }
    globText += text.slice(lastIndex).trim();
    if (globText.length) {
      for (const filter of splitGlobAware(globText, ",").map((s) => s.trim()).filter((s) => !!s.length)) {
        if (filter.startsWith("!")) {
          this.globList.push({ include: false, text: filter.slice(1).toLowerCase() });
        } else {
          this.globList.push({ include: true, text: filter.toLowerCase() });
        }
      }
    }
    this.text.value = text;
  }
  /** @inheritdoc */
  isFilteringFor(term) {
    return !!this.termFilterState[term];
  }
  /** @inheritdoc */
  toggleFilteringFor(term, shouldFilter) {
    const text = this.text.value.trim();
    if (shouldFilter !== false && !this.termFilterState[term]) {
      this.setText(text ? `${text} ${term}` : term);
    } else if (shouldFilter !== true && this.termFilterState[term]) {
      this.setText(trimExtraWhitespace(text.replace(term, "")));
    }
  }
};
TestExplorerFilterState = __decorateClass([
  __decorateParam(0, IStorageService)
], TestExplorerFilterState);
var TestFilterTerm = /* @__PURE__ */ ((TestFilterTerm2) => {
  TestFilterTerm2["Failed"] = "@failed";
  TestFilterTerm2["Executed"] = "@executed";
  TestFilterTerm2["CurrentDoc"] = "@doc";
  TestFilterTerm2["OpenedFiles"] = "@openedFiles";
  TestFilterTerm2["Hidden"] = "@hidden";
  return TestFilterTerm2;
})(TestFilterTerm || {});
const allTestFilterTerms = [
  "@failed" /* Failed */,
  "@executed" /* Executed */,
  "@doc" /* CurrentDoc */,
  "@openedFiles" /* OpenedFiles */,
  "@hidden" /* Hidden */
];
export {
  ITestExplorerFilterState,
  TestExplorerFilterState,
  TestFilterTerm
};
