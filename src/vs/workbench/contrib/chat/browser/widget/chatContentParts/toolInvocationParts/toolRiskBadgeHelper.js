import { CancellationTokenSource } from "../../../../../../../base/common/cancellation.js";
import { renderAsPlaintext } from "../../../../../../../base/browser/markdownRenderer.js";
import { toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { ToolRiskLevel } from "../../../tools/chatToolRiskAssessmentService.js";
import { ToolRiskBadgeWidget } from "./toolRiskBadgeWidget.js";
function toolRiskLevelForSafety(safety) {
  const normalized = Math.max(0, Math.min(1, safety));
  if (normalized >= 2 / 3) {
    return ToolRiskLevel.Green;
  }
  if (normalized >= 1 / 3) {
    return ToolRiskLevel.Orange;
  }
  return ToolRiskLevel.Red;
}
function createApprovalReasonBadge(store, instantiationService, reason) {
  if (!reason) {
    return void 0;
  }
  const widget = store.add(instantiationService.createInstance(ToolRiskBadgeWidget));
  if (reason.status === "loading") {
    widget.setLoading();
  } else {
    widget.setAssessment({
      risk: toolRiskLevelForSafety(reason.safety),
      explanation: typeof reason.explanation === "string" ? reason.explanation : renderAsPlaintext(reason.explanation)
    });
  }
  return widget;
}
function createToolRiskBadge(store, instantiationService, riskAssessmentService, languageModelToolsService, toolId, parameters, kind) {
  if (!riskAssessmentService.isEnabled()) {
    return void 0;
  }
  const tool = languageModelToolsService.getTool(toolId);
  if (!tool) {
    return void 0;
  }
  const widget = store.add(instantiationService.createInstance(ToolRiskBadgeWidget));
  const cached = riskAssessmentService.getCached(tool, parameters, kind);
  if (cached) {
    widget.setAssessment(cached);
    return widget;
  }
  widget.setLoading();
  const cts = new CancellationTokenSource();
  store.add(toDisposable(() => cts.dispose(true)));
  (async () => {
    try {
      const result = await riskAssessmentService.assess(tool, parameters, cts.token, kind);
      if (cts.token.isCancellationRequested || widget.isDisposed) {
        return;
      }
      if (!result) {
        widget.setHidden();
        return;
      }
      widget.setAssessment(result);
    } catch {
      if (!widget.isDisposed) {
        widget.setHidden();
      }
    }
  })();
  return widget;
}
export {
  createApprovalReasonBadge,
  createToolRiskBadge,
  toolRiskLevelForSafety
};
