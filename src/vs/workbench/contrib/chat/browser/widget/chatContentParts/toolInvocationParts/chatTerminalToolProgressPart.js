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
import { h } from "../../../../../../../base/browser/dom.js";
import { createPixelSpinner } from "../../../../../../../base/browser/ui/pixelSpinner/pixelSpinner.js";
import { isMarkdownString, MarkdownString } from "../../../../../../../base/common/htmlContent.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { ChatConfiguration } from "../../../../common/constants.js";
import { migrateLegacyTerminalToolSpecificData } from "../../../../common/chat.js";
import { IChatToolInvocation, ToolConfirmKind } from "../../../../common/chatService/chatService.js";
import { IChatWidgetService } from "../../../chat.js";
import { ChatQueryTitlePart } from "../chatConfirmationWidget.js";
import { ChatMarkdownContentPart } from "../chatMarkdownContentPart.js";
import { ChatProgressSubPart } from "../chatProgressContentPart.js";
import { ChatResourceGroupWidget } from "../chatResourceGroupWidget.js";
import { BaseChatToolInvocationSubPart } from "./chatToolInvocationSubPart.js";
import { extractImagesFromToolInvocationOutputDetails } from "../../../../common/chatImageExtraction.js";
import { TerminalToolAutoExpand } from "./terminalToolAutoExpand.js";
import { ChatCollapsibleContentPart } from "../chatCollapsibleContentPart.js";
import { isResponseVM } from "../../../../common/model/chatViewModel.js";
import "../media/chatTerminalToolProgressPart.css";
import { Action } from "../../../../../../../base/common/actions.js";
import { ActionBar } from "../../../../../../../base/browser/ui/actionbar/actionbar.js";
import { timeout } from "../../../../../../../base/common/async.js";
import { ITerminalChatService, ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalService } from "../../../../../terminal/browser/terminal.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { Emitter, Event } from "../../../../../../../base/common/event.js";
import { autorun } from "../../../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { DecorationSelector, getTerminalCommandDecorationState, getTerminalCommandDecorationTooltip } from "../../../../../terminal/browser/xterm/decorationStyles.js";
import * as dom from "../../../../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../../../../base/common/keyCodes.js";
import { DomScrollableElement } from "../../../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ScrollbarVisibility } from "../../../../../../../base/common/scrollable.js";
import { localize } from "../../../../../../../nls.js";
import { TerminalCapability } from "../../../../../../../platform/terminal/common/capabilities/capabilities.js";
import { IHoverService } from "../../../../../../../platform/hover/browser/hover.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { stripIcons } from "../../../../../../../base/common/iconLabels.js";
import { IAccessibleViewService } from "../../../../../../../platform/accessibility/browser/accessibleView.js";
import { IContextKeyService } from "../../../../../../../platform/contextkey/common/contextkey.js";
import { AccessibilityVerbositySettingId } from "../../../../../accessibility/browser/accessibilityConfiguration.js";
import { ChatContextKeys } from "../../../../common/actions/chatContextKeys.js";
import { DetachedTerminalCommandMirror, DetachedTerminalSnapshotMirror } from "../../../../../terminal/browser/chatTerminalCommandMirror.js";
import { TerminalLocation } from "../../../../../../../platform/terminal/common/terminal.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { TerminalContribCommandId } from "../../../../../terminal/terminalContribExports.js";
import { ITelemetryService } from "../../../../../../../platform/telemetry/common/telemetry.js";
import { isNumber } from "../../../../../../../base/common/types.js";
import { removeAnsiEscapeCodes } from "../../../../../../../base/common/strings.js";
import { PANEL_BACKGROUND } from "../../../../../../common/theme.js";
import { editorBackground } from "../../../../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { CommandsRegistry } from "../../../../../../../platform/commands/common/commands.js";
const MIN_OUTPUT_ROWS = 1;
const MAX_OUTPUT_ROWS = 10;
const MAX_COMMAND_TITLE_LENGTH = 50;
const MAX_OUTPUT_POLL_RETRIES = 10;
const OUTPUT_POLL_DELAY_MS = 100;
const MIN_DATA_EVENTS_FOR_REAL_OUTPUT = 2;
const expandedStateByInvocation = /* @__PURE__ */ new WeakMap();
CommandsRegistry.registerCommand(TerminalContribCommandId.FocusChatInstanceAction, async (_accessor, progressPart) => {
  await progressPart?.focusTerminal();
});
CommandsRegistry.registerCommand(TerminalContribCommandId.ContinueInBackground, async (_accessor, progressPart) => {
  progressPart?.continueInBackground();
});
CommandsRegistry.registerCommand(TerminalContribCommandId.ToggleChatTerminalOutput, async (_accessor, progressPart) => {
  await progressPart?.toggleOutputFromAction();
});
let TerminalCommandDecoration = class extends Disposable {
  constructor(_options, _hoverService) {
    super();
    this._options = _options;
    this._hoverService = _hoverService;
    this._hoverRegistered = false;
    const decorationElements = h("span.chat-terminal-command-decoration@decoration", { role: "img", tabIndex: 0 });
    this._element = decorationElements.decoration;
    this._register(createPixelSpinner(this._element));
    this._attachElementToContainer();
  }
  _attachElementToContainer() {
    const container = this._options.getCommandBlock();
    if (!container) {
      return;
    }
    const decoration = this._element;
    if (!decoration.isConnected || decoration.parentElement !== container) {
      const icon = this._options.getIconElement();
      if (icon && icon.parentElement === container) {
        icon.insertAdjacentElement("afterend", decoration);
      } else {
        container.insertBefore(decoration, container.firstElementChild ?? null);
      }
    }
    if (!this._hoverRegistered) {
      this._hoverRegistered = true;
      this._register(this._hoverService.setupDelayedHover(decoration, () => ({
        content: this._getHoverText()
      })));
    }
  }
  _getHoverText() {
    const command = this._options.getResolvedCommand();
    const { effectiveCommand, storedState } = this._getDecorationInput(command);
    return getTerminalCommandDecorationTooltip(effectiveCommand, storedState) || "";
  }
  update(command) {
    this._attachElementToContainer();
    const decoration = this._element;
    const resolvedCommand = command ?? this._options.getResolvedCommand();
    this._apply(decoration, resolvedCommand);
  }
  _apply(decoration, command) {
    const terminalData = this._options.terminalData;
    if (terminalData.isPty !== false && command) {
      const existingState = terminalData.terminalCommandState ?? {};
      terminalData.terminalCommandState = {
        ...existingState,
        exitCode: command.exitCode,
        timestamp: command.timestamp ?? existingState.timestamp,
        duration: command.duration ?? existingState.duration
      };
    } else if (terminalData.isPty !== false && !terminalData.terminalCommandState) {
      const now = Date.now();
      terminalData.terminalCommandState = { exitCode: void 0, timestamp: now };
    }
    const { effectiveCommand, storedState } = this._getDecorationInput(command);
    const decorationState = getTerminalCommandDecorationState(effectiveCommand, storedState);
    const tooltip = getTerminalCommandDecorationTooltip(effectiveCommand, storedState);
    const isRunning = this._options.getIsRunning();
    decoration.className = `chat-terminal-command-decoration ${DecorationSelector.CommandDecoration}`;
    if (isRunning) {
      const nonIconClasses = decorationState.classNames.filter((c) => c !== DecorationSelector.Codicon && !c.startsWith("codicon-"));
      decoration.classList.add("chat-terminal-running-spinner", ...nonIconClasses);
    } else {
      decoration.classList.add(DecorationSelector.Codicon, ...decorationState.classNames, ...ThemeIcon.asClassNameArray(decorationState.icon));
    }
    const isInteractive = !decoration.classList.contains(DecorationSelector.Default);
    decoration.tabIndex = isInteractive ? 0 : -1;
    if (isInteractive) {
      decoration.removeAttribute("aria-disabled");
    } else {
      decoration.setAttribute("aria-disabled", "true");
    }
    const hoverText = tooltip || decorationState.hoverMessage;
    if (hoverText) {
      decoration.setAttribute("aria-label", hoverText);
    } else {
      decoration.removeAttribute("aria-label");
    }
  }
  _getDecorationInput(command) {
    let storedState = this._options.terminalData.terminalCommandState;
    if (this._options.terminalData.isPty !== false) {
      return { effectiveCommand: command, storedState };
    }
    const exitCode = this._options.getExitCode();
    storedState = exitCode === void 0 ? storedState : { ...storedState, exitCode };
    return {
      effectiveCommand: command?.exitCode === void 0 && storedState?.exitCode !== void 0 ? void 0 : command,
      storedState
    };
  }
};
TerminalCommandDecoration = __decorateClass([
  __decorateParam(1, IHoverService)
], TerminalCommandDecoration);
let ChatTerminalToolProgressPart = class extends BaseChatToolInvocationSubPart {
  constructor(toolInvocation, terminalData, context, renderer, editorPool, currentWidthDelegate, codeBlockStartIndex, _instantiationService, _terminalChatService, _terminalService, _contextKeyService, _chatWidgetService, _configurationService, _terminalEditorService, _terminalGroupService, _telemetryService) {
    super(toolInvocation);
    this._instantiationService = _instantiationService;
    this._terminalChatService = _terminalChatService;
    this._terminalService = _terminalService;
    this._contextKeyService = _contextKeyService;
    this._chatWidgetService = _chatWidgetService;
    this._configurationService = _configurationService;
    this._terminalEditorService = _terminalEditorService;
    this._terminalGroupService = _terminalGroupService;
    this._telemetryService = _telemetryService;
    // Toolbar state that drives action visibility (replaces context keys to avoid
    // accumulating listeners on the shared IContextKeyService when many parts exist)
    this._toolbarHasInstance = false;
    this._toolbarCanContinueInBackground = false;
    this._toolbarHasOutput = false;
    this._toolbarIsHiddenTerminal = false;
    this._toolbarOutputExpanded = false;
    this._actionBarActions = new DisposableStore();
    this._outputSourceListener = this._register(new MutableDisposable());
    this._userToggledOutput = false;
    this._isInThinkingContainer = false;
    this._usesCollapsibleWrapper = false;
    this._elementIndex = context.elementIndex;
    this._contentIndex = context.contentIndex;
    this._sessionResource = context.element.sessionResource;
    this._forceExpandTerminalOutput = isResponseVM(context.element) && context.element.isTerminalCommand;
    terminalData = migrateLegacyTerminalToolSpecificData(terminalData);
    this._terminalData = terminalData;
    this._terminalCommandUri = terminalData.terminalCommandUri ? URI.revive(terminalData.terminalCommandUri) : void 0;
    this._isSerializedInvocation = toolInvocation.kind === "toolInvocationSerialized";
    const elements = h(".chat-terminal-content-part@container", [
      h(".chat-terminal-content-title@title", [
        h(".chat-terminal-command-block@commandBlock")
      ]),
      h(".chat-terminal-content-message@message")
    ]);
    this._titleElement = elements.title;
    const command = (terminalData.commandLine.forDisplay ?? terminalData.commandLine.userEdited ?? terminalData.commandLine.toolEdited ?? terminalData.commandLine.original).trimStart();
    this._commandText = command;
    this._terminalOutputContextKey = ChatContextKeys.inChatTerminalToolOutput.bindTo(this._contextKeyService);
    this._decoration = this._register(this._instantiationService.createInstance(TerminalCommandDecoration, {
      terminalData: this._terminalData,
      getCommandBlock: () => elements.commandBlock,
      getIconElement: () => void 0,
      getResolvedCommand: () => this._getResolvedCommand(),
      getIsRunning: () => this._isInvocationRunning(),
      getExitCode: () => this._outputSource?.exitCode
    }));
    const displayCommand = terminalData.presentationOverrides?.commandLine ?? command;
    const displayLanguage = terminalData.presentationOverrides?.language ?? terminalData.language;
    const titlePart = this._register(_instantiationService.createInstance(
      ChatQueryTitlePart,
      elements.commandBlock,
      new MarkdownString([
        `\`\`\`${displayLanguage}`,
        `${displayCommand.replaceAll("```", "\\`\\`\\`")}`,
        `\`\`\``
      ].join("\n"), { supportThemeIcons: true }),
      void 0
    ));
    this._register(titlePart.onDidChangeHeight(() => {
      this._decoration.update();
    }));
    this._outputView = this._register(this._instantiationService.createInstance(
      ChatTerminalToolOutputSection,
      () => this._ensureTerminalInstance(),
      () => this._getResolvedCommand(),
      () => this._outputSource,
      () => this._terminalData.terminalCommandOutput,
      () => this._commandText,
      () => this._terminalData.terminalTheme,
      () => this._isInvocationRunning(),
      !!this._terminalData.terminalToolSessionId
    ));
    if (this._terminalData.terminalToolSessionId || this._terminalData.terminalCommandOutput) {
      elements.container.append(this._outputView.domNode);
    }
    this._register(this._outputView.onDidFocus(() => this._handleOutputFocus()));
    this._register(this._outputView.onDidBlur((e) => this._handleOutputBlur(e)));
    this._register(toDisposable(() => this._handleDispose()));
    const actionBarEl = h(".chat-terminal-action-bar@actionBar");
    elements.title.append(actionBarEl.root);
    this._actionBar = this._register(new ActionBar(actionBarEl.actionBar));
    this._register(this._actionBarActions);
    let didInitializeTerminalActions = false;
    const initializeTerminalActionsOnce = () => {
      if (didInitializeTerminalActions || this._store.isDisposed) {
        return;
      }
      didInitializeTerminalActions = true;
      this._initializeTerminalActions();
    };
    initializeTerminalActionsOnce();
    this._terminalService.whenConnected.then(() => {
      initializeTerminalActionsOnce();
    });
    const terminalToolSessionId = this._terminalData.terminalToolSessionId;
    if (terminalToolSessionId) {
      if (this._terminalData.isPty === false) {
        this._attachOutputSource();
        this._register(this._terminalChatService.onDidRegisterOutputSource((sessionId) => {
          if (sessionId === terminalToolSessionId) {
            this._attachOutputSource();
          }
        }));
      }
      this._register(this._terminalChatService.onDidContinueInBackground((sessionId) => {
        if (sessionId === terminalToolSessionId) {
          this._terminalData.didContinueInBackground = true;
          this._toolbarCanContinueInBackground = false;
          this._updateToolbarActions();
        }
      }));
    }
    let pastTenseMessage;
    if (toolInvocation.pastTenseMessage) {
      pastTenseMessage = `${typeof toolInvocation.pastTenseMessage === "string" ? toolInvocation.pastTenseMessage : toolInvocation.pastTenseMessage.value}`;
    }
    const markdownContent = new MarkdownString(pastTenseMessage, {
      supportThemeIcons: true,
      isTrusted: isMarkdownString(toolInvocation.pastTenseMessage) ? toolInvocation.pastTenseMessage.isTrusted : false
    });
    const chatMarkdownContent = {
      kind: "markdownContent",
      content: markdownContent
    };
    const codeBlockRenderOptions = {
      hideToolbar: true,
      reserveWidth: 19,
      verticalPadding: 5,
      editorOptions: {
        wordWrap: "on"
      }
    };
    const markdownOptions = {
      codeBlockRenderOptions,
      accessibilityOptions: pastTenseMessage ? {
        statusMessage: localize("terminalToolCommand", "{0}", stripIcons(pastTenseMessage))
      } : void 0
    };
    this.markdownPart = this._register(_instantiationService.createInstance(ChatMarkdownContentPart, chatMarkdownContent, context, editorPool, false, codeBlockStartIndex, renderer, {}, currentWidthDelegate(), markdownOptions));
    elements.message.append(this.markdownPart.domNode);
    const progressPart = this._register(_instantiationService.createInstance(ChatProgressSubPart, elements.container, this.getIcon(), terminalData.autoApproveInfo));
    progressPart.domNode.classList.add("chat-terminal-progress-row");
    this._decoration.update();
    if (toolInvocation.kind === "toolInvocation") {
      this._register(autorun((reader) => {
        toolInvocation.state.read(reader);
        this._decoration.update();
      }));
    }
    const terminalToolsInThinking = this._configurationService.getValue(ChatConfiguration.TerminalToolsInThinking);
    const isSimpleTerminal = this._configurationService.getValue(ChatConfiguration.SimpleTerminalCollapsible);
    const requiresConfirmation = toolInvocation.kind === "toolInvocation" && IChatToolInvocation.getConfirmationMessages(toolInvocation);
    this._isInThinkingContainer = terminalToolsInThinking && !requiresConfirmation;
    this._usesCollapsibleWrapper = this._isInThinkingContainer || isSimpleTerminal;
    if (this._usesCollapsibleWrapper) {
      this.domNode = this._createCollapsibleWrapper(progressPart.domNode, displayCommand, toolInvocation, context);
    } else {
      this.domNode = progressPart.domNode;
    }
    this._renderImagePills(toolInvocation, context, elements.container);
    const hasStoredOutput = !!terminalData.terminalCommandOutput;
    const storedExpandedState = expandedStateByInvocation.get(toolInvocation);
    const hasStoredExpandedState = expandedStateByInvocation.has(toolInvocation);
    if (storedExpandedState || !hasStoredExpandedState && this._forceExpandTerminalOutput || this._isInThinkingContainer && IChatToolInvocation.isComplete(toolInvocation) && hasStoredOutput) {
      void this._toggleOutput(true);
    }
    this._register(this._terminalChatService.registerProgressPart(this));
  }
  get codeblocks() {
    return this.markdownPart?.codeblocks ?? [];
  }
  get elementIndex() {
    return this._elementIndex;
  }
  get contentIndex() {
    return this._contentIndex;
  }
  /**
   * Renders image attachment pills below the terminal output when the tool
   * result contains image data parts. For collapsible wrappers, the single
   * widget is reparented between inside/outside based on expanded state.
   */
  _renderImagePills(toolInvocation, context, innerContainer) {
    const renderImages = () => {
      const extracted = extractImagesFromToolInvocationOutputDetails(toolInvocation, context.element.sessionResource);
      const imageParts = extracted.map((img) => ({
        kind: "data",
        value: img.data.buffer,
        mimeType: img.mimeType,
        uri: img.uri
      }));
      if (imageParts.length === 0) {
        return;
      }
      const widget = this._register(this._instantiationService.createInstance(ChatResourceGroupWidget, imageParts));
      if (this._thinkingCollapsibleWrapper) {
        const wrapper = this._thinkingCollapsibleWrapper;
        const placeWidget = (expanded) => {
          if (expanded) {
            innerContainer.appendChild(widget.domNode);
          } else {
            wrapper.domNode.appendChild(widget.domNode);
          }
        };
        placeWidget(wrapper.expanded.get());
        this._register(autorun((reader) => {
          placeWidget(wrapper.expanded.read(reader));
        }));
      } else {
        innerContainer.appendChild(widget.domNode);
      }
    };
    if (toolInvocation.kind === "toolInvocationSerialized") {
      renderImages();
    } else {
      this._register(autorun((reader) => {
        const state = toolInvocation.state.read(reader);
        if (state.type === IChatToolInvocation.StateKind.Completed) {
          renderImages();
        }
      }));
    }
  }
  _createCollapsibleWrapper(contentElement, commandText, toolInvocation, context) {
    const truncatedCommand = commandText.length > MAX_COMMAND_TITLE_LENGTH ? commandText.substring(0, MAX_COMMAND_TITLE_LENGTH) + "..." : commandText;
    const toolInvocationComplete = IChatToolInvocation.isComplete(toolInvocation);
    const isRunningInBackground = toolInvocationComplete && this._isInvocationRunning();
    const isComplete = toolInvocationComplete && !isRunningInBackground;
    const isSkipped = IChatToolInvocation.executionConfirmedOrDenied(toolInvocation)?.type === ToolConfirmKind.Skipped;
    const autoExpandFailures = this._configurationService.getValue(ChatConfiguration.AutoExpandToolFailures);
    const hasError = autoExpandFailures && this._terminalData.terminalCommandState?.exitCode !== void 0 && this._terminalData.terminalCommandState.exitCode !== 0;
    const initialExpanded = !isComplete || hasError || this._forceExpandTerminalOutput;
    const wrapper = this._register(this._instantiationService.createInstance(
      ChatTerminalThinkingCollapsibleWrapper,
      truncatedCommand,
      this._terminalData.intention,
      this._terminalData.commandLine.isSandboxWrapped === true,
      contentElement,
      context,
      initialExpanded,
      isComplete,
      isSkipped,
      isRunningInBackground,
      this._terminalData.isPty === false ? void 0 : () => this.focusTerminal()
    ));
    this._thinkingCollapsibleWrapper = wrapper;
    let isFirstRun = true;
    this._register(autorun((r) => {
      const expanded = wrapper.expanded.read(r);
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      this._toggleOutput(expanded);
    }));
    return wrapper.domNode;
  }
  expandCollapsibleWrapper() {
    this._thinkingCollapsibleWrapper?.expand();
  }
  markCollapsibleWrapperComplete() {
    this._thinkingCollapsibleWrapper?.markComplete();
  }
  async _initializeTerminalActions() {
    if (this._store.isDisposed) {
      return;
    }
    const terminalToolSessionId = this._terminalData.terminalToolSessionId;
    if (!terminalToolSessionId) {
      this._updateToolbarContextKeys();
      return;
    }
    if (this._terminalData.isPty === false) {
      this._attachOutputSource();
      this._updateToolbarContextKeys(void 0, terminalToolSessionId);
      return;
    }
    const attachInstance = async (instance) => {
      if (this._store.isDisposed) {
        return;
      }
      if (!instance) {
        if (this._isSerializedInvocation) {
          this._clearCommandAssociation();
        }
        this._updateToolbarContextKeys(void 0, terminalToolSessionId);
        return;
      }
      const isNewInstance = this._terminalInstance !== instance;
      if (isNewInstance) {
        this._terminalInstance = instance;
        this._registerInstanceListener(instance);
      }
      this._updateToolbarContextKeys(instance, terminalToolSessionId);
    };
    const initialInstance = await this._terminalChatService.getTerminalInstanceByToolSessionId(terminalToolSessionId);
    await attachInstance(initialInstance);
    if (!initialInstance) {
      this._updateToolbarContextKeys(void 0, terminalToolSessionId);
    }
    if (this._store.isDisposed) {
      return;
    }
    if (!this._terminalSessionRegistration) {
      const listener = this._terminalChatService.onDidRegisterTerminalInstanceWithToolSession(async (instance) => {
        const registeredInstance = await this._terminalChatService.getTerminalInstanceByToolSessionId(terminalToolSessionId);
        if (instance !== registeredInstance) {
          return;
        }
        this._terminalSessionRegistration?.dispose();
        this._terminalSessionRegistration = void 0;
        await attachInstance(instance);
      });
      this._terminalSessionRegistration = this._store.add(listener);
    }
  }
  /**
   * Updates the scoped context keys that drive toolbar action visibility.
   * The ActionBar is rebuilt with the correct set of visible actions.
   */
  _updateToolbarContextKeys(terminalInstance, terminalToolSessionId) {
    if (this._store.isDisposed) {
      return;
    }
    const resolvedCommand = this._getResolvedCommand(terminalInstance);
    this._toolbarHasInstance = !!terminalInstance;
    if (terminalInstance && terminalToolSessionId) {
      this._toolbarIsHiddenTerminal = this._terminalChatService.isBackgroundTerminal(terminalToolSessionId);
    } else {
      this._toolbarIsHiddenTerminal = false;
    }
    if (terminalInstance && terminalToolSessionId && !this._terminalData.isBackground && !this._terminalData.didContinueInBackground) {
      const isStillRunning = resolvedCommand?.exitCode === void 0 && this._terminalData.terminalCommandState?.exitCode === void 0;
      this._toolbarCanContinueInBackground = isStillRunning;
    } else {
      this._toolbarCanContinueInBackground = false;
    }
    if (!this._usesCollapsibleWrapper) {
      const hasSnapshot = !!this._terminalData.terminalCommandOutput || !!this._outputSource?.output;
      const hasOutput = !!resolvedCommand || hasSnapshot;
      this._toolbarHasOutput = hasOutput;
      if (hasOutput && !this._outputView.isExpanded) {
        const autoExpandFailures = this._configurationService.getValue(ChatConfiguration.AutoExpandToolFailures);
        const exitCode = resolvedCommand?.exitCode ?? this._outputSource?.exitCode ?? this._terminalData.terminalCommandState?.exitCode;
        if (exitCode !== void 0 && exitCode !== 0 && autoExpandFailures) {
          this._toggleOutput(true);
        }
      }
    }
    this._updateToolbarActions();
    this._decoration.update(resolvedCommand);
  }
  /**
   * Rebuilds the ActionBar actions based on current toolbar state.
   */
  _updateToolbarActions() {
    if (!this._actionBar || this._store.isDisposed) {
      return;
    }
    this._actionBar.clear();
    this._actionBarActions.clear();
    const actions = [];
    if (this._toolbarCanContinueInBackground) {
      const action = new Action(
        TerminalContribCommandId.ContinueInBackground,
        localize("continueInBackground", "Continue in Background"),
        ThemeIcon.asClassName(Codicon.debugContinueSmall),
        true,
        () => this.continueInBackground()
      );
      this._actionBarActions.add(action);
      actions.push(action);
    }
    if (this._toolbarHasInstance) {
      const focusLabel = this._toolbarIsHiddenTerminal ? localize("showTerminal", "Show and Focus Terminal") : localize("focusTerminal", "Focus Terminal");
      const action = new Action(
        TerminalContribCommandId.FocusChatInstanceAction,
        focusLabel,
        ThemeIcon.asClassName(Codicon.openInProduct),
        true,
        () => this.focusTerminal()
      );
      this._actionBarActions.add(action);
      actions.push(action);
    }
    if (this._toolbarHasOutput && !this._usesCollapsibleWrapper) {
      const toggleIcon = this._toolbarOutputExpanded ? Codicon.chevronDown : Codicon.chevronRight;
      const toggleLabel = this._toolbarOutputExpanded ? localize("hideTerminalOutput", "Hide Output") : localize("showTerminalOutput", "Show Output");
      const action = new Action(
        TerminalContribCommandId.ToggleChatTerminalOutput,
        toggleLabel,
        ThemeIcon.asClassName(toggleIcon),
        true,
        () => this.toggleOutputFromAction()
      );
      this._actionBarActions.add(action);
      actions.push(action);
    }
    this._actionBar.push(actions, { icon: true, label: false });
  }
  _getResolvedCommand(instance) {
    const target = instance ?? this._terminalInstance;
    if (!target) {
      return void 0;
    }
    return this._resolveCommand(target);
  }
  _isInvocationRunning() {
    const currentTerminalData = this.toolInvocation.toolSpecificData?.kind === "terminal" ? migrateLegacyTerminalToolSpecificData(this.toolInvocation.toolSpecificData) : this._terminalData;
    if (currentTerminalData.isPty === false) {
      if (this._outputSource?.exitCode !== void 0 || currentTerminalData.terminalCommandState?.exitCode !== void 0) {
        return false;
      }
      if (!IChatToolInvocation.isComplete(this.toolInvocation)) {
        return true;
      }
      return currentTerminalData.isBackground === true || currentTerminalData.didContinueInBackground === true;
    }
    const commandExitCode = this._getResolvedCommand()?.exitCode;
    if (commandExitCode !== void 0) {
      return false;
    }
    const storedExitCode = currentTerminalData.terminalCommandState?.exitCode;
    if (storedExitCode !== void 0) {
      return false;
    }
    if (!IChatToolInvocation.isComplete(this.toolInvocation)) {
      return true;
    }
    return currentTerminalData.isBackground === true || currentTerminalData.didContinueInBackground === true;
  }
  _clearCommandAssociation(options) {
    this._terminalCommandUri = void 0;
    if (options?.clearPersistentData) {
      if (this._terminalData.terminalCommandUri) {
        delete this._terminalData.terminalCommandUri;
      }
      if (this._terminalData.terminalToolSessionId) {
        delete this._terminalData.terminalToolSessionId;
      }
    }
    this._decoration.update();
  }
  /**
   * Determines whether the terminal output should auto-expand.
   * Returns false if already expanded, user has manually toggled, component is disposed,
   * or if the invocation was previously expanded (to preserve state across re-renders).
   */
  _shouldAutoExpand() {
    return !this._outputView.isExpanded && !this._userToggledOutput && !this._store.isDisposed && (!this._forceExpandTerminalOutput || !expandedStateByInvocation.has(this.toolInvocation)) && !expandedStateByInvocation.get(this.toolInvocation);
  }
  /**
   * Registers event listeners on the terminal instance to track command execution,
   * manage auto-expansion of output, and handle command completion.
   *
   * This method sets up:
   * - Command detection listeners for tracking command lifecycle
   * - Auto-expand logic based on command output and duration
   * - Instance disposal handling to clean up actions and state
   */
  _registerInstanceListener(terminalInstance) {
    const commandDetectionListener = this._register(new MutableDisposable());
    const tryResolveCommand = async () => {
      const resolvedCommand = this._resolveCommand(terminalInstance);
      this._updateToolbarContextKeys(terminalInstance, this._terminalData.terminalToolSessionId);
      return resolvedCommand;
    };
    const attachCommandDetection = async (commandDetection) => {
      commandDetectionListener.clear();
      if (!commandDetection) {
        const ahpSource = this._terminalData.terminalToolSessionId ? this._terminalChatService.getAhpCommandSource(this._terminalData.terminalToolSessionId) : void 0;
        if (ahpSource) {
          this._attachAhpCommandSource(terminalInstance, ahpSource, commandDetectionListener);
        }
        await tryResolveCommand();
        return;
      }
      const store = new DisposableStore();
      let receivedDataCount = 0;
      const hasRealOutput = () => {
        if (this._terminalData.terminalCommandOutput?.text?.trim()) {
          return true;
        }
        const command = this._getResolvedCommand(terminalInstance);
        if (!command?.executedMarker || terminalInstance.isDisposed) {
          return false;
        }
        const buffer = terminalInstance.xterm?.raw.buffer.active;
        if (!buffer) {
          return false;
        }
        const cursorLine = buffer.baseY + buffer.cursorY;
        if (cursorLine > command.executedMarker.line) {
          return true;
        }
        return receivedDataCount > MIN_DATA_EVENTS_FOR_REAL_OUTPUT;
      };
      const autoExpand = store.add(new TerminalToolAutoExpand({
        onCommandExecuted: Event.map(commandDetection.onCommandExecuted, () => void 0),
        onCommandFinished: Event.map(commandDetection.onCommandFinished, () => void 0),
        onWillData: terminalInstance.onWillData,
        shouldAutoExpand: () => this._shouldAutoExpand(),
        hasRealOutput
      }));
      store.add(autoExpand.onDidRequestExpand(() => {
        if (this._usesCollapsibleWrapper) {
          this.expandCollapsibleWrapper();
        }
        this._toggleOutput(true);
      }));
      store.add(terminalInstance.onWillData(() => {
        receivedDataCount++;
      }));
      store.add(commandDetection.onCommandExecuted(() => {
        this._updateToolbarContextKeys(terminalInstance, this._terminalData.terminalToolSessionId);
      }));
      store.add(commandDetection.onCommandFinished(() => {
        this._updateToolbarContextKeys(terminalInstance, this._terminalData.terminalToolSessionId);
        const resolvedCommand = this._getResolvedCommand(terminalInstance);
        this._handleCommandCompletion(resolvedCommand);
        if (resolvedCommand?.endMarker) {
          commandDetectionListener.clear();
        }
      }));
      commandDetectionListener.value = store;
      const resolvedImmediately = await tryResolveCommand();
      if (resolvedImmediately?.endMarker) {
        commandDetectionListener.clear();
        this._handleCommandCompletion(resolvedImmediately);
        return;
      }
    };
    attachCommandDetection(terminalInstance.capabilities.get(TerminalCapability.CommandDetection));
    this._register(terminalInstance.capabilities.onDidAddCommandDetectionCapability((cd) => attachCommandDetection(cd)));
    const instanceListener = this._register(terminalInstance.onDisposed(() => {
      if (this._terminalInstance === terminalInstance) {
        this._terminalInstance = void 0;
      }
      this._clearCommandAssociation({ clearPersistentData: true });
      commandDetectionListener.clear();
      this._updateToolbarContextKeys(void 0, this._terminalData.terminalToolSessionId);
      instanceListener.dispose();
    }));
  }
  /**
   * Sets up listeners using an {@link IAhpTerminalCommandSource} when no local
   * `ICommandDetectionCapability` is available. Provides auto-expand, toolbar
   * context key updates, and command completion handling.
   */
  _attachAhpCommandSource(terminalInstance, ahpSource, commandDetectionListener) {
    const store = new DisposableStore();
    const hasRealOutput = () => {
      const command = this._getResolvedCommand(terminalInstance);
      if (command?.hasOutput()) {
        return true;
      }
      return !!this._terminalData.terminalCommandOutput?.text?.trim();
    };
    const autoExpand = store.add(new TerminalToolAutoExpand({
      onCommandExecuted: Event.map(ahpSource.onCommandExecuted, () => void 0),
      onCommandFinished: Event.map(ahpSource.onCommandFinished, () => void 0),
      onWillData: terminalInstance.onWillData,
      shouldAutoExpand: () => this._shouldAutoExpand(),
      hasRealOutput
    }));
    store.add(autoExpand.onDidRequestExpand(() => {
      if (this._usesCollapsibleWrapper) {
        this.expandCollapsibleWrapper();
      }
      this._toggleOutput(true);
    }));
    store.add(ahpSource.onCommandExecuted((cmd) => {
      if (!this._terminalData.terminalCommandId && cmd.id) {
        this._terminalData.terminalCommandId = cmd.id;
        this._updateToolbarContextKeys(terminalInstance, this._terminalData.terminalToolSessionId);
      }
      if (this._outputView.isExpanded) {
        void this._toggleOutput(true);
      }
    }));
    store.add(ahpSource.onCommandFinished((cmd) => {
      if (this._terminalData.terminalCommandId === cmd.id) {
        this._updateToolbarContextKeys(terminalInstance, this._terminalData.terminalToolSessionId);
        const resolvedCommand2 = this._getResolvedCommand(terminalInstance);
        this._handleCommandCompletion(resolvedCommand2);
      }
    }));
    commandDetectionListener.value = store;
    const resolvedCommand = this._resolveCommand(terminalInstance);
    if (resolvedCommand?.endMarker) {
      this._handleCommandCompletion(resolvedCommand);
    }
  }
  /**
   * Handles the completion of a terminal command by updating the UI state.
   * This includes marking the collapsible wrapper as complete, auto-collapsing
   * successful commands, and keeping failed commands expanded.
   *
   * @param resolvedCommand The completed terminal command with exit code information.
   */
  _handleCommandCompletion(resolvedCommand) {
    this.markCollapsibleWrapperComplete();
    if (resolvedCommand?.exitCode === 0 && this._outputView.isExpanded && !this._userToggledOutput && !this._forceExpandTerminalOutput) {
      this._toggleOutput(false);
    }
    const autoExpandFailures = this._configurationService.getValue(ChatConfiguration.AutoExpandToolFailures);
    if (autoExpandFailures && resolvedCommand?.exitCode !== void 0 && resolvedCommand.exitCode !== 0 && this._thinkingCollapsibleWrapper) {
      this.expandCollapsibleWrapper();
    }
  }
  async _toggleOutput(expanded) {
    const didChange = await this._outputView.toggle(expanded);
    const isExpanded = this._outputView.isExpanded;
    const hasOutputSection = !!this._outputView.domNode.parentElement;
    this._titleElement.classList.toggle("chat-terminal-content-title-no-bottom-radius", isExpanded && hasOutputSection);
    this._toolbarOutputExpanded = isExpanded;
    this._updateToolbarActions();
    if (didChange) {
      expandedStateByInvocation.set(this.toolInvocation, isExpanded);
    }
    return didChange;
  }
  async _ensureTerminalInstance() {
    if (this._terminalData.isPty === false) {
      return void 0;
    }
    if (this._terminalInstance?.isDisposed) {
      this._terminalInstance = void 0;
    }
    if (!this._terminalInstance && this._terminalData.terminalToolSessionId) {
      this._terminalInstance = await this._terminalChatService.getTerminalInstanceByToolSessionId(this._terminalData.terminalToolSessionId);
      if (this._terminalInstance?.isDisposed) {
        this._terminalInstance = void 0;
      }
    }
    return this._terminalInstance;
  }
  _attachOutputSource() {
    const source = this._terminalChatService.getOutputSource(this._terminalData.terminalToolSessionId);
    if (!source || source === this._outputSource) {
      return;
    }
    this._outputSource = source;
    const store = new DisposableStore();
    const onCommandExecuted = store.add(new Emitter());
    const onCommandFinished = store.add(new Emitter());
    const autoExpand = store.add(new TerminalToolAutoExpand({
      onCommandExecuted: onCommandExecuted.event,
      onCommandFinished: onCommandFinished.event,
      onWillData: source.onDidChange,
      shouldAutoExpand: () => this._shouldAutoExpand(),
      hasRealOutput: () => !!source.output
    }));
    store.add(autoExpand.onDidRequestExpand(() => {
      if (this._usesCollapsibleWrapper) {
        this.expandCollapsibleWrapper();
      }
      void this._toggleOutput(true);
    }));
    store.add(source.onDidChange(() => {
      this._decoration.update();
      this._updateToolbarContextKeys(void 0, this._terminalData.terminalToolSessionId);
      void this._outputView.refresh();
      if (source.exitCode !== void 0) {
        onCommandFinished.fire();
        this.markCollapsibleWrapperComplete();
      }
    }));
    this._outputSourceListener.value = store;
    onCommandExecuted.fire();
    if (source.exitCode !== void 0) {
      onCommandFinished.fire();
    }
    this._decoration.update();
    this._updateToolbarContextKeys(void 0, this._terminalData.terminalToolSessionId);
    void this._outputView.refresh();
  }
  _handleOutputFocus() {
    this._terminalOutputContextKey.set(true);
    this._terminalChatService.setFocusedProgressPart(this);
    this._outputView.updateAriaLabel();
  }
  _handleOutputBlur(event) {
    const nextTarget = event.relatedTarget;
    if (this._outputView.containsElement(nextTarget)) {
      return;
    }
    this._terminalOutputContextKey.reset();
    this._terminalChatService.clearFocusedProgressPart(this);
  }
  _handleDispose() {
    this._terminalOutputContextKey.reset();
    this._terminalChatService.clearFocusedProgressPart(this);
  }
  getCommandAndOutputAsText() {
    return this._outputView.getCommandAndOutputAsText();
  }
  focusOutput() {
    this._outputView.focus();
  }
  _focusChatInput() {
    const widget = this._chatWidgetService.getWidgetBySessionResource(this._sessionResource);
    widget?.focusInput();
  }
  async focusTerminal() {
    if (this._terminalData.isPty === false) {
      return;
    }
    const instance = await this._ensureTerminalInstance();
    let target = "none";
    let location = "panel";
    if (instance) {
      target = "instance";
      location = instance.target === TerminalLocation.Editor ? "editor" : "panel";
    } else if (this._terminalCommandUri) {
      target = "commandUri";
    }
    this._telemetryService.publicLog2("terminal/chatFocusInstance", { target, location });
    if (instance) {
      this._terminalService.setActiveInstance(instance);
      if (instance.target === TerminalLocation.Editor) {
        this._terminalEditorService.openEditor(instance);
      } else {
        await this._terminalGroupService.showPanel(true);
      }
      this._terminalService.setActiveInstance(instance);
      await instance.focusWhenReady(true);
      const command = this._getResolvedCommand(instance);
      if (command) {
        instance.xterm?.markTracker.revealCommand(command);
      }
      return;
    }
    if (this._terminalCommandUri) {
      this._terminalService.openResource(this._terminalCommandUri);
    }
  }
  continueInBackground() {
    const sessionId = this._terminalData.terminalToolSessionId;
    if (sessionId) {
      this._terminalChatService.continueInBackground(sessionId);
    }
  }
  async toggleOutputFromAction() {
    this._userToggledOutput = true;
    this._telemetryService.publicLog2("terminal/chatToggleOutput", {
      previousExpanded: this._outputView.isExpanded
    });
    if (!this._outputView.isExpanded) {
      await this._toggleOutput(true);
      return;
    }
    await this._toggleOutput(false);
  }
  async toggleOutputFromKeyboard() {
    this._userToggledOutput = true;
    if (!this._outputView.isExpanded) {
      await this._toggleOutput(true);
      this.focusOutput();
      return;
    }
    await this._collapseOutputAndFocusInput();
  }
  async _collapseOutputAndFocusInput() {
    if (this._outputView.isExpanded) {
      await this._toggleOutput(false);
    }
    this._focusChatInput();
  }
  _resolveCommand(instance) {
    if (instance.isDisposed) {
      return void 0;
    }
    const targetId = this._terminalData.terminalCommandId;
    const commandDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
    if (commandDetection && targetId) {
      const commands = commandDetection.commands;
      if (commands && commands.length > 0) {
        const fromHistory = commands.find((c) => c.id === targetId);
        if (fromHistory) {
          return fromHistory;
        }
      }
      const executing = commandDetection.executingCommandObject;
      if (executing && executing.id === targetId) {
        return executing;
      }
    }
    const sessionId = this._terminalData.terminalToolSessionId;
    if (sessionId) {
      const ahpSource = this._terminalChatService.getAhpCommandSource(sessionId);
      if (ahpSource) {
        if (targetId) {
          return ahpSource.getCommandById(targetId);
        }
        return ahpSource.executingCommandObject ?? ahpSource.commands[ahpSource.commands.length - 1];
      }
    }
    return void 0;
  }
};
ChatTerminalToolProgressPart = __decorateClass([
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, ITerminalChatService),
  __decorateParam(9, ITerminalService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IChatWidgetService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, ITerminalEditorService),
  __decorateParam(14, ITerminalGroupService),
  __decorateParam(15, ITelemetryService)
], ChatTerminalToolProgressPart);
let ChatTerminalToolOutputSection = class extends Disposable {
  constructor(_ensureTerminalInstance, _resolveCommand, _getOutputSource, _getTerminalCommandOutput, _getCommandText, _getStoredTheme, _isInvocationRunning, _hasTerminalSession, _accessibleViewService, _instantiationService, _terminalConfigurationService, _themeService, _contextKeyService) {
    super();
    this._ensureTerminalInstance = _ensureTerminalInstance;
    this._resolveCommand = _resolveCommand;
    this._getOutputSource = _getOutputSource;
    this._getTerminalCommandOutput = _getTerminalCommandOutput;
    this._getCommandText = _getCommandText;
    this._getStoredTheme = _getStoredTheme;
    this._isInvocationRunning = _isInvocationRunning;
    this._hasTerminalSession = _hasTerminalSession;
    this._accessibleViewService = _accessibleViewService;
    this._instantiationService = _instantiationService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._themeService = _themeService;
    this._contextKeyService = _contextKeyService;
    this._isAtBottom = true;
    this._isProgrammaticScroll = false;
    this._onDidFocusEmitter = this._register(new Emitter());
    this._onDidBlurEmitter = this._register(new Emitter());
    const containerElements = h(".chat-terminal-output-container@container", [
      h(".chat-terminal-output-body@body", [
        h(".chat-terminal-output-content@content", [
          h(".chat-terminal-output-terminal@terminal"),
          h(".chat-terminal-output-empty@empty")
        ])
      ])
    ]);
    this.domNode = containerElements.container;
    this.domNode.classList.add("collapsed");
    this._outputBody = containerElements.body;
    this._contentContainer = containerElements.content;
    this._terminalContainer = containerElements.terminal;
    this._emptyElement = containerElements.empty;
    this._contentContainer.appendChild(this._emptyElement);
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.FOCUS_IN, () => this._onDidFocusEmitter.fire()));
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.FOCUS_OUT, (event) => this._onDidBlurEmitter.fire(event)));
    const resizeObserver = this._register(new dom.DisposableResizeObserver("ChatTerminalToolProgressPart.handleResize", () => this._handleResize()));
    this._register(resizeObserver.observe(this.domNode));
    this._applyBackgroundColor();
    this._register(this._themeService.onDidColorThemeChange(() => this._applyBackgroundColor()));
  }
  get isExpanded() {
    return this.domNode.classList.contains("expanded");
  }
  get onDidFocus() {
    return this._onDidFocusEmitter.event;
  }
  get onDidBlur() {
    return this._onDidBlurEmitter.event;
  }
  async toggle(expanded) {
    const currentlyExpanded = this.isExpanded;
    if (expanded === currentlyExpanded) {
      if (expanded) {
        await this._updateTerminalContent();
      }
      return false;
    }
    if (!expanded) {
      this._setExpanded(false);
      this._isAtBottom = true;
      return true;
    }
    if (!this._scrollableContainer) {
      await this._createScrollableContainer();
    }
    await this._updateTerminalContent();
    this._setExpanded(true);
    await this._layoutMirrorWidth();
    this._layoutOutput();
    this._scrollOutputToBottom();
    this._scheduleOutputRelayout();
    return true;
  }
  async refresh() {
    if (this.isExpanded) {
      await this._updateTerminalContent();
    }
  }
  focus() {
    this._scrollableContainer?.getDomNode().focus();
  }
  containsElement(element) {
    return !!element && this.domNode.contains(element);
  }
  updateAriaLabel() {
    if (!this._scrollableContainer) {
      return;
    }
    const command = this._resolveCommand();
    const commandText = command?.command ?? this._getCommandText();
    if (!commandText) {
      return;
    }
    const ariaLabel = localize("chatTerminalOutputAriaLabel", "Terminal output for {0}", commandText);
    const scrollableDomNode = this._scrollableContainer.getDomNode();
    scrollableDomNode.setAttribute("role", "region");
    const accessibleViewHint = this._accessibleViewService.getOpenAriaHint(AccessibilityVerbositySettingId.TerminalChatOutput);
    const label = accessibleViewHint ? ariaLabel + ", " + accessibleViewHint : ariaLabel;
    scrollableDomNode.setAttribute("aria-label", label);
  }
  getCommandAndOutputAsText() {
    const command = this._resolveCommand();
    const commandText = command?.command ?? this._getCommandText();
    if (!commandText) {
      return void 0;
    }
    const commandHeader = localize("chatTerminalOutputAccessibleViewHeader", "Command: {0}", commandText);
    if (command) {
      const rawOutput = command.getOutput();
      if (!rawOutput || rawOutput.trim().length === 0) {
        return `${commandHeader}
${localize("chat.terminalOutputEmpty", "No output was produced by the command.")}`;
      }
      const lines = rawOutput.split("\n");
      return `${commandHeader}
${lines.join("\n").trimEnd()}`;
    }
    const source = this._getOutputSource();
    const snapshot = source ? { text: source.output } : this._getTerminalCommandOutput();
    if (!snapshot) {
      return `${commandHeader}
${localize("chatTerminalOutputUnavailable", "Command output is no longer available.")}`;
    }
    const plain = removeAnsiEscapeCodes(snapshot.text ?? "");
    if (!plain.trim().length) {
      return `${commandHeader}
${localize("chat.terminalOutputEmpty", "No output was produced by the command.")}`;
    }
    let outputText = plain.trimEnd();
    if (snapshot.truncated) {
      outputText += `
${localize("chatTerminalOutputTruncated", "Output truncated.")}`;
    }
    return `${commandHeader}
${outputText}`;
  }
  _setExpanded(expanded) {
    this.domNode.classList.toggle("expanded", expanded);
    this.domNode.classList.toggle("collapsed", !expanded);
  }
  async _createScrollableContainer() {
    this._scrollableContainer = this._register(new DomScrollableElement(this._outputBody, {
      vertical: ScrollbarVisibility.Hidden,
      horizontal: ScrollbarVisibility.Hidden,
      handleMouseWheel: true
    }));
    const scrollableDomNode = this._scrollableContainer.getDomNode();
    scrollableDomNode.tabIndex = 0;
    this.domNode.appendChild(scrollableDomNode);
    this.updateAriaLabel();
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.MOUSE_ENTER, () => {
      this._scrollableContainer?.updateOptions({ horizontal: ScrollbarVisibility.Auto });
    }));
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.MOUSE_LEAVE, () => {
      this._scrollableContainer?.updateOptions({ horizontal: ScrollbarVisibility.Hidden });
    }));
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.FOCUS_IN, () => {
      this._scrollableContainer?.updateOptions({ horizontal: ScrollbarVisibility.Auto });
    }));
    this._register(dom.addDisposableListener(this.domNode, dom.EventType.FOCUS_OUT, () => {
      this._scrollableContainer?.updateOptions({ horizontal: ScrollbarVisibility.Hidden });
    }));
    this._register(this._scrollableContainer.onScroll(() => {
      if (this._isProgrammaticScroll) {
        return;
      }
      this._isAtBottom = this._computeIsAtBottom();
    }));
  }
  async _updateTerminalContent() {
    const outputSource = this._getOutputSource();
    if (outputSource) {
      this._disposeLiveMirror();
      if (outputSource.output) {
        await this._renderSnapshotOutput({ text: outputSource.output });
      } else if (outputSource.exitCode === void 0) {
        this._hideEmptyMessage();
        this._layoutOutput(0);
      } else {
        this._showEmptyMessage(localize("chat.terminalOutputEmpty", "No output was produced by the command."));
        this._layoutOutput(0);
      }
      return;
    }
    const liveTerminalInstance = await this._resolveLiveTerminal();
    const command = liveTerminalInstance ? this._resolveCommand() : void 0;
    const snapshot = this._getTerminalCommandOutput();
    if (liveTerminalInstance && command) {
      const handled = await this._renderLiveOutput(liveTerminalInstance, command);
      if (handled) {
        return;
      }
    }
    this._disposeLiveMirror();
    if (snapshot) {
      await this._renderSnapshotOutput(snapshot);
      return;
    }
    if (!this._hasTerminalSession) {
      return;
    }
    if (this._isInvocationRunning()) {
      this._hideEmptyMessage();
      this._layoutOutput(0);
      return;
    }
    this._renderUnavailableMessage(liveTerminalInstance);
  }
  async _renderLiveOutput(liveTerminalInstance, command) {
    if (this._mirror) {
      return true;
    }
    await liveTerminalInstance.xtermReadyPromise;
    if (this._store.isDisposed || liveTerminalInstance.isDisposed || !liveTerminalInstance.xterm) {
      this._disposeLiveMirror();
      return false;
    }
    const mirror = this._register(this._instantiationService.createInstance(DetachedTerminalCommandMirror, liveTerminalInstance.xterm, command));
    this._mirror = mirror;
    this._register(mirror.onDidChangeRowHeight(() => this._handleMirrorRowHeightChange()));
    this._register(mirror.onDidUpdate((result2) => {
      if (result2.lineCount && result2.lineCount > 0) {
        this._hideEmptyMessage();
      }
      this._layoutOutput(result2.lineCount);
      if (this._isAtBottom) {
        this._scrollOutputToBottom();
      }
    }));
    this._register(mirror.onDidInput((data) => {
      if (!liveTerminalInstance.isDisposed) {
        liveTerminalInstance.sendText(data, false);
      }
    }));
    await mirror.attach(this._terminalContainer);
    await this._layoutMirrorWidth(mirror);
    let result = await mirror.renderCommand();
    let commandFinished = !!command.endMarker;
    let hasOutput = result && result.lineCount && result.lineCount > 0;
    if (!hasOutput) {
      for (let retry = 0; retry < MAX_OUTPUT_POLL_RETRIES && !hasOutput; retry++) {
        await timeout(OUTPUT_POLL_DELAY_MS);
        if (this._store.isDisposed) {
          return true;
        }
        result = await mirror.renderCommand();
        hasOutput = result && result.lineCount && result.lineCount > 0;
        commandFinished = !!command.endMarker;
        if (commandFinished) {
          break;
        }
      }
    }
    if (!hasOutput) {
      if (commandFinished) {
        this._showEmptyMessage(localize("chat.terminalOutputEmpty", "No output was produced by the command."));
      }
    } else {
      this._hideEmptyMessage();
    }
    this._layoutOutput(result?.lineCount ?? 0);
    return true;
  }
  async _renderSnapshotOutput(snapshot) {
    if (this._snapshotMirror) {
      this._snapshotMirror.setOutput(snapshot);
      await this._layoutMirrorWidth(this._snapshotMirror);
      const result2 = await this._snapshotMirror.render();
      this._layoutOutput(result2?.lineCount ?? snapshot.lineCount ?? this._lastRenderedLineCount ?? 0);
      return;
    }
    if (this._store.isDisposed) {
      return;
    }
    dom.clearNode(this._terminalContainer);
    this._snapshotMirror = this._register(this._instantiationService.createInstance(DetachedTerminalSnapshotMirror, snapshot, this._getStoredTheme));
    this._register(this._snapshotMirror.onDidChangeRowHeight(() => this._handleMirrorRowHeightChange()));
    await this._snapshotMirror.attach(this._terminalContainer);
    this._snapshotMirror.setOutput(snapshot);
    await this._layoutMirrorWidth(this._snapshotMirror);
    const result = await this._snapshotMirror.render();
    const hasText = !!snapshot.text && snapshot.text.length > 0;
    if (hasText) {
      this._hideEmptyMessage();
    } else {
      this._showEmptyMessage(localize("chat.terminalOutputEmpty", "No output was produced by the command."));
    }
    const lineCount = result?.lineCount ?? snapshot.lineCount ?? 0;
    this._layoutOutput(lineCount);
  }
  _renderUnavailableMessage(liveTerminalInstance) {
    dom.clearNode(this._terminalContainer);
    this._lastRenderedLineCount = void 0;
    if (!liveTerminalInstance) {
      this._showEmptyMessage(localize("chat.terminalOutputTerminalMissing", "Terminal is no longer available."));
    } else {
      this._showEmptyMessage(localize("chat.terminalOutputCommandMissing", "Command information is not available."));
    }
  }
  async _resolveLiveTerminal() {
    const instance = await this._ensureTerminalInstance();
    return instance && !instance.isDisposed ? instance : void 0;
  }
  _showEmptyMessage(message) {
    this._emptyElement.textContent = message;
    this._terminalContainer.classList.add("chat-terminal-output-terminal-no-output");
    this.domNode.classList.add("chat-terminal-output-container-no-output");
  }
  _hideEmptyMessage() {
    this._emptyElement.textContent = "";
    this._terminalContainer.classList.remove("chat-terminal-output-terminal-no-output");
    this.domNode.classList.remove("chat-terminal-output-container-no-output");
  }
  _disposeLiveMirror() {
    if (this._mirror) {
      this._mirror.dispose();
      this._mirror = void 0;
    }
  }
  _scheduleOutputRelayout() {
    dom.getWindow(this.domNode).requestAnimationFrame(() => {
      this._layoutOutput();
      this._scrollOutputToBottom();
    });
  }
  /**
   * The mirror's painted cell metrics changed: the first render replaces the pre-render
   * font estimate, and later renders can reflect DPR changes. Re-run layout so the box
   * height and wrap width match what xterm actually painted.
   */
  _handleMirrorRowHeightChange() {
    void this._layoutMirrorWidth();
    this._layoutOutput();
  }
  _handleResize() {
    if (!this._scrollableContainer) {
      return;
    }
    if (this.isExpanded) {
      void this._layoutMirrorWidth();
      this._layoutOutput();
      this._scrollOutputToBottom();
    } else {
      this._scrollableContainer.scanDomNode();
    }
  }
  /**
   * Resizes the mirror's column count to fill the currently available width. No-op while the
   * width is unmeasurable (e.g. collapsed); the mirror keeps its current cols until the next
   * layout opportunity.
   */
  async _layoutMirrorWidth(mirror = this._snapshotMirror ?? this._mirror) {
    if (!mirror) {
      return;
    }
    const width = this._terminalContainer.clientWidth || this._outputBody.clientWidth || this.domNode.clientWidth || (this.domNode.parentElement?.clientWidth ?? 0);
    if (width <= 0) {
      return;
    }
    const result = await mirror.layout(width);
    if (!this._store.isDisposed && result?.lineCount !== void 0) {
      this._layoutOutput(result.lineCount);
    }
  }
  _layoutOutput(lineCount) {
    if (!this._scrollableContainer) {
      return;
    }
    if (lineCount !== void 0) {
      this._lastRenderedLineCount = lineCount;
    } else {
      lineCount = this._lastRenderedLineCount;
    }
    this._scrollableContainer.scanDomNode();
    if (!this.isExpanded || lineCount === void 0) {
      return;
    }
    const scrollableDomNode = this._scrollableContainer.getDomNode();
    const rowHeight = this._computeRowHeightPx();
    const padding = this._getOutputPadding();
    let maxRows = MAX_OUTPUT_ROWS;
    const containerMaxHeight = Number.parseFloat(dom.getComputedStyle(this.domNode).maxHeight);
    if (!Number.isNaN(containerMaxHeight)) {
      maxRows = Math.max(Math.min(maxRows, Math.floor((containerMaxHeight - padding) / rowHeight)), MIN_OUTPUT_ROWS);
    }
    const contentRows = Math.min(Math.max(lineCount, MIN_OUTPUT_ROWS), maxRows);
    scrollableDomNode.style.height = `${contentRows * rowHeight + padding}px`;
    this._scrollableContainer.scanDomNode();
  }
  _computeIsAtBottom() {
    if (!this._scrollableContainer) {
      return true;
    }
    const dimensions = this._scrollableContainer.getScrollDimensions();
    const scrollPosition = this._scrollableContainer.getScrollPosition();
    const threshold = 5;
    return scrollPosition.scrollTop >= dimensions.scrollHeight - dimensions.height - threshold;
  }
  _scrollOutputToBottom() {
    if (!this._scrollableContainer) {
      return;
    }
    this._isProgrammaticScroll = true;
    const dimensions = this._scrollableContainer.getScrollDimensions();
    this._scrollableContainer.setScrollPosition({ scrollTop: dimensions.scrollHeight });
    this._isProgrammaticScroll = false;
  }
  _getOutputPadding() {
    const style = dom.getComputedStyle(this._outputBody);
    const paddingTop = Number.parseFloat(style.paddingTop || "0");
    const paddingBottom = Number.parseFloat(style.paddingBottom || "0");
    return paddingTop + paddingBottom;
  }
  _computeRowHeightPx() {
    const mirrorRowHeight = (this._snapshotMirror ?? this._mirror)?.getRowHeightPx();
    if (mirrorRowHeight !== void 0) {
      return mirrorRowHeight;
    }
    const window = dom.getWindow(this.domNode);
    const font = this._terminalConfigurationService.getFont(window);
    const hasCharHeight = isNumber(font.charHeight) && font.charHeight > 0;
    const hasFontSize = isNumber(font.fontSize) && font.fontSize > 0;
    const hasLineHeight = isNumber(font.lineHeight) && font.lineHeight > 0;
    const charHeight = (hasCharHeight ? font.charHeight : hasFontSize ? font.fontSize : 1) ?? 1;
    const lineHeight = hasLineHeight ? font.lineHeight : 1;
    const rowHeight = Math.ceil(charHeight * lineHeight);
    return Math.max(rowHeight, 1);
  }
  _applyBackgroundColor() {
    const theme = this._themeService.getColorTheme();
    const isInEditor = ChatContextKeys.inChatEditor.getValue(this._contextKeyService);
    const backgroundColor = theme.getColor(isInEditor ? editorBackground : PANEL_BACKGROUND);
    if (backgroundColor) {
      this.domNode.style.backgroundColor = backgroundColor.toString();
    }
  }
};
ChatTerminalToolOutputSection = __decorateClass([
  __decorateParam(8, IAccessibleViewService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, ITerminalConfigurationService),
  __decorateParam(11, IThemeService),
  __decorateParam(12, IContextKeyService)
], ChatTerminalToolOutputSection);
let ChatTerminalThinkingCollapsibleWrapper = class extends ChatCollapsibleContentPart {
  constructor(commandText, intention, isSandboxWrapped, contentElement, context, initialExpanded, isComplete, isSkipped, isRunningInBackground, onFocusTerminal, hoverService, configurationService) {
    const intentionText = intention && !isSkipped ? intention : void 0;
    const stateTitle = isSkipped ? localize("chat.terminal.skipped.plain", "Skipped {0}", commandText) : isRunningInBackground ? localize("chat.terminal.runningInBackground.plain", "Running {0} in background", commandText) : isComplete ? localize("chat.terminal.ran.plain", "Ran {0}", commandText) : localize("chat.terminal.running.plain", "Running {0}", commandText);
    const title = intentionText ? isRunningInBackground ? `${intentionText} ${commandText}${localize("chat.terminal.backgroundSuffix", " in background")}` : `${intentionText} ${commandText}` : stateTitle;
    super(title, context, void 0, hoverService, configurationService);
    this._showLinkDisposables = this._register(new MutableDisposable());
    this._terminalContentElement = contentElement;
    this._commandText = commandText;
    this._intention = intentionText;
    this._isSandboxWrapped = isSandboxWrapped;
    this._isComplete = isComplete;
    this._isSkipped = isSkipped;
    this._isRunningInBackground = isRunningInBackground;
    this._onFocusTerminal = onFocusTerminal;
    this.domNode.classList.add("chat-terminal-thinking-collapsible");
    if (isComplete) {
      this.icon = Codicon.check;
    }
    this._setCodeFormattedTitle();
    this._updateShowLink();
    this.setExpanded(initialExpanded);
  }
  shouldAnimateContent() {
    return true;
  }
  _setCodeFormattedTitle() {
    if (!this._collapseButton) {
      return;
    }
    const labelElement = this._collapseButton.labelElement;
    labelElement.textContent = "";
    const suffixText = this._isSandboxWrapped ? this._isRunningInBackground ? localize("chat.terminal.sandbox.backgroundSuffix", " in sandbox (background)") : localize("chat.terminal.sandbox.suffix", " in sandbox") : this._isRunningInBackground ? localize("chat.terminal.backgroundSuffix", " in background") : void 0;
    this.domNode.classList.toggle("chat-terminal-has-intention", !!this._intention);
    if (this._intention) {
      const row = dom.$("span.chat-terminal-label-flex");
      const intentionElement = dom.$("span.chat-terminal-intention");
      intentionElement.textContent = this._intention;
      const commandElement = dom.$("span.chat-terminal-command");
      const codeElement2 = document.createElement("code");
      codeElement2.textContent = this._commandText;
      commandElement.appendChild(codeElement2);
      row.appendChild(intentionElement);
      row.appendChild(commandElement);
      if (suffixText) {
        const suffixElement = dom.$("span.chat-terminal-label-suffix");
        suffixElement.textContent = suffixText;
        row.appendChild(suffixElement);
      }
      labelElement.appendChild(row);
      return;
    }
    const prefixText = this._isSandboxWrapped ? this._isSkipped ? localize("chat.terminal.skippedInSandbox.prefix", "Skipped ") : this._isComplete ? localize("chat.terminal.ranInSandbox.prefix", "Ran ") : localize("chat.terminal.runningInSandbox.prefix", "Running ") : this._isSkipped ? localize("chat.terminal.skipped.prefix", "Skipped ") : this._isComplete ? localize("chat.terminal.ran.prefix", "Ran ") : localize("chat.terminal.running.prefix", "Running ");
    labelElement.appendChild(document.createTextNode(prefixText));
    const codeElement = document.createElement("code");
    codeElement.textContent = this._commandText;
    labelElement.appendChild(codeElement);
    if (suffixText) {
      labelElement.appendChild(document.createTextNode(suffixText));
    }
  }
  _updateShowLink() {
    this._showLinkElement?.remove();
    this._showLinkElement = void 0;
    this._showLinkDisposables.value = void 0;
    if (!this._isRunningInBackground || !this._onFocusTerminal || !this._collapseButton) {
      return;
    }
    const labelElement = this._collapseButton.labelElement;
    const store = new DisposableStore();
    this._showLinkDisposables.value = store;
    const container = dom.$("span.chat-terminal-show-link-container");
    container.appendChild(document.createTextNode(" \u2014 "));
    const showLink = dom.$("span.chat-terminal-show-link");
    showLink.textContent = localize("chat.terminal.showTerminal", "Show");
    showLink.role = "button";
    showLink.tabIndex = 0;
    store.add(dom.addDisposableListener(showLink, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e, true);
      this._onFocusTerminal?.();
    }));
    store.add(dom.addDisposableListener(showLink, dom.EventType.KEY_DOWN, (e) => {
      const keyboardEvent = new StandardKeyboardEvent(e);
      if (keyboardEvent.equals(KeyCode.Enter) || keyboardEvent.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e, true);
        this._onFocusTerminal?.();
      }
    }));
    container.appendChild(showLink);
    labelElement.appendChild(container);
    this._showLinkElement = container;
  }
  markComplete() {
    if (this._isComplete) {
      return;
    }
    this._isComplete = true;
    this._isRunningInBackground = false;
    this.icon = Codicon.check;
    this._setCodeFormattedTitle();
    this._updateShowLink();
  }
  initContent() {
    const listWrapper = dom.$(".chat-used-context-list.chat-terminal-thinking-content");
    listWrapper.appendChild(this._terminalContentElement);
    return listWrapper;
  }
  expand() {
    this.setExpanded(true);
  }
  hasSameContent(_other, _followingContent, _element) {
    return false;
  }
};
ChatTerminalThinkingCollapsibleWrapper = __decorateClass([
  __decorateParam(10, IHoverService),
  __decorateParam(11, IConfigurationService)
], ChatTerminalThinkingCollapsibleWrapper);
export {
  ChatTerminalThinkingCollapsibleWrapper,
  ChatTerminalToolOutputSection,
  ChatTerminalToolProgressPart
};
