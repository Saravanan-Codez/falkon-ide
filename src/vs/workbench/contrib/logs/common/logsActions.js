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
import { Action } from "../../../../base/common/actions.js";
import { ILoggerService, LogLevel, LogLevelToLocalizedString, isLogLevel } from "../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { dirname, basename, isEqual } from "../../../../base/common/resources.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IOutputService, isMultiSourceOutputChannelDescriptor, isSingleSourceOutputChannelDescriptor } from "../../../services/output/common/output.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IDefaultLogLevelsService } from "../../../services/log/common/defaultLogLevels.js";
let SetLogLevelAction = class extends Action {
  constructor(id, label, quickInputService, loggerService, outputService, defaultLogLevelsService) {
    super(id, label);
    this.quickInputService = quickInputService;
    this.loggerService = loggerService;
    this.outputService = outputService;
    this.defaultLogLevelsService = defaultLogLevelsService;
  }
  static {
    this.ID = "workbench.action.setLogLevel";
  }
  static {
    this.TITLE = nls.localize2("setLogLevel", "Set Log Level...");
  }
  async run() {
    const logLevelOrChannel = await this.selectLogLevelOrChannel();
    if (logLevelOrChannel !== null) {
      if (isLogLevel(logLevelOrChannel)) {
        this.loggerService.setLogLevel(logLevelOrChannel);
      } else {
        await this.setLogLevelForChannel(logLevelOrChannel);
      }
    }
  }
  async selectLogLevelOrChannel() {
    const defaultLogLevels = this.defaultLogLevelsService.defaultLogLevels;
    const extensionLogs = [], logs = [];
    const logLevel = this.loggerService.getLogLevel();
    for (const channel of this.outputService.getChannelDescriptors()) {
      if (!this.outputService.canSetLogLevel(channel)) {
        continue;
      }
      const sources = isSingleSourceOutputChannelDescriptor(channel) ? [channel.source] : isMultiSourceOutputChannelDescriptor(channel) ? channel.source : [];
      if (!sources.length) {
        continue;
      }
      const channelLogLevel = sources.reduce((prev, curr) => Math.min(prev, this.loggerService.getLogLevel(curr.resource) ?? logLevel), logLevel);
      const item = {
        id: channel.id,
        label: channel.label,
        description: channelLogLevel !== logLevel ? this.getLabel(channelLogLevel) : void 0,
        channel
      };
      if (channel.extensionId) {
        extensionLogs.push(item);
      } else {
        logs.push(item);
      }
    }
    const entries = [];
    entries.push({ type: "separator", label: nls.localize("all", "All") });
    entries.push(...this.getLogLevelEntries(defaultLogLevels.default, this.loggerService.getLogLevel(), true));
    if (extensionLogs.length) {
      entries.push({ type: "separator", label: nls.localize("extensionLogs", "Extension Logs") });
      entries.push(...extensionLogs.sort((a, b) => a.label.localeCompare(b.label)));
    }
    entries.push({ type: "separator", label: nls.localize("loggers", "Logs") });
    entries.push(...logs.sort((a, b) => a.label.localeCompare(b.label)));
    return new Promise((resolve, reject) => {
      const disposables = new DisposableStore();
      const quickPick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
      quickPick.placeholder = nls.localize("selectlog", "Set Log Level");
      quickPick.items = entries;
      let selectedItem;
      disposables.add(quickPick.onDidTriggerItemButton((e) => {
        quickPick.hide();
        this.defaultLogLevelsService.setDefaultLogLevel(e.item.level);
      }));
      disposables.add(quickPick.onDidAccept((e) => {
        selectedItem = quickPick.selectedItems[0];
        quickPick.hide();
      }));
      disposables.add(quickPick.onDidHide(() => {
        const result = selectedItem ? selectedItem.level ?? selectedItem : null;
        disposables.dispose();
        resolve(result);
      }));
      quickPick.show();
    });
  }
  async setLogLevelForChannel(logChannel) {
    const defaultLogLevels = this.defaultLogLevelsService.defaultLogLevels;
    const defaultLogLevel = defaultLogLevels.extensions.find((e) => e[0] === logChannel.channel.extensionId?.toLowerCase())?.[1] ?? defaultLogLevels.default;
    const entries = this.getLogLevelEntries(defaultLogLevel, this.outputService.getLogLevel(logChannel.channel) ?? defaultLogLevel, !!logChannel.channel.extensionId);
    return new Promise((resolve, reject) => {
      const disposables = new DisposableStore();
      const quickPick = disposables.add(this.quickInputService.createQuickPick());
      quickPick.placeholder = logChannel ? nls.localize("selectLogLevelFor", " {0}: Select log level", logChannel?.label) : nls.localize("selectLogLevel", "Select log level");
      quickPick.items = entries;
      quickPick.activeItems = entries.filter((entry) => entry.level === this.loggerService.getLogLevel());
      let selectedItem;
      disposables.add(quickPick.onDidTriggerItemButton((e) => {
        quickPick.hide();
        this.defaultLogLevelsService.setDefaultLogLevel(e.item.level, logChannel.channel.extensionId);
      }));
      disposables.add(quickPick.onDidAccept((e) => {
        selectedItem = quickPick.selectedItems[0];
        quickPick.hide();
      }));
      disposables.add(quickPick.onDidHide(() => {
        if (selectedItem) {
          this.outputService.setLogLevel(logChannel.channel, selectedItem.level);
        }
        disposables.dispose();
        resolve();
      }));
      quickPick.show();
    });
  }
  getLogLevelEntries(defaultLogLevel, currentLogLevel, canSetDefaultLogLevel) {
    const button = canSetDefaultLogLevel ? { iconClass: ThemeIcon.asClassName(Codicon.checkAll), tooltip: nls.localize("resetLogLevel", "Set as Default Log Level") } : void 0;
    return [
      { label: this.getLabel(LogLevel.Trace, currentLogLevel), level: LogLevel.Trace, description: this.getDescription(LogLevel.Trace, defaultLogLevel), buttons: button && defaultLogLevel !== LogLevel.Trace ? [button] : void 0 },
      { label: this.getLabel(LogLevel.Debug, currentLogLevel), level: LogLevel.Debug, description: this.getDescription(LogLevel.Debug, defaultLogLevel), buttons: button && defaultLogLevel !== LogLevel.Debug ? [button] : void 0 },
      { label: this.getLabel(LogLevel.Info, currentLogLevel), level: LogLevel.Info, description: this.getDescription(LogLevel.Info, defaultLogLevel), buttons: button && defaultLogLevel !== LogLevel.Info ? [button] : void 0 },
      { label: this.getLabel(LogLevel.Warning, currentLogLevel), level: LogLevel.Warning, description: this.getDescription(LogLevel.Warning, defaultLogLevel), buttons: button && defaultLogLevel !== LogLevel.Warning ? [button] : void 0 },
      { label: this.getLabel(LogLevel.Error, currentLogLevel), level: LogLevel.Error, description: this.getDescription(LogLevel.Error, defaultLogLevel), buttons: button && defaultLogLevel !== LogLevel.Error ? [button] : void 0 },
      { label: this.getLabel(LogLevel.Off, currentLogLevel), level: LogLevel.Off, description: this.getDescription(LogLevel.Off, defaultLogLevel), buttons: button && defaultLogLevel !== LogLevel.Off ? [button] : void 0 }
    ];
  }
  getLabel(level, current) {
    const label = LogLevelToLocalizedString(level).value;
    return level === current ? `$(check) ${label}` : label;
  }
  getDescription(level, defaultLogLevel) {
    return defaultLogLevel === level ? nls.localize("default", "Default") : void 0;
  }
};
SetLogLevelAction = __decorateClass([
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, ILoggerService),
  __decorateParam(4, IOutputService),
  __decorateParam(5, IDefaultLogLevelsService)
], SetLogLevelAction);
let OpenWindowSessionLogFileAction = class extends Action {
  constructor(id, label, environmentService, fileService, quickInputService, editorService) {
    super(id, label);
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.quickInputService = quickInputService;
    this.editorService = editorService;
  }
  static {
    this.ID = "workbench.action.openSessionLogFile";
  }
  static {
    this.TITLE = nls.localize2("openSessionLogFile", "Open Window Log File (Session)...");
  }
  async run() {
    const sessionResult = await this.quickInputService.pick(
      this.getSessions().then((sessions) => sessions.map((s, index) => ({
        id: s.toString(),
        label: basename(s),
        description: index === 0 ? nls.localize("current", "Current") : void 0
      }))),
      {
        canPickMany: false,
        placeHolder: nls.localize("sessions placeholder", "Select Session")
      }
    );
    if (sessionResult) {
      const logFileResult = await this.quickInputService.pick(
        this.getLogFiles(URI.parse(sessionResult.id)).then((logFiles) => logFiles.map((s) => ({
          id: s.toString(),
          label: basename(s)
        }))),
        {
          canPickMany: false,
          placeHolder: nls.localize("log placeholder", "Select Log file")
        }
      );
      if (logFileResult) {
        return this.editorService.openEditor({ resource: URI.parse(logFileResult.id), options: { pinned: true } }).then(() => void 0);
      }
    }
  }
  async getSessions() {
    const logsPath = this.environmentService.logsHome.with({ scheme: this.environmentService.logFile.scheme });
    const result = [logsPath];
    const stat = await this.fileService.resolve(dirname(logsPath));
    if (stat.children) {
      result.push(...stat.children.filter((stat2) => !isEqual(stat2.resource, logsPath) && stat2.isDirectory && /^\d{8}T\d{6}$/.test(stat2.name)).sort().reverse().map((d) => d.resource));
    }
    return result;
  }
  async getLogFiles(session) {
    const stat = await this.fileService.resolve(session);
    if (stat.children) {
      return stat.children.filter((stat2) => !stat2.isDirectory).map((stat2) => stat2.resource);
    }
    return [];
  }
};
OpenWindowSessionLogFileAction = __decorateClass([
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IQuickInputService),
  __decorateParam(5, IEditorService)
], OpenWindowSessionLogFileAction);
export {
  OpenWindowSessionLogFileAction,
  SetLogLevelAction
};
