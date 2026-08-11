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
import { KeyMod, KeyChord, KeyCode } from "../../../../base/common/keyCodes.js";
import { ModesRegistry } from "../../../../editor/common/languages/modesRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { MenuId, registerAction2, Action2, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { OutputService } from "./outputServices.js";
import { OUTPUT_MODE_ID, OUTPUT_MIME, OUTPUT_VIEW_ID, IOutputService, CONTEXT_IN_OUTPUT, LOG_MODE_ID, LOG_MIME, CONTEXT_OUTPUT_SCROLL_LOCK, ACTIVE_OUTPUT_CHANNEL_CONTEXT, CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE, Extensions, CONTEXT_ACTIVE_OUTPUT_LEVEL, CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT, SHOW_INFO_FILTER_CONTEXT, SHOW_TRACE_FILTER_CONTEXT, SHOW_DEBUG_FILTER_CONTEXT, SHOW_ERROR_FILTER_CONTEXT, SHOW_WARNING_FILTER_CONTEXT, OUTPUT_FILTER_FOCUS_CONTEXT, CONTEXT_ACTIVE_LOG_FILE_OUTPUT, isSingleSourceOutputChannelDescriptor } from "../../../services/output/common/output.js";
import { OutputViewPane } from "./outputView.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { ViewContainerLocation, Extensions as ViewContainerExtensions, WindowEnablement } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { AUX_WINDOW_GROUP, IEditorService } from "../../../services/editor/common/editorService.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Disposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ILoggerService, LogLevel, LogLevelToLocalizedString, LogLevelToString } from "../../../../platform/log/common/log.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../platform/accessibility/common/accessibility.js";
import { IsWindowsContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { FocusedViewContext } from "../../../common/contextkeys.js";
import { localize, localize2 } from "../../../../nls.js";
import { viewFilterSubmenu } from "../../../browser/parts/views/viewFilter.js";
import { ViewAction } from "../../../browser/parts/views/viewPane.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { basename } from "../../../../base/common/resources.js";
import { hasKey } from "../../../../base/common/types.js";
import { IDefaultLogLevelsService } from "../../../services/log/common/defaultLogLevels.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { OutputAccessibilityHelp } from "./outputAccessibilityHelp.js";
const IMPORTED_LOG_ID_PREFIX = "importedLog.";
registerSingleton(IOutputService, OutputService, InstantiationType.Delayed);
AccessibleViewRegistry.register(new OutputAccessibilityHelp());
ModesRegistry.registerLanguage({
  id: OUTPUT_MODE_ID,
  extensions: [],
  mimetypes: [OUTPUT_MIME]
});
ModesRegistry.registerLanguage({
  id: LOG_MODE_ID,
  extensions: [],
  mimetypes: [LOG_MIME]
});
const outputViewIcon = registerIcon("output-view-icon", Codicon.output, nls.localize("outputViewIcon", "View icon of the output view."));
const VIEW_CONTAINER = Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
  id: OUTPUT_VIEW_ID,
  title: nls.localize2("output", "Output"),
  icon: outputViewIcon,
  order: 1,
  ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [OUTPUT_VIEW_ID, { mergeViewWithContainerWhenSingleView: true }]),
  storageId: OUTPUT_VIEW_ID,
  hideIfEmpty: true,
  windowEnablement: WindowEnablement.Both
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });
Registry.as(ViewContainerExtensions.ViewsRegistry).registerViews([{
  id: OUTPUT_VIEW_ID,
  name: nls.localize2("output", "Output"),
  containerIcon: outputViewIcon,
  canMoveView: true,
  canToggleVisibility: true,
  ctorDescriptor: new SyncDescriptor(OutputViewPane),
  openCommandActionDescriptor: {
    id: "workbench.action.output.toggleOutput",
    mnemonicTitle: nls.localize({ key: "miToggleOutput", comment: ["&& denotes a mnemonic"] }, "&&Output"),
    keybindings: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyU,
      linux: {
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyH)
        // On Ubuntu Ctrl+Shift+U is taken by some global OS command
      }
    },
    order: 1
  },
  windowEnablement: WindowEnablement.Both
}], VIEW_CONTAINER);
let OutputContribution = class extends Disposable {
  constructor(outputService, editorService) {
    super();
    this.outputService = outputService;
    this.editorService = editorService;
    this.registerActions();
  }
  registerActions() {
    this.registerSwitchOutputAction();
    this.registerAddCompoundLogAction();
    this.registerRemoveLogAction();
    this.registerShowOutputChannelsAction();
    this.registerClearOutputAction();
    this.registerToggleAutoScrollAction();
    this.registerOpenActiveOutputFileAction();
    this.registerOpenActiveOutputFileInAuxWindowAction();
    this.registerSaveActiveOutputAsAction();
    this.registerShowLogsAction();
    this.registerOpenLogFileAction();
    this.registerConfigureActiveOutputLogLevelAction();
    this.registerLogLevelFilterActions();
    this.registerClearFilterActions();
    this.registerExportLogsAction();
    this.registerImportLogAction();
  }
  registerSwitchOutputAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.output.action.switchBetweenOutputs`,
          title: nls.localize("switchBetweenOutputs.label", "Switch Output")
        });
      }
      async run(accessor, channelId) {
        if (channelId) {
          accessor.get(IOutputService).showChannel(channelId, true);
        }
      }
    }));
    const switchOutputMenu = new MenuId("workbench.output.menu.switchOutput");
    this._register(MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
      submenu: switchOutputMenu,
      title: nls.localize("switchToOutput.label", "Switch Output"),
      group: "navigation",
      when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
      order: 1,
      isSelection: true
    }));
    const registeredChannels = /* @__PURE__ */ new Map();
    this._register(toDisposable(() => dispose(registeredChannels.values())));
    const registerOutputChannels = (channels) => {
      for (const channel of channels) {
        const title = channel.label;
        const group = channel.user ? "2_user_outputchannels" : channel.extensionId ? "0_ext_outputchannels" : "1_core_outputchannels";
        registeredChannels.set(channel.id, registerAction2(class extends Action2 {
          constructor() {
            super({
              id: `workbench.action.output.show.${channel.id}`,
              title,
              toggled: ACTIVE_OUTPUT_CHANNEL_CONTEXT.isEqualTo(channel.id),
              menu: {
                id: switchOutputMenu,
                group
              }
            });
          }
          async run(accessor) {
            return accessor.get(IOutputService).showChannel(channel.id, true);
          }
        }));
      }
    };
    registerOutputChannels(this.outputService.getChannelDescriptors());
    const outputChannelRegistry = Registry.as(Extensions.OutputChannels);
    this._register(outputChannelRegistry.onDidRegisterChannel((e) => {
      const channel = this.outputService.getChannelDescriptor(e);
      if (channel) {
        registerOutputChannels([channel]);
      }
    }));
    this._register(outputChannelRegistry.onDidRemoveChannel((e) => {
      registeredChannels.get(e.id)?.dispose();
      registeredChannels.delete(e.id);
    }));
  }
  registerAddCompoundLogAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.output.addCompoundLog",
          title: nls.localize2("addCompoundLog", "Add Compound Log..."),
          category: nls.localize2("output", "Output"),
          f1: true,
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "2_add"
          }]
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const extensionLogs = [], logs = [];
        for (const channel of outputService.getChannelDescriptors()) {
          if (channel.log && !channel.user) {
            if (channel.extensionId) {
              extensionLogs.push(channel);
            } else {
              logs.push(channel);
            }
          }
        }
        const entries = [];
        for (const log of logs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        if (extensionLogs.length && logs.length) {
          entries.push({ type: "separator", label: nls.localize("extensionLogs", "Extension Logs") });
        }
        for (const log of extensionLogs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        const result = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlog", "Select Log"), canPickMany: true });
        if (result?.length) {
          outputService.showChannel(outputService.registerCompoundLogChannel(result));
        }
      }
    }));
  }
  registerRemoveLogAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.output.remove",
          title: nls.localize2("removeLog", "Remove Output..."),
          category: nls.localize2("output", "Output"),
          f1: true
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const notificationService = accessor.get(INotificationService);
        const entries = outputService.getChannelDescriptors().filter((channel) => channel.user);
        if (entries.length === 0) {
          notificationService.info(nls.localize("nocustumoutput", "No custom outputs to remove."));
          return;
        }
        const result = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlog", "Select Log"), canPickMany: true });
        if (!result?.length) {
          return;
        }
        const outputChannelRegistry = Registry.as(Extensions.OutputChannels);
        for (const channel of result) {
          outputChannelRegistry.removeChannel(channel.id);
        }
      }
    }));
  }
  registerShowOutputChannelsAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.showOutputChannels",
          title: nls.localize2("showOutputChannels", "Show Output Channels..."),
          category: nls.localize2("output", "Output"),
          f1: true
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const extensionChannels = [], coreChannels = [];
        for (const channel of outputService.getChannelDescriptors()) {
          if (channel.extensionId) {
            extensionChannels.push(channel);
          } else {
            coreChannels.push(channel);
          }
        }
        const entries = [];
        for (const { id, label } of extensionChannels) {
          entries.push({ id, label });
        }
        if (extensionChannels.length && coreChannels.length) {
          entries.push({ type: "separator" });
        }
        for (const { id, label } of coreChannels) {
          entries.push({ id, label });
        }
        const entry = await quickInputService.pick(entries, { placeHolder: nls.localize("selectOutput", "Select Output Channel") });
        if (entry) {
          return outputService.showChannel(entry.id);
        }
      }
    }));
  }
  registerClearOutputAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.output.action.clearOutput`,
          title: nls.localize2("clearOutput.label", "Clear Output"),
          category: Categories.View,
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "navigation",
            order: 2
          }, {
            id: MenuId.CommandPalette
          }, {
            id: MenuId.EditorContext,
            when: CONTEXT_IN_OUTPUT
          }],
          icon: Codicon.clearAll
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
        const activeChannel = outputService.getActiveChannel();
        if (activeChannel) {
          activeChannel.clear();
          accessibilitySignalService.playSignal(AccessibilitySignal.clear);
        }
      }
    }));
  }
  registerToggleAutoScrollAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.output.action.toggleAutoScroll`,
          title: nls.localize2("toggleAutoScroll", "Toggle Auto Scrolling"),
          tooltip: nls.localize("outputScrollOff", "Turn Auto Scrolling Off"),
          menu: {
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OUTPUT_VIEW_ID)),
            group: "navigation",
            order: 3
          },
          icon: Codicon.lock,
          toggled: {
            condition: CONTEXT_OUTPUT_SCROLL_LOCK,
            icon: Codicon.unlock,
            tooltip: nls.localize("outputScrollOn", "Turn Auto Scrolling On")
          }
        });
      }
      async run(accessor) {
        const outputView = accessor.get(IViewsService).getActiveViewWithId(OUTPUT_VIEW_ID);
        outputView.scrollLock = !outputView.scrollLock;
      }
    }));
  }
  registerOpenActiveOutputFileAction() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.openActiveLogOutputFile`,
          title: nls.localize2("openActiveOutputFile", "Open Output in Editor"),
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "navigation",
            order: 4,
            isHiddenByDefault: true
          }],
          icon: Codicon.goToFile
        });
      }
      async run() {
        that.openActiveOutput();
      }
    }));
  }
  registerOpenActiveOutputFileInAuxWindowAction() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.openActiveLogOutputFileInNewWindow`,
          title: nls.localize2("openActiveOutputFileInNewWindow", "Open Output in New Window"),
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "navigation",
            order: 5,
            isHiddenByDefault: true
          }],
          icon: Codicon.emptyWindow
        });
      }
      async run() {
        that.openActiveOutput(AUX_WINDOW_GROUP);
      }
    }));
  }
  registerSaveActiveOutputAsAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.saveActiveLogOutputAs`,
          title: nls.localize2("saveActiveOutputAs", "Save Output As..."),
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "1_export",
            order: 1
          }]
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const channel = outputService.getActiveChannel();
        if (channel) {
          const descriptor = outputService.getChannelDescriptors().find((c) => c.id === channel.id);
          if (descriptor) {
            await outputService.saveOutputAs(void 0, descriptor);
          }
        }
      }
    }));
  }
  async openActiveOutput(group) {
    const channel = this.outputService.getActiveChannel();
    if (channel) {
      await this.editorService.openEditor({
        resource: channel.uri,
        options: {
          pinned: true
        }
      }, group);
    }
  }
  registerConfigureActiveOutputLogLevelAction() {
    const logLevelMenu = new MenuId("workbench.output.menu.logLevel");
    this._register(MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
      submenu: logLevelMenu,
      title: nls.localize("logLevel.label", "Set Log Level..."),
      group: "navigation",
      when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OUTPUT_VIEW_ID), CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE),
      icon: Codicon.gear,
      order: 6
    }));
    let order = 0;
    const registerLogLevel = (logLevel) => {
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `workbench.action.output.activeOutputLogLevel.${logLevel}`,
            title: LogLevelToLocalizedString(logLevel).value,
            toggled: CONTEXT_ACTIVE_OUTPUT_LEVEL.isEqualTo(LogLevelToString(logLevel)),
            menu: {
              id: logLevelMenu,
              order: order++,
              group: "0_level"
            }
          });
        }
        async run(accessor) {
          const outputService = accessor.get(IOutputService);
          const channel = outputService.getActiveChannel();
          if (channel) {
            const channelDescriptor = outputService.getChannelDescriptor(channel.id);
            if (channelDescriptor) {
              outputService.setLogLevel(channelDescriptor, logLevel);
            }
          }
        }
      }));
    };
    registerLogLevel(LogLevel.Trace);
    registerLogLevel(LogLevel.Debug);
    registerLogLevel(LogLevel.Info);
    registerLogLevel(LogLevel.Warning);
    registerLogLevel(LogLevel.Error);
    registerLogLevel(LogLevel.Off);
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.output.activeOutputLogLevelDefault`,
          title: nls.localize("logLevelDefault.label", "Set As Default"),
          menu: {
            id: logLevelMenu,
            order,
            group: "1_default"
          },
          precondition: CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT.negate()
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const loggerService = accessor.get(ILoggerService);
        const defaultLogLevelsService = accessor.get(IDefaultLogLevelsService);
        const channel = outputService.getActiveChannel();
        if (channel) {
          const channelDescriptor = outputService.getChannelDescriptor(channel.id);
          if (channelDescriptor && isSingleSourceOutputChannelDescriptor(channelDescriptor)) {
            const logLevel = loggerService.getLogLevel(channelDescriptor.source.resource);
            return await defaultLogLevelsService.setDefaultLogLevel(logLevel, channelDescriptor.extensionId);
          }
        }
      }
    }));
  }
  registerShowLogsAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.showLogs",
          title: nls.localize2("showLogs", "Show Logs..."),
          category: Categories.Developer,
          menu: {
            id: MenuId.CommandPalette
          }
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const extensionLogs = [], logs = [];
        for (const channel of outputService.getChannelDescriptors()) {
          if (channel.log) {
            if (channel.extensionId) {
              extensionLogs.push(channel);
            } else {
              logs.push(channel);
            }
          }
        }
        const entries = [];
        for (const { id, label } of logs) {
          entries.push({ id, label });
        }
        if (extensionLogs.length && logs.length) {
          entries.push({ type: "separator", label: nls.localize("extensionLogs", "Extension Logs") });
        }
        for (const { id, label } of extensionLogs) {
          entries.push({ id, label });
        }
        const entry = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlog", "Select Log") });
        if (entry) {
          return outputService.showChannel(entry.id);
        }
      }
    }));
  }
  registerOpenLogFileAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openLogFile",
          title: nls.localize2("openLogFile", "Open Log..."),
          category: Categories.Developer,
          menu: {
            id: MenuId.CommandPalette
          },
          metadata: {
            description: "workbench.action.openLogFile",
            args: [{
              name: "logFile",
              schema: {
                markdownDescription: nls.localize("logFile", 'The id of the log file to open, for example `"window"`. Currently the best way to get this is to get the ID by checking the `workbench.action.output.show.<id>` commands'),
                type: "string"
              }
            }]
          }
        });
      }
      async run(accessor, args) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const editorService = accessor.get(IEditorService);
        let entry;
        const argName = args && typeof args === "string" ? args : void 0;
        const extensionChannels = [];
        const coreChannels = [];
        for (const c of outputService.getChannelDescriptors()) {
          if (c.log) {
            const e = { id: c.id, label: c.label };
            if (c.extensionId) {
              extensionChannels.push(e);
            } else {
              coreChannels.push(e);
            }
            if (e.id === argName) {
              entry = e;
            }
          }
        }
        if (!entry) {
          const entries = [...extensionChannels.sort((a, b) => a.label.localeCompare(b.label))];
          if (entries.length && coreChannels.length) {
            entries.push({ type: "separator" });
            entries.push(...coreChannels.sort((a, b) => a.label.localeCompare(b.label)));
          }
          entry = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlogFile", "Select Log File") });
        }
        if (entry?.id) {
          const channel = outputService.getChannel(entry.id);
          if (channel) {
            await editorService.openEditor({
              resource: channel.uri,
              options: {
                pinned: true
              }
            });
          }
        }
      }
    }));
  }
  registerLogLevelFilterActions() {
    let order = 0;
    const registerLogLevel = (logLevel, toggled) => {
      this._register(registerAction2(class extends ViewAction {
        constructor() {
          super({
            id: `workbench.actions.${OUTPUT_VIEW_ID}.toggle.${LogLevelToString(logLevel)}`,
            title: LogLevelToLocalizedString(logLevel).value,
            metadata: {
              description: localize2("toggleTraceDescription", "Show or hide {0} messages in the output", LogLevelToString(logLevel))
            },
            toggled,
            menu: {
              id: viewFilterSubmenu,
              group: "2_log_filter",
              when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OUTPUT_VIEW_ID), CONTEXT_ACTIVE_LOG_FILE_OUTPUT),
              order: order++
            },
            viewId: OUTPUT_VIEW_ID
          });
        }
        async runInView(serviceAccessor, view) {
          this.toggleLogLevelFilter(serviceAccessor.get(IOutputService), logLevel);
        }
        toggleLogLevelFilter(outputService, logLevel2) {
          switch (logLevel2) {
            case LogLevel.Trace:
              outputService.filters.trace = !outputService.filters.trace;
              break;
            case LogLevel.Debug:
              outputService.filters.debug = !outputService.filters.debug;
              break;
            case LogLevel.Info:
              outputService.filters.info = !outputService.filters.info;
              break;
            case LogLevel.Warning:
              outputService.filters.warning = !outputService.filters.warning;
              break;
            case LogLevel.Error:
              outputService.filters.error = !outputService.filters.error;
              break;
          }
        }
      }));
    };
    registerLogLevel(LogLevel.Trace, SHOW_TRACE_FILTER_CONTEXT);
    registerLogLevel(LogLevel.Debug, SHOW_DEBUG_FILTER_CONTEXT);
    registerLogLevel(LogLevel.Info, SHOW_INFO_FILTER_CONTEXT);
    registerLogLevel(LogLevel.Warning, SHOW_WARNING_FILTER_CONTEXT);
    registerLogLevel(LogLevel.Error, SHOW_ERROR_FILTER_CONTEXT);
  }
  registerClearFilterActions() {
    this._register(registerAction2(class extends ViewAction {
      constructor() {
        super({
          id: `workbench.actions.${OUTPUT_VIEW_ID}.clearFilterText`,
          title: localize("clearFiltersText", "Clear filters text"),
          keybinding: {
            when: OUTPUT_FILTER_FOCUS_CONTEXT,
            weight: KeybindingWeight.WorkbenchContrib,
            primary: KeyCode.Escape
          },
          viewId: OUTPUT_VIEW_ID
        });
      }
      async runInView(serviceAccessor, outputView) {
        outputView.clearFilterText();
      }
    }));
  }
  registerExportLogsAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.exportLogs`,
          title: nls.localize2("exportLogs", "Export Logs..."),
          f1: true,
          category: Categories.Developer,
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "1_export",
            order: 2
          }]
        });
      }
      async run(accessor, arg) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const extensionLogs = [], logs = [], userLogs = [];
        for (const channel of outputService.getChannelDescriptors()) {
          if (channel.log) {
            if (channel.extensionId) {
              extensionLogs.push(channel);
            } else if (channel.user) {
              userLogs.push(channel);
            } else {
              logs.push(channel);
            }
          }
        }
        const entries = [];
        for (const log of logs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        if (extensionLogs.length && logs.length) {
          entries.push({ type: "separator", label: nls.localize("extensionLogs", "Extension Logs") });
        }
        for (const log of extensionLogs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        if (userLogs.length && (extensionLogs.length || logs.length)) {
          entries.push({ type: "separator", label: nls.localize("userLogs", "User Logs") });
        }
        for (const log of userLogs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        let selectedOutputChannels;
        if (arg?.outputChannelIds) {
          const requestedIdsNormalized = arg.outputChannelIds.map((id) => id.trim().toLowerCase());
          const candidates = entries.filter((e) => {
            const isSeparator = hasKey(e, { type: true }) && e.type === "separator";
            return !isSeparator;
          });
          if (requestedIdsNormalized.includes("*")) {
            selectedOutputChannels = candidates;
          } else {
            selectedOutputChannels = candidates.filter((candidate) => requestedIdsNormalized.includes(candidate.id.toLowerCase()));
          }
        } else {
          selectedOutputChannels = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlog", "Select Log"), canPickMany: true });
        }
        if (selectedOutputChannels?.length) {
          await outputService.saveOutputAs(arg?.outputPath, ...selectedOutputChannels);
        }
      }
    }));
  }
  registerImportLogAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.importLog`,
          title: nls.localize2("importLog", "Import Log..."),
          f1: true,
          category: Categories.Developer,
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "2_add",
            order: 2
          }]
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const fileDialogService = accessor.get(IFileDialogService);
        const result = await fileDialogService.showOpenDialog({
          title: nls.localize("importLogFile", "Import Log File"),
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: true,
          filters: [{
            name: nls.localize("logFiles", "Log Files"),
            extensions: ["log"]
          }]
        });
        if (result?.length) {
          const channelName = basename(result[0]);
          const channelId = `${IMPORTED_LOG_ID_PREFIX}${Date.now()}`;
          Registry.as(Extensions.OutputChannels).registerChannel({
            id: channelId,
            label: channelName,
            log: true,
            user: true,
            source: result.length === 1 ? { resource: result[0] } : result.map((resource) => ({ resource, name: basename(resource).split(".")[0] }))
          });
          outputService.showChannel(channelId);
        }
      }
    }));
  }
};
OutputContribution = __decorateClass([
  __decorateParam(0, IOutputService),
  __decorateParam(1, IEditorService)
], OutputContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(OutputContribution, LifecyclePhase.Restored);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "output",
  order: 30,
  title: nls.localize("output", "Output"),
  type: "object",
  properties: {
    "output.smartScroll.enabled": {
      type: "boolean",
      description: nls.localize("output.smartScroll.enabled", "Enable/disable the ability of smart scrolling in the output view. Smart scrolling allows you to lock scrolling automatically when you click in the output view and unlocks when you click in the last line."),
      default: true,
      scope: ConfigurationScope.WINDOW,
      tags: ["output"]
    }
  }
});
KeybindingsRegistry.registerKeybindingRule({
  id: "cursorWordAccessibilityLeft",
  when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
  primary: KeyMod.CtrlCmd | KeyCode.LeftArrow,
  weight: KeybindingWeight.WorkbenchContrib
});
KeybindingsRegistry.registerKeybindingRule({
  id: "cursorWordAccessibilityLeftSelect",
  when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.LeftArrow,
  weight: KeybindingWeight.WorkbenchContrib
});
KeybindingsRegistry.registerKeybindingRule({
  id: "cursorWordAccessibilityRight",
  when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
  primary: KeyMod.CtrlCmd | KeyCode.RightArrow,
  weight: KeybindingWeight.WorkbenchContrib
});
KeybindingsRegistry.registerKeybindingRule({
  id: "cursorWordAccessibilityRightSelect",
  when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.RightArrow,
  weight: KeybindingWeight.WorkbenchContrib
});
