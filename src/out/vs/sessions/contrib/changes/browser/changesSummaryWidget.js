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
import "./media/changesSummaryWidget.css";
import * as dom from "../../../../base/browser/dom.js";
import { structuralEquals } from "../../../../base/common/equals.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { derived, derivedObservableWithCache, derivedOpts } from "../../../../base/common/observable.js";
import { IChangesViewService } from "../common/changesViewService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { AnimatedCounterWidget } from "../../../../workbench/browser/animatedCounterWidget.js";
let ChangesSummaryWidget = class extends Disposable {
  constructor(changesViewService, _instantiationService) {
    super();
    this._instantiationService = _instantiationService;
    const summaryRawObs = derivedObservableWithCache(this, (reader, lastValue) => {
      const isLoading = changesViewService.activeSessionLoadingObs.read(reader);
      if (isLoading) {
        return lastValue;
      }
      const entries = changesViewService.activeSessionChangesObs.read(reader);
      if (entries.length === 0) {
        return void 0;
      }
      let additions = 0, deletions = 0;
      for (const entry of entries) {
        additions += entry.insertions;
        deletions += entry.deletions;
      }
      return {
        additions,
        deletions,
        files: entries.length
      };
    });
    this._summaryObs = derivedOpts({
      equalsFn: structuralEquals
    }, (reader) => summaryRawObs.read(reader));
  }
  get summary() {
    return this._summaryObs;
  }
  render(container) {
    const element = dom.$("div.changes-summary-widget");
    container.appendChild(element);
    this._register(this._instantiationService.createInstance(AnimatedCounterWidget, element, {
      prefix: "+",
      direction: "topToBottom",
      cssClassName: "changes-summary-lines-added",
      count: derived(this, (reader) => {
        return this._summaryObs.read(reader)?.additions;
      })
    }));
    this._register(this._instantiationService.createInstance(AnimatedCounterWidget, element, {
      prefix: "-",
      direction: "bottomToTop",
      cssClassName: "changes-summary-lines-removed",
      count: derived(this, (reader) => {
        return this._summaryObs.read(reader)?.deletions;
      })
    }));
  }
};
ChangesSummaryWidget = __decorateClass([
  __decorateParam(0, IChangesViewService),
  __decorateParam(1, IInstantiationService)
], ChangesSummaryWidget);
export {
  ChangesSummaryWidget
};
