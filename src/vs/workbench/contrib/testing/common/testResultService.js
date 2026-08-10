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
import { findFirstIdxMonotonousOrArrLen } from "../../../../base/common/arraysFind.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { createSingleCallFunction } from "../../../../base/common/functional.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { TestingContextKeys } from "./testingContextKeys.js";
import { ITestProfileService } from "./testProfileService.js";
import { LiveTestResult, TestResultItemChangeReason } from "./testResult.js";
import { ITestResultStorage, RETAIN_MAX_RESULTS } from "./testResultStorage.js";
import { TestResultState, TestRunProfileBitset } from "./testTypes.js";
const isRunningTests = (service) => service.results.length > 0 && service.results[0].completedAt === void 0;
const ITestResultService = createDecorator("testResultService");
let TestResultService = class extends Disposable {
  constructor(contextKeyService, storage, testProfiles, telemetryService) {
    super();
    this.storage = storage;
    this.testProfiles = testProfiles;
    this.telemetryService = telemetryService;
    this.changeResultEmitter = this._register(new Emitter());
    this._results = [];
    this._resultsDisposables = [];
    this.testChangeEmitter = this._register(new Emitter());
    this.insertOrderCounter = 0;
    /**
     * @inheritdoc
     */
    this.onResultsChanged = this.changeResultEmitter.event;
    /**
     * @inheritdoc
     */
    this.onTestChanged = this.testChangeEmitter.event;
    this.loadResults = createSingleCallFunction(() => this.storage.read().then((loaded) => {
      for (let i = loaded.length - 1; i >= 0; i--) {
        this.push(loaded[i]);
      }
    }));
    this.persistScheduler = this._register(new RunOnceScheduler(() => this.persistImmediately(), 500));
    this._register(toDisposable(() => dispose(this._resultsDisposables)));
    this.isRunning = TestingContextKeys.isRunning.bindTo(contextKeyService);
    this.hasAnyResults = TestingContextKeys.hasAnyResults.bindTo(contextKeyService);
  }
  /**
   * @inheritdoc
   */
  get results() {
    this.loadResults();
    return this._results;
  }
  /**
   * @inheritdoc
   */
  getStateById(extId) {
    for (const result of this.results) {
      const lookup = result.getStateById(extId);
      if (lookup && lookup.computedState !== TestResultState.Unset) {
        return [result, lookup];
      }
    }
    return void 0;
  }
  /**
   * @inheritdoc
   */
  createLiveResult(req) {
    if ("targets" in req) {
      const id = generateUuid();
      return this.push(new LiveTestResult(id, true, req, this.insertOrderCounter++, this.telemetryService));
    }
    let profile;
    if (req.profile) {
      const profiles = this.testProfiles.getControllerProfiles(req.controllerId);
      profile = profiles.find((c) => c.profileId === req.profile.id);
    }
    const resolved = {
      preserveFocus: req.preserveFocus,
      targets: [],
      exclude: req.exclude,
      continuous: req.continuous,
      group: profile?.group ?? TestRunProfileBitset.Run
    };
    if (profile) {
      resolved.targets.push({
        profileId: profile.profileId,
        controllerId: req.controllerId,
        testIds: req.include
      });
    }
    return this.push(new LiveTestResult(req.id, req.persist, resolved, this.insertOrderCounter++, this.telemetryService));
  }
  /**
   * @inheritdoc
   */
  push(result) {
    if (result.completedAt === void 0) {
      this.results.unshift(result);
    } else {
      const index = findFirstIdxMonotonousOrArrLen(this.results, (r) => r.completedAt !== void 0 && r.completedAt <= result.completedAt);
      this.results.splice(index, 0, result);
      this.persistScheduler.schedule();
    }
    this.hasAnyResults.set(true);
    if (this.results.length > RETAIN_MAX_RESULTS) {
      this.results.pop();
      this._resultsDisposables.pop()?.dispose();
    }
    const ds = new DisposableStore();
    this._resultsDisposables.push(ds);
    if (result instanceof LiveTestResult) {
      ds.add(result);
      ds.add(result.onComplete(() => this.onComplete(result)));
      ds.add(result.onChange(this.testChangeEmitter.fire, this.testChangeEmitter));
      this.isRunning.set(true);
      this.changeResultEmitter.fire({ started: result });
    } else {
      this.changeResultEmitter.fire({ inserted: result });
      for (const item of result.tests) {
        for (const otherResult of this.results) {
          if (otherResult === result) {
            this.testChangeEmitter.fire({ item, result, reason: TestResultItemChangeReason.ComputedStateChange });
            break;
          } else if (otherResult.getStateById(item.item.extId) !== void 0) {
            break;
          }
        }
      }
    }
    return result;
  }
  /**
   * @inheritdoc
   */
  getResult(id) {
    return this.results.find((r) => r.id === id);
  }
  /**
   * @inheritdoc
   */
  clear() {
    const keep = [];
    const removed = [];
    for (const result of this.results) {
      if (result.completedAt !== void 0) {
        removed.push(result);
      } else {
        keep.push(result);
      }
    }
    this._results = keep;
    this.persistScheduler.schedule();
    if (keep.length === 0) {
      this.hasAnyResults.set(false);
    }
    this.changeResultEmitter.fire({ removed });
  }
  onComplete(result) {
    this.resort();
    this.updateIsRunning();
    this.persistScheduler.schedule();
    this.changeResultEmitter.fire({ completed: result });
  }
  resort() {
    this.results.sort((a, b) => {
      if (!!a.completedAt !== !!b.completedAt) {
        return a.completedAt === void 0 ? -1 : 1;
      }
      const aComp = a instanceof LiveTestResult ? a.insertOrder : -1;
      const bComp = b instanceof LiveTestResult ? b.insertOrder : -1;
      return bComp - aComp;
    });
  }
  updateIsRunning() {
    this.isRunning.set(isRunningTests(this));
  }
  async persistImmediately() {
    await this.loadResults();
    this.storage.persist(this.results);
  }
};
TestResultService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ITestResultStorage),
  __decorateParam(2, ITestProfileService),
  __decorateParam(3, ITelemetryService)
], TestResultService);
export {
  ITestResultService,
  TestResultService
};
