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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { overviewRulerInfo } from "../../../../editor/common/core/editorColorRegistry.js";
import { OverviewRulerLane } from "../../../../editor/common/model.js";
import { themeColorFromId } from "../../../../platform/theme/common/themeService.js";
import { registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { localize } from "../../../../nls.js";
import { AgentFeedbackState, IAgentFeedbackService } from "./agentFeedbackService.js";
const overviewRulerAgentFeedbackForeground = registerColor(
  "editorOverviewRuler.agentFeedbackForeground",
  overviewRulerInfo,
  localize("editorOverviewRuler.agentFeedbackForeground", "Editor overview ruler decoration color for agent feedback. This color should be opaque.")
);
let AgentFeedbackOverviewRulerContribution = class extends Disposable {
  constructor(_editor, _agentFeedbackService) {
    super();
    this._editor = _editor;
    this._agentFeedbackService = _agentFeedbackService;
    this._decorations = this._editor.createDecorationsCollection();
    this._store.add(this._agentFeedbackService.onDidChangeFeedback(() => this._updateDecorations()));
    this._store.add(this._agentFeedbackService.onDidChangeFeedbackScope(() => {
      this._resolveSession();
      this._updateDecorations();
    }));
    this._store.add(this._editor.onDidChangeModel(() => {
      this._resolveSession();
      this._updateDecorations();
    }));
    this._resolveSession();
    this._updateDecorations();
  }
  static {
    this.ID = "agentFeedback.overviewRulerContribution";
  }
  _resolveSession() {
    const model = this._editor.getModel();
    if (!model) {
      this._sessionResource = void 0;
      return;
    }
    this._sessionResource = this._agentFeedbackService.getFeedbackSessionResource(model.uri);
  }
  _updateDecorations() {
    if (!this._sessionResource) {
      this._decorations.clear();
      return;
    }
    const model = this._editor.getModel();
    if (!model) {
      this._decorations.clear();
      return;
    }
    const feedbackItems = this._agentFeedbackService.getFeedback(this._sessionResource);
    const modelUri = model.uri.toString();
    this._decorations.set(
      feedbackItems.filter((item) => item.resourceUri.toString() === modelUri && item.state !== AgentFeedbackState.Resolved).map((item) => ({
        range: item.range,
        options: {
          description: "agent-feedback-overview-ruler",
          overviewRuler: {
            color: themeColorFromId(overviewRulerAgentFeedbackForeground),
            position: OverviewRulerLane.Center
          }
        }
      }))
    );
  }
  dispose() {
    this._decorations.clear();
    super.dispose();
  }
};
AgentFeedbackOverviewRulerContribution = __decorateClass([
  __decorateParam(1, IAgentFeedbackService)
], AgentFeedbackOverviewRulerContribution);
registerEditorContribution(AgentFeedbackOverviewRulerContribution.ID, AgentFeedbackOverviewRulerContribution, EditorContributionInstantiation.Eventually);
export {
  AgentFeedbackOverviewRulerContribution
};
