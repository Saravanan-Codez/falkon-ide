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
import { h } from "../../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../base/common/observable.js";
import { isDefined } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ExplorerExtensions } from "../../files/browser/explorerFileContrib.js";
import * as coverUtils from "./codeCoverageDisplayUtils.js";
import { TestingConfigKeys, getTestingConfiguration, observeTestingConfiguration } from "../common/configuration.js";
import { ITestCoverageService } from "../common/testCoverageService.js";
import { safeIntl } from "../../../../base/common/date.js";
let ManagedTestCoverageBars = class extends Disposable {
  constructor(options, configurationService, hoverService) {
    super();
    this.options = options;
    this.configurationService = configurationService;
    this.hoverService = hoverService;
    this.el = new Lazy(() => {
      if (this.options.compact) {
        const el = h(".test-coverage-bars.compact", [
          h(".tpc@overall"),
          h(".bar@tpcBar")
        ]);
        this.attachHover(el.tpcBar, getOverallHoverText);
        return el;
      } else {
        const el = h(".test-coverage-bars", [
          h(".tpc@overall"),
          h(".bar@statement"),
          h(".bar@function"),
          h(".bar@branch")
        ]);
        this.attachHover(el.statement, stmtCoverageText);
        this.attachHover(el.function, fnCoverageText);
        this.attachHover(el.branch, branchCoverageText);
        return el;
      }
    });
    this.visibleStore = this._register(new DisposableStore());
    this.customHovers = [];
  }
  /** Gets whether coverage is currently visible for the resource. */
  get visible() {
    return !!this._coverage;
  }
  attachHover(target, factory) {
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), target, () => this._coverage && factory(this._coverage)));
  }
  setCoverageInfo(coverage) {
    const ds = this.visibleStore;
    if (!coverage) {
      if (this._coverage) {
        this._coverage = void 0;
        this.customHovers.forEach((c) => c.hide());
        ds.clear();
      }
      return;
    }
    if (!this._coverage) {
      const root = this.el.value.root;
      ds.add(toDisposable(() => root.remove()));
      this.options.container.appendChild(root);
      ds.add(this.configurationService.onDidChangeConfiguration((c) => {
        if (!this._coverage) {
          return;
        }
        if (c.affectsConfiguration(TestingConfigKeys.CoveragePercent) || c.affectsConfiguration(TestingConfigKeys.CoverageBarThresholds)) {
          this.doRender(this._coverage);
        }
      }));
    }
    this._coverage = coverage;
    this.doRender(coverage);
  }
  doRender(coverage) {
    const el = this.el.value;
    const precision = this.options.compact ? 0 : 2;
    const thresholds = getTestingConfiguration(this.configurationService, TestingConfigKeys.CoverageBarThresholds);
    const overallStat = coverUtils.calculateDisplayedStat(coverage, getTestingConfiguration(this.configurationService, TestingConfigKeys.CoveragePercent));
    if (this.options.overall !== false) {
      el.overall.textContent = coverUtils.displayPercent(overallStat, precision);
    } else {
      el.overall.style.display = "none";
    }
    if ("tpcBar" in el) {
      renderBar(el.tpcBar, overallStat, false, thresholds);
    } else {
      renderBar(el.statement, coverUtils.percent(coverage.statement), coverage.statement.total === 0, thresholds);
      renderBar(el.function, coverage.declaration && coverUtils.percent(coverage.declaration), coverage.declaration?.total === 0, thresholds);
      renderBar(el.branch, coverage.branch && coverUtils.percent(coverage.branch), coverage.branch?.total === 0, thresholds);
    }
  }
};
ManagedTestCoverageBars = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IHoverService)
], ManagedTestCoverageBars);
const barWidth = 16;
const renderBar = (bar, pct, isZero, thresholds) => {
  if (pct === void 0) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "block";
  bar.style.width = `${barWidth}px`;
  bar.style.setProperty("--test-bar-width", `${Math.floor(pct * 16)}px`);
  if (isZero) {
    bar.style.color = "currentColor";
    bar.style.opacity = "0.5";
    return;
  }
  bar.style.color = coverUtils.getCoverageColor(pct, thresholds);
  bar.style.opacity = "1";
};
const nf = safeIntl.NumberFormat();
const stmtCoverageText = (coverage) => localize("statementCoverage", "{0}/{1} statements covered ({2})", nf.value.format(coverage.statement.covered), nf.value.format(coverage.statement.total), coverUtils.displayPercent(coverUtils.percent(coverage.statement)));
const fnCoverageText = (coverage) => coverage.declaration && localize("functionCoverage", "{0}/{1} functions covered ({2})", nf.value.format(coverage.declaration.covered), nf.value.format(coverage.declaration.total), coverUtils.displayPercent(coverUtils.percent(coverage.declaration)));
const branchCoverageText = (coverage) => coverage.branch && localize("branchCoverage", "{0}/{1} branches covered ({2})", nf.value.format(coverage.branch.covered), nf.value.format(coverage.branch.total), coverUtils.displayPercent(coverUtils.percent(coverage.branch)));
const getOverallHoverText = (coverage) => {
  const str = [
    stmtCoverageText(coverage),
    fnCoverageText(coverage),
    branchCoverageText(coverage)
  ].filter(isDefined).join("\n\n");
  return {
    markdown: new MarkdownString().appendText(str),
    markdownNotSupportedFallback: str
  };
};
let ExplorerTestCoverageBars = class extends ManagedTestCoverageBars {
  constructor(options, configurationService, hoverService, testCoverageService) {
    super(options, configurationService, hoverService);
    this.resource = observableValue(this, void 0);
    const isEnabled = observeTestingConfiguration(configurationService, TestingConfigKeys.ShowCoverageInExplorer);
    this._register(autorun(async (reader) => {
      let info;
      const coverage = testCoverageService.selected.read(reader);
      if (coverage && isEnabled.read(reader)) {
        const resource = this.resource.read(reader);
        if (resource) {
          info = coverage.getComputedForUri(resource);
        }
      }
      this.setCoverageInfo(info);
    }));
  }
  static {
    this.hasRegistered = false;
  }
  static register() {
    if (this.hasRegistered) {
      return;
    }
    this.hasRegistered = true;
    Registry.as(ExplorerExtensions.FileContributionRegistry).register({
      create(insta, container) {
        return insta.createInstance(
          ExplorerTestCoverageBars,
          { compact: true, container }
        );
      }
    });
  }
  /** @inheritdoc */
  setResource(resource, transaction) {
    this.resource.set(resource, transaction);
  }
  setCoverageInfo(coverage) {
    super.setCoverageInfo(coverage);
    this.options.container?.classList.toggle("explorer-item-with-test-coverage", this.visible);
  }
};
ExplorerTestCoverageBars = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IHoverService),
  __decorateParam(3, ITestCoverageService)
], ExplorerTestCoverageBars);
export {
  ExplorerTestCoverageBars,
  ManagedTestCoverageBars
};
