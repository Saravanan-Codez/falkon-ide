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
import { Event } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { MainThreadTestCollection } from "./mainThreadTestCollection.js";
import { MutableObservableValue } from "./observableValue.js";
class NullTestExclusions extends Disposable {
  constructor() {
    super(...arguments);
    this.onTestExclusionsChanged = Event.None;
  }
  get hasAny() {
    return false;
  }
  get all() {
    return Iterable.empty();
  }
  toggle() {
  }
  contains() {
    return false;
  }
  clear() {
  }
}
let NullTestService = class extends Disposable {
  constructor(uriIdentityService) {
    super();
    this.onDidCancelTestRun = Event.None;
    this.onWillProcessDiff = Event.None;
    this.onDidProcessDiff = Event.None;
    this.excluded = this._register(new NullTestExclusions());
    this.showInlineOutput = this._register(new MutableObservableValue(false));
    this.collection = new MainThreadTestCollection(uriIdentityService, () => Promise.resolve());
  }
  registerExtHost() {
    return Disposable.None;
  }
  registerTestController() {
    return Disposable.None;
  }
  getTestController() {
    return void 0;
  }
  async refreshTests() {
  }
  cancelRefreshTests() {
  }
  async startContinuousRun() {
  }
  async runTests() {
    throw new Error("Tests are not supported in this window.");
  }
  async runResolvedTests() {
    throw new Error("Tests are not supported in this window.");
  }
  async provideTestFollowups() {
    return { followups: [], dispose() {
    } };
  }
  async syncTests() {
  }
  cancelTestRun() {
  }
  publishDiff() {
  }
  async getTestsRelatedToCode(_uri, _position) {
    return [];
  }
  async getCodeRelatedToTest() {
    return [];
  }
};
NullTestService = __decorateClass([
  __decorateParam(0, IUriIdentityService)
], NullTestService);
class NullTestProfileService extends Disposable {
  constructor() {
    super(...arguments);
    this.onDidChange = Event.None;
  }
  addProfile() {
  }
  updateProfile() {
  }
  removeProfile() {
  }
  capabilitiesForTest() {
    return 0;
  }
  configure() {
  }
  all() {
    return Iterable.empty();
  }
  getGroupDefaultProfiles() {
    return [];
  }
  setGroupDefaultProfiles() {
  }
  getControllerProfiles() {
    return [];
  }
  getDefaultProfileForTest() {
    return void 0;
  }
}
class NullTestResultService extends Disposable {
  constructor() {
    super(...arguments);
    this.onResultsChanged = Event.None;
    this.onTestChanged = Event.None;
    this.results = [];
  }
  clear() {
  }
  createLiveResult() {
    throw new Error("Tests are not supported in this window.");
  }
  push(result) {
    return result;
  }
  getResult() {
    return void 0;
  }
  getStateById() {
    return void 0;
  }
}
export {
  NullTestProfileService,
  NullTestResultService,
  NullTestService
};
