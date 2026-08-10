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
import { $, addDisposableGenericMouseDownListener, addDisposableListener, append, EventType } from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { ActionViewItem, BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Action } from "../../../../base/common/actions.js";
import { equals } from "../../../../base/common/arrays.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun, derivedOpts } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize, localize2 } from "../../../../nls.js";
import { IActionViewItemService } from "../../../../platform/actions/browser/actionViewItemService.js";
import { ActionWidgetDropdownActionViewItem } from "../../../../platform/actions/browser/actionWidgetDropdownActionViewItem.js";
import { MenuId, registerAction2, Action2, MenuRegistry, SubmenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { logSessionsInteraction } from "../../../common/sessionsTelemetry.js";
import { IWorkbenchLayoutService } from "../../../../workbench/services/layout/browser/layoutService.js";
import { SessionsCategories } from "../../../common/categories.js";
import { ISessionsManagementService } from "../../../services/sessions/common/sessionsManagement.js";
import { ISessionsService } from "../../../services/sessions/browser/sessionsService.js";
import { SessionWorkspaceIsVirtualContext, SessionsWelcomeVisibleContext } from "../../../common/contextkeys.js";
import { IChatWidgetService } from "../../../../workbench/contrib/chat/browser/chat.js";
import { Menus } from "../../../browser/menus.js";
import { ISessionsTasksService } from "./sessionsTasksService.js";
import { IsAuxiliaryWindowContext } from "../../../../workbench/common/contextkeys.js";
import { RunScriptCustomTaskWidget } from "./runScriptCustomTaskWidget.js";
const RunScriptDropdownMenuId = MenuId.for("AgentSessionsRunScriptDropdown");
const RUN_SCRIPT_ACTION_MODAL_VISIBLE_CLASS = "run-script-action-modal-visible";
const RUN_SCRIPT_ACTION_PRIMARY_ID = "workbench.action.agentSessions.runScriptPrimary";
const CONFIGURE_DEFAULT_RUN_ACTION_ID = "workbench.action.agentSessions.configureDefaultRunAction";
const GENERATE_RUN_ACTION_ID = "workbench.action.agentSessions.generateRunAction";
const closeQuickWidgetButton = {
  iconClass: ThemeIcon.asClassName(Codicon.close),
  tooltip: localize("closeQuickWidget", "Close"),
  alwaysVisible: true
};
function getTaskDisplayLabel(task) {
  if (task.label && task.label.length > 0) {
    return task.label;
  }
  if (task.script && task.script.length > 0) {
    return task.script;
  }
  if (task.command && task.command.length > 0) {
    return task.command;
  }
  if (task.task && task.task.toString().length > 0) {
    return task.task.toString();
  }
  return "";
}
function getTaskCommandPreview(task) {
  if (task.command && task.command.length > 0) {
    return task.command;
  }
  if (task.script && task.script.length > 0) {
    return localize("npmTaskCommandPreview", "npm run {0}", task.script);
  }
  if (task.task && task.task.toString().length > 0) {
    return task.task.toString();
  }
  return getTaskDisplayLabel(task);
}
function formatBrowserUrlDescription(url, maxLength) {
  if (!url) {
    return void 0;
  }
  const stripped = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  if (stripped.length <= maxLength) {
    return stripped;
  }
  return `${stripped.substring(0, maxLength - 3)}...`;
}
function getPrimaryTask(tasks, pinnedTaskLabel) {
  if (tasks.length === 0) {
    return void 0;
  }
  if (pinnedTaskLabel) {
    const pinnedTask = tasks.find((task) => task.task.label === pinnedTaskLabel);
    if (pinnedTask) {
      return pinnedTask;
    }
  }
  return tasks[0];
}
let RunScriptContribution = class extends Disposable {
  constructor(_sessionManagementService, _sessionsService, _keybindingService, _quickInputService, _sessionsConfigService, _actionViewItemService, _layoutService, _telemetryService, _chatWidgetService, _commandService) {
    super();
    this._sessionManagementService = _sessionManagementService;
    this._sessionsService = _sessionsService;
    this._quickInputService = _quickInputService;
    this._sessionsConfigService = _sessionsConfigService;
    this._actionViewItemService = _actionViewItemService;
    this._layoutService = _layoutService;
    this._telemetryService = _telemetryService;
    this._chatWidgetService = _chatWidgetService;
    this._commandService = _commandService;
    this._activeRunState = derivedOpts({
      owner: this,
      equalsFn: (a, b) => {
        if (a === b) {
          return true;
        }
        if (!a || !b) {
          return false;
        }
        return a.session === b.session && a.pinnedTaskLabel === b.pinnedTaskLabel && a.browserUrl === b.browserUrl && a.pinnedBrowser === b.pinnedBrowser && equals(a.tasks, b.tasks, (t1, t2) => t1.task.label === t2.task.label && t1.task.command === t2.task.command && t1.target === t2.target && t1.task.runOptions?.runOn === t2.task.runOptions?.runOn);
      }
    }, (reader) => {
      const activeSession = this._sessionsService.activeSession.read(reader);
      if (!activeSession) {
        return void 0;
      }
      const tasks = this._sessionsConfigService.getSessionTasks(activeSession).read(reader);
      const folder = activeSession.workspace.read(reader)?.folders[0];
      const pinnedTaskLabel = this._sessionsConfigService.getPinnedTaskLabel(folder?.root).read(reader);
      const browserUrl = this._sessionsConfigService.getBrowserUrl(folder?.root).read(reader);
      const pinnedBrowser = this._sessionsConfigService.getPinnedBrowser(folder?.root).read(reader);
      return { session: activeSession, tasks, pinnedTaskLabel, browserUrl, pinnedBrowser };
    }).recomputeInitiallyAndOnChange(this._store);
    this._registerActionViewItemProvider();
    this._registerActions();
  }
  static {
    this.ID = "workbench.contrib.agentSessions.runScript";
  }
  _registerActionViewItemProvider() {
    const that = this;
    this._register(this._actionViewItemService.register(
      Menus.TitleBarCenterRight,
      RunScriptDropdownMenuId,
      (action, options, instantiationService) => {
        if (!(action instanceof SubmenuItemAction)) {
          return void 0;
        }
        return instantiationService.createInstance(
          RunScriptActionViewItem,
          action,
          options,
          that._activeRunState,
          (session) => that._showConfigureQuickPick(session),
          (session, existingTask, mode) => that._showCustomCommandInput(session, existingTask, mode),
          (session) => that._generateNewTask(session),
          (session) => that._configureBrowserUrl(session)
        );
      }
    ));
  }
  _registerActions() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: RUN_SCRIPT_ACTION_PRIMARY_ID,
          title: { value: localize("runPrimaryTask", "Run Primary Task"), original: "Run Primary Task" },
          icon: Codicon.play,
          category: SessionsCategories.Sessions,
          f1: true
        });
      }
      async run() {
        const activeState = that._activeRunState.get();
        if (!activeState) {
          return;
        }
        logSessionsInteraction(that._telemetryService, "runPrimaryTask");
        const { tasks, session, pinnedBrowser, browserUrl } = activeState;
        if (pinnedBrowser) {
          await that._commandService.executeCommand("simpleBrowser.show", browserUrl);
          return;
        }
        if (tasks.length === 0) {
          const task = await that._showConfigureQuickPick(session);
          if (task) {
            await that._sessionsConfigService.runTask(task, session);
          }
          return;
        }
        const primaryTask = getPrimaryTask(tasks, activeState.pinnedTaskLabel);
        if (!primaryTask) {
          return;
        }
        await that._sessionsConfigService.runTask(primaryTask.task, session);
      }
    }));
    this._register(autorun((reader) => {
      const activeState = this._activeRunState.read(reader);
      if (!activeState) {
        return;
      }
      const { session, tasks } = activeState;
      const folder = session.workspace.read(reader)?.folders[0];
      const configureScriptPrecondition = folder?.workingDirectory ? ContextKeyExpr.true() : ContextKeyExpr.false();
      reader.store.add(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: CONFIGURE_DEFAULT_RUN_ACTION_ID,
            title: localize2("configureDefaultRunAction", "Add Task..."),
            category: SessionsCategories.Sessions,
            icon: Codicon.add,
            precondition: configureScriptPrecondition,
            menu: [{
              id: RunScriptDropdownMenuId,
              group: tasks.length === 0 ? "navigation" : "1_configure",
              order: 0
            }]
          });
        }
        async run() {
          logSessionsInteraction(that._telemetryService, "addTask", "menu");
          const task = await that._showConfigureQuickPick(session);
          if (task) {
            await that._sessionsConfigService.runTask(task, session);
          }
        }
      }));
      reader.store.add(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: GENERATE_RUN_ACTION_ID,
            title: localize2("generateRunAction", "Generate New Task..."),
            category: SessionsCategories.Sessions,
            precondition: SessionWorkspaceIsVirtualContext.toNegated(),
            menu: [{
              id: RunScriptDropdownMenuId,
              group: tasks.length === 0 ? "navigation" : "1_configure",
              order: 1
            }]
          });
        }
        async run() {
          logSessionsInteraction(that._telemetryService, "generateNewTask", "menu");
          await that._generateNewTask(session);
        }
      }));
    }));
  }
  async _generateNewTask(session) {
    const query = "/generate-run-commands";
    const widget = this._chatWidgetService.getWidgetBySessionResource(session.mainChat.get().resource);
    if (widget) {
      await widget.acceptInput(query);
    } else {
      await this._sessionManagementService.sendNewChatRequest(session, { query });
    }
  }
  async _configureBrowserUrl(session) {
    const folder = session.workspace.get()?.folders[0];
    if (!folder?.root) {
      return;
    }
    const currentUrl = this._sessionsConfigService.getBrowserUrl(folder.root).get();
    const url = await this._quickInputService.input({
      title: localize("configureBrowserUrlTitle", "Configure Browser URL"),
      prompt: localize("configureBrowserUrlPrompt", "Enter the URL to open in the integrated browser. Leave empty to clear."),
      placeHolder: "https://example.com",
      value: currentUrl ?? "",
      ignoreFocusLost: true
    });
    if (url === void 0) {
      return;
    }
    this._sessionsConfigService.setBrowserUrl(folder.root, url);
  }
  async _showConfigureQuickPick(session) {
    const nonSessionTasks = await this._sessionsConfigService.getNonSessionTasks(session);
    if (nonSessionTasks.length === 0) {
      return this._showCustomCommandInput(session);
    }
    const items = [];
    items.push({ type: "separator", label: localize("custom", "Custom") });
    items.push({
      label: localize("createNewTask", "Create new task..."),
      description: localize("enterCustomCommandDesc", "Create a new shell task")
    });
    if (nonSessionTasks.length > 0) {
      items.push({ type: "separator", label: localize("existingTasks", "Existing Tasks") });
      for (const { task, target } of nonSessionTasks) {
        items.push({
          label: getTaskDisplayLabel(task),
          description: task.command,
          task,
          source: target
        });
      }
    }
    const picked = await this._quickInputService.pick(items, {
      placeHolder: localize("pickRunAction", "Select or create a task")
    });
    if (!picked) {
      return void 0;
    }
    const pickedItem = picked;
    if (pickedItem.task) {
      return this._showCustomCommandInput(session, { task: pickedItem.task, target: pickedItem.source ?? "workspace" }, "add", true);
    } else {
      return this._showCustomCommandInput(session, void 0, "add", true);
    }
  }
  async _showCustomCommandInput(session, existingTask, mode = "add", allowBackNavigation = false) {
    const taskConfiguration = await this._showCustomCommandWidget(session, existingTask, mode, allowBackNavigation);
    if (!taskConfiguration) {
      return void 0;
    }
    if (taskConfiguration === "back") {
      return this._showConfigureQuickPick(session);
    }
    if (existingTask) {
      if (mode === "configure") {
        const newLabel = taskConfiguration.label?.trim() || existingTask.task.label || taskConfiguration.command;
        let updatedTask = {
          ...existingTask.task,
          label: newLabel,
          inAgents: true
        };
        if (taskConfiguration.command && existingTask.task.command !== void 0) {
          updatedTask = {
            ...updatedTask,
            command: taskConfiguration.command
          };
        }
        if (taskConfiguration.runOn) {
          updatedTask = {
            ...updatedTask,
            runOptions: {
              ...existingTask.task.runOptions ?? {},
              runOn: taskConfiguration.runOn
            }
          };
        }
        await this._sessionsConfigService.updateTask(existingTask.task.label, updatedTask, session, existingTask.target, taskConfiguration.target);
        return updatedTask;
      }
      await this._sessionsConfigService.addTaskToSessions(existingTask.task, session, existingTask.target, { runOn: taskConfiguration.runOn ?? "default" });
      return {
        ...existingTask.task,
        inAgents: true,
        ...taskConfiguration.runOn ? { runOptions: { runOn: taskConfiguration.runOn } } : {}
      };
    }
    return this._sessionsConfigService.createAndAddTask(
      taskConfiguration.label,
      taskConfiguration.command,
      session,
      taskConfiguration.target,
      taskConfiguration.runOn ? { runOn: taskConfiguration.runOn } : void 0
    );
  }
  _showCustomCommandWidget(session, existingTask, mode = "add", allowBackNavigation = false) {
    const folder = session.workspace.get()?.folders[0];
    const workspaceTargetDisabledReason = !(folder?.workingDirectory ?? folder?.root) ? localize("workspaceStorageUnavailableTooltip", "Workspace storage is unavailable for this session") : void 0;
    const isConfigureMode = mode === "configure";
    return new Promise((resolve) => {
      const disposables = new DisposableStore();
      let settled = false;
      const quickWidget = disposables.add(this._quickInputService.createQuickWidget());
      quickWidget.title = isConfigureMode ? localize("configureActionWidgetTitle", "Configure Task") : existingTask ? localize("addExistingActionWidgetTitle", "Add Existing Task") : localize("addActionWidgetTitle", "Add Task");
      quickWidget.description = isConfigureMode ? localize("configureActionWidgetDescription", "Update how this task is named, saved, and run.") : existingTask ? localize("addExistingActionWidgetDescription", "Enable an existing task for sessions and configure when it should run.") : localize("addActionWidgetDescription", "Create a shell task and configure how it should be saved and run.");
      quickWidget.ignoreFocusOut = true;
      quickWidget.buttons = allowBackNavigation ? [this._quickInputService.backButton, closeQuickWidgetButton] : [closeQuickWidgetButton];
      const widget = disposables.add(new RunScriptCustomTaskWidget({
        label: existingTask?.task.label,
        labelDisabledReason: existingTask && !isConfigureMode ? localize("existingTaskLabelLocked", "This name comes from an existing task and cannot be changed here.") : void 0,
        command: existingTask ? getTaskCommandPreview(existingTask.task) : void 0,
        commandDisabledReason: existingTask && !isConfigureMode ? localize("existingTaskCommandLocked", "This command comes from an existing task and cannot be changed here.") : void 0,
        target: existingTask?.target,
        targetDisabledReason: existingTask && !isConfigureMode ? localize("existingTaskTargetLocked", "This existing task cannot be moved between workspace and user storage.") : workspaceTargetDisabledReason,
        runOn: existingTask?.task.runOptions?.runOn === "worktreeCreated" ? "worktreeCreated" : void 0,
        mode: isConfigureMode ? "configure" : existingTask ? "add-existing" : "add"
      }));
      quickWidget.widget = widget.domNode;
      this._layoutService.mainContainer.classList.add(RUN_SCRIPT_ACTION_MODAL_VISIBLE_CLASS);
      const backdrop = append(this._layoutService.mainContainer, $(".run-script-action-modal-backdrop"));
      disposables.add(addDisposableGenericMouseDownListener(backdrop, (e) => {
        e.preventDefault();
        e.stopPropagation();
        complete(void 0);
      }));
      disposables.add({ dispose: () => backdrop.remove() });
      disposables.add({ dispose: () => this._layoutService.mainContainer.classList.remove(RUN_SCRIPT_ACTION_MODAL_VISIBLE_CLASS) });
      const complete = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
        quickWidget.hide();
      };
      disposables.add(widget.onDidSubmit((result) => complete(result)));
      disposables.add(widget.onDidCancel(() => complete(void 0)));
      disposables.add(quickWidget.onDidTriggerButton((button) => {
        if (allowBackNavigation && button === this._quickInputService.backButton) {
          settled = true;
          resolve("back");
          quickWidget.hide();
          return;
        }
        if (button === closeQuickWidgetButton) {
          complete(void 0);
        }
      }));
      disposables.add(quickWidget.onDidHide(() => {
        if (!settled) {
          settled = true;
          resolve(void 0);
        }
        disposables.dispose();
      }));
      quickWidget.show();
      widget.focus();
    });
  }
};
RunScriptContribution = __decorateClass([
  __decorateParam(0, ISessionsManagementService),
  __decorateParam(1, ISessionsService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, ISessionsTasksService),
  __decorateParam(5, IActionViewItemService),
  __decorateParam(6, IWorkbenchLayoutService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IChatWidgetService),
  __decorateParam(9, ICommandService)
], RunScriptContribution);
let RunScriptActionViewItem = class extends BaseActionViewItem {
  constructor(action, _options, _activeRunState, _showConfigureQuickPick, _showCustomCommandInput, _generateNewTask, _configureBrowserUrl, _commandService, _sessionsConfigService, _keybindingService, _actionWidgetService, contextKeyService, _telemetryService) {
    super(void 0, action);
    this._activeRunState = _activeRunState;
    this._showConfigureQuickPick = _showConfigureQuickPick;
    this._showCustomCommandInput = _showCustomCommandInput;
    this._generateNewTask = _generateNewTask;
    this._configureBrowserUrl = _configureBrowserUrl;
    this._commandService = _commandService;
    this._sessionsConfigService = _sessionsConfigService;
    this._keybindingService = _keybindingService;
    this._actionWidgetService = _actionWidgetService;
    this._telemetryService = _telemetryService;
    const state = this._activeRunState.get();
    const isPrimaryEnabled = !!state && (state.tasks.length > 0 || state.pinnedBrowser);
    this._primaryActionAction = this._register(new Action(
      "agentSessions.runScriptPrimary",
      this._getPrimaryActionTooltip(state),
      ThemeIcon.asClassName(Codicon.play),
      isPrimaryEnabled,
      () => this._commandService.executeCommand(RUN_SCRIPT_ACTION_PRIMARY_ID)
    ));
    this._primaryAction = this._register(new ActionViewItem(void 0, this._primaryActionAction, { icon: true, label: false }));
    this._register(autorun((reader) => {
      const runState = this._activeRunState.read(reader);
      this._primaryActionAction.enabled = !!runState && (runState.tasks.length > 0 || runState.pinnedBrowser);
      this._primaryActionAction.label = this._getPrimaryActionTooltip(runState);
    }));
    const dropdownAction = this._register(new Action("agentSessions.runScriptDropdown", localize("runDropdown", "More Tasks...")));
    this._dropdown = this._register(new ChevronActionWidgetDropdown(
      dropdownAction,
      {
        actionProvider: { getActions: () => this._getDropdownActions() },
        showItemKeybindings: true,
        listOptions: { className: "compact-icons" }
      },
      this._actionWidgetService,
      this._keybindingService,
      contextKeyService,
      this._telemetryService
    ));
  }
  render(container) {
    super.render(container);
    container.classList.add("monaco-dropdown-with-default");
    const primaryContainer = $(".action-container");
    this._primaryAction.render(append(container, primaryContainer));
    this._register(addDisposableListener(primaryContainer, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.RightArrow)) {
        this._primaryAction.blur();
        this._dropdown.focus();
        event.stopPropagation();
      }
    }));
    const dropdownContainer = $(".dropdown-action-container");
    this._dropdown.render(append(container, dropdownContainer));
    this._register(addDisposableListener(dropdownContainer, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.LeftArrow)) {
        this._dropdown.setFocusable(false);
        this._primaryAction.focus();
        event.stopPropagation();
      }
    }));
  }
  focus(fromRight) {
    if (fromRight) {
      this._dropdown.focus();
    } else {
      this._primaryAction.focus();
    }
  }
  blur() {
    this._primaryAction.blur();
    this._dropdown.blur();
  }
  setFocusable(focusable) {
    this._primaryAction.setFocusable(focusable);
    if (!focusable) {
      this._dropdown.setFocusable(false);
    }
  }
  _getPrimaryActionTooltip(state) {
    const keybindingLabel = this._keybindingService.lookupKeybinding(RUN_SCRIPT_ACTION_PRIMARY_ID)?.getLabel();
    const withKeybinding = (label) => keybindingLabel ? localize("runActionTooltipKeybinding", "{0} ({1})", label, keybindingLabel) : label;
    if (state?.pinnedBrowser) {
      return withKeybinding(localize("openBrowserAction", "Open Browser"));
    }
    if (!state || state.tasks.length === 0) {
      return localize("runPrimaryTaskTooltip", "Run Primary Task");
    }
    const primaryTask = getPrimaryTask(state.tasks, state.pinnedTaskLabel)?.task;
    if (!primaryTask) {
      return localize("runPrimaryTaskTooltip", "Run Primary Task");
    }
    return withKeybinding(getTaskDisplayLabel(primaryTask));
  }
  _getDropdownActions() {
    const state = this._activeRunState.get();
    if (!state) {
      return [];
    }
    const { tasks, session, pinnedTaskLabel } = state;
    const folder = session.workspace.get()?.folders[0];
    const actions = [];
    const defaultCategory = { label: "", order: 0, showHeader: false };
    const worktreeCategory = { label: localize("worktreeCreationCategory", "Run on Worktree Creation"), order: 1, showHeader: true };
    const tasksCategory = { label: localize("tasksActionsCategory", "Tasks"), order: 2, showHeader: true };
    for (let i = 0; i < tasks.length; i++) {
      const entry = tasks[i];
      const task = entry.task;
      const isWorktreeTask = task.runOptions?.runOn === "worktreeCreated";
      const isPinned = task.label === pinnedTaskLabel;
      const toolbarActions = [
        {
          id: `runScript.pin.${i}`,
          label: isPinned ? localize("unpinTask", "Unpin") : localize("pinTask", "Pin"),
          tooltip: isPinned ? localize("unpinTaskTooltip", "Unpin") : localize("pinTaskTooltip", "Pin"),
          class: ThemeIcon.asClassName(isPinned ? Codicon.pinned : Codicon.pin),
          enabled: !!folder?.root,
          run: async () => {
            this._actionWidgetService.hide();
            this._sessionsConfigService.setPinnedTaskLabel(folder?.root, isPinned ? void 0 : task.label);
          }
        },
        {
          id: `runScript.configure.${i}`,
          label: localize("configureTask", "Configure"),
          tooltip: localize("configureTask", "Configure"),
          class: ThemeIcon.asClassName(Codicon.gear),
          enabled: true,
          run: async () => {
            this._actionWidgetService.hide();
            await this._showCustomCommandInput(session, { task, target: entry.target }, "configure");
          }
        },
        {
          id: `runScript.remove.${i}`,
          label: localize("removeTask", "Remove"),
          tooltip: localize("removeTask", "Remove"),
          class: ThemeIcon.asClassName(Codicon.close),
          enabled: true,
          run: async () => {
            this._actionWidgetService.hide();
            await this._sessionsConfigService.removeTask(task.label, session, entry.target);
          }
        }
      ];
      actions.push({
        id: `runScript.task.${i}`,
        label: getTaskDisplayLabel(task),
        tooltip: "",
        hover: {
          content: localize("runActionTooltip", "Run '{0}' in terminal", getTaskDisplayLabel(task))
        },
        icon: Codicon.runCompact,
        enabled: true,
        class: void 0,
        category: isWorktreeTask ? worktreeCategory : defaultCategory,
        toolbarActions,
        run: async () => {
          await this._sessionsConfigService.runTask(task, session);
        }
      });
    }
    const canConfigure = !!(folder?.workingDirectory ?? folder?.root);
    actions.push({
      id: "runScript.addAction",
      label: localize("configureDefaultRunAction", "Add Task..."),
      tooltip: "",
      hover: {
        content: canConfigure ? localize("addActionTooltip", "Add a new task") : localize("addActionTooltipDisabled", "Cannot add tasks to this session because workspace storage is unavailable")
      },
      icon: Codicon.addCompact,
      enabled: canConfigure,
      class: void 0,
      category: tasksCategory,
      run: async () => {
        logSessionsInteraction(this._telemetryService, "addTask", "actionWidget");
        const task = await this._showConfigureQuickPick(session);
        if (task) {
          await this._sessionsConfigService.runTask(task, session);
        }
      }
    });
    actions.push({
      id: "runScript.generateAction",
      label: localize("generateRunAction", "Generate New Task..."),
      tooltip: "",
      hover: {
        content: localize("generateRunActionTooltip", "Generate a new workspace task")
      },
      icon: Codicon.sparkleCompact,
      enabled: true,
      class: void 0,
      category: tasksCategory,
      run: async () => {
        logSessionsInteraction(this._telemetryService, "generateNewTask", "actionWidget");
        await this._generateNewTask(session);
      }
    });
    const browserCategory = { label: localize("browserActionsCategory", "Browser"), order: 3, showHeader: true };
    const browserUrl = state.browserUrl;
    const browserUrlDescription = formatBrowserUrlDescription(browserUrl, 20);
    const canConfigureBrowser = !!folder?.root;
    const isBrowserPinned = state.pinnedBrowser;
    actions.push({
      id: "runScript.openBrowser",
      label: localize("openBrowserAction", "Open Browser"),
      tooltip: "",
      description: browserUrlDescription,
      hover: {
        content: browserUrl ? localize("openBrowserActionTooltip", "Open '{0}' in the integrated browser", browserUrl) : localize("openBrowserActionTooltipUnconfigured", "Open the integrated browser")
      },
      icon: Codicon.windowCompact,
      enabled: true,
      class: void 0,
      category: browserCategory,
      toolbarActions: [
        {
          id: "runScript.pinBrowser",
          label: isBrowserPinned ? localize("unpinBrowser", "Unpin") : localize("pinBrowser", "Pin"),
          tooltip: isBrowserPinned ? localize("unpinBrowserTooltip", "Unpin") : localize("pinBrowserTooltip", "Pin"),
          class: ThemeIcon.asClassName(isBrowserPinned ? Codicon.pinned : Codicon.pin),
          enabled: !!folder?.root,
          run: async () => {
            this._actionWidgetService.hide();
            this._sessionsConfigService.setPinnedBrowser(folder?.root, !isBrowserPinned);
          }
        },
        {
          id: "runScript.configureBrowser",
          label: localize("configureBrowserUrl", "Configure URL"),
          tooltip: localize("configureBrowserUrl", "Configure URL"),
          class: ThemeIcon.asClassName(Codicon.gear),
          enabled: canConfigureBrowser,
          run: async () => {
            this._actionWidgetService.hide();
            await this._configureBrowserUrl(session);
          }
        }
      ],
      run: async () => {
        await this._commandService.executeCommand("simpleBrowser.show", browserUrl);
      }
    });
    return actions;
  }
};
RunScriptActionViewItem = __decorateClass([
  __decorateParam(7, ICommandService),
  __decorateParam(8, ISessionsTasksService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IActionWidgetService),
  __decorateParam(11, IContextKeyService),
  __decorateParam(12, ITelemetryService)
], RunScriptActionViewItem);
class ChevronActionWidgetDropdown extends ActionWidgetDropdownActionViewItem {
  renderLabel(element) {
    element.classList.add("codicon", "codicon-chevron-down");
    return null;
  }
}
MenuRegistry.appendMenuItem(Menus.TitleBarCenterRight, {
  submenu: RunScriptDropdownMenuId,
  isSplitButton: true,
  title: localize2("run", "Run"),
  icon: Codicon.play,
  group: "navigation",
  order: 6,
  when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated(), SessionWorkspaceIsVirtualContext.toNegated())
});
class RunScriptNotAvailableAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.agentSessions.runScript.notAvailable",
      title: localize2("run", "Run"),
      tooltip: localize("runScriptNotAvailableTooltip", "Run Task is not available for this session type"),
      icon: Codicon.play,
      precondition: ContextKeyExpr.false(),
      menu: [{
        id: Menus.TitleBarCenterRight,
        group: "navigation",
        order: 6,
        when: ContextKeyExpr.and(IsAuxiliaryWindowContext.toNegated(), SessionsWelcomeVisibleContext.toNegated(), SessionWorkspaceIsVirtualContext)
      }]
    });
  }
  run() {
  }
}
registerAction2(RunScriptNotAvailableAction);
KeybindingsRegistry.registerKeybindingRule({
  id: RUN_SCRIPT_ACTION_PRIMARY_ID,
  primary: KeyCode.F5,
  weight: KeybindingWeight.WorkbenchContrib + 100,
  when: IsAuxiliaryWindowContext.toNegated()
});
export {
  RunScriptContribution,
  RunScriptDropdownMenuId
};
