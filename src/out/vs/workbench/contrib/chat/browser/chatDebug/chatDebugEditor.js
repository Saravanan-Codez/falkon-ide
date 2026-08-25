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
import "./media/chatDebug.css";
import * as DOM from "../../../../../base/browser/dom.js";
import { DisposableMap, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { AgentHostAhpJsonlLoggingSettingId } from "../../../../../platform/agentHost/common/agentService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../../browser/parts/editor/editorPane.js";
import { IPreferencesService } from "../../../../services/preferences/common/preferences.js";
import { IChatDebugService } from "../../common/chatDebugService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { AgentHostAgentDebugLogEnabledSettingId, AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING } from "../../common/promptSyntax/promptTypes.js";
import { IChatWidgetService } from "../chat.js";
import { ViewState, CHAT_DEBUG_ACTIVE_SESSION_IS_AGENT_HOST } from "./chatDebugTypes.js";
import { ChatDebugFilterState, registerFilterMenuItems } from "./chatDebugFilters.js";
import { isAgentHostSession } from "./agentHostLogSources.js";
import { isChatDebugLoggingEnabledForSession, isWireLogLoggingEnabled, renderChatDebugLoggingDisabledMessage, renderWireLogLoggingDisabledMessage } from "./chatDebugEnablement.js";
import { ChatDebugHomeView } from "./chatDebugHomeView.js";
import { ChatDebugOverviewView, OverviewNavigation } from "./chatDebugOverviewView.js";
import { ChatDebugLogsView, LogsNavigation } from "./chatDebugLogsView.js";
import { ChatDebugFlowChartView, FlowChartNavigation } from "./chatDebugFlowChartView.js";
import { ChatDebugCacheExplorerView, CacheExplorerNavigation } from "./chatDebugCacheExplorerView.js";
import { ChatDebugWireLogView, WireLogNavigation } from "./chatDebugWireLogView.js";
const $ = DOM.$;
let ChatDebugEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, instantiationService, chatDebugService, chatWidgetService, chatService, contextKeyService, configurationService, preferencesService) {
    super(ChatDebugEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.chatDebugService = chatDebugService;
    this.chatWidgetService = chatWidgetService;
    this.chatService = chatService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.preferencesService = preferencesService;
    this.viewState = ViewState.Home;
    this.disabledOverlayDisposables = this._register(new DisposableStore());
    this.sessionModelListener = this._register(new MutableDisposable());
    this.modelChangeListeners = this._register(new DisposableMap());
  }
  static {
    this.ID = "workbench.editor.chatDebug";
  }
  get scopedContextKeyService() {
    return this._scopedContextKeyService;
  }
  /**
   * Stops the streaming pipeline and clears cached events for the
   * active session. Called when navigating away from a session or
   * when the editor becomes hidden.
   */
  endActiveSession() {
    const sessionResource = this.chatDebugService.activeSessionResource;
    if (sessionResource) {
      this.chatDebugService.endSession(sessionResource);
    }
    this.chatDebugService.activeSessionResource = void 0;
    this._activeSessionIsAgentHostContextKey?.set(false);
  }
  createEditor(parent) {
    this.container = DOM.append(parent, $(".chat-debug-editor"));
    this.filterState = this._register(new ChatDebugFilterState());
    const scopedContextKeyService = this._register(this.contextKeyService.createScoped(this.container));
    this._scopedContextKeyService = scopedContextKeyService;
    this._activeSessionIsAgentHostContextKey = CHAT_DEBUG_ACTIVE_SESSION_IS_AGENT_HOST.bindTo(scopedContextKeyService);
    this._register(registerFilterMenuItems(this.filterState, scopedContextKeyService));
    this.homeView = this._register(this.instantiationService.createInstance(ChatDebugHomeView, this.container));
    this._register(this.homeView.onNavigateToSession((sessionResource) => {
      this.navigateToSession(sessionResource);
    }));
    this.overviewView = this._register(this.instantiationService.createInstance(ChatDebugOverviewView, this.container));
    this._register(this.overviewView.onNavigate((nav) => {
      switch (nav) {
        case OverviewNavigation.Home:
          this.endActiveSession();
          this.showView(ViewState.Home);
          break;
        case OverviewNavigation.Logs:
          this.showView(ViewState.Logs);
          break;
        case OverviewNavigation.FlowChart:
          this.showView(ViewState.FlowChart);
          break;
        case OverviewNavigation.CacheExplorer:
          this.showView(ViewState.CacheExplorer);
          break;
        case OverviewNavigation.WireLog:
          this.showView(ViewState.WireLog);
          break;
      }
    }));
    this.logsView = this._register(this.instantiationService.createInstance(ChatDebugLogsView, this.container, this.filterState));
    this._register(this.logsView.onNavigate((nav) => {
      switch (nav) {
        case LogsNavigation.Home:
          this.endActiveSession();
          this.showView(ViewState.Home);
          break;
        case LogsNavigation.Overview:
          this.showView(ViewState.Overview);
          break;
      }
    }));
    this.flowChartView = this._register(this.instantiationService.createInstance(ChatDebugFlowChartView, this.container, this.filterState));
    this._register(this.flowChartView.onNavigate((nav) => {
      switch (nav) {
        case FlowChartNavigation.Home:
          this.endActiveSession();
          this.showView(ViewState.Home);
          break;
        case FlowChartNavigation.Overview:
          this.showView(ViewState.Overview);
          break;
      }
    }));
    this.cacheExplorerView = this._register(this.instantiationService.createInstance(ChatDebugCacheExplorerView, this.container));
    this._register(this.cacheExplorerView.onNavigate((nav) => {
      switch (nav) {
        case CacheExplorerNavigation.Home:
          this.endActiveSession();
          this.showView(ViewState.Home);
          break;
        case CacheExplorerNavigation.Overview:
          this.showView(ViewState.Overview);
          break;
      }
    }));
    this.wireLogView = this._register(this.instantiationService.createInstance(ChatDebugWireLogView, this.container));
    this._register(this.wireLogView.onNavigate((nav) => {
      switch (nav) {
        case WireLogNavigation.Home:
          this.endActiveSession();
          this.showView(ViewState.Home);
          break;
        case WireLogNavigation.Overview:
          this.showView(ViewState.Overview);
          break;
      }
    }));
    this._register(this.chatDebugService.onDidAddEvent((event) => {
      if (this.viewState === ViewState.Home) {
        this.homeView?.render();
      } else if (this.chatDebugService.activeSessionResource && event.sessionResource.toString() === this.chatDebugService.activeSessionResource.toString()) {
        if (this.viewState === ViewState.Overview) {
          this.overviewView?.refresh();
        } else if (this.viewState === ViewState.FlowChart) {
          this.flowChartView?.refresh();
        } else if (this.viewState === ViewState.CacheExplorer) {
          this.cacheExplorerView?.refresh();
        } else if (this.viewState === ViewState.WireLog) {
          this.wireLogView?.refresh();
        }
      }
    }));
    this._register(this.chatWidgetService.onDidChangeFocusedSession(() => {
      if (this.viewState === ViewState.Home) {
        this.homeView?.render();
      }
    }));
    this._register(this.chatService.onDidCreateModel((model) => {
      const key = model.sessionResource.toString();
      this.modelChangeListeners.set(key, model.onDidChange((e) => {
        if (e.kind === "setCustomTitle") {
          if (this.viewState === ViewState.Home) {
            this.homeView?.render();
          } else if (this.viewState === ViewState.Overview || this.viewState === ViewState.Logs || this.viewState === ViewState.FlowChart || this.viewState === ViewState.CacheExplorer || this.viewState === ViewState.WireLog) {
            this.overviewView?.updateBreadcrumb();
            this.logsView?.updateBreadcrumb();
            this.flowChartView?.updateBreadcrumb();
            this.cacheExplorerView?.updateBreadcrumb();
            this.wireLogView?.updateBreadcrumb();
          }
        }
      }));
    }));
    this._register(this.chatService.onDidDisposeSession(() => {
      if (this.viewState === ViewState.Home) {
        this.homeView?.render();
      }
    }));
    this.disabledOverlay = DOM.append(this.container, $(".chat-debug-disabled-overlay"));
    DOM.hide(this.disabledOverlay);
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AgentHostAgentDebugLogEnabledSettingId) || e.affectsConfiguration(AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING) || e.affectsConfiguration(AgentHostAhpJsonlLoggingSettingId)) {
        this.displayView(this.viewState);
      }
    }));
    this.showView(ViewState.Home);
  }
  // =====================================================================
  // View switching
  // =====================================================================
  showView(state) {
    this.viewState = state;
    this.telemetryService.publicLog2("chatDebugViewSwitched", {
      viewState: state
    });
    this.displayView(state);
  }
  displayView(state) {
    const session = this.chatDebugService.activeSessionResource;
    const dataViewDisabled = (state === ViewState.Logs || state === ViewState.FlowChart || state === ViewState.CacheExplorer) && !isChatDebugLoggingEnabledForSession(this.configurationService, session);
    const wireLogDisabled = state === ViewState.WireLog && isAgentHostSession(session) && !isWireLogLoggingEnabled(this.configurationService);
    if (state === ViewState.Home) {
      this.homeView?.show();
    } else {
      this.homeView?.hide();
    }
    if (state === ViewState.Overview) {
      this.overviewView?.show();
    } else {
      this.overviewView?.hide();
    }
    if (state === ViewState.Logs && !dataViewDisabled) {
      this.logsView?.show();
      this.doLayout();
      this.logsView?.focus();
    } else {
      this.logsView?.hide();
    }
    if (state === ViewState.FlowChart && !dataViewDisabled) {
      this.flowChartView?.show();
    } else {
      this.flowChartView?.hide();
    }
    if (state === ViewState.CacheExplorer && !dataViewDisabled) {
      this.cacheExplorerView?.show();
    } else {
      this.cacheExplorerView?.hide();
    }
    if (state === ViewState.WireLog && !wireLogDisabled) {
      this.wireLogView?.show();
      this.doLayout();
    } else {
      this.wireLogView?.hide();
    }
    this.updateDisabledOverlay(wireLogDisabled ? "wirelog" : dataViewDisabled ? "data" : void 0);
  }
  updateDisabledOverlay(kind) {
    if (!this.disabledOverlay) {
      return;
    }
    this.disabledOverlayDisposables.clear();
    DOM.clearNode(this.disabledOverlay);
    if (kind === "wirelog") {
      renderWireLogLoggingDisabledMessage(this.disabledOverlay, this.preferencesService, this.disabledOverlayDisposables);
      DOM.show(this.disabledOverlay);
    } else if (kind === "data") {
      renderChatDebugLoggingDisabledMessage(this.disabledOverlay, this.chatDebugService.activeSessionResource, this.preferencesService, this.disabledOverlayDisposables);
      DOM.show(this.disabledOverlay);
    } else {
      DOM.hide(this.disabledOverlay);
    }
  }
  navigateToSession(sessionResource, view) {
    const previousSessionResource = this.chatDebugService.activeSessionResource;
    if (previousSessionResource && previousSessionResource.toString() !== sessionResource.toString()) {
      this.chatDebugService.endSession(previousSessionResource);
    }
    this.chatDebugService.activeSessionResource = sessionResource;
    this._activeSessionIsAgentHostContextKey?.set(isAgentHostSession(sessionResource));
    if (!this.chatDebugService.hasInvokedProviders(sessionResource)) {
      this.chatDebugService.invokeProviders(sessionResource);
    }
    this.trackSessionModelChanges(sessionResource);
    this.overviewView?.setSession(sessionResource);
    this.logsView?.setSession(sessionResource);
    this.flowChartView?.setSession(sessionResource);
    this.cacheExplorerView?.setSession(sessionResource);
    this.wireLogView?.setSession(sessionResource);
    const targetState = view === "logs" ? ViewState.Logs : view === "flowchart" ? ViewState.FlowChart : view === "cache" ? ViewState.CacheExplorer : view === "wirelog" ? ViewState.WireLog : ViewState.Overview;
    this.showView(targetState);
  }
  trackSessionModelChanges(sessionResource) {
    const model = this.chatService.getSession(sessionResource);
    if (!model) {
      this.sessionModelListener.clear();
      return;
    }
    this.sessionModelListener.value = model.onDidChange((e) => {
      if (e.kind === "addRequest" || e.kind === "completedRequest") {
        if (this.viewState === ViewState.Overview) {
          this.overviewView?.refresh();
        }
      }
    });
  }
  // =====================================================================
  // EditorPane overrides
  // =====================================================================
  focus() {
    if (this.viewState === ViewState.Logs) {
      this.logsView?.focus();
    } else {
      this.container?.focus();
    }
  }
  clearInput() {
    this.endActiveSession();
    super.clearInput();
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    if (options) {
      this._applyNavigationOptions(options);
    }
  }
  setOptions(options) {
    super.setOptions(options);
    if (options) {
      this._applyNavigationOptions(options);
    }
  }
  /**
   * The panel is enabled when either local file logging or agent-host (Copilot
   * CLI) debug logging is on. Each provider self-gates on its own setting, so
   * this only decides whether to fall back to the home view.
   */
  _isDebugEnabled() {
    return this.configurationService.getValue(AGENT_DEBUG_LOG_FILE_LOGGING_ENABLED_SETTING) || this.configurationService.getValue(AgentHostAgentDebugLogEnabledSettingId);
  }
  setEditorVisible(visible) {
    super.setEditorVisible(visible);
    if (visible) {
      this.telemetryService.publicLog2("chatDebugPanelOpened");
      if (!this._isDebugEnabled()) {
        this.endActiveSession();
        this.showView(ViewState.Home);
        return;
      }
      this.showView(this.viewState);
    }
  }
  _applyNavigationOptions(options) {
    if (!this._isDebugEnabled()) {
      this.endActiveSession();
      this.showView(ViewState.Home);
      return;
    }
    const { sessionResource, viewHint, filter } = options;
    if (viewHint === "logs" && sessionResource) {
      this.navigateToSession(sessionResource, "logs");
    } else if (viewHint === "flowchart" && sessionResource) {
      this.navigateToSession(sessionResource, "flowchart");
    } else if (viewHint === "cache" && sessionResource) {
      this.navigateToSession(sessionResource, "cache");
    } else if (viewHint === "overview" && sessionResource) {
      this.navigateToSession(sessionResource, "overview");
    } else if (viewHint === "wirelog" && sessionResource) {
      this.navigateToSession(sessionResource, "wirelog");
    } else if (viewHint === "home") {
      this.endActiveSession();
      this.showView(ViewState.Home);
    } else if (sessionResource) {
      this.navigateToSession(sessionResource, "overview");
    } else if (this.viewState === ViewState.Home) {
      this.showView(ViewState.Home);
    }
    if (filter !== void 0 && this.filterState) {
      this.filterState.setTextFilter(filter);
      this.logsView?.setFilterText(filter);
    }
  }
  layout(dimension) {
    this.currentDimension = dimension;
    if (this.container) {
      this.container.style.width = `${dimension.width}px`;
      this.container.style.height = `${dimension.height}px`;
    }
    this.doLayout();
  }
  doLayout() {
    if (!this.currentDimension) {
      return;
    }
    if (this.viewState === ViewState.Logs) {
      this.logsView?.layout(this.currentDimension);
    } else if (this.viewState === ViewState.WireLog) {
      this.wireLogView?.layout();
    }
  }
};
ChatDebugEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IChatDebugService),
  __decorateParam(6, IChatWidgetService),
  __decorateParam(7, IChatService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IPreferencesService)
], ChatDebugEditor);
export {
  ChatDebugEditor
};
