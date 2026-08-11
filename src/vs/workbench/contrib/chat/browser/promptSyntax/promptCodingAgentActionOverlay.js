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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { OverlayWidgetPositionPreference } from "../../../../../editor/browser/editorBrowser.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { IRemoteCodingAgentsService } from "../../../remoteCodingAgents/common/remoteCodingAgentsService.js";
import { localize } from "../../../../../nls.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { PROMPT_LANGUAGE_ID } from "../../common/promptSyntax/promptTypes.js";
import { $ } from "../../../../../base/browser/dom.js";
import { IPromptsService } from "../../common/promptSyntax/service/promptsService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
let PromptCodingAgentActionOverlayWidget = class extends Disposable {
  constructor(_editor, _commandService, _contextKeyService, _remoteCodingAgentService, _promptsService) {
    super();
    this._editor = _editor;
    this._commandService = _commandService;
    this._contextKeyService = _contextKeyService;
    this._remoteCodingAgentService = _remoteCodingAgentService;
    this._promptsService = _promptsService;
    this._isVisible = false;
    this._domNode = $(".prompt-coding-agent-action-overlay");
    this._button = this._register(new Button(this._domNode, {
      supportIcons: true,
      title: localize("runPromptWithCodingAgent", "Run prompt file in a remote coding agent")
    }));
    this._button.element.style.background = "var(--vscode-button-background)";
    this._button.element.style.color = "var(--vscode-button-foreground)";
    this._button.label = localize("runWithCodingAgent.label", "{0} Delegate to Copilot coding agent", "$(cloud-upload)");
    this._register(this._button.onDidClick(async () => {
      await this._execute();
    }));
    this._register(this._contextKeyService.onDidChangeContext(() => {
      this._updateVisibility();
    }));
    this._register(this._editor.onDidChangeModel(() => {
      this._updateVisibility();
    }));
    this._register(this._editor.onDidLayoutChange(() => {
      if (this._isVisible) {
        this._editor.layoutOverlayWidget(this);
      }
    }));
    this._updateVisibility();
  }
  static {
    this.ID = "promptCodingAgentActionOverlay";
  }
  getId() {
    return PromptCodingAgentActionOverlayWidget.ID;
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    if (!this._isVisible) {
      return null;
    }
    return {
      preference: OverlayWidgetPositionPreference.BOTTOM_RIGHT_CORNER
    };
  }
  _updateVisibility() {
    const enableRemoteCodingAgentPromptFileOverlay = ChatContextKeys.enableRemoteCodingAgentPromptFileOverlay.getValue(this._contextKeyService);
    const hasRemoteCodingAgent = ChatContextKeys.hasRemoteCodingAgent.getValue(this._contextKeyService);
    const model = this._editor.getModel();
    const isPromptFile = model?.getLanguageId() === PROMPT_LANGUAGE_ID;
    const shouldBeVisible = !!(isPromptFile && enableRemoteCodingAgentPromptFileOverlay && hasRemoteCodingAgent);
    if (shouldBeVisible !== this._isVisible) {
      this._isVisible = shouldBeVisible;
      if (this._isVisible) {
        this._editor.addOverlayWidget(this);
      } else {
        this._editor.removeOverlayWidget(this);
      }
    }
  }
  async _execute() {
    const model = this._editor.getModel();
    if (!model) {
      return;
    }
    this._button.enabled = false;
    try {
      const promptContent = model.getValue();
      const promptName = await this._promptsService.getPromptSlashCommandName(model.uri, CancellationToken.None);
      const agents = this._remoteCodingAgentService.getAvailableAgents();
      const agent = agents[0];
      if (!agent) {
        return;
      }
      await this._commandService.executeCommand(agent.command, {
        userPrompt: promptName,
        summary: promptContent,
        source: "prompt"
      });
    } finally {
      this._button.enabled = true;
    }
  }
  dispose() {
    if (this._isVisible) {
      this._editor.removeOverlayWidget(this);
    }
    super.dispose();
  }
};
PromptCodingAgentActionOverlayWidget = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IRemoteCodingAgentsService),
  __decorateParam(4, IPromptsService)
], PromptCodingAgentActionOverlayWidget);
export {
  PromptCodingAgentActionOverlayWidget
};
