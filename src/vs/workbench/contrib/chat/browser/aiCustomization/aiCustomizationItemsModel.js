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
import { RunOnceScheduler } from "../../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../../base/common/errors.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue } from "../../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../../base/common/resources.js";
import { createDecorator, IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { InstantiationType, registerSingleton } from "../../../../../platform/instantiation/common/extensions.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { IAICustomizationWorkspaceService, AICustomizationManagementSection } from "../../common/aiCustomizationWorkspaceService.js";
import { ICustomizationHarnessService, isPluginCustomizationItem } from "../../common/customizationHarnessService.js";
import { IAgentPluginService } from "../../common/plugins/agentPluginService.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import { IPromptsService } from "../../common/promptSyntax/service/promptsService.js";
import { AICustomizationItemNormalizer, EmptyItemProviderItemSource, ItemProviderItemSource, PureItemProviderItemSource } from "./aiCustomizationItemSource.js";
import { PromptsServiceCustomizationItemProvider } from "./promptsServiceCustomizationItemProvider.js";
import { getChatSessionType } from "../../common/model/chatUri.js";
import { isAgentHostTarget } from "../agentSessions/agentSessions.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
const ITEMS_MODEL_SECTIONS = [
  AICustomizationManagementSection.Agents,
  AICustomizationManagementSection.Skills,
  AICustomizationManagementSection.Instructions,
  AICustomizationManagementSection.Prompts,
  AICustomizationManagementSection.Hooks
];
const IAICustomizationItemsModel = createDecorator("aiCustomizationItemsModel");
let AICustomizationItemsModel = class extends Disposable {
  constructor(harnessService, promptsService, workspaceService, workspaceContextService, labelService, agentPluginService, productService, fileService, pathService, logService, instantiationService) {
    super();
    this.harnessService = harnessService;
    this.promptsService = promptsService;
    this.workspaceService = workspaceService;
    this.agentPluginService = agentPluginService;
    this.fileService = fileService;
    this.pathService = pathService;
    this.logService = logService;
    this.instantiationService = instantiationService;
    /**
     * Cached source per active descriptor. Keyed by descriptor reference (not id) so that
     * an external harness re-registering under the same id (e.g. extension reload) gets a
     * fresh source bound to the new provider. Pruned when its descriptor is no longer
     * present in `availableHarnesses`.
     */
    this.sourceCache = this._register(new MutableDisposable());
    this.refetchObservedScheduler = this._register(new RunOnceScheduler(() => {
      const source = this.pendingRefetchSource;
      if (!source || this._store.isDisposed) {
        return;
      }
      this.refetchObserved(source);
    }, 0));
    this.perSection = /* @__PURE__ */ new Map();
    this.perSectionCount = /* @__PURE__ */ new Map();
    this.fetchSeq = /* @__PURE__ */ new Map();
    /** Promise of the most recent fetch per section (resolves regardless of stale-discard). */
    this.perSectionPending = /* @__PURE__ */ new Map();
    this.remotePluginNames = observableValue("aiCustomizationRemotePluginNames", []);
    this.pluginCount = derived((reader) => {
      const installed = this.agentPluginService.plugins.read(reader);
      const installedNames = new Set(installed.map((p) => (p.label || basename(p.uri)).toLowerCase()));
      const remoteNames = this.remotePluginNames.read(reader);
      const uniqueRemote = remoteNames.filter((name) => name && !installedNames.has(name.toLowerCase()));
      return installed.length + uniqueRemote.length;
    });
    this.pluginCountObserved = false;
    this.pluginFetchSeq = 0;
    /**
     * Sections that have been observed at least once. The model only fetches on
     * demand: first `getItems`/`getCount` for a section triggers an initial fetch,
     * and subsequent harness/source/workspace change events refetch only sections
     * that have already been read. This avoids 5x provider enumeration on startup.
     */
    this.observedSections = /* @__PURE__ */ new Set();
    this.itemNormalizer = new AICustomizationItemNormalizer(labelService, productService);
    for (const section of ITEMS_MODEL_SECTIONS) {
      const items = observableValue(`aiCustomizationItems:${section}`, []);
      this.perSection.set(section, items);
      this.perSectionCount.set(section, derived((reader) => items.read(reader).length));
      this.fetchSeq.set(section, 0);
    }
    const sourceChangeListener = this._register(new MutableDisposable());
    this._register(autorun((reader) => {
      const activeSessionResource = this.harnessService.activeSessionResource.read(reader);
      const source = this.getOrCreateSource(activeSessionResource);
      sourceChangeListener.value = source.onDidAICustomizationItemsChange(() => {
        this.scheduleRefetchObserved(source);
      });
      this.scheduleRefetchObserved(source);
    }));
    this._register(workspaceContextService.onDidChangeWorkspaceFolders(() => this.scheduleRefetchObserved(this.getActiveItemSource())));
    this._register(autorun((reader) => {
      this.workspaceService.activeProjectRoot.read(reader);
      this.scheduleRefetchObserved(this.getActiveItemSource());
    }));
  }
  getItems(section) {
    this.markObserved(section);
    return this.perSection.get(section);
  }
  getCount(section) {
    this.markObserved(section);
    return this.perSectionCount.get(section);
  }
  getPluginCount() {
    this.markPluginCountObserved();
    return this.pluginCount;
  }
  getActiveItemSource() {
    return this.getOrCreateSource(this.harnessService.activeSessionResource.get());
  }
  whenSectionLoaded(section) {
    this.markObserved(section);
    return this.perSectionPending.get(section) ?? Promise.resolve();
  }
  markObserved(section) {
    if (this.observedSections.has(section) || this._store.isDisposed) {
      return;
    }
    this.observedSections.add(section);
    this.refetchSection(section, this.getActiveItemSource());
  }
  markPluginCountObserved() {
    if (this.pluginCountObserved || this._store.isDisposed) {
      return;
    }
    this.pluginCountObserved = true;
    this.refetchPluginCount(this.getActiveItemSource());
  }
  getOrCreateSource(sessionResource) {
    const cached = this.sourceCache.value;
    if (cached && isEqual(sessionResource, cached.sessionResource) && !(cached instanceof EmptyItemProviderItemSource)) {
      return cached;
    }
    const sessionType = getChatSessionType(sessionResource);
    const descriptor = this.harnessService.findHarnessById(sessionType);
    const getItemSource = () => {
      if (!descriptor) {
        this.logService.warn(`No harness descriptor found for session type ${sessionType}`);
        return new EmptyItemProviderItemSource(sessionResource);
      }
      if (isAgentHostTarget(sessionType)) {
        if (!descriptor.itemProvider) {
          this.logService.warn(`Agent-host session type ${sessionType} has no item provider`);
          return new EmptyItemProviderItemSource(sessionResource);
        }
        return new PureItemProviderItemSource(sessionResource, descriptor.itemProvider, this.itemNormalizer, this.promptsService, this.workspaceService);
      } else {
        const itemProvider = descriptor.itemProvider ?? this.instantiationService.createInstance(PromptsServiceCustomizationItemProvider);
        return new ItemProviderItemSource(
          sessionResource,
          itemProvider,
          this.promptsService,
          this.workspaceService,
          this.fileService,
          this.pathService,
          this.itemNormalizer
        );
      }
    };
    const source = getItemSource();
    this.sourceCache.value = source;
    return source;
  }
  scheduleRefetchObserved(source) {
    this.pendingRefetchSource = source;
    this.refetchObservedScheduler.schedule();
  }
  refetchObserved(source) {
    for (const section of this.observedSections) {
      this.refetchSection(section, source);
    }
    if (this.pluginCountObserved) {
      this.refetchPluginCount(source);
    }
  }
  refetchSection(section, source) {
    const seq = (this.fetchSeq.get(section) ?? 0) + 1;
    this.fetchSeq.set(section, seq);
    const promptType = sectionToPromptType(section);
    const observable = this.perSection.get(section);
    const pending = source.fetchAICustomizationItems(promptType).then((items) => {
      if (this._store.isDisposed) {
        return;
      }
      if (this.fetchSeq.get(section) !== seq) {
        return;
      }
      if (this.getActiveItemSource() !== source) {
        return;
      }
      observable.set(items, void 0);
    }, (e) => {
      if (this._store.isDisposed) {
        return;
      }
      onUnexpectedError(e);
    });
    this.perSectionPending.set(section, pending);
  }
  refetchPluginCount(source) {
    const seq = ++this.pluginFetchSeq;
    const pending = source.fetchProviderItems().then((items) => {
      return items.filter((item) => isPluginCustomizationItem(item) && item.groupKey !== "remote-client").map((item) => item.name ?? "");
    });
    pending.then((names) => {
      if (this._store.isDisposed) {
        return;
      }
      if (this.pluginFetchSeq !== seq) {
        return;
      }
      if (this.getActiveItemSource() !== source) {
        return;
      }
      this.remotePluginNames.set(names, void 0);
    }, (e) => {
      if (!this._store.isDisposed) {
        onUnexpectedError(e);
      }
    });
  }
};
AICustomizationItemsModel = __decorateClass([
  __decorateParam(0, ICustomizationHarnessService),
  __decorateParam(1, IPromptsService),
  __decorateParam(2, IAICustomizationWorkspaceService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, IAgentPluginService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IPathService),
  __decorateParam(9, ILogService),
  __decorateParam(10, IInstantiationService)
], AICustomizationItemsModel);
function sectionToPromptType(section) {
  switch (section) {
    case AICustomizationManagementSection.Agents:
      return PromptsType.agent;
    case AICustomizationManagementSection.Skills:
      return PromptsType.skill;
    case AICustomizationManagementSection.Instructions:
      return PromptsType.instructions;
    case AICustomizationManagementSection.Hooks:
      return PromptsType.hook;
    case AICustomizationManagementSection.Prompts:
    default:
      return PromptsType.prompt;
  }
}
registerSingleton(IAICustomizationItemsModel, AICustomizationItemsModel, InstantiationType.Delayed);
export {
  AICustomizationItemsModel,
  IAICustomizationItemsModel,
  ITEMS_MODEL_SECTIONS
};
