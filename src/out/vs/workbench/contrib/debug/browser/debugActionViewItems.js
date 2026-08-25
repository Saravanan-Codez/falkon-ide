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
import * as nls from "../../../../nls.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import * as dom from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IDebugService, State } from "../common/debug.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { selectBorder, selectBackground, asCssVariable } from "../../../../platform/theme/common/colorRegistry.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { ADD_CONFIGURATION_ID } from "./debugCommands.js";
import { BaseActionViewItem, SelectActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { debugStart } from "./debugIcons.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { defaultSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { hasNativeContextMenu } from "../../../../platform/window/common/window.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { ActionWidgetDropdown } from "../../../../platform/actionWidget/browser/actionWidgetDropdown.js";
import { IActionWidgetService } from "../../../../platform/actionWidget/browser/actionWidget.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
let StartDebugActionViewItem = class extends BaseActionViewItem {
  constructor(context, action, options, debugService, configurationService, commandService, contextService, _contextViewService, keybindingService, hoverService, contextKeyService, actionWidgetService, telemetryService) {
    super(context, action, options);
    this.context = context;
    this.debugService = debugService;
    this.configurationService = configurationService;
    this.commandService = commandService;
    this.contextService = contextService;
    this.keybindingService = keybindingService;
    this.hoverService = hoverService;
    this.contextKeyService = contextKeyService;
    this.actionWidgetService = actionWidgetService;
    this.telemetryService = telemetryService;
    this.debugOptions = [];
    this.selected = 0;
    this.providers = [];
    this.optionCategories = [];
    this.toDispose = [];
    this.registerListeners();
  }
  registerListeners() {
    this.toDispose.push(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("launch")) {
        this.updateOptions();
      }
    }));
    this.toDispose.push(this.debugService.getConfigurationManager().onDidSelectConfiguration(() => {
      this.updateOptions();
    }));
  }
  render(container) {
    this.container = container;
    container.classList.add("start-debug-action-item");
    let titleElement = null;
    let isDisposed = false;
    this.toDispose.push(toDisposable(() => {
      isDisposed = true;
      titleElement?.classList.remove("has-start-debug-action-item");
    }));
    queueMicrotask(() => {
      if (!isDisposed) {
        titleElement = container.closest(".part > .title");
        titleElement?.classList.add("has-start-debug-action-item");
      }
    });
    this.start = dom.append(container, dom.$(ThemeIcon.asCSSSelector(debugStart)));
    const title = this.keybindingService.appendKeybinding(this.action.label, this.action.id);
    this.toDispose.push(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.start, title));
    this.start.setAttribute("role", "button");
    this._setAriaLabel(title);
    this._register(Gesture.addTarget(this.start));
    for (const event of [dom.EventType.CLICK, TouchEventType.Tap]) {
      this.toDispose.push(dom.addDisposableListener(this.start, event, () => {
        this.start.blur();
        if (this.debugService.state !== State.Initializing) {
          this.actionRunner.run(this.action, this.context);
        }
      }));
    }
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_DOWN, (e) => {
      if (this.action.enabled && e.button === 0) {
        this.start.classList.add("active");
      }
    }));
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_UP, () => {
      this.start.classList.remove("active");
    }));
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.MOUSE_OUT, () => {
      this.start.classList.remove("active");
    }));
    this.toDispose.push(dom.addDisposableListener(this.start, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.RightArrow)) {
        this.start.tabIndex = -1;
        this.dropdownLabel?.focus();
        event.stopPropagation();
      }
    }));
    this.configurationContainer = dom.append(container, dom.$(".configuration"));
    this.dropdown = new ActionWidgetDropdown(this.configurationContainer, {
      label: nls.localize("debugLaunchConfigurations", "Debug Launch Configurations"),
      labelRenderer: (el) => {
        this.dropdownLabel = el;
        el.classList.add("start-debug-action-item-dropdown-label");
        el.tabIndex = -1;
        el.setAttribute("role", "button");
        el.setAttribute("aria-haspopup", "true");
        el.setAttribute("aria-expanded", "false");
        this.renderDropdownLabel();
        return null;
      },
      actionProvider: { getActions: () => this.getDropdownActions() },
      listOptions: {
        showFilter: true,
        filterPlaceholder: nls.localize("debugLaunchConfigurations.search", "Search configurations"),
        focusFilterOnOpen: true
      }
    }, this.actionWidgetService, this.keybindingService, this.telemetryService);
    this.toDispose.push(this.dropdown);
    this.toDispose.push(this.dropdown.onDidChangeVisibility((visible) => {
      this.dropdownLabel?.setAttribute("aria-expanded", String(visible));
    }));
    this.toDispose.push(dom.addDisposableListener(this.configurationContainer, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.LeftArrow)) {
        if (this.dropdownLabel) {
          this.dropdownLabel.tabIndex = -1;
        }
        this.start.tabIndex = 0;
        this.start.focus();
        event.stopPropagation();
        event.preventDefault();
      }
    }));
    this.container.style.border = `1px solid ${asCssVariable(selectBorder)}`;
    this.configurationContainer.style.borderLeft = `1px solid ${asCssVariable(selectBorder)}`;
    this.container.style.backgroundColor = asCssVariable(selectBackground);
    const configManager = this.debugService.getConfigurationManager();
    const updateDynamicConfigs = () => configManager.getDynamicProviders().then((providers) => {
      if (providers.length !== this.providers.length) {
        this.providers = providers;
        this.updateOptions();
      }
    });
    this.toDispose.push(configManager.onDidChangeConfigurationProviders(updateDynamicConfigs));
    updateDynamicConfigs();
    this.updateOptions();
  }
  setActionContext(context) {
    this.context = context;
  }
  isEnabled() {
    return true;
  }
  focus(fromRight) {
    if (fromRight) {
      if (this.dropdownLabel) {
        this.dropdownLabel.tabIndex = 0;
        this.dropdownLabel.focus();
      }
    } else {
      this.start.tabIndex = 0;
      this.start.focus();
    }
  }
  blur() {
    this.start.tabIndex = -1;
    if (this.dropdownLabel) {
      this.dropdownLabel.tabIndex = -1;
      this.dropdownLabel.blur();
    }
    this.container.blur();
  }
  setFocusable(focusable) {
    if (focusable) {
      this.start.tabIndex = 0;
    } else {
      this.start.tabIndex = -1;
      if (this.dropdownLabel) {
        this.dropdownLabel.tabIndex = -1;
      }
    }
  }
  dispose() {
    this.toDispose = dispose(this.toDispose);
    super.dispose();
  }
  renderDropdownLabel() {
    if (!this.dropdownLabel) {
      return;
    }
    const currentLabel = this.debugOptions[this.selected]?.label ?? nls.localize("noConfigurations", "No Configurations");
    const labelSpan = dom.$("span.start-debug-action-item-label", void 0, currentLabel);
    const chevron = renderLabelWithIcons("$(chevron-down)");
    dom.reset(this.dropdownLabel, labelSpan, ...chevron);
    this.dropdownLabel.title = currentLabel;
    this.dropdownLabel.setAttribute("aria-label", nls.localize("debugLaunchConfigurationsAriaLabel", "Debug Launch Configurations: {0}", currentLabel));
  }
  getDropdownActions() {
    const actions = [];
    for (let i = 0; i < this.debugOptions.length; i++) {
      const option = this.debugOptions[i];
      const category = this.optionCategories[i];
      actions.push({
        id: `debug.config.${i}`,
        label: option.label,
        tooltip: option.label,
        class: void 0,
        enabled: true,
        checked: i === this.selected,
        category,
        run: async () => {
          await option.handler();
        }
      });
    }
    return actions;
  }
  updateOptions() {
    this.selected = 0;
    this.debugOptions = [];
    this.optionCategories = [];
    const manager = this.debugService.getConfigurationManager();
    const inWorkspace = this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
    let lastGroup;
    let groupOrder = 0;
    const pushOption = (option, category) => {
      this.debugOptions.push(option);
      this.optionCategories.push(category);
    };
    manager.getAllConfigurations().forEach(({ launch, name, presentation }) => {
      if (lastGroup !== presentation?.group) {
        lastGroup = presentation?.group;
        if (this.debugOptions.length) {
          groupOrder++;
        }
      }
      if (name === manager.selectedConfiguration.name && launch === manager.selectedConfiguration.launch) {
        this.selected = this.debugOptions.length;
      }
      const label = inWorkspace ? `${name} (${launch.name})` : name;
      pushOption({
        label,
        handler: async () => {
          await manager.selectConfiguration(launch, name);
          return true;
        }
      }, { label: `configurations-${groupOrder}`, order: groupOrder });
    });
    manager.getRecentDynamicConfigurations().slice(0, 3).forEach(({ name, type }) => {
      if (type === manager.selectedConfiguration.type && manager.selectedConfiguration.name === name) {
        this.selected = this.debugOptions.length;
      }
      pushOption({
        label: name,
        handler: async () => {
          await manager.selectConfiguration(void 0, name, void 0, { type });
          return true;
        }
      }, { label: "recent-dynamic", order: 100 });
    });
    if (this.debugOptions.length === 0) {
      pushOption({ label: nls.localize("noConfigurations", "No Configurations"), handler: async () => false }, void 0);
    }
    this.providers.forEach((p) => {
      pushOption({
        label: `${p.label}...`,
        handler: async () => {
          const picked = await p.pick();
          if (picked) {
            await manager.selectConfiguration(picked.launch, picked.config.name, picked.config, { type: p.type });
            return true;
          }
          return false;
        }
      }, { label: "actions", order: 200 });
    });
    manager.getLaunches().filter((l) => !l.hidden).forEach((l) => {
      const label = inWorkspace ? nls.localize("addConfigTo", "Add Config ({0})...", l.name) : nls.localize("addConfiguration", "Add Configuration...");
      pushOption({
        label,
        handler: async () => {
          await this.commandService.executeCommand(ADD_CONFIGURATION_ID, l.uri.toString());
          return false;
        }
      }, { label: "actions", order: 200 });
    });
    this.renderDropdownLabel();
  }
  _setAriaLabel(title) {
    let ariaLabel = title;
    let keybinding;
    const verbose = this.configurationService.getValue(AccessibilityVerbositySettingId.Debug);
    if (verbose) {
      keybinding = this.keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp, this.contextKeyService)?.getLabel() ?? void 0;
    }
    if (keybinding) {
      ariaLabel = nls.localize("commentLabelWithKeybinding", "{0}, use ({1}) for accessibility help", ariaLabel, keybinding);
    } else {
      ariaLabel = nls.localize("commentLabelWithKeybindingNoKeybinding", "{0}, run the command Open Accessibility Help which is currently not triggerable via keybinding.", ariaLabel);
    }
    this.start.ariaLabel = ariaLabel;
  }
};
StartDebugActionViewItem = __decorateClass([
  __decorateParam(3, IDebugService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IContextViewService),
  __decorateParam(8, IKeybindingService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IActionWidgetService),
  __decorateParam(12, ITelemetryService)
], StartDebugActionViewItem);
let FocusSessionActionViewItem = class extends SelectActionViewItem {
  constructor(action, session, debugService, contextViewService, configurationService) {
    super(null, action, [], -1, contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize("debugSession", "Debug Session"), useCustomDrawn: !hasNativeContextMenu(configurationService) });
    this.debugService = debugService;
    this.configurationService = configurationService;
    this._register(this.debugService.getViewModel().onDidFocusSession(() => {
      const session2 = this.getSelectedSession();
      if (session2) {
        const index = this.getSessions().indexOf(session2);
        this.select(index);
      }
    }));
    const sessionListenersStore = this._register(new DisposableStore());
    const registerSessionListeners = (session2) => {
      const sessionListeners = sessionListenersStore.add(new DisposableStore());
      sessionListeners.add(session2.onDidChangeName(() => this.update()));
      sessionListeners.add(session2.onDidEndAdapter(() => sessionListenersStore.delete(sessionListeners)));
    };
    this._register(this.debugService.onDidNewSession((session2) => {
      registerSessionListeners(session2);
      this.update();
    }));
    this.getSessions().forEach(registerSessionListeners);
    this._register(this.debugService.onDidEndSession(() => this.update()));
    const selectedSession = session ? this.mapFocusedSessionToSelected(session) : void 0;
    this.update(selectedSession);
  }
  getActionContext(_, index) {
    return this.getSessions()[index];
  }
  update(session) {
    if (!session) {
      session = this.getSelectedSession();
    }
    const sessions = this.getSessions();
    const names = sessions.map((s) => {
      const label = s.getLabel();
      if (s.parentSession) {
        return `\xA0\xA0${label}`;
      }
      return label;
    });
    this.setOptions(names.map((data) => ({ text: data })), session ? sessions.indexOf(session) : void 0);
  }
  getSelectedSession() {
    const session = this.debugService.getViewModel().focusedSession;
    return session ? this.mapFocusedSessionToSelected(session) : void 0;
  }
  getSessions() {
    const showSubSessions = this.configurationService.getValue("debug").showSubSessionsInToolBar;
    const sessions = this.debugService.getModel().getSessions();
    return showSubSessions ? sessions : sessions.filter((s) => !s.parentSession);
  }
  mapFocusedSessionToSelected(focusedSession) {
    const showSubSessions = this.configurationService.getValue("debug").showSubSessionsInToolBar;
    while (focusedSession.parentSession && !showSubSessions) {
      focusedSession = focusedSession.parentSession;
    }
    return focusedSession;
  }
};
FocusSessionActionViewItem = __decorateClass([
  __decorateParam(2, IDebugService),
  __decorateParam(3, IContextViewService),
  __decorateParam(4, IConfigurationService)
], FocusSessionActionViewItem);
export {
  FocusSessionActionViewItem,
  StartDebugActionViewItem
};
