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
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import Severity from "../../../../base/common/severity.js";
import * as strings from "../../../../base/common/strings.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import * as nls from "../../../../nls.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Breakpoints } from "../common/breakpoints.js";
import { CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_DEBUG_EXTENSION_AVAILABLE, INTERNAL_CONSOLE_OPTIONS_SCHEMA } from "../common/debug.js";
import { Debugger } from "../common/debugger.js";
import { breakpointsExtPoint, debuggersExtPoint, launchSchema, presentationSchema } from "../common/debugSchemas.js";
import { TaskDefinitionRegistry } from "../../tasks/common/taskDefinitionRegistry.js";
import { ITaskService } from "../../tasks/common/taskService.js";
import { launchSchemaId } from "../../../services/configuration/common/configuration.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
const jsonRegistry = Registry.as(JSONExtensions.JSONContribution);
let AdapterManager = class extends Disposable {
  constructor(delegate, editorService, configurationService, quickInputService, instantiationService, commandService, extensionService, contextKeyService, languageService, dialogService, lifecycleService, tasksService, menuService) {
    super();
    this.delegate = delegate;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.commandService = commandService;
    this.extensionService = extensionService;
    this.contextKeyService = contextKeyService;
    this.languageService = languageService;
    this.dialogService = dialogService;
    this.lifecycleService = lifecycleService;
    this.tasksService = tasksService;
    this.menuService = menuService;
    this.debugAdapterFactories = /* @__PURE__ */ new Map();
    this._onDidRegisterDebugger = this._register(new Emitter());
    this._onDidDebuggersExtPointRead = this._register(new Emitter());
    this.breakpointContributions = [];
    this.debuggerWhenKeys = /* @__PURE__ */ new Set();
    this.taskLabels = [];
    this.usedDebugTypes = /* @__PURE__ */ new Set();
    this.adapterDescriptorFactories = [];
    this.debuggers = [];
    this.registerListeners();
    this.contextKeyService.bufferChangeEvents(() => {
      this.debuggersAvailable = CONTEXT_DEBUGGERS_AVAILABLE.bindTo(contextKeyService);
      this.debugExtensionsAvailable = CONTEXT_DEBUG_EXTENSION_AVAILABLE.bindTo(contextKeyService);
    });
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(this.debuggerWhenKeys)) {
        this.debuggersAvailable.set(this.hasEnabledDebuggers());
        this.updateDebugAdapterSchema();
      }
    }));
    this._register(this.onDidDebuggersExtPointRead(() => {
      this.debugExtensionsAvailable.set(this.debuggers.length > 0);
    }));
    const updateTaskScheduler = this._register(new RunOnceScheduler(() => this.updateTaskLabels(), 5e3));
    this._register(Event.any(tasksService.onDidChangeTaskConfig, tasksService.onDidChangeTaskProviders)(() => {
      updateTaskScheduler.cancel();
      updateTaskScheduler.schedule();
    }));
    this.lifecycleService.when(LifecyclePhase.Eventually).then(() => this.debugExtensionsAvailable.set(this.debuggers.length > 0));
    this._register(delegate.onDidNewSession((s) => {
      this.usedDebugTypes.add(s.configuration.type);
    }));
    updateTaskScheduler.schedule();
  }
  registerListeners() {
    debuggersExtPoint.setHandler((extensions, delta) => {
      delta.added.forEach((added) => {
        added.value.forEach((rawAdapter) => {
          if (!rawAdapter.type || typeof rawAdapter.type !== "string") {
            added.collector.error(nls.localize("debugNoType", "Debugger 'type' can not be omitted and must be of type 'string'."));
          }
          if (rawAdapter.type !== "*") {
            const existing = this.getDebugger(rawAdapter.type);
            if (existing) {
              existing.merge(rawAdapter, added.description);
            } else {
              const dbg = this.instantiationService.createInstance(Debugger, this, rawAdapter, added.description);
              dbg.when?.keys().forEach((key) => this.debuggerWhenKeys.add(key));
              this.debuggers.push(dbg);
            }
          }
        });
      });
      extensions.forEach((extension) => {
        extension.value.forEach((rawAdapter) => {
          if (rawAdapter.type === "*") {
            this.debuggers.forEach((dbg) => dbg.merge(rawAdapter, extension.description));
          }
        });
      });
      delta.removed.forEach((removed) => {
        const removedTypes = removed.value.map((rawAdapter) => rawAdapter.type);
        this.debuggers = this.debuggers.filter((d) => removedTypes.indexOf(d.type) === -1);
      });
      this.updateDebugAdapterSchema();
      this._onDidDebuggersExtPointRead.fire();
    });
    breakpointsExtPoint.setHandler((extensions) => {
      this.breakpointContributions = extensions.flatMap((ext) => ext.value.map((breakpoint) => this.instantiationService.createInstance(Breakpoints, breakpoint)));
    });
  }
  updateTaskLabels() {
    this.tasksService.getKnownTasks().then((tasks) => {
      this.taskLabels = tasks.map((task) => task._label);
      this.updateDebugAdapterSchema();
    });
  }
  updateDebugAdapterSchema() {
    const items = launchSchema.properties["configurations"].items;
    const taskSchema = TaskDefinitionRegistry.getJsonSchema();
    const definitions = {
      "common": {
        properties: {
          "name": {
            type: "string",
            description: nls.localize("debugName", "Name of configuration; appears in the launch configuration dropdown menu."),
            default: "Launch"
          },
          "debugServer": {
            type: "number",
            description: nls.localize("debugServer", "For debug extension development only: if a port is specified VS Code tries to connect to a debug adapter running in server mode"),
            default: 4711
          },
          "preLaunchTask": {
            anyOf: [taskSchema, {
              type: ["string"]
            }],
            default: "",
            defaultSnippets: [{ body: { task: "", type: "" } }],
            description: nls.localize("debugPrelaunchTask", "Task to run before debug session starts."),
            examples: this.taskLabels
          },
          "postDebugTask": {
            anyOf: [taskSchema, {
              type: ["string"]
            }],
            default: "",
            defaultSnippets: [{ body: { task: "", type: "" } }],
            description: nls.localize("debugPostDebugTask", "Task to run after debug session ends."),
            examples: this.taskLabels
          },
          "presentation": presentationSchema,
          "internalConsoleOptions": INTERNAL_CONSOLE_OPTIONS_SCHEMA,
          "suppressMultipleSessionWarning": {
            type: "boolean",
            description: nls.localize("suppressMultipleSessionWarning", "Disable the warning when trying to start the same debug configuration more than once."),
            default: true
          }
        }
      }
    };
    launchSchema.definitions = definitions;
    items.oneOf = [];
    items.defaultSnippets = [];
    this.debuggers.forEach((adapter) => {
      const schemaAttributes = adapter.getSchemaAttributes(definitions);
      if (schemaAttributes && items.oneOf) {
        items.oneOf.push(...schemaAttributes);
      }
      const configurationSnippets = adapter.configurationSnippets;
      if (configurationSnippets && items.defaultSnippets) {
        items.defaultSnippets.push(...configurationSnippets);
      }
    });
    jsonRegistry.registerSchema(launchSchemaId, launchSchema);
  }
  registerDebugAdapterFactory(debugTypes, debugAdapterLauncher) {
    debugTypes.forEach((debugType) => this.debugAdapterFactories.set(debugType, debugAdapterLauncher));
    this.debuggersAvailable.set(this.hasEnabledDebuggers());
    this._onDidRegisterDebugger.fire();
    return {
      dispose: () => {
        debugTypes.forEach((debugType) => this.debugAdapterFactories.delete(debugType));
      }
    };
  }
  hasEnabledDebuggers() {
    for (const [type] of this.debugAdapterFactories) {
      const dbg = this.getDebugger(type);
      if (dbg && dbg.enabled) {
        return true;
      }
    }
    return false;
  }
  createDebugAdapter(session) {
    const factory = this.debugAdapterFactories.get(session.configuration.type);
    if (factory) {
      return factory.createDebugAdapter(session);
    }
    return void 0;
  }
  substituteVariables(debugType, folder, config) {
    const factory = this.debugAdapterFactories.get(debugType);
    if (factory) {
      return factory.substituteVariables(folder, config);
    }
    return Promise.resolve(config);
  }
  runInTerminal(debugType, args, sessionId) {
    const factory = this.debugAdapterFactories.get(debugType);
    if (factory) {
      return factory.runInTerminal(args, sessionId);
    }
    return Promise.resolve(void 0);
  }
  registerDebugAdapterDescriptorFactory(debugAdapterProvider) {
    this.adapterDescriptorFactories.push(debugAdapterProvider);
    return {
      dispose: () => {
        this.unregisterDebugAdapterDescriptorFactory(debugAdapterProvider);
      }
    };
  }
  unregisterDebugAdapterDescriptorFactory(debugAdapterProvider) {
    const ix = this.adapterDescriptorFactories.indexOf(debugAdapterProvider);
    if (ix >= 0) {
      this.adapterDescriptorFactories.splice(ix, 1);
    }
  }
  getDebugAdapterDescriptor(session) {
    const config = session.configuration;
    const providers = this.adapterDescriptorFactories.filter((p) => p.type === config.type && p.createDebugAdapterDescriptor);
    if (providers.length === 1) {
      return providers[0].createDebugAdapterDescriptor(session);
    } else {
    }
    return Promise.resolve(void 0);
  }
  getDebuggerLabel(type) {
    const dbgr = this.getDebugger(type);
    if (dbgr) {
      return dbgr.label;
    }
    return void 0;
  }
  get onDidRegisterDebugger() {
    return this._onDidRegisterDebugger.event;
  }
  get onDidDebuggersExtPointRead() {
    return this._onDidDebuggersExtPointRead.event;
  }
  canSetBreakpointsIn(model) {
    const languageId = model.getLanguageId();
    if (!languageId || languageId === "jsonc" || languageId === "log") {
      return false;
    }
    if (this.configurationService.getValue("debug").allowBreakpointsEverywhere) {
      return true;
    }
    return this.breakpointContributions.some((breakpoints) => breakpoints.language === languageId && breakpoints.enabled);
  }
  getDebugger(type) {
    return this.debuggers.find((dbg) => strings.equalsIgnoreCase(dbg.type, type));
  }
  getEnabledDebugger(type) {
    const adapter = this.getDebugger(type);
    return adapter && adapter.enabled ? adapter : void 0;
  }
  someDebuggerInterestedInLanguage(languageId) {
    return !!this.debuggers.filter((d) => d.enabled).find((a) => a.interestedInLanguage(languageId));
  }
  async guessDebugger(gettingConfigurations) {
    const activeTextEditorControl = this.editorService.activeTextEditorControl;
    let candidates = [];
    let languageLabel = null;
    let model = null;
    if (isCodeEditor(activeTextEditorControl)) {
      model = activeTextEditorControl.getModel();
      const language = model ? model.getLanguageId() : void 0;
      if (language) {
        languageLabel = this.languageService.getLanguageName(language);
      }
      const adapters = this.debuggers.filter((a) => a.enabled).filter((a) => language && a.interestedInLanguage(language));
      if (adapters.length === 1) {
        return { debugger: adapters[0] };
      }
      if (adapters.length > 1) {
        candidates = adapters;
      }
    }
    if ((!languageLabel || gettingConfigurations || model && this.canSetBreakpointsIn(model)) && candidates.length === 0) {
      await this.activateDebuggers("onDebugInitialConfigurations");
      candidates = this.debuggers.filter((a) => a.enabled).filter((dbg) => dbg.hasInitialConfiguration() || dbg.hasDynamicConfigurationProviders() || dbg.hasConfigurationProvider());
    }
    if (candidates.length === 0 && languageLabel) {
      if (languageLabel.indexOf(" ") >= 0) {
        languageLabel = `'${languageLabel}'`;
      }
      const { confirmed } = await this.dialogService.confirm({
        type: Severity.Warning,
        message: nls.localize("CouldNotFindLanguage", "You don't have an extension for debugging {0}. Should we find a {0} extension in the Marketplace?", languageLabel),
        primaryButton: nls.localize({ key: "findExtension", comment: ["&& denotes a mnemonic"] }, "&&Find {0} extension", languageLabel)
      });
      if (confirmed) {
        await this.commandService.executeCommand("debug.installAdditionalDebuggers", languageLabel);
      }
      return void 0;
    }
    this.initExtensionActivationsIfNeeded();
    candidates.sort((first, second) => first.label.localeCompare(second.label));
    candidates = candidates.filter((a) => !a.isHiddenFromDropdown);
    const suggestedCandidates = [];
    const otherCandidates = [];
    candidates.forEach((d) => {
      const descriptor = d.getMainExtensionDescriptor();
      if (descriptor.id && !!this.earlyActivatedExtensions?.has(descriptor.id)) {
        suggestedCandidates.push(d);
      } else if (this.usedDebugTypes.has(d.type)) {
        suggestedCandidates.push(d);
      } else {
        otherCandidates.push(d);
      }
    });
    const picks = [];
    const dynamic = await this.delegate.configurationManager().getDynamicProviders();
    if (suggestedCandidates.length > 0) {
      picks.push(
        { type: "separator", label: nls.localize("suggestedDebuggers", "Suggested") },
        ...suggestedCandidates.map((c) => ({ label: c.label, pick: () => ({ debugger: c }) }))
      );
    }
    if (otherCandidates.length > 0) {
      if (picks.length > 0) {
        picks.push({ type: "separator", label: "" });
      }
      picks.push(...otherCandidates.map((c) => ({ label: c.label, pick: () => ({ debugger: c }) })));
    }
    if (dynamic.length) {
      if (picks.length) {
        picks.push({ type: "separator", label: "" });
      }
      for (const d of dynamic) {
        picks.push({
          label: nls.localize("moreOptionsForDebugType", "More {0} options...", d.label),
          pick: async () => {
            const cfg = await d.pick();
            if (!cfg) {
              return void 0;
            }
            return cfg && { debugger: this.getDebugger(d.type), withConfig: cfg };
          }
        });
      }
    }
    picks.push(
      { type: "separator", label: "" },
      { label: languageLabel ? nls.localize("installLanguage", "Install an extension for {0}...", languageLabel) : nls.localize("installExt", "Install extension...") }
    );
    const contributed = this.menuService.getMenuActions(MenuId.DebugCreateConfiguration, this.contextKeyService);
    for (const [, action] of contributed) {
      for (const item of action) {
        picks.push(item);
      }
    }
    const placeHolder = nls.localize("selectDebug", "Select debugger");
    return this.quickInputService.pick(picks, { activeItem: picks[0], placeHolder }).then(async (picked) => {
      if (picked && "pick" in picked && typeof picked.pick === "function") {
        return await picked.pick();
      }
      if (picked instanceof MenuItemAction) {
        picked.run();
        return;
      }
      if (picked) {
        this.commandService.executeCommand("debug.installAdditionalDebuggers", languageLabel);
      }
      return void 0;
    });
  }
  initExtensionActivationsIfNeeded() {
    if (!this.earlyActivatedExtensions) {
      this.earlyActivatedExtensions = /* @__PURE__ */ new Set();
      const status = this.extensionService.getExtensionsStatus();
      for (const id in status) {
        if (!!status[id].activationTimes) {
          this.earlyActivatedExtensions.add(id);
        }
      }
    }
  }
  async activateDebuggers(activationEvent, debugType) {
    this.initExtensionActivationsIfNeeded();
    const promises = [
      this.extensionService.activateByEvent(activationEvent),
      this.extensionService.activateByEvent("onDebug")
    ];
    if (debugType) {
      promises.push(this.extensionService.activateByEvent(`${activationEvent}:${debugType}`));
    }
    await Promise.all(promises);
  }
};
AdapterManager = __decorateClass([
  __decorateParam(1, IEditorService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IDialogService),
  __decorateParam(10, ILifecycleService),
  __decorateParam(11, ITaskService),
  __decorateParam(12, IMenuService)
], AdapterManager);
export {
  AdapterManager
};
