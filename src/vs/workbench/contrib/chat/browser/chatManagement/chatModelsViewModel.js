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
import { distinct } from "../../../../../base/common/arrays.js";
import { or, matchesCamelCase, matchesWords, matchesBaseContiguousSubString } from "../../../../../base/common/filters.js";
import { Emitter } from "../../../../../base/common/event.js";
import { getLanguageModelProviderDisplayName, ILanguageModelChatMetadata, ILanguageModelsService } from "../../../chat/common/languageModels.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { languageModelSourcePresentationRegistry } from "../../common/languageModelSourcePresentation.js";
const MODEL_ENTRY_TEMPLATE_ID = "model.entry.template";
const VENDOR_ENTRY_TEMPLATE_ID = "vendor.entry.template";
const GROUP_ENTRY_TEMPLATE_ID = "group.entry.template";
const wordFilter = or(matchesBaseContiguousSubString, matchesWords);
const CAPABILITY_REGEX = /@capability:\s*([^\s]+)/gi;
const PROVIDER_REGEX = /@provider:\s*((".+?")|([^\s]+))/gi;
const SEARCH_SUGGESTIONS = {
  FILTER_TYPES: [
    "@provider:",
    "@capability:"
  ],
  CAPABILITIES: [
    "@capability:tools",
    "@capability:vision",
    "@capability:agent"
  ]
};
function getManageModelsProviderLabel(model) {
  return model.provider.group.name;
}
function isLanguageModelProviderEntry(entry) {
  return entry.type === "vendor";
}
function isLanguageModelGroupEntry(entry) {
  return entry.type === "group";
}
function isStatusEntry(entry) {
  return entry.type === "status";
}
var ChatModelGroup = /* @__PURE__ */ ((ChatModelGroup2) => {
  ChatModelGroup2["Vendor"] = "vendor";
  return ChatModelGroup2;
})(ChatModelGroup || {});
let ChatModelsViewModel = class extends Disposable {
  constructor(languageModelsService) {
    super();
    this.languageModelsService = languageModelsService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onDidChangeGrouping = this._register(new Emitter());
    this.onDidChangeGrouping = this._onDidChangeGrouping.event;
    this.languageModelGroupStatuses = [];
    this.languageModelGroups = [];
    this.collapsedGroups = /* @__PURE__ */ new Set();
    this.searchValue = "";
    this.modelsSorted = false;
    this._groupBy = "vendor" /* Vendor */;
    this._viewModelEntries = [];
    this.languageModels = [];
    this._register(this.languageModelsService.onDidChangeLanguageModels((vendor) => this.refreshVendor(vendor)));
    this._register(this.languageModelsService.onDidChangeModelVisibility(() => this.refreshVisibility()));
  }
  get groupBy() {
    return this._groupBy;
  }
  set groupBy(groupBy) {
    if (this._groupBy !== groupBy) {
      this._groupBy = groupBy;
      this.collapsedGroups.clear();
      this.languageModelGroups = this.groupModels(this.languageModels);
      this.doFilter();
      this._onDidChangeGrouping.fire(groupBy);
    }
  }
  get viewModelEntries() {
    return this._viewModelEntries;
  }
  splice(at, removed, added) {
    this._viewModelEntries.splice(at, removed, ...added);
    if (this.selectedEntry) {
      this.selectedEntry = this._viewModelEntries.find((entry) => entry.id === this.selectedEntry?.id);
    }
    this._onDidChange.fire({ at, removed, added });
  }
  shouldRefilter() {
    return !this.modelsSorted;
  }
  filter(searchValue) {
    if (searchValue !== this.searchValue) {
      this.searchValue = searchValue;
      this.collapsedGroups.clear();
      if (!this.modelsSorted) {
        this.languageModelGroups = this.groupModels(this.languageModels);
      }
      this.doFilter();
    }
    return this.viewModelEntries;
  }
  doFilter() {
    const viewModelEntries = [];
    const shouldShowGroupHeaders = this.languageModelGroups.length > 1 || this.languageModelGroups.some((group) => isLanguageModelProviderEntry(group.group) && group.group.sourcePresentation !== void 0);
    for (const group of this.languageModelGroups) {
      if (this.collapsedGroups.has(group.group.id)) {
        group.group.collapsed = true;
        if (shouldShowGroupHeaders) {
          viewModelEntries.push(group.group);
        }
        continue;
      }
      const groupEntries = [];
      if (group.status) {
        groupEntries.push(group.status);
      }
      groupEntries.push(...this.filterModels(group.models, this.searchValue));
      if (groupEntries.length > 0) {
        group.group.collapsed = false;
        if (shouldShowGroupHeaders) {
          viewModelEntries.push(group.group);
        }
        viewModelEntries.push(...groupEntries);
      }
    }
    this.splice(0, this._viewModelEntries.length, viewModelEntries);
  }
  filterModels(modelEntries, searchValue) {
    const providerNames = [];
    let providerMatch;
    PROVIDER_REGEX.lastIndex = 0;
    while ((providerMatch = PROVIDER_REGEX.exec(searchValue)) !== null) {
      const providerName = providerMatch[2] ? providerMatch[2].substring(1, providerMatch[2].length - 1) : providerMatch[3];
      providerNames.push(providerName);
    }
    if (providerNames.length > 0) {
      searchValue = searchValue.replace(PROVIDER_REGEX, "");
    }
    const capabilities = [];
    let capabilityMatch;
    CAPABILITY_REGEX.lastIndex = 0;
    while ((capabilityMatch = CAPABILITY_REGEX.exec(searchValue)) !== null) {
      capabilities.push(capabilityMatch[1].toLowerCase());
    }
    if (capabilities.length > 0) {
      searchValue = searchValue.replace(CAPABILITY_REGEX, "");
    }
    const quoteAtFirstChar = searchValue.charAt(0) === '"';
    const quoteAtLastChar = searchValue.charAt(searchValue.length - 1) === '"';
    const completeMatch = quoteAtFirstChar && quoteAtLastChar;
    if (quoteAtFirstChar) {
      searchValue = searchValue.substring(1);
    }
    if (quoteAtLastChar) {
      searchValue = searchValue.substring(0, searchValue.length - 1);
    }
    searchValue = searchValue.trim();
    const result = [];
    const words = searchValue.split(" ");
    const lowerProviders = providerNames.map((p) => p.toLowerCase().trim());
    for (const modelEntry of modelEntries) {
      if (lowerProviders.length > 0) {
        const matchesProvider = lowerProviders.some(
          (provider) => modelEntry.provider.vendor.vendor.toLowerCase() === provider || modelEntry.provider.vendor.displayName.toLowerCase() === provider || modelEntry.provider.group.vendor.toLowerCase() === provider || modelEntry.provider.group.name.toLowerCase() === provider
        );
        if (!matchesProvider) {
          continue;
        }
      }
      let matchedCapabilities = [];
      if (capabilities.length > 0) {
        if (!modelEntry.metadata.capabilities) {
          continue;
        }
        let matchesAll = true;
        for (const capability of capabilities) {
          const matchedForThisCapability = this.getMatchingCapabilities(modelEntry, capability);
          if (matchedForThisCapability.length === 0) {
            matchesAll = false;
            break;
          }
          matchedCapabilities.push(...matchedForThisCapability);
        }
        if (!matchesAll) {
          continue;
        }
        matchedCapabilities = distinct(matchedCapabilities);
      }
      let modelMatches;
      if (searchValue) {
        modelMatches = new ModelItemMatches(modelEntry, searchValue, words, completeMatch);
        if (!modelMatches.modelNameMatches && !modelMatches.modelIdMatches && !modelMatches.providerMatches && !modelMatches.capabilityMatches) {
          continue;
        }
      }
      const modelId = this.getModelId(modelEntry);
      result.push({
        type: "model",
        id: modelId,
        templateId: MODEL_ENTRY_TEMPLATE_ID,
        model: modelEntry,
        modelNameMatches: modelMatches?.modelNameMatches || void 0,
        modelIdMatches: modelMatches?.modelIdMatches || void 0,
        providerMatches: modelMatches?.providerMatches || void 0,
        capabilityMatches: matchedCapabilities.length ? matchedCapabilities : void 0
      });
    }
    return result;
  }
  getMatchingCapabilities(modelEntry, capability) {
    const matchedCapabilities = [];
    if (!modelEntry.metadata.capabilities) {
      return matchedCapabilities;
    }
    switch (capability) {
      case "tools":
      case "toolcalling":
        if (modelEntry.metadata.capabilities.toolCalling === true) {
          matchedCapabilities.push("toolCalling");
        }
        break;
      case "vision":
        if (modelEntry.metadata.capabilities.vision === true) {
          matchedCapabilities.push("vision");
        }
        break;
      case "agent":
      case "agentmode":
        if (modelEntry.metadata.capabilities.agentMode === true) {
          matchedCapabilities.push("agentMode");
        }
        break;
      default:
        if (modelEntry.metadata.capabilities.editTools) {
          for (const tool of modelEntry.metadata.capabilities.editTools) {
            if (tool.toLowerCase().includes(capability)) {
              matchedCapabilities.push(tool);
            }
          }
        }
        break;
    }
    return matchedCapabilities;
  }
  groupModels(languageModels) {
    const result = [];
    if (this.groupBy === "vendor" /* Vendor */) {
      for (const model of languageModels) {
        const groupId = this.getProviderGroupId(model.provider);
        let group = result.find((group2) => group2.group.id === groupId);
        if (!group) {
          group = {
            group: this.createLanguageModelProviderEntry(model.provider),
            models: []
          };
          result.push(group);
        }
        group.models.push(model);
      }
      for (const statusGroup of this.languageModelGroupStatuses) {
        const groupId = this.getProviderGroupId(statusGroup.provider);
        let group = result.find((group2) => group2.group.id === groupId);
        if (!group) {
          group = {
            group: this.createLanguageModelProviderEntry(statusGroup.provider),
            models: []
          };
          result.push(group);
        }
        group.status = {
          id: `status.${group.group.id}`,
          type: "status",
          ...statusGroup.status
        };
      }
      result.sort((a, b) => {
        if (a.models[0]?.provider.vendor.isDefault) {
          return -1;
        }
        if (b.models[0]?.provider.vendor.isDefault) {
          return 1;
        }
        return a.group.label.localeCompare(b.group.label);
      });
    }
    for (const group of result) {
      if (isLanguageModelProviderEntry(group.group)) {
        group.group.hidden = group.models.length > 0 && group.models.every((model) => model.hidden);
      }
      group.models.sort((a, b) => {
        if (a.provider.vendor.isDefault && b.provider.vendor.isDefault) {
          return a.metadata.name.localeCompare(b.metadata.name);
        }
        if (a.provider.vendor.isDefault) {
          return -1;
        }
        if (b.provider.vendor.isDefault) {
          return 1;
        }
        if (a.provider.group.name === b.provider.group.name) {
          return a.metadata.name.localeCompare(b.metadata.name);
        }
        return a.provider.group.name.localeCompare(b.provider.group.name);
      });
    }
    this.modelsSorted = true;
    return result;
  }
  createLanguageModelProviderEntry(provider) {
    const id = this.getProviderGroupId(provider);
    return {
      type: "vendor",
      id,
      label: provider.group.name,
      templateId: VENDOR_ENTRY_TEMPLATE_ID,
      collapsed: this.collapsedGroups.has(id),
      hidden: false,
      sourcePresentation: provider.sourcePresentation,
      vendorEntry: provider
    };
  }
  getVendors() {
    return [...this.languageModelsService.getVendors()].sort((a, b) => {
      if (a.isDefault) {
        return -1;
      }
      if (b.isDefault) {
        return 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }
  async refresh() {
    await this.languageModelsService.selectLanguageModels({});
    await this.refreshAllVendors();
  }
  async refreshAllVendors() {
    this.languageModels = [];
    this.languageModelGroupStatuses = [];
    for (const vendor of this.getVendors()) {
      this.addVendorModels(vendor);
    }
    this.languageModelGroups = this.groupModels(this.languageModels);
    this.doFilter();
  }
  refreshVendor(vendorId) {
    const vendor = this.getVendors().find((v) => v.vendor === vendorId);
    if (!vendor) {
      return;
    }
    this.languageModels = this.languageModels.filter((m) => m.provider.vendor.vendor !== vendorId);
    this.languageModelGroupStatuses = this.languageModelGroupStatuses.filter((s) => s.provider.vendor.vendor !== vendorId);
    this.addVendorModels(vendor);
    this.languageModelGroups = this.groupModels(this.languageModels);
    this.doFilter();
  }
  addVendorModels(vendor) {
    const models = [];
    const languageModelsGroups = this.languageModelsService.getLanguageModelGroups(vendor.vendor);
    for (const group of languageModelsGroups) {
      const defaultProvider = {
        group: group.group ?? {
          vendor: vendor.vendor,
          name: vendor.displayName
        },
        vendor
      };
      if (group.status) {
        this.languageModelGroupStatuses.push({
          provider: defaultProvider,
          status: {
            message: group.status.message,
            severity: group.status.severity
          }
        });
      }
      for (const identifier of group.modelIdentifiers) {
        const metadata = this.languageModelsService.lookupLanguageModel(identifier);
        if (!metadata) {
          continue;
        }
        if (vendor.isDefault && metadata.id === "auto") {
          continue;
        }
        if (ILanguageModelChatMetadata.getAgentHostByokManageModelsIdentifier(metadata) !== void 0) {
          continue;
        }
        const sourcePresentation = metadata.modelGroup?.sourceId ? languageModelSourcePresentationRegistry.get(metadata.vendor, metadata.modelGroup.sourceId) : void 0;
        const provider = metadata.modelGroup ? {
          vendor,
          group: {
            vendor: metadata.modelGroup.id,
            name: sourcePresentation?.label ?? getLanguageModelProviderDisplayName(this.languageModelsService, metadata.modelGroup.id)
          },
          sourceId: metadata.modelGroup.sourceId,
          sourcePresentation
        } : defaultProvider;
        models.push({
          identifier,
          metadata,
          provider,
          hidden: this.languageModelsService.isModelHidden(identifier)
        });
      }
    }
    this.languageModels.push(...models.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name)));
  }
  getModelsForGroup(group) {
    if (isLanguageModelProviderEntry(group)) {
      return this.languageModels.filter(
        (m) => this.getProviderGroupId(m.provider) === group.id
      );
    }
    return this.languageModels;
  }
  toggleModelHidden(entry) {
    this.languageModelsService.setModelHidden(entry.model.identifier, !entry.model.hidden);
  }
  toggleGroupHidden(entry) {
    this.languageModelsService.setModelsHidden(this.getModelsForGroup(entry).map((model) => model.identifier), !entry.hidden);
  }
  setModelsHidden(entries, hidden) {
    this.languageModelsService.setModelsHidden(entries.map((entry) => entry.model.identifier), hidden);
  }
  refreshVisibility() {
    for (const model of this.languageModels) {
      model.hidden = this.languageModelsService.isModelHidden(model.identifier);
    }
    this.languageModelGroups = this.groupModels(this.languageModels);
    this.doFilter();
  }
  getModelId(modelEntry) {
    return `${modelEntry.provider.group.name}.${modelEntry.identifier}.${modelEntry.metadata.version}`;
  }
  getProviderGroupId(provider) {
    return `${provider.group.vendor}-${provider.group.name}-${provider.sourceId ?? "configured"}`;
  }
  toggleCollapsed(viewModelEntry) {
    const id = isLanguageModelGroupEntry(viewModelEntry) ? viewModelEntry.id : isLanguageModelProviderEntry(viewModelEntry) ? viewModelEntry.id : void 0;
    if (!id) {
      return;
    }
    this.selectedEntry = viewModelEntry;
    if (!this.collapsedGroups.delete(id)) {
      this.collapsedGroups.add(id);
    }
    this.doFilter();
  }
  collapseAll() {
    this.collapsedGroups.clear();
    for (const entry of this.viewModelEntries) {
      if (isLanguageModelProviderEntry(entry) || isLanguageModelGroupEntry(entry)) {
        this.collapsedGroups.add(entry.id);
      }
    }
    this.doFilter();
  }
  getConfiguredVendors() {
    const result = [];
    const seenVendors = /* @__PURE__ */ new Set();
    for (const modelEntry of this.languageModels) {
      if (!seenVendors.has(modelEntry.provider.group.name)) {
        seenVendors.add(modelEntry.provider.group.name);
        result.push(modelEntry.provider);
      }
    }
    return result;
  }
};
ChatModelsViewModel = __decorateClass([
  __decorateParam(0, ILanguageModelsService)
], ChatModelsViewModel);
class ModelItemMatches {
  constructor(modelEntry, searchValue, words, completeMatch) {
    this.modelNameMatches = null;
    this.modelIdMatches = null;
    this.providerMatches = null;
    this.capabilityMatches = null;
    if (!completeMatch) {
      this.modelNameMatches = modelEntry.metadata.name ? this.matches(searchValue, modelEntry.metadata.name, (word, wordToMatchAgainst) => matchesWords(word, wordToMatchAgainst, true), words) : null;
      this.modelIdMatches = this.matches(searchValue, modelEntry.metadata.id, or(matchesWords, matchesCamelCase), words);
      this.providerMatches = this.matches(searchValue, modelEntry.provider.group.name, (word, wordToMatchAgainst) => matchesWords(word, wordToMatchAgainst, true), words);
      if (modelEntry.metadata.capabilities) {
        const capabilityStrings = [];
        if (modelEntry.metadata.capabilities.toolCalling) {
          capabilityStrings.push("tools", "toolCalling");
        }
        if (modelEntry.metadata.capabilities.vision) {
          capabilityStrings.push("vision");
        }
        if (modelEntry.metadata.capabilities.agentMode) {
          capabilityStrings.push("agent", "agentMode");
        }
        if (modelEntry.metadata.capabilities.editTools) {
          capabilityStrings.push(...modelEntry.metadata.capabilities.editTools);
        }
        const capabilityString = capabilityStrings.join(" ");
        if (capabilityString) {
          this.capabilityMatches = this.matches(searchValue, capabilityString, or(matchesWords, matchesCamelCase), words);
        }
      }
    }
  }
  matches(searchValue, wordToMatchAgainst, wordMatchesFilter, words) {
    let matches = searchValue ? wordFilter(searchValue, wordToMatchAgainst) : null;
    if (!matches) {
      matches = this.matchesWords(words, wordToMatchAgainst, wordMatchesFilter);
    }
    if (matches) {
      matches = this.filterAndSort(matches);
    }
    return matches;
  }
  matchesWords(words, wordToMatchAgainst, wordMatchesFilter) {
    let matches = [];
    for (const word of words) {
      const wordMatches = wordMatchesFilter(word, wordToMatchAgainst);
      if (wordMatches) {
        matches = [...matches || [], ...wordMatches];
      } else {
        matches = null;
        break;
      }
    }
    return matches;
  }
  filterAndSort(matches) {
    return distinct(matches, ((a) => a.start + "." + a.end)).filter((match) => !matches.some((m) => !(m.start === match.start && m.end === match.end) && (m.start <= match.start && m.end >= match.end))).sort((a, b) => a.start - b.start);
  }
}
export {
  ChatModelGroup,
  ChatModelsViewModel,
  GROUP_ENTRY_TEMPLATE_ID,
  MODEL_ENTRY_TEMPLATE_ID,
  SEARCH_SUGGESTIONS,
  VENDOR_ENTRY_TEMPLATE_ID,
  getManageModelsProviderLabel,
  isLanguageModelGroupEntry,
  isLanguageModelProviderEntry,
  isStatusEntry
};
