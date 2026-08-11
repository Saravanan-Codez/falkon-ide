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
import { localize } from "../../../../nls.js";
import { URI } from "../../../../base/common/uri.js";
import { TextResourceEditorInput } from "../../../common/editor/textResourceEditorInput.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ILifecycleService, LifecyclePhase, StartupKindToString } from "../../../services/lifecycle/common/lifecycle.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { writeTransientState } from "../../codeEditor/browser/toggleWordWrap.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ByteSize, IFileService } from "../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { ITerminalService } from "../../terminal/browser/terminal.js";
import * as perf from "../../../../base/common/performance.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions, getWorkbenchContribution } from "../../../common/contributions.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
let PerfviewContrib = class {
  constructor(_instaService, textModelResolverService) {
    this._instaService = _instaService;
    this._inputUri = URI.from({ scheme: "perf", path: "Startup Performance" });
    this._registration = textModelResolverService.registerTextModelContentProvider("perf", _instaService.createInstance(PerfModelContentProvider));
  }
  static get() {
    return getWorkbenchContribution(PerfviewContrib.ID);
  }
  static {
    this.ID = "workbench.contrib.perfview";
  }
  dispose() {
    this._registration.dispose();
  }
  getInputUri() {
    return this._inputUri;
  }
  getEditorInput() {
    return this._instaService.createInstance(PerfviewInput);
  }
};
PerfviewContrib = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ITextModelService)
], PerfviewContrib);
let PerfviewInput = class extends TextResourceEditorInput {
  static {
    this.Id = "PerfviewInput";
  }
  get typeId() {
    return PerfviewInput.Id;
  }
  constructor(textModelResolverService, textFileService, editorService, fileService, labelService, filesConfigurationService, textResourceConfigurationService, customEditorLabelService) {
    super(
      PerfviewContrib.get().getInputUri(),
      localize("name", "Startup Performance"),
      void 0,
      void 0,
      void 0,
      textModelResolverService,
      textFileService,
      editorService,
      fileService,
      labelService,
      filesConfigurationService,
      textResourceConfigurationService,
      customEditorLabelService
    );
  }
};
PerfviewInput = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, IFilesConfigurationService),
  __decorateParam(6, ITextResourceConfigurationService),
  __decorateParam(7, ICustomEditorLabelService)
], PerfviewInput);
let PerfModelContentProvider = class {
  constructor(_modelService, _languageService, _editorService, _lifecycleService, _timerService, _extensionService, _productService, _remoteAgentService, _terminalService) {
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._editorService = _editorService;
    this._lifecycleService = _lifecycleService;
    this._timerService = _timerService;
    this._extensionService = _extensionService;
    this._productService = _productService;
    this._remoteAgentService = _remoteAgentService;
    this._terminalService = _terminalService;
    this._modelDisposables = [];
  }
  provideTextContent(resource) {
    if (!this._model || this._model.isDisposed()) {
      this._modelDisposables = dispose(this._modelDisposables);
      const langId = this._languageService.createById("markdown");
      this._model = this._modelService.getModel(resource) || this._modelService.createModel("Loading...", langId, resource);
      this._modelDisposables.push(langId.onDidChange((e) => {
        this._model?.setLanguage(e);
      }));
      this._modelDisposables.push(this._extensionService.onDidChangeExtensionsStatus(this._updateModel, this));
      writeTransientState(this._model, { wordWrapOverride: "off" }, this._editorService);
    }
    this._updateModel();
    return Promise.resolve(this._model);
  }
  _updateModel() {
    Promise.all([
      this._timerService.whenReady(),
      this._lifecycleService.when(LifecyclePhase.Eventually),
      this._extensionService.whenInstalledExtensionsRegistered(),
      // The terminal service never connects to the pty host on the web
      isWeb && !this._remoteAgentService.getConnection()?.remoteAuthority ? Promise.resolve() : this._terminalService.whenConnected
    ]).then(() => {
      if (this._model && !this._model.isDisposed()) {
        const md = new MarkdownBuilder();
        this._addSummary(md);
        md.blank();
        this._addSummaryTable(md);
        md.blank();
        this._addExtensionsTable(md);
        md.blank();
        this._addPerfMarksTable("Terminal Stats", md, this._timerService.getPerformanceMarks().find((e) => e[0] === "renderer")?.[1].filter((e) => e.name.startsWith("code/terminal/")));
        md.blank();
        this._addAgentHostPerfMarksTable(md);
        md.blank();
        this._addWorkbenchContributionsPerfMarksTable(md);
        md.blank();
        this._addRawPerfMarks(md);
        md.blank();
        this._addResourceTimingStats(md);
        this._model.setValue(md.value);
      }
    });
  }
  _addSummary(md) {
    const metrics = this._timerService.startupMetrics;
    md.heading(2, "System Info");
    md.li(`${this._productService.nameShort}: ${this._productService.version} (${this._productService.commit || "0000000"})`);
    md.li(`OS: ${metrics.platform}(${metrics.release})`);
    if (metrics.cpus) {
      md.li(`CPUs: ${metrics.cpus.model}(${metrics.cpus.count} x ${metrics.cpus.speed})`);
    }
    if (typeof metrics.totalmem === "number" && typeof metrics.freemem === "number") {
      md.li(`Memory(System): ${(metrics.totalmem / ByteSize.GB).toFixed(2)} GB(${(metrics.freemem / ByteSize.GB).toFixed(2)}GB free)`);
    }
    if (metrics.meminfo) {
      md.li(`Memory(Process): ${(metrics.meminfo.workingSetSize / ByteSize.KB).toFixed(2)} MB working set(${(metrics.meminfo.privateBytes / ByteSize.KB).toFixed(2)}MB private, ${(metrics.meminfo.sharedBytes / ByteSize.KB).toFixed(2)}MB shared)`);
    }
    md.li(`VM(likelihood): ${metrics.isVMLikelyhood}%`);
    md.li(`Initial Startup: ${metrics.initialStartup}`);
    md.li(`Has ${metrics.windowCount - 1} other windows`);
    md.li(`Screen Reader Active: ${metrics.hasAccessibilitySupport}`);
    md.li(`Empty Workspace: ${metrics.emptyWorkbench}`);
  }
  _addSummaryTable(md) {
    const metrics = this._timerService.startupMetrics;
    const contribTimings = Registry.as(WorkbenchExtensions.Workbench).timings;
    const table = [];
    table.push(["import(main.js)", metrics.timers.ellapsedLoadMainBundle, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["start => app.isReady", metrics.timers.ellapsedAppReady, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["nls:start => nls:end", metrics.timers.ellapsedNlsGeneration, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["run main.js", metrics.timers.ellapsedRunMainBundle, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["start crash reporter", metrics.timers.ellapsedCrashReporter, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["serve main IPC handle", metrics.timers.ellapsedMainServer, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["create window", metrics.timers.ellapsedWindowCreate, "[main]", `initial startup: ${metrics.initialStartup}, ${metrics.initialStartup ? `state: ${metrics.timers.ellapsedWindowRestoreState}ms, widget: ${metrics.timers.ellapsedBrowserWindowCreate}ms, show: ${metrics.timers.ellapsedWindowMaximize}ms` : ""}`]);
    table.push(["app.isReady => window.loadUrl()", metrics.timers.ellapsedWindowLoad, "[main]", `initial startup: ${metrics.initialStartup}`]);
    table.push(["window.loadUrl() => begin to import(workbench.desktop.main.js)", metrics.timers.ellapsedWindowLoadToRequire, "[main->renderer]", StartupKindToString(metrics.windowKind)]);
    table.push(["import(workbench.desktop.main.js)", metrics.timers.ellapsedRequire, "[renderer]", `cached data: ${metrics.didUseCachedData ? "YES" : "NO"}`]);
    table.push(["wait for window config", metrics.timers.ellapsedWaitForWindowConfig, "[renderer]", void 0]);
    table.push(["init storage (global & workspace)", metrics.timers.ellapsedStorageInit, "[renderer]", void 0]);
    table.push(["init workspace service", metrics.timers.ellapsedWorkspaceServiceInit, "[renderer]", void 0]);
    if (isWeb) {
      table.push(["init settings and global state from settings sync service", metrics.timers.ellapsedRequiredUserDataInit, "[renderer]", void 0]);
      table.push(["init keybindings, snippets & extensions from settings sync service", metrics.timers.ellapsedOtherUserDataInit, "[renderer]", void 0]);
    }
    table.push(["register extensions & spawn extension host", metrics.timers.ellapsedExtensions, "[renderer]", void 0]);
    table.push(["restore primary viewlet", metrics.timers.ellapsedViewletRestore, "[renderer]", metrics.viewletId]);
    table.push(["restore secondary viewlet", metrics.timers.ellapsedAuxiliaryViewletRestore, "[renderer]", metrics.auxiliaryViewletId]);
    table.push(["restore panel", metrics.timers.ellapsedPanelRestore, "[renderer]", metrics.panelId]);
    table.push(["restore & resolve visible editors", metrics.timers.ellapsedEditorRestore, "[renderer]", `${metrics.editorIds.length}: ${metrics.editorIds.join(", ")}`]);
    table.push(["create workbench contributions", metrics.timers.ellapsedWorkbenchContributions, "[renderer]", `${(contribTimings.get(LifecyclePhase.Starting)?.length ?? 0) + (contribTimings.get(LifecyclePhase.Ready)?.length ?? 0)} blocking startup`]);
    table.push(["overall workbench load", metrics.timers.ellapsedWorkbench, "[renderer]", void 0]);
    table.push(["workbench ready", metrics.ellapsed, "[main->renderer]", void 0]);
    table.push(["renderer ready", metrics.timers.ellapsedRenderer, "[renderer]", void 0]);
    table.push(["shared process connection ready", metrics.timers.ellapsedSharedProcesConnected, "[renderer->sharedprocess]", void 0]);
    table.push(["extensions registered", metrics.timers.ellapsedExtensionsReady, "[renderer]", void 0]);
    md.heading(2, "Performance Marks");
    md.table(["What", "Duration", "Process", "Info"], table);
  }
  _addExtensionsTable(md) {
    const eager = [];
    const normal = [];
    const extensionsStatus = this._extensionService.getExtensionsStatus();
    for (const id in extensionsStatus) {
      const { activationTimes: times } = extensionsStatus[id];
      if (!times) {
        continue;
      }
      if (times.activationReason.startup) {
        eager.push([id, times.activationReason.startup, times.codeLoadingTime, times.activateCallTime, times.activateResolvedTime, times.activationReason.activationEvent, times.activationReason.extensionId.value]);
      } else {
        normal.push([id, times.activationReason.startup, times.codeLoadingTime, times.activateCallTime, times.activateResolvedTime, times.activationReason.activationEvent, times.activationReason.extensionId.value]);
      }
    }
    const table = eager.concat(normal);
    if (table.length > 0) {
      md.heading(2, "Extension Activation Stats");
      md.table(
        ["Extension", "Eager", "Load Code", "Call Activate", "Finish Activate", "Event", "By"],
        table
      );
    }
  }
  _addPerfMarksTable(name, md, marks) {
    if (!marks) {
      return;
    }
    const table = [];
    let lastStartTime = -1;
    let total = 0;
    for (const { name: name2, startTime } of marks) {
      const delta = lastStartTime !== -1 ? startTime - lastStartTime : 0;
      total += delta;
      table.push([name2, Math.round(startTime), Math.round(delta), Math.round(total)]);
      lastStartTime = startTime;
    }
    if (name) {
      md.heading(2, name);
    }
    md.table(["Name", "Timestamp", "Delta", "Total"], table);
  }
  _addAgentHostPerfMarksTable(md) {
    const marks = perf.getMarks();
    if (!marks.some((mark) => mark.name.startsWith("code/agentHost/"))) {
      return;
    }
    this._addPerfMarksTable("Agent Host Startup", md, marks.filter((mark) => mark.name === "code/timeOrigin" || mark.name.startsWith("code/agentHost/")));
  }
  _addWorkbenchContributionsPerfMarksTable(md) {
    md.heading(2, "Workbench Contributions Blocking Restore");
    const timings = Registry.as(WorkbenchExtensions.Workbench).timings;
    md.li(`Total (LifecyclePhase.Starting): ${timings.get(LifecyclePhase.Starting)?.length} (${timings.get(LifecyclePhase.Starting)?.reduce((p, c) => p + c[1], 0)}ms)`);
    md.li(`Total (LifecyclePhase.Ready): ${timings.get(LifecyclePhase.Ready)?.length} (${timings.get(LifecyclePhase.Ready)?.reduce((p, c) => p + c[1], 0)}ms)`);
    md.blank();
    const marks = this._timerService.getPerformanceMarks().find((e) => e[0] === "renderer")?.[1].filter(
      (e) => e.name.startsWith("code/willCreateWorkbenchContribution/1") || e.name.startsWith("code/didCreateWorkbenchContribution/1") || e.name.startsWith("code/willCreateWorkbenchContribution/2") || e.name.startsWith("code/didCreateWorkbenchContribution/2")
    );
    this._addPerfMarksTable(void 0, md, marks);
  }
  _addRawPerfMarks(md) {
    for (const [source, marks] of this._timerService.getPerformanceMarks()) {
      md.heading(2, `Raw Perf Marks: ${source}`);
      md.value += "```\n";
      md.value += `Name	Timestamp	Delta	Total
`;
      let lastStartTime = -1;
      let total = 0;
      for (const { name, startTime } of marks) {
        const delta = lastStartTime !== -1 ? startTime - lastStartTime : 0;
        total += delta;
        md.value += `${name}	${startTime}	${delta}	${total}
`;
        lastStartTime = startTime;
      }
      md.value += "```\n";
    }
  }
  _addResourceTimingStats(md) {
    const stats = performance.getEntriesByType("resource").map((entry) => {
      return [entry.name, entry.duration];
    });
    if (!stats.length) {
      return;
    }
    md.heading(2, "Resource Timing Stats");
    md.table(["Name", "Duration"], stats);
  }
};
PerfModelContentProvider = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, ICodeEditorService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, ITimerService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IRemoteAgentService),
  __decorateParam(8, ITerminalService)
], PerfModelContentProvider);
class MarkdownBuilder {
  constructor() {
    this.value = "";
  }
  heading(level, value) {
    this.value += `${"#".repeat(level)} ${value}

`;
    return this;
  }
  blank() {
    this.value += "\n";
    return this;
  }
  li(value) {
    this.value += `* ${value}
`;
    return this;
  }
  table(header, rows) {
    this.value += this.toMarkdownTable(header, rows);
  }
  toMarkdownTable(header, rows) {
    let result = "";
    const lengths = [];
    header.forEach((cell, ci) => {
      lengths[ci] = cell.length;
    });
    rows.forEach((row) => {
      row.forEach((cell, ci) => {
        if (typeof cell === "undefined") {
          cell = row[ci] = "-";
        }
        const len = cell.toString().length;
        lengths[ci] = Math.max(len, lengths[ci]);
      });
    });
    header.forEach((cell, ci) => {
      result += `| ${cell + " ".repeat(lengths[ci] - cell.toString().length)} `;
    });
    result += "|\n";
    header.forEach((_cell, ci) => {
      result += `| ${"-".repeat(lengths[ci])} `;
    });
    result += "|\n";
    rows.forEach((row) => {
      row.forEach((cell, ci) => {
        if (typeof cell !== "undefined") {
          result += `| ${cell + " ".repeat(lengths[ci] - cell.toString().length)} `;
        }
      });
      result += "|\n";
    });
    return result;
  }
}
export {
  PerfModelContentProvider,
  PerfviewContrib,
  PerfviewInput
};
