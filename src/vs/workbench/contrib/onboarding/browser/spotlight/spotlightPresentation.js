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
import { timeout } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IWorkbenchLayoutService } from "../../../../services/layout/browser/layoutService.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { OnboardingDismissReason, OnboardingOutcome } from "../../common/onboardingScenario.js";
import { findOnboardingTarget, openOnboardingTarget } from "./onboardingTarget.js";
import { SpotlightOverlay } from "./spotlightOverlay.js";
import { SPOTLIGHT_PRESENTATION_KIND } from "./spotlightTypes.js";
const TARGET_RESOLVE_TIMEOUT = 2e3;
const TARGET_POLL_INTERVAL = 50;
const TARGET_ANIMATION_SETTLE_TIMEOUT = 600;
let SpotlightPresentation = class extends Disposable {
  constructor(layoutService, hostService, contextKeyService) {
    super();
    this.layoutService = layoutService;
    this.hostService = hostService;
    this.contextKeyService = contextKeyService;
    this.kind = SPOTLIGHT_PRESENTATION_KIND;
    this.countsAsVisualStep = true;
  }
  async run(scenario, context) {
    const payload = scenario.presentation.payload;
    return this._runPayload(payload, context);
  }
  async runStep(sequenceStep, context) {
    const step = sequenceStep.payload;
    if (step.when && !this.contextKeyService.contextMatchesRules(step.when)) {
      return { action: "skipStep", shown: false };
    }
    try {
      await step.onBeforeShow?.();
    } catch (error) {
      onUnexpectedError(error);
    }
    if (context.cancellationToken.isCancellationRequested) {
      return { action: "abort", shown: false };
    }
    const target = await this._resolveTarget(context.targetWindow, step.targetId, context.cancellationToken, step.missingTarget);
    if (!target) {
      return context.cancellationToken.isCancellationRequested ? { action: "abort", shown: false } : { action: "skipStep", shown: false };
    }
    await this._waitForTargetReady(context.targetWindow, target);
    if (context.cancellationToken.isCancellationRequested) {
      return { action: "abort", shown: false };
    }
    const store = new DisposableStore();
    try {
      const container = this.layoutService.getContainer(context.targetWindow);
      const overlay = store.add(new SpotlightOverlay(container));
      this.hostService.setWindowDimmed(context.targetWindow, true);
      store.add(toDisposable(() => this.hostService.setWindowDimmed(context.targetWindow, false)));
      store.add(this.layoutService.onDidLayoutContainer(() => overlay.scheduleLayout()));
      const end = await this._runStep(
        overlay,
        context,
        step,
        target,
        context.visualStepIndex,
        context.visualStepCount,
        context.canGoBack,
        context.isLastVisualStep
      );
      overlay.hide();
      switch (end.action) {
        case "next":
          return {
            action: "next",
            shown: true,
            dismissReason: end.via === "target" ? OnboardingDismissReason.TargetClick : OnboardingDismissReason.Completed
          };
        case "back":
          return { action: "back", shown: true };
        case "skip":
          return { action: "skipSequence", shown: true, dismissReason: end.reason };
        case "abort":
          return { action: "abort", shown: true };
      }
    } finally {
      store.dispose();
    }
  }
  async _runPayload(payload, context) {
    const steps = payload?.steps ?? [];
    const stepCount = steps.length;
    if (stepCount === 0) {
      return { outcome: OnboardingOutcome.Completed, shown: false, dismissReason: OnboardingDismissReason.Completed, lastStepIndex: 0, stepCount: 0 };
    }
    let lastStepIndex = 0;
    let shown = false;
    const skippedStepIndexes = /* @__PURE__ */ new Set();
    const store = new DisposableStore();
    try {
      const container = this.layoutService.getContainer(context.targetWindow);
      const overlay = store.add(new SpotlightOverlay(container));
      this.hostService.setWindowDimmed(context.targetWindow, true);
      store.add(toDisposable(() => this.hostService.setWindowDimmed(context.targetWindow, false)));
      let aborted = false;
      const targetResolutionCancellation = store.add(new CancellationTokenSource());
      store.add(context.onAbort(() => {
        aborted = true;
        targetResolutionCancellation.cancel();
      }));
      store.add(this.layoutService.onDidLayoutContainer(() => overlay.scheduleLayout()));
      let index = 0;
      let direction = 1;
      while (index >= 0 && index < stepCount && !aborted) {
        const step = steps[index];
        if (step.when && !this.contextKeyService.contextMatchesRules(step.when)) {
          skippedStepIndexes.add(index);
          index += direction;
          continue;
        }
        try {
          await step.onBeforeShow?.();
        } catch (error) {
          onUnexpectedError(error);
        }
        if (aborted) {
          break;
        }
        const target = await this._resolveTarget(context.targetWindow, step.targetId, targetResolutionCancellation.token, step.missingTarget);
        if (aborted) {
          break;
        }
        if (!target) {
          skippedStepIndexes.add(index);
          index += direction;
          continue;
        }
        skippedStepIndexes.delete(index);
        await this._waitForTargetReady(context.targetWindow, target);
        if (aborted) {
          break;
        }
        lastStepIndex = Math.max(lastStepIndex, index);
        shown = true;
        const skippedBefore = Array.from(skippedStepIndexes).filter((skippedIndex) => skippedIndex < index).length;
        const displayStepIndex = index - skippedBefore;
        const displayStepCount = stepCount - skippedStepIndexes.size;
        const end = await this._runStep(overlay, context, step, target, displayStepIndex, displayStepCount);
        overlay.hide();
        switch (end.action) {
          case "next":
            if (index === stepCount - 1) {
              const dismissReason = end.via === "target" ? OnboardingDismissReason.TargetClick : OnboardingDismissReason.Completed;
              return { outcome: OnboardingOutcome.Completed, shown, dismissReason, lastStepIndex, stepCount };
            }
            direction = 1;
            index++;
            break;
          case "back":
            direction = -1;
            index--;
            break;
          case "skip":
            return { outcome: OnboardingOutcome.Skipped, shown, dismissReason: end.reason, lastStepIndex, stepCount };
          case "abort":
            return { outcome: OnboardingOutcome.Aborted, shown, dismissReason: OnboardingDismissReason.Aborted, lastStepIndex, stepCount };
        }
      }
      if (aborted) {
        return { outcome: OnboardingOutcome.Aborted, shown, dismissReason: OnboardingDismissReason.Aborted, lastStepIndex, stepCount };
      }
      return { outcome: OnboardingOutcome.Completed, shown, dismissReason: OnboardingDismissReason.Completed, lastStepIndex, stepCount };
    } finally {
      store.dispose();
    }
  }
  async _resolveTarget(targetWindow, targetId, cancellationToken, behavior) {
    if (cancellationToken.isCancellationRequested) {
      return void 0;
    }
    let element = findOnboardingTarget(targetWindow, targetId);
    if (element || behavior?.kind === "skip") {
      return element;
    }
    const timeoutMs = behavior?.kind === "wait" ? Math.max(0, behavior.timeoutMs) : TARGET_RESOLVE_TIMEOUT;
    const deadline = Date.now() + timeoutMs;
    while (!element && Date.now() < deadline && !cancellationToken.isCancellationRequested) {
      try {
        await timeout(TARGET_POLL_INTERVAL, cancellationToken);
      } catch (error) {
        if (cancellationToken.isCancellationRequested) {
          return void 0;
        }
        throw error;
      }
      element = findOnboardingTarget(targetWindow, targetId);
    }
    return element;
  }
  async _waitForTargetReady(targetWindow, target) {
    const animations = this._getActiveFiniteAnimations(target);
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((animation) => animation.finished.catch(() => void 0))),
        timeout(TARGET_ANIMATION_SETTLE_TIMEOUT)
      ]);
    }
    await new Promise((resolve) => targetWindow.requestAnimationFrame(() => resolve()));
  }
  _getActiveFiniteAnimations(target) {
    const animations = [];
    for (let element = target; element; element = element.parentElement) {
      for (const animation of element.getAnimations()) {
        if (animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity) {
          animations.push(animation);
        }
      }
    }
    return animations;
  }
  async _runStep(overlay, context, step, target, index, stepCount, canGoBack = index > 0, isLastStep = index === stepCount - 1) {
    const stepStore = new DisposableStore();
    let ended = false;
    let resolveStep;
    const result = new Promise((resolve) => resolveStep = resolve);
    const done = (end) => {
      if (ended) {
        return;
      }
      ended = true;
      stepStore.dispose();
      resolveStep(end);
    };
    stepStore.add(overlay.onDidClickNext((via) => done({ action: "next", via })));
    stepStore.add(overlay.onDidClickPrevious(() => done({ action: "back" })));
    stepStore.add(overlay.onDidSkip((reason) => done({ action: "skip", reason })));
    stepStore.add(context.onAbort(() => done({ action: "abort" })));
    const content = {
      title: step.title,
      description: step.description,
      stepIndex: index,
      stepCount,
      canGoBack,
      isLastStep
    };
    overlay.show(target, content, {
      placement: step.placement,
      allowTargetInteraction: step.allowTargetInteraction,
      advanceOnTargetClick: step.advanceOnTargetClick,
      hideNext: !!step.advanceWhen,
      targetOverlayVisible: step.openTarget,
      padding: step.padding
    });
    if (step.advanceWhen) {
      const keys = new Set(step.advanceWhen.keys());
      const advanceIfSatisfied = () => {
        if (this.contextKeyService.contextMatchesRules(step.advanceWhen)) {
          done({ action: "next", via: "condition" });
        }
      };
      stepStore.add(this.contextKeyService.onDidChangeContext((event) => {
        if (event.affectsSome(keys)) {
          advanceIfSatisfied();
        }
      }));
      advanceIfSatisfied();
    }
    if (step.openTarget && !ended) {
      try {
        await openOnboardingTarget(target);
      } catch (error) {
        onUnexpectedError(error);
      }
    }
    return result;
  }
};
SpotlightPresentation = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, IHostService),
  __decorateParam(2, IContextKeyService)
], SpotlightPresentation);
export {
  SpotlightPresentation
};
