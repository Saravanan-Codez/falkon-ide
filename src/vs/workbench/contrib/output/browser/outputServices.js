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
import { Event, Emitter } from "../../../../base/common/event.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { OUTPUT_VIEW_ID, LOG_MIME, OUTPUT_MIME, Extensions, ACTIVE_OUTPUT_CHANNEL_CONTEXT, CONTEXT_ACTIVE_FILE_OUTPUT, CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE, CONTEXT_ACTIVE_OUTPUT_LEVEL, CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT, SHOW_DEBUG_FILTER_CONTEXT, SHOW_ERROR_FILTER_CONTEXT, SHOW_INFO_FILTER_CONTEXT, SHOW_TRACE_FILTER_CONTEXT, SHOW_WARNING_FILTER_CONTEXT, CONTEXT_ACTIVE_LOG_FILE_OUTPUT, isSingleSourceOutputChannelDescriptor, HIDE_CATEGORY_FILTER_CONTEXT, isMultiSourceOutputChannelDescriptor } from "../../../services/output/common/output.js";
import { OutputLinkProvider } from "./outputLinkProvider.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ILogService, ILoggerService, LogLevel, LogLevelToString } from "../../../../platform/log/common/log.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { DelegatedOutputChannelModel, FileOutputChannelModel, MultiFileOutputChannelModel } from "../common/outputChannelModel.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { localize } from "../../../../nls.js";
import { joinPath } from "../../../../base/common/resources.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { telemetryLogId } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { toLocalISOString } from "../../../../base/common/date.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IDefaultLogLevelsService } from "../../../services/log/common/defaultLogLevels.js";
const OUTPUT_ACTIVE_CHANNEL_KEY = "output.activechannel";
let OutputChannel = class extends Disposable {
  constructor(outputChannelDescriptor, outputLocation, outputDirPromise, languageService, instantiationService) {
    super();
    this.outputChannelDescriptor = outputChannelDescriptor;
    this.outputLocation = outputLocation;
    this.outputDirPromise = outputDirPromise;
    this.languageService = languageService;
    this.instantiationService = instantiationService;
    this.scrollLock = false;
    this.id = outputChannelDescriptor.id;
    this.label = outputChannelDescriptor.label;
    this.uri = URI.from({ scheme: Schemas.outputChannel, path: this.id });
    this.model = this._register(this.createOutputChannelModel(this.uri, outputChannelDescriptor));
  }
  createOutputChannelModel(uri, outputChannelDescriptor) {
    const language = outputChannelDescriptor.languageId ? this.languageService.createById(outputChannelDescriptor.languageId) : this.languageService.createByMimeType(outputChannelDescriptor.log ? LOG_MIME : OUTPUT_MIME);
    if (isMultiSourceOutputChannelDescriptor(outputChannelDescriptor)) {
      return this.instantiationService.createInstance(MultiFileOutputChannelModel, uri, language, [...outputChannelDescriptor.source]);
    }
    if (isSingleSourceOutputChannelDescriptor(outputChannelDescriptor)) {
      return this.instantiationService.createInstance(FileOutputChannelModel, uri, language, outputChannelDescriptor.source);
    }
    return this.instantiationService.createInstance(DelegatedOutputChannelModel, this.id, uri, language, this.outputLocation, this.outputDirPromise);
  }
  getLogEntries() {
    return this.model.getLogEntries();
  }
  append(output) {
    this.model.append(output);
  }
  update(mode, till) {
    this.model.update(mode, till, true);
  }
  clear() {
    this.model.clear();
  }
  replace(value) {
    this.model.replace(value);
  }
};
OutputChannel = __decorateClass([
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IInstantiationService)
], OutputChannel);
class OutputViewFilters extends Disposable {
  constructor(options, contextKeyService) {
    super();
    this.contextKeyService = contextKeyService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._filterText = "";
    this._includePatterns = [];
    this._excludePatterns = [];
    this._trace = SHOW_TRACE_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._trace.set(options.trace);
    this._debug = SHOW_DEBUG_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._debug.set(options.debug);
    this._info = SHOW_INFO_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._info.set(options.info);
    this._warning = SHOW_WARNING_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._warning.set(options.warning);
    this._error = SHOW_ERROR_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._error.set(options.error);
    this._categories = HIDE_CATEGORY_FILTER_CONTEXT.bindTo(this.contextKeyService);
    this._categories.set(options.sources);
    this.filterHistory = options.filterHistory;
  }
  get text() {
    return this._filterText;
  }
  set text(filterText) {
    if (this._filterText !== filterText) {
      this._filterText = filterText;
      const { includePatterns, excludePatterns } = this.parseText(filterText);
      this._includePatterns = includePatterns;
      this._excludePatterns = excludePatterns;
      this._onDidChange.fire();
    }
  }
  parseText(filterText) {
    const includePatterns = [];
    const excludePatterns = [];
    const patterns = this.splitByCommaRespectingQuotes(filterText);
    for (const pattern of patterns) {
      const trimmed = pattern.trim();
      if (trimmed.length === 0) {
        continue;
      }
      if (trimmed.startsWith("!")) {
        const negativePattern = trimmed.substring(1).trim();
        if (negativePattern.length > 0) {
          excludePatterns.push(negativePattern);
        }
      } else {
        includePatterns.push(trimmed);
      }
    }
    return { includePatterns, excludePatterns };
  }
  get includePatterns() {
    return this._includePatterns;
  }
  get excludePatterns() {
    return this._excludePatterns;
  }
  splitByCommaRespectingQuotes(text) {
    const patterns = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (!inQuotes && char === '"') {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        current += char;
      } else if (!inQuotes && char === ",") {
        if (current.length > 0) {
          patterns.push(current);
        }
        current = "";
      } else {
        current += char;
      }
    }
    if (current.length > 0) {
      patterns.push(current);
    }
    return patterns;
  }
  get trace() {
    return !!this._trace.get();
  }
  set trace(trace) {
    if (this._trace.get() !== trace) {
      this._trace.set(trace);
      this._onDidChange.fire();
    }
  }
  get debug() {
    return !!this._debug.get();
  }
  set debug(debug) {
    if (this._debug.get() !== debug) {
      this._debug.set(debug);
      this._onDidChange.fire();
    }
  }
  get info() {
    return !!this._info.get();
  }
  set info(info) {
    if (this._info.get() !== info) {
      this._info.set(info);
      this._onDidChange.fire();
    }
  }
  get warning() {
    return !!this._warning.get();
  }
  set warning(warning) {
    if (this._warning.get() !== warning) {
      this._warning.set(warning);
      this._onDidChange.fire();
    }
  }
  get error() {
    return !!this._error.get();
  }
  set error(error) {
    if (this._error.get() !== error) {
      this._error.set(error);
      this._onDidChange.fire();
    }
  }
  get categories() {
    return this._categories.get() || ",";
  }
  set categories(categories) {
    this._categories.set(categories);
    this._onDidChange.fire();
  }
  toggleCategory(category) {
    const categories = this.categories;
    if (this.hasCategory(category)) {
      this.categories = categories.replace(`,${category},`, ",");
    } else {
      this.categories = `${categories}${category},`;
    }
  }
  hasCategory(category) {
    if (category === ",") {
      return false;
    }
    return this.categories.includes(`,${category},`);
  }
}
let OutputService = class extends Disposable {
  constructor(storageService, instantiationService, textModelService, logService, loggerService, lifecycleService, viewsService, contextKeyService, defaultLogLevelsService, fileDialogService, fileService, environmentService) {
    super();
    this.storageService = storageService;
    this.instantiationService = instantiationService;
    this.textModelService = textModelService;
    this.logService = logService;
    this.loggerService = loggerService;
    this.lifecycleService = lifecycleService;
    this.viewsService = viewsService;
    this.defaultLogLevelsService = defaultLogLevelsService;
    this.fileDialogService = fileDialogService;
    this.fileService = fileService;
    this.channels = this._register(new DisposableMap());
    this._onActiveOutputChannel = this._register(new Emitter());
    this.onActiveOutputChannel = this._onActiveOutputChannel.event;
    this.outputFolderCreationPromise = null;
    this.activeChannelIdInStorage = this.storageService.get(OUTPUT_ACTIVE_CHANNEL_KEY, StorageScope.WORKSPACE, "");
    this.activeOutputChannelContext = ACTIVE_OUTPUT_CHANNEL_CONTEXT.bindTo(contextKeyService);
    this.activeOutputChannelContext.set(this.activeChannelIdInStorage);
    this._register(this.onActiveOutputChannel((channel) => this.activeOutputChannelContext.set(channel)));
    this.activeFileOutputChannelContext = CONTEXT_ACTIVE_FILE_OUTPUT.bindTo(contextKeyService);
    this.activeLogOutputChannelContext = CONTEXT_ACTIVE_LOG_FILE_OUTPUT.bindTo(contextKeyService);
    this.activeOutputChannelLevelSettableContext = CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE.bindTo(contextKeyService);
    this.activeOutputChannelLevelContext = CONTEXT_ACTIVE_OUTPUT_LEVEL.bindTo(contextKeyService);
    this.activeOutputChannelLevelIsDefaultContext = CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT.bindTo(contextKeyService);
    this.outputLocation = joinPath(environmentService.windowLogsPath, `output_${toLocalISOString(/* @__PURE__ */ new Date()).replace(/-|:|\.\d+Z$/g, "")}`);
    this._register(textModelService.registerTextModelContentProvider(Schemas.outputChannel, this));
    this._register(instantiationService.createInstance(OutputLinkProvider));
    const registry = Registry.as(Extensions.OutputChannels);
    for (const channelIdentifier of registry.getChannels()) {
      this.onDidRegisterChannel(channelIdentifier.id);
    }
    this._register(registry.onDidRegisterChannel((id) => this.onDidRegisterChannel(id)));
    this._register(registry.onDidUpdateChannelSources((channel) => this.onDidUpdateChannelSources(channel)));
    this._register(registry.onDidRemoveChannel((channel) => this.onDidRemoveChannel(channel)));
    if (!this.activeChannel) {
      const channels = this.getChannelDescriptors();
      this.setActiveChannel(channels && channels.length > 0 ? this.getChannel(channels[0].id) : void 0);
    }
    this._register(Event.filter(this.viewsService.onDidChangeViewVisibility, (e) => e.id === OUTPUT_VIEW_ID && e.visible)(() => {
      if (this.activeChannel) {
        this.viewsService.getActiveViewWithId(OUTPUT_VIEW_ID)?.showChannel(this.activeChannel, true);
      }
    }));
    this._register(this.loggerService.onDidChangeLogLevel(() => {
      this.setLevelContext();
      this.setLevelIsDefaultContext();
    }));
    this._register(this.defaultLogLevelsService.onDidChangeDefaultLogLevels(() => {
      this.setLevelIsDefaultContext();
    }));
    this._register(this.lifecycleService.onDidShutdown(() => this.dispose()));
    this.filters = this._register(new OutputViewFilters({
      filterHistory: [],
      trace: true,
      debug: true,
      info: true,
      warning: true,
      error: true,
      sources: ""
    }, contextKeyService));
  }
  provideTextContent(resource) {
    const channel = this.getChannel(resource.path);
    if (channel) {
      return channel.model.loadModel();
    }
    return null;
  }
  async showChannel(id, preserveFocus) {
    const channel = this.getChannel(id);
    if (this.activeChannel?.id !== channel?.id) {
      this.setActiveChannel(channel);
      this._onActiveOutputChannel.fire(id);
    }
    const outputView = await this.viewsService.openView(OUTPUT_VIEW_ID, !preserveFocus);
    if (outputView && channel) {
      outputView.showChannel(channel, !!preserveFocus);
    }
  }
  getChannel(id) {
    return this.channels.get(id);
  }
  getChannelDescriptor(id) {
    return Registry.as(Extensions.OutputChannels).getChannel(id);
  }
  getChannelDescriptors() {
    return Registry.as(Extensions.OutputChannels).getChannels();
  }
  getActiveChannel() {
    return this.activeChannel;
  }
  canSetLogLevel(channel) {
    return channel.log && channel.id !== telemetryLogId;
  }
  getLogLevel(channel) {
    if (!channel.log) {
      return void 0;
    }
    const sources = isSingleSourceOutputChannelDescriptor(channel) ? [channel.source] : isMultiSourceOutputChannelDescriptor(channel) ? channel.source : [];
    if (sources.length === 0) {
      return void 0;
    }
    const logLevel = this.loggerService.getLogLevel();
    return sources.reduce((prev, curr) => Math.min(prev, this.loggerService.getLogLevel(curr.resource) ?? logLevel), LogLevel.Error);
  }
  setLogLevel(channel, logLevel) {
    if (!channel.log) {
      return;
    }
    const sources = isSingleSourceOutputChannelDescriptor(channel) ? [channel.source] : isMultiSourceOutputChannelDescriptor(channel) ? channel.source : [];
    if (sources.length === 0) {
      return;
    }
    for (const source of sources) {
      this.loggerService.setLogLevel(source.resource, logLevel);
    }
  }
  registerCompoundLogChannel(descriptors) {
    const outputChannelRegistry = Registry.as(Extensions.OutputChannels);
    descriptors.sort((a, b) => a.label.localeCompare(b.label));
    const id = descriptors.map((r) => r.id.toLowerCase()).join("-");
    if (!outputChannelRegistry.getChannel(id)) {
      outputChannelRegistry.registerChannel({
        id,
        label: descriptors.map((r) => r.label).join(", "),
        log: descriptors.some((r) => r.log),
        user: true,
        source: descriptors.map((descriptor) => {
          if (isSingleSourceOutputChannelDescriptor(descriptor)) {
            return [{ resource: descriptor.source.resource, name: descriptor.source.name ?? descriptor.label }];
          }
          if (isMultiSourceOutputChannelDescriptor(descriptor)) {
            return descriptor.source;
          }
          const channel = this.getChannel(descriptor.id);
          if (channel) {
            return channel.model.source;
          }
          return [];
        }).flat()
      });
    }
    return id;
  }
  async saveOutputAs(outputPath, ...channels) {
    let channel;
    if (channels.length > 1) {
      const compoundChannelId = this.registerCompoundLogChannel(channels);
      channel = this.getChannel(compoundChannelId);
    } else {
      channel = this.getChannel(channels[0].id);
    }
    if (!channel) {
      return;
    }
    try {
      let uri = outputPath;
      if (!uri) {
        const name = channels.length > 1 ? "output" : channels[0].label;
        uri = await this.fileDialogService.showSaveDialog({
          title: localize("saveLog.dialogTitle", "Save Output As"),
          availableFileSystems: [Schemas.file],
          defaultUri: joinPath(await this.fileDialogService.defaultFilePath(), `${name}.log`),
          filters: [{
            name,
            extensions: ["log"]
          }]
        });
      }
      if (!uri) {
        return;
      }
      const modelRef = await this.textModelService.createModelReference(channel.uri);
      try {
        await this.fileService.writeFile(uri, VSBuffer.fromString(modelRef.object.textEditorModel.getValue()));
      } finally {
        modelRef.dispose();
      }
      return;
    } finally {
      if (channels.length > 1) {
        Registry.as(Extensions.OutputChannels).removeChannel(channel.id);
      }
    }
  }
  async onDidRegisterChannel(channelId) {
    const channel = this.createChannel(channelId);
    this.channels.set(channelId, channel);
    if (!this.activeChannel || this.activeChannelIdInStorage === channelId) {
      this.setActiveChannel(channel);
      this._onActiveOutputChannel.fire(channelId);
      const outputView = this.viewsService.getActiveViewWithId(OUTPUT_VIEW_ID);
      outputView?.showChannel(channel, true);
    }
  }
  onDidUpdateChannelSources(channel) {
    const outputChannel = this.channels.get(channel.id);
    if (outputChannel) {
      outputChannel.model.updateChannelSources(channel.source);
    }
  }
  onDidRemoveChannel(channel) {
    if (this.activeChannel?.id === channel.id) {
      const channels = this.getChannelDescriptors();
      if (channels[0]) {
        this.showChannel(channels[0].id);
      }
    }
    this.channels.deleteAndDispose(channel.id);
  }
  createChannel(id) {
    const channel = this.instantiateChannel(id);
    this._register(Event.once(channel.model.onDispose)(() => {
      if (this.activeChannel === channel) {
        const channels = this.getChannelDescriptors();
        const channel2 = channels.length ? this.getChannel(channels[0].id) : void 0;
        if (channel2 && this.viewsService.isViewVisible(OUTPUT_VIEW_ID)) {
          this.showChannel(channel2.id);
        } else {
          this.setActiveChannel(void 0);
        }
      }
      Registry.as(Extensions.OutputChannels).removeChannel(id);
    }));
    return channel;
  }
  instantiateChannel(id) {
    const channelData = Registry.as(Extensions.OutputChannels).getChannel(id);
    if (!channelData) {
      this.logService.error(`Channel '${id}' is not registered yet`);
      throw new Error(`Channel '${id}' is not registered yet`);
    }
    if (!this.outputFolderCreationPromise) {
      this.outputFolderCreationPromise = this.fileService.createFolder(this.outputLocation).then(() => void 0);
    }
    return this.instantiationService.createInstance(OutputChannel, channelData, this.outputLocation, this.outputFolderCreationPromise);
  }
  setLevelContext() {
    const descriptor = this.activeChannel?.outputChannelDescriptor;
    const channelLogLevel = descriptor ? this.getLogLevel(descriptor) : void 0;
    this.activeOutputChannelLevelContext.set(channelLogLevel !== void 0 ? LogLevelToString(channelLogLevel) : "");
  }
  async setLevelIsDefaultContext() {
    const descriptor = this.activeChannel?.outputChannelDescriptor;
    const channelLogLevel = descriptor ? this.getLogLevel(descriptor) : void 0;
    if (channelLogLevel !== void 0) {
      const channelDefaultLogLevel = this.defaultLogLevelsService.getDefaultLogLevel(descriptor?.extensionId);
      this.activeOutputChannelLevelIsDefaultContext.set(channelDefaultLogLevel === channelLogLevel);
    } else {
      this.activeOutputChannelLevelIsDefaultContext.set(false);
    }
  }
  setActiveChannel(channel) {
    this.activeChannel = channel;
    const descriptor = channel?.outputChannelDescriptor;
    this.activeFileOutputChannelContext.set(!!descriptor && isSingleSourceOutputChannelDescriptor(descriptor));
    this.activeLogOutputChannelContext.set(!!descriptor?.log);
    this.activeOutputChannelLevelSettableContext.set(descriptor !== void 0 && this.canSetLogLevel(descriptor));
    this.setLevelIsDefaultContext();
    this.setLevelContext();
    if (this.activeChannel) {
      this.storageService.store(OUTPUT_ACTIVE_CHANNEL_KEY, this.activeChannel.id, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(OUTPUT_ACTIVE_CHANNEL_KEY, StorageScope.WORKSPACE);
    }
  }
};
OutputService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, ILogService),
  __decorateParam(4, ILoggerService),
  __decorateParam(5, ILifecycleService),
  __decorateParam(6, IViewsService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IDefaultLogLevelsService),
  __decorateParam(9, IFileDialogService),
  __decorateParam(10, IFileService),
  __decorateParam(11, IWorkbenchEnvironmentService)
], OutputService);
export {
  OutputService
};
