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
import { append, DisposableResizeObserver, getWindow, h } from "../../../../../../../base/browser/dom.js";
import { HoverStyle } from "../../../../../../../base/browser/ui/hover/hover.js";
import { HoverPosition } from "../../../../../../../base/browser/ui/hover/hoverWidget.js";
import { Separator } from "../../../../../../../base/common/actions.js";
import { asArray } from "../../../../../../../base/common/arrays.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { ErrorNoTelemetry, onUnexpectedError } from "../../../../../../../base/common/errors.js";
import { createCommandUri, escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { toDisposable } from "../../../../../../../base/common/lifecycle.js";
import Severity from "../../../../../../../base/common/severity.js";
import { isObject } from "../../../../../../../base/common/types.js";
import { ILanguageService } from "../../../../../../../editor/common/languages/language.js";
import { localize } from "../../../../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../../../platform/dialogs/common/dialogs.js";
import { IHoverService } from "../../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../../platform/keybinding/common/keybinding.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../../platform/storage/common/storage.js";
import { IPreferencesService } from "../../../../../../services/preferences/common/preferences.js";
import { ITerminalChatService } from "../../../../../terminal/browser/terminal.js";
import { TerminalContribCommandId, TerminalContribSettingId } from "../../../../../terminal/terminalContribExports.js";
import { ChatContextKeys } from "../../../../common/actions/chatContextKeys.js";
import { migrateLegacyTerminalToolSpecificData } from "../../../../common/chat.js";
import { SessionType } from "../../../../common/chatSessionsService.js";
import { getChatSessionType } from "../../../../common/model/chatUri.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
import { ILanguageModelToolsService } from "../../../../common/tools/languageModelToolsService.js";
import { AcceptToolConfirmationActionId, SkipToolConfirmationActionId } from "../../../actions/chatToolActions.js";
import { IChatWidgetService } from "../../../chat.js";
import { IChatToolRiskAssessmentService } from "../../../tools/chatToolRiskAssessmentService.js";
import { ChatCustomConfirmationWidget } from "../chatConfirmationWidget.js";
import { ChatMarkdownContentPart } from "../chatMarkdownContentPart.js";
import { CodeBlockPart } from "../codeBlockPart.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import { createApprovalReasonBadge, createToolRiskBadge } from "./toolRiskBadgeHelper.js";
var TerminalToolConfirmationStorageKeys = /* @__PURE__ */ ((TerminalToolConfirmationStorageKeys2) => {
  TerminalToolConfirmationStorageKeys2["TerminalAutoApproveWarningAccepted"] = "chat.tools.terminal.autoApprove.warningAccepted";
  return TerminalToolConfirmationStorageKeys2;
})(TerminalToolConfirmationStorageKeys || {});
let ChatTerminalToolConfirmationSubPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, terminalData, context, renderer, editorPool, currentWidthDelegate, codeBlockStartIndex, instantiationService, dialogService, keybindingService, languageService, configurationService, contextKeyService, chatWidgetService, preferencesService, storageService, terminalChatService, hoverService, languageModelToolsService, riskAssessmentService) {
    super(toolInvocation);
    this.context = context;
    this.renderer = renderer;
    this.editorPool = editorPool;
    this.currentWidthDelegate = currentWidthDelegate;
    this.codeBlockStartIndex = codeBlockStartIndex;
    this.instantiationService = instantiationService;
    this.dialogService = dialogService;
    this.keybindingService = keybindingService;
    this.languageService = languageService;
    this.configurationService = configurationService;
    this.contextKeyService = contextKeyService;
    this.chatWidgetService = chatWidgetService;
    this.preferencesService = preferencesService;
    this.storageService = storageService;
    this.terminalChatService = terminalChatService;
    this.languageModelToolsService = languageModelToolsService;
    this.riskAssessmentService = riskAssessmentService;
    this.codeblocks = [];
    const state = toolInvocation.state.get();
    if (state.type !== IChatToolInvocation.StateKind.WaitingForConfirmation || !state.confirmationMessages?.title) {
      throw new Error("Confirmation messages are missing");
    }
    terminalData = migrateLegacyTerminalToolSpecificData(terminalData);
    const { title, message, disclaimer, terminalCustomActions } = state.confirmationMessages;
    const initialContent = terminalData.presentationOverrides?.commandLine ?? terminalData.confirmation?.commandLine ?? (terminalData.commandLine.toolEdited ?? terminalData.commandLine.original).trimStart();
    const cdPrefix = terminalData.confirmation?.cdPrefix ?? "";
    const isReadOnly = !!terminalData.presentationOverrides;
    const autoApproveEnabled = this.configurationService.getValue(TerminalContribSettingId.EnableAutoApprove) === true;
    let customActions = terminalCustomActions;
    const buildMoreActions = () => {
      if (!autoApproveEnabled) {
        return void 0;
      }
      const autoApproveWarningAccepted = this.storageService.getBoolean("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalAutoApproveWarningAccepted */, StorageScope.APPLICATION, false);
      const moreActions = [];
      if (!autoApproveWarningAccepted) {
        moreActions.push({
          label: localize("autoApprove.enable", "Enable Auto Approve..."),
          data: {
            type: "enable"
          }
        });
        moreActions.push(new Separator());
        if (customActions) {
          for (const action of customActions) {
            if (!(action instanceof Separator)) {
              action.disabled = true;
            }
          }
        }
      }
      if (customActions) {
        moreActions.push(...customActions);
      }
      return moreActions.length === 0 ? void 0 : moreActions;
    };
    const codeBlockRenderOptions = {
      hideToolbar: true,
      reserveWidth: 19,
      verticalPadding: 5,
      editorOptions: {
        wordWrap: "on",
        readOnly: isReadOnly,
        tabFocusMode: true,
        ariaLabel: typeof title === "string" ? title : title.value
      }
    };
    const languageId = this.languageService.getLanguageIdByLanguageName(terminalData.presentationOverrides?.language ?? terminalData.language ?? "sh") ?? "shellscript";
    const key = CodeBlockPart.poolKey(this.context.element.id, this.codeBlockStartIndex);
    const editor = this._register(this.editorPool.get(key));
    editor.object.render({
      codeBlockIndex: this.codeBlockStartIndex,
      element: this.context.element,
      languageId,
      text: initialContent,
      renderOptions: codeBlockRenderOptions,
      chatSessionResource: this.context.element.sessionResource
    }, this.currentWidthDelegate());
    const model = editor.object.editor.getModel();
    this.codeblocks.push({
      codeBlockIndex: this.codeBlockStartIndex,
      codemapperUri: void 0,
      elementId: this.context.element.id,
      focus: () => editor.object.focus(),
      ownerMarkdownPartId: this.codeblocksPartId,
      uri: model.uri,
      chatSessionResource: this.context.element.sessionResource
    });
    this._register(model.onDidChangeContent(() => {
      const currentValue = model.getValue();
      if (currentValue !== initialContent) {
        terminalData.commandLine.userEdited = cdPrefix + currentValue;
      } else {
        terminalData.commandLine.userEdited = void 0;
      }
    }));
    const elements = h(".chat-confirmation-message-terminal", [
      h(".chat-confirmation-message-terminal-editor@editor"),
      h(".chat-confirmation-message-terminal-disclaimer@disclaimer")
    ]);
    append(elements.editor, editor.object.element);
    const editorResizeObserver = this._register(new DisposableResizeObserver("ChatTerminalToolConfirmationSubPart.editor", (entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        editor.object.layout(width);
      }
    }, getWindow(this.context.container)));
    this._register(editorResizeObserver.observe(elements.editor));
    this._register(hoverService.setupDelayedHover(elements.editor, {
      content: message || "",
      style: HoverStyle.Pointer,
      position: { hoverPosition: HoverPosition.LEFT }
    }));
    const riskBadge = createApprovalReasonBadge(this._store, this.instantiationService, state.confirmationMessages.approvalReason) ?? createToolRiskBadge(this._store, this.instantiationService, this.riskAssessmentService, this.languageModelToolsService, this.toolInvocation.toolId, state.parameters, "terminal");
    const confirmWidget = this._register(this.instantiationService.createInstance(
      ChatCustomConfirmationWidget,
      this.context,
      {
        title,
        icon: Codicon.terminal,
        message: elements.root,
        footerBanner: riskBadge?.domNode,
        buttons: this._createButtons(buildMoreActions())
      }
    ));
    if (autoApproveEnabled && !customActions && terminalData.autoApproveRuleResolvable && getChatSessionType(this.context.element.sessionResource) === SessionType.AgentHostCopilot) {
      const commandForAnalysis = terminalData.commandLine.toolEdited ?? terminalData.commandLine.original;
      const analysisLanguage = terminalData.language === "powershell" ? "powershell" : "shellscript";
      this.terminalChatService.getAutoApproveActions(commandForAnalysis, analysisLanguage).then((actions) => {
        if (this._store.isDisposed || !actions?.length) {
          return;
        }
        if (toolInvocation.state.get().type !== IChatToolInvocation.StateKind.WaitingForConfirmation) {
          return;
        }
        customActions = actions;
        confirmWidget.updateButtons(this._createButtons(buildMoreActions()));
      }, onUnexpectedError);
    }
    const detailParts = [];
    if (terminalData.requestUnsandboxedExecution) {
      const reasonText = terminalData.requestUnsandboxedExecutionReason && terminalData.requestUnsandboxedExecutionReason.trim() || localize("chat.terminal.unsandboxedExecution.defaultReason", "The model did not provide a reason for requesting unsandboxed execution.");
      const inline = new MarkdownString(void 0, { supportThemeIcons: true });
      inline.appendMarkdown(`$(${Codicon.info.id}) `);
      inline.appendText(reasonText);
      detailParts.push({
        inline,
        hoverLabel: localize("chat.terminal.detail.sandboxInsufficient", "Sandbox insufficient:"),
        hoverBody: escapeMarkdownSyntaxTokens(reasonText),
        isTrusted: void 0
      });
    }
    if (terminalData.requestAllowNetwork) {
      const reasonText = terminalData.requestAllowNetworkReason && terminalData.requestAllowNetworkReason.trim() || localize("chat.terminal.allowNetwork.defaultReason", "The model did not provide a reason for requesting unrestricted network access in the sandbox.");
      const inline = new MarkdownString(void 0, { supportThemeIcons: true });
      inline.appendMarkdown(`$(${Codicon.info.id}) `);
      inline.appendText(reasonText);
      detailParts.push({
        inline,
        hoverLabel: localize("chat.terminal.detail.unrestrictedNetwork", "Unrestricted network access:"),
        hoverBody: escapeMarkdownSyntaxTokens(reasonText),
        isTrusted: void 0
      });
    }
    if (disclaimer) {
      const inline = typeof disclaimer === "string" ? new MarkdownString(disclaimer) : disclaimer;
      const hoverBody = inline.value.replace(/^\s*\$\([^)]+\)\s*/, "");
      detailParts.push({
        inline,
        hoverLabel: localize("chat.terminal.detail.approvalNeeded", "Approval needed:"),
        hoverBody,
        isTrusted: inline.isTrusted
      });
    }
    const renderInlineDisclaimers = () => {
      elements.disclaimer.replaceChildren();
      for (const part of detailParts) {
        this._appendMarkdownPart(elements.disclaimer, part.inline, codeBlockRenderOptions);
      }
    };
    if (riskBadge && detailParts.length) {
      const combined = new MarkdownString(void 0, {
        supportThemeIcons: true,
        isTrusted: detailParts.reduce((acc, part) => {
          if (part.isTrusted === true || acc === true) {
            return true;
          }
          if (typeof part.isTrusted === "object" && part.isTrusted) {
            const enabled = /* @__PURE__ */ new Set([
              ...typeof acc === "object" && acc?.enabledCommands ? acc.enabledCommands : [],
              ...part.isTrusted.enabledCommands
            ]);
            return { enabledCommands: [...enabled] };
          }
          return acc;
        }, void 0)
      });
      detailParts.forEach((part, i) => {
        if (i > 0) {
          combined.appendMarkdown("\n\n");
        }
        combined.appendMarkdown(`**${escapeMarkdownSyntaxTokens(part.hoverLabel)}** ${part.hoverBody}`);
      });
      riskBadge.setDetails(combined);
      this._register(riskBadge.onDidHide(() => renderInlineDisclaimers()));
    } else {
      renderInlineDisclaimers();
    }
    const hasToolConfirmationKey = ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService);
    hasToolConfirmationKey.set(true);
    this._register(toDisposable(() => hasToolConfirmationKey.reset()));
    this._register(confirmWidget.onDidClick(async ({ button, isTouchClick }) => {
      let doComplete = true;
      const data = button.data;
      let toolConfirmKind = ToolConfirmKind.Denied;
      if (typeof data === "boolean") {
        if (data) {
          toolConfirmKind = ToolConfirmKind.UserAction;
          if (terminalData.autoApproveInfo) {
            terminalData.autoApproveInfo = void 0;
          }
        }
      } else if (typeof data !== "boolean") {
        switch (data.type) {
          case "enable": {
            const optedIn = await this._showAutoApproveWarning();
            if (optedIn) {
              this.storageService.store("chat.tools.terminal.autoApprove.warningAccepted" /* TerminalAutoApproveWarningAccepted */, true, StorageScope.APPLICATION, StorageTarget.USER);
              if (terminalData.autoApproveInfo) {
                toolConfirmKind = ToolConfirmKind.UserAction;
              } else {
                if (customActions) {
                  for (const action of customActions) {
                    if (!(action instanceof Separator)) {
                      action.disabled = false;
                    }
                  }
                }
                confirmWidget.updateButtons(this._createButtons(buildMoreActions()));
                doComplete = false;
              }
            } else {
              doComplete = false;
            }
            break;
          }
          case "skip": {
            toolConfirmKind = ToolConfirmKind.Skipped;
            break;
          }
          case "newRule": {
            let formatRuleLinks = function(rules, scope) {
              return rules.map((e) => {
                if (scope === "session") {
                  return `\`${e.key}\``;
                }
                const target = scope === "workspace" ? ConfigurationTarget.WORKSPACE : ConfigurationTarget.USER;
                const settingsUri = createCommandUri(TerminalContribCommandId.OpenTerminalSettingsLink, target);
                return `[\`${e.key}\`](${settingsUri.toString()} "${localize("ruleTooltip", "View rule in settings")}")`;
              }).join(", ");
            };
            const newRules = asArray(data.rule);
            const sessionRules = newRules.filter((r) => r.scope === "session");
            const workspaceRules = newRules.filter((r) => r.scope === "workspace");
            const userRules = newRules.filter((r) => r.scope === "user");
            const chatSessionResource = this.context.element.sessionResource;
            for (const rule of sessionRules) {
              this.terminalChatService.addSessionAutoApproveRule(chatSessionResource, rule.key, rule.value);
            }
            if (workspaceRules.length > 0) {
              const inspect = this.configurationService.inspect(TerminalContribSettingId.AutoApprove);
              const oldValue = inspect.workspaceValue ?? {};
              if (isObject(oldValue)) {
                const newValue = { ...oldValue };
                for (const rule of workspaceRules) {
                  newValue[rule.key] = rule.value;
                }
                await this.configurationService.updateValue(TerminalContribSettingId.AutoApprove, newValue, ConfigurationTarget.WORKSPACE);
              } else {
                this.preferencesService.openSettings({
                  jsonEditor: true,
                  target: ConfigurationTarget.WORKSPACE,
                  revealSetting: { key: TerminalContribSettingId.AutoApprove }
                });
                throw new ErrorNoTelemetry(`Cannot add new rule, existing workspace setting is unexpected format`);
              }
            }
            if (userRules.length > 0) {
              const inspect = this.configurationService.inspect(TerminalContribSettingId.AutoApprove);
              const oldValue = inspect.userValue ?? {};
              if (isObject(oldValue)) {
                const newValue = { ...oldValue };
                for (const rule of userRules) {
                  newValue[rule.key] = rule.value;
                }
                await this.configurationService.updateValue(TerminalContribSettingId.AutoApprove, newValue, ConfigurationTarget.USER);
              } else {
                this.preferencesService.openSettings({
                  jsonEditor: true,
                  target: ConfigurationTarget.USER,
                  revealSetting: { key: TerminalContribSettingId.AutoApprove }
                });
                throw new ErrorNoTelemetry(`Cannot add new rule, existing setting is unexpected format`);
              }
            }
            const mdTrustSettings = {
              isTrusted: {
                enabledCommands: [TerminalContribCommandId.OpenTerminalSettingsLink]
              }
            };
            const parts = [];
            if (sessionRules.length > 0) {
              parts.push(sessionRules.length === 1 ? localize("newRule.session", "Session auto approve rule {0} added", formatRuleLinks(sessionRules, "session")) : localize("newRule.session.plural", "Session auto approve rules {0} added", formatRuleLinks(sessionRules, "session")));
            }
            if (workspaceRules.length > 0) {
              parts.push(workspaceRules.length === 1 ? localize("newRule.workspace", "Workspace auto approve rule {0} added", formatRuleLinks(workspaceRules, "workspace")) : localize("newRule.workspace.plural", "Workspace auto approve rules {0} added", formatRuleLinks(workspaceRules, "workspace")));
            }
            if (userRules.length > 0) {
              parts.push(userRules.length === 1 ? localize("newRule.user", "User auto approve rule {0} added", formatRuleLinks(userRules, "user")) : localize("newRule.user.plural", "User auto approve rules {0} added", formatRuleLinks(userRules, "user")));
            }
            if (parts.length > 0) {
              terminalData.autoApproveInfo = new MarkdownString(parts.join(", "), mdTrustSettings);
            }
            toolConfirmKind = ToolConfirmKind.UserAction;
            break;
          }
          case "configure": {
            this.preferencesService.openSettings({
              target: ConfigurationTarget.USER,
              query: `@id:${TerminalContribSettingId.AutoApprove}`
            });
            doComplete = false;
            break;
          }
          case "sessionApproval": {
            const sessionResource = this.context.element.sessionResource;
            this.terminalChatService.setChatSessionAutoApproval(sessionResource, true);
            const disableUri = createCommandUri(TerminalContribCommandId.DisableSessionAutoApproval, sessionResource);
            const mdTrustSettings = {
              isTrusted: {
                enabledCommands: [TerminalContribCommandId.DisableSessionAutoApproval]
              }
            };
            terminalData.autoApproveInfo = new MarkdownString(`${localize("sessionApproval", "All commands will be auto approved for this session")} ([${localize("sessionApproval.disable", "Disable")}](${disableUri.toString()}))`, mdTrustSettings);
            toolConfirmKind = ToolConfirmKind.UserAction;
            break;
          }
        }
      }
      if (doComplete) {
        IChatToolInvocation.confirmWith(toolInvocation, { type: toolConfirmKind });
        if (!isTouchClick) {
          this.chatWidgetService.getWidgetBySessionResource(this.context.element.sessionResource)?.focusInput();
        }
      }
    }));
    this.domNode = confirmWidget.domNode;
  }
  _createButtons(moreActions) {
    const getLabelAndTooltip = (label, actionId, tooltipDetail = label) => {
      const tooltip = this.keybindingService.appendKeybinding(tooltipDetail, actionId);
      return { label, tooltip };
    };
    return [
      {
        ...getLabelAndTooltip(localize("tool.allow", "Allow"), AcceptToolConfirmationActionId),
        data: true,
        moreActions
      },
      {
        ...getLabelAndTooltip(localize("tool.skip", "Skip"), SkipToolConfirmationActionId, localize("skip.detail", "Proceed without executing this command")),
        data: { type: "skip" },
        isSecondary: true
      }
    ];
  }
  async _showAutoApproveWarning() {
    const promptResult = await this.dialogService.prompt({
      type: Severity.Info,
      message: localize("autoApprove.title", "Enable terminal auto approve?"),
      buttons: [{
        label: localize("autoApprove.button.enable", "Enable"),
        run: () => true
      }],
      cancelButton: true,
      custom: {
        icon: Codicon.shield,
        markdownDetails: [{
          markdown: new MarkdownString(localize("autoApprove.markdown", "This will enable a configurable subset of commands to run in the terminal autonomously. It provides *best effort protections* and assumes the agent is not acting maliciously."))
        }, {
          markdown: new MarkdownString(`[${localize("autoApprove.markdown2", "Learn more about the potential risks and how to avoid them.")}](https://code.visualstudio.com/docs/agents/run/security?referrer=in-product#_security-risks-to-be-aware-of)`)
        }]
      }
    });
    return promptResult.result === true;
  }
  _appendMarkdownPart(container, message, codeBlockRenderOptions) {
    const part = this._register(this.instantiationService.createInstance(
      ChatMarkdownContentPart,
      {
        kind: "markdownContent",
        content: typeof message === "string" ? new MarkdownString().appendMarkdown(message) : message
      },
      this.context,
      this.editorPool,
      false,
      this.codeBlockStartIndex,
      this.renderer,
      void 0,
      this.currentWidthDelegate(),
      { codeBlockRenderOptions }
    ));
    append(container, part.domNode);
  }
};
ChatTerminalToolConfirmationSubPart = __decorateClass([
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, ILanguageService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IContextKeyService),
  __decorateParam(13, IChatWidgetService),
  __decorateParam(14, IPreferencesService),
  __decorateParam(15, IStorageService),
  __decorateParam(16, ITerminalChatService),
  __decorateParam(17, IHoverService),
  __decorateParam(18, ILanguageModelToolsService),
  __decorateParam(19, IChatToolRiskAssessmentService)
], ChatTerminalToolConfirmationSubPart);
export {
  ChatTerminalToolConfirmationSubPart,
  TerminalToolConfirmationStorageKeys
};
