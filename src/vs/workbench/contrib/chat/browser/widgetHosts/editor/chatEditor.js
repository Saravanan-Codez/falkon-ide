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
import * as dom from "../../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { raceCancellationError } from "../../../../../../base/common/async.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import * as nls from "../../../../../../nls.js";
import { ITextResourceConfigurationService } from "../../../../../../editor/common/services/textResourceConfiguration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../../../platform/instantiation/common/serviceCollection.js";
import { IStorageService } from "../../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../../platform/telemetry/common/telemetry.js";
import { editorBackground, editorForeground, inputBackground } from "../../../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { AbstractEditorWithViewState } from "../../../../../browser/parts/editor/editorWithViewState.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from "../../../../../common/theme.js";
import { IEditorGroupsService } from "../../../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { ChatContextKeys } from "../../../common/actions/chatContextKeys.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { IChatSessionsService, localChatSessionType } from "../../../common/chatSessionsService.js";
import { ChatAgentLocation, ChatModeKind } from "../../../common/constants.js";
import { clearChatEditor } from "../../actions/chatClear.js";
import { ChatEditorInput } from "./chatEditorInput.js";
import { ChatWidget } from "../../widget/chatWidget.js";
import { setModelPreservingInputTypedWhileLoading } from "../../chat.js";
let ChatEditor = class extends AbstractEditorWithViewState {
  constructor(group, telemetryService, themeService, instantiationService, storageService, chatSessionsService, contextKeyService, chatService, textResourceConfigurationService, editorService, editorGroupService) {
    super(ChatEditorInput.EditorID, group, ChatEditor.VIEW_STATE_KEY, telemetryService, instantiationService, storageService, textResourceConfigurationService, themeService, editorService, editorGroupService);
    this.chatSessionsService = chatSessionsService;
    this.contextKeyService = contextKeyService;
    this.chatService = chatService;
    this.dimension = new dom.Dimension(0, 0);
  }
  static {
    this.VIEW_STATE_KEY = "chatEditorViewState";
  }
  get widget() {
    return this._widget;
  }
  get scopedContextKeyService() {
    return this._scopedContextKeyService;
  }
  async clear(targetSessionType) {
    if (this.input) {
      return this.instantiationService.invokeFunction(clearChatEditor, this.input, targetSessionType);
    }
  }
  createEditor(parent) {
    this._editorContainer = parent;
    parent.classList.add("chat-editor-relative");
    this._scopedContextKeyService = this._register(this.contextKeyService.createScoped(parent));
    const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
    ChatContextKeys.inChatEditor.bindTo(this._scopedContextKeyService).set(true);
    this._widget = this._register(
      scopedInstantiationService.createInstance(
        ChatWidget,
        ChatAgentLocation.Chat,
        void 0,
        {
          autoScroll: (mode) => mode !== ChatModeKind.Ask,
          readOnlyBannerAtTop: true,
          renderFollowups: true,
          supportsFileReferences: true,
          clear: (targetSessionType) => this.clear(targetSessionType),
          rendererOptions: {
            renderTextEditsAsSummary: (uri) => {
              return true;
            },
            referencesExpandedWhenEmptyResponse: false,
            progressMessageAtBottomOfResponse: (mode) => mode !== ChatModeKind.Ask
          },
          enableImplicitContext: true,
          enableWorkingSet: "explicit",
          supportsChangingModes: true
        },
        {
          listForeground: editorForeground,
          listBackground: editorBackground,
          overlayBackground: EDITOR_DRAG_AND_DROP_BACKGROUND,
          inputEditorBackground: inputBackground,
          resultEditorBackground: editorBackground
        }
      )
    );
    this._register(this.widget.onDidSubmitAgent(() => {
      this.group.pinEditor(this.input);
    }));
    this._register(this.widget.onDidChangeViewModel((e) => {
      if (e.currentSessionResource && this.input instanceof ChatEditorInput) {
        const newModel = this.chatService.getSession(e.currentSessionResource);
        if (newModel) {
          this.input.updateModel(newModel);
        }
      }
    }));
    this.widget.render(parent);
    this.widget.setVisible(true);
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    this.widget?.setVisible(visible);
    if (visible && this.widget) {
      this.widget.layout(this.dimension.height, this.dimension.width);
    }
  }
  focus() {
    super.focus();
    this.widget?.focusInput();
  }
  clearInput() {
    super.clearInput();
    this.widget.setModel(void 0);
    if (this._editorContainer) {
      delete this._editorContainer.dataset.boundChatResource;
    }
  }
  showLoadingInChatWidget(message) {
    if (!this._editorContainer) {
      return;
    }
    if (this._loadingContainer) {
      const existingText = this._loadingContainer.querySelector(".chat-loading-content span");
      if (existingText) {
        existingText.textContent = message;
        return;
      }
      this.hideLoadingInChatWidget();
    }
    this._editorContainer.setAttribute("aria-busy", "true");
    this._loadingContainer = dom.append(this._editorContainer, dom.$(".chat-loading-overlay"));
    this._loadingContainer.setAttribute("role", "status");
    this._loadingContainer.setAttribute("aria-live", "polite");
    this._loadingContainer.tabIndex = -1;
    const loadingContent = dom.append(this._loadingContainer, dom.$(".chat-loading-content"));
    const spinner = renderIcon(ThemeIcon.modify(Codicon.loading, "spin"));
    spinner.setAttribute("aria-hidden", "true");
    loadingContent.appendChild(spinner);
    const text = dom.append(loadingContent, dom.$("span"));
    text.textContent = message;
  }
  hideLoadingInChatWidget() {
    if (this._loadingContainer) {
      this._loadingContainer.remove();
      this._loadingContainer = void 0;
    }
    if (this._editorContainer) {
      this._editorContainer.removeAttribute("aria-busy");
    }
  }
  async setInput(input, options, context, token) {
    const inputBeforeLoad = this.widget?.getInput() ?? "";
    let isContributedChatSession = false;
    const chatSessionType = input.getSessionType();
    if (chatSessionType !== localChatSessionType) {
      const loadingMessage = nls.localize("chatEditor.loadingSession", "Loading...");
      this.showLoadingInChatWidget(loadingMessage);
    }
    await super.setInput(input, options, context, token);
    if (token.isCancellationRequested) {
      this.hideLoadingInChatWidget();
      return;
    }
    if (!this.widget) {
      throw new Error("ChatEditor lifecycle issue: no editor widget");
    }
    if (chatSessionType !== localChatSessionType) {
      try {
        await raceCancellationError(this.chatSessionsService.canResolveChatSession(chatSessionType), token);
        const contributions = this.chatSessionsService.getAllChatSessionContributions();
        const contribution = contributions.find((c) => c.type === chatSessionType);
        if (contribution) {
          this.widget.lockToCodingAgent(contribution.name, contribution.displayName, contribution.type, contribution.agentHostProviderId);
          isContributedChatSession = true;
        } else {
          this.widget.unlockFromCodingAgent();
        }
      } catch (error) {
        this.hideLoadingInChatWidget();
        throw error;
      }
    } else {
      this.widget.unlockFromCodingAgent();
    }
    try {
      const editorModel = await raceCancellationError(input.resolve(), token);
      if (!editorModel) {
        throw new Error(`Failed to get model for chat editor. resource: ${input.sessionResource}`);
      }
      if (chatSessionType !== localChatSessionType) {
        this.hideLoadingInChatWidget();
      }
      if (options?.modelInputState) {
        editorModel.model.inputModel.setState(options.modelInputState);
      }
      setModelPreservingInputTypedWhileLoading(this.widget, inputBeforeLoad, () => this.updateModel(editorModel.model));
      const viewState = this.loadEditorViewState(input, context);
      if (viewState) {
        this._widget.restoreViewState(viewState);
      }
      if (isContributedChatSession && options?.title?.preferred && input.sessionResource) {
        this.chatService.setChatSessionTitle(input.sessionResource, options.title.preferred);
      }
    } catch (error) {
      this.hideLoadingInChatWidget();
      throw error;
    }
  }
  updateModel(model) {
    this.widget.setModel(model);
    if (this._editorContainer) {
      this._editorContainer.dataset.boundChatResource = model.sessionResource.toString();
    }
  }
  computeEditorViewState(resource) {
    if (!this._widget || !isEqual(this._widget.viewModel?.sessionResource, resource)) {
      return void 0;
    }
    return this._widget.getViewState();
  }
  tracksEditorViewState(input) {
    return input instanceof ChatEditorInput;
  }
  toEditorViewStateResource(input) {
    return input.sessionResource;
  }
  layout(dimension, position) {
    this.dimension = dimension;
    if (this.widget) {
      this.widget.layout(dimension.height, dimension.width);
    }
  }
};
ChatEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IChatSessionsService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IChatService),
  __decorateParam(8, ITextResourceConfigurationService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IEditorGroupsService)
], ChatEditor);
export {
  ChatEditor
};
