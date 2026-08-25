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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue, transaction } from "../../../../base/common/observable.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { bindContextKey, observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { TestingConfigKeys } from "./configuration.js";
import { Testing } from "./constants.js";
import { ITestResultService } from "./testResultService.js";
import { TestingContextKeys } from "./testingContextKeys.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
const ITestCoverageService = createDecorator("testCoverageService");
let TestCoverageService = class extends Disposable {
  constructor(contextKeyService, resultService, configService, viewsService) {
    super();
    this.viewsService = viewsService;
    this.lastOpenCts = this._register(new MutableDisposable());
    this.selected = observableValue("testCoverage", void 0);
    this.filterToTest = observableValue("filterToTest", void 0);
    this.showInline = observableValue("inlineCoverage", false);
    const toolbarConfig = observableConfigValue(TestingConfigKeys.CoverageToolbarEnabled, true, configService);
    this._register(bindContextKey(
      TestingContextKeys.coverageToolbarEnabled,
      contextKeyService,
      (reader) => toolbarConfig.read(reader)
    ));
    this._register(bindContextKey(
      TestingContextKeys.inlineCoverageEnabled,
      contextKeyService,
      (reader) => this.showInline.read(reader)
    ));
    this._register(bindContextKey(
      TestingContextKeys.isTestCoverageOpen,
      contextKeyService,
      (reader) => !!this.selected.read(reader)
    ));
    this._register(bindContextKey(
      TestingContextKeys.hasPerTestCoverage,
      contextKeyService,
      (reader) => !Iterable.isEmpty(this.selected.read(reader)?.allPerTestIDs())
    ));
    this._register(bindContextKey(
      TestingContextKeys.isCoverageFilteredToTest,
      contextKeyService,
      (reader) => !!this.filterToTest.read(reader)
    ));
    this._register(resultService.onResultsChanged((evt) => {
      if ("completed" in evt) {
        const coverage = evt.completed.tasks.find((t) => t.coverage.get());
        if (coverage) {
          this.openCoverage(coverage, false);
        } else {
          this.closeCoverage();
        }
      } else if ("removed" in evt && this.selected.get()) {
        const taskId = this.selected.get()?.fromTaskId;
        if (evt.removed.some((e) => e.tasks.some((t) => t.id === taskId))) {
          this.closeCoverage();
        }
      }
    }));
  }
  /** @inheritdoc */
  async openCoverage(task, focus = true) {
    this.lastOpenCts.value?.cancel();
    const cts = this.lastOpenCts.value = new CancellationTokenSource();
    const coverage = task.coverage.get();
    if (!coverage) {
      return;
    }
    transaction((tx) => {
      this.filterToTest.set(void 0, tx);
      this.selected.set(coverage, tx);
    });
    if (focus && !cts.token.isCancellationRequested) {
      this.viewsService.openView(Testing.CoverageViewId, true);
    }
  }
  /** @inheritdoc */
  closeCoverage() {
    this.selected.set(void 0, void 0);
  }
};
TestCoverageService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ITestResultService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IViewsService)
], TestCoverageService);
export {
  ITestCoverageService,
  TestCoverageService
};
