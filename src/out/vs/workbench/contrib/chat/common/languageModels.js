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
import { SequencerByKey, timeout } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { CancellationError, getErrorMessage, isCancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { hash } from "../../../../base/common/hash.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { equals } from "../../../../base/common/objects.js";
import Severity from "../../../../base/common/severity.js";
import { format, isFalsyOrWhitespace } from "../../../../base/common/strings.js";
import { SubmenuAction } from "../../../../base/common/actions.js";
import { isObject, isString } from "../../../../base/common/types.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, NeverShowAgainScope } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { asJson, IRequestService } from "../../../../platform/request/common/request.js";
import { IQuickInputService, QuickInputHideReason } from "../../../../platform/quickinput/common/quickInput.js";
import { ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { ChatContextKeys } from "./actions/chatContextKeys.js";
import { ILanguageModelsConfigurationService } from "./languageModelsConfiguration.js";
const COPILOT_VENDOR_ID = "copilot";
function isLanguageModelVendorAbsenceConclusive(vendor, hasLiveModels, hasResolved) {
  return hasLiveModels || hasResolved && vendor !== COPILOT_VENDOR_ID;
}
const BUILT_IN_BYOK_VENDOR_IDS = /* @__PURE__ */ new Set([
  "openai",
  "anthropic",
  "gemini",
  "ollama",
  "openrouter",
  "azure",
  "xai",
  "customoai",
  "customendpoint"
]);
const THIRD_PARTY_PROVIDER_TELEMETRY_NAME = "3p-extension";
const BUILT_IN_BYOK_EXTENSION_IDS = [
  "github.copilot-chat",
  "github.copilot"
];
function getByokProviderTelemetryName(vendor, extension) {
  if (!vendor || vendor === COPILOT_VENDOR_ID) {
    return void 0;
  }
  if (BUILT_IN_BYOK_VENDOR_IDS.has(vendor) && extension && BUILT_IN_BYOK_EXTENSION_IDS.some((id) => ExtensionIdentifier.equals(extension, id))) {
    return vendor;
  }
  return THIRD_PARTY_PROVIDER_TELEMETRY_NAME;
}
var ChatMessageRole = /* @__PURE__ */ ((ChatMessageRole2) => {
  ChatMessageRole2[ChatMessageRole2["System"] = 0] = "System";
  ChatMessageRole2[ChatMessageRole2["User"] = 1] = "User";
  ChatMessageRole2[ChatMessageRole2["Assistant"] = 2] = "Assistant";
  return ChatMessageRole2;
})(ChatMessageRole || {});
var LanguageModelPartAudience = /* @__PURE__ */ ((LanguageModelPartAudience2) => {
  LanguageModelPartAudience2[LanguageModelPartAudience2["Assistant"] = 0] = "Assistant";
  LanguageModelPartAudience2[LanguageModelPartAudience2["User"] = 1] = "User";
  LanguageModelPartAudience2[LanguageModelPartAudience2["Extension"] = 2] = "Extension";
  return LanguageModelPartAudience2;
})(LanguageModelPartAudience || {});
var ChatImageMimeType = /* @__PURE__ */ ((ChatImageMimeType2) => {
  ChatImageMimeType2["PNG"] = "image/png";
  ChatImageMimeType2["JPEG"] = "image/jpeg";
  ChatImageMimeType2["GIF"] = "image/gif";
  ChatImageMimeType2["WEBP"] = "image/webp";
  ChatImageMimeType2["BMP"] = "image/bmp";
  return ChatImageMimeType2;
})(ChatImageMimeType || {});
var ImageDetailLevel = /* @__PURE__ */ ((ImageDetailLevel2) => {
  ImageDetailLevel2["Low"] = "low";
  ImageDetailLevel2["High"] = "high";
  return ImageDetailLevel2;
})(ImageDetailLevel || {});
var ILanguageModelChatMetadata;
((ILanguageModelChatMetadata2) => {
  function suitableForAgentMode(metadata) {
    const supportsToolsAgent = typeof metadata.capabilities?.agentMode === "undefined" || metadata.capabilities.agentMode;
    return supportsToolsAgent && !!metadata.capabilities?.toolCalling;
  }
  ILanguageModelChatMetadata2.suitableForAgentMode = suitableForAgentMode;
  function asQualifiedName(metadata) {
    return `${metadata.name} (${metadata.vendor})`;
  }
  ILanguageModelChatMetadata2.asQualifiedName = asQualifiedName;
  function matchesQualifiedName(name, metadata) {
    if (metadata.vendor === COPILOT_VENDOR_ID && name === metadata.name) {
      return true;
    }
    return name === asQualifiedName(metadata);
  }
  ILanguageModelChatMetadata2.matchesQualifiedName = matchesQualifiedName;
  function hasPromoDiscount(metadata) {
    return !!metadata.promo && metadata.promo.discountPercent > 0;
  }
  ILanguageModelChatMetadata2.hasPromoDiscount = hasPromoDiscount;
  function hasPromoMessage(metadata) {
    return !!metadata.promo && metadata.promo.discountPercent >= 0 && !!metadata.promo.message;
  }
  ILanguageModelChatMetadata2.hasPromoMessage = hasPromoMessage;
  function getPromoEndsAtLabel(endsAt) {
    if (!endsAt) {
      return void 0;
    }
    const endsAtDate = new Date(endsAt);
    if (isNaN(endsAtDate.getTime())) {
      return void 0;
    }
    const formattedDate = endsAtDate.toLocaleDateString(void 0, { year: "numeric", month: "long", day: "numeric" });
    return localize("chat.promo.endsAt", "Ends {0}.", formattedDate);
  }
  ILanguageModelChatMetadata2.getPromoEndsAtLabel = getPromoEndsAtLabel;
  ILanguageModelChatMetadata2.autoModelSelectionDocsUrl = "https://docs.github.com/en/copilot/concepts/models/auto-model-selection";
  function getAutoModelDescription(discountPercent) {
    const base = localize("autoModel.description", "Auto routes based on your task and real-time system health and model performance.");
    const learnMore = localize("autoModel.learnMore", "[Learn More]({0})", ILanguageModelChatMetadata2.autoModelSelectionDocsUrl);
    if (typeof discountPercent === "number" && discountPercent > 0) {
      const discount = localize("autoModel.discount", "Models routed via auto receive a {0}% discount.", discountPercent);
      return `${base} ${discount} ${learnMore}`;
    }
    return `${base} ${learnMore}`;
  }
  ILanguageModelChatMetadata2.getAutoModelDescription = getAutoModelDescription;
  function getAgentHostByokManageModelsIdentifier(metadata) {
    return metadata.byokModelIdentifier;
  }
  ILanguageModelChatMetadata2.getAgentHostByokManageModelsIdentifier = getAgentHostByokManageModelsIdentifier;
})(ILanguageModelChatMetadata || (ILanguageModelChatMetadata = {}));
async function getTextResponseFromStream(response) {
  let responseText = "";
  const streaming = (async () => {
    if (!response?.stream) {
      return;
    }
    for await (const part of response.stream) {
      if (Array.isArray(part)) {
        for (const item of part) {
          if (item.type === "text") {
            responseText += item.value;
          }
        }
      } else if (part.type === "text") {
        responseText += part.value;
      }
    }
  })();
  try {
    await Promise.all([response.result, streaming]);
    return responseText;
  } catch (err) {
    if (responseText) {
      return responseText;
    }
    throw err;
  }
}
function isILanguageModelChatSelector(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value;
  return (obj.name === void 0 || typeof obj.name === "string") && (obj.id === void 0 || typeof obj.id === "string") && (obj.vendor === void 0 || typeof obj.vendor === "string") && (obj.version === void 0 || typeof obj.version === "string") && (obj.family === void 0 || typeof obj.family === "string") && (obj.tokens === void 0 || typeof obj.tokens === "number") && (obj.extension === void 0 || typeof obj.extension === "object");
}
const ILanguageModelsService = createDecorator("ILanguageModelsService");
function getLanguageModelProviderDisplayName(languageModelsService, vendor) {
  if (vendor === "copilotcli") {
    return localize("chat.languageModelProvider.copilot", "Copilot");
  }
  const descriptor = languageModelsService.getVendors().find((candidate) => candidate.vendor === vendor);
  return descriptor?.displayName ?? vendor.charAt(0).toUpperCase() + vendor.slice(1);
}
function getLanguageModelDisplayNameWithProvider(model, languageModelsService) {
  const { metadata } = model;
  if (!metadata.isBYOK && !metadata.byokModelIdentifier) {
    return metadata.name;
  }
  const originalIdentifier = metadata.byokModelIdentifier ?? model.identifier;
  const originalMetadata = metadata.byokModelIdentifier ? languageModelsService.lookupLanguageModel(originalIdentifier) : metadata;
  const providerVendor = originalMetadata?.vendor ?? metadata.modelGroup?.id ?? metadata.vendor;
  const providerName = getLanguageModelProviderDisplayName(languageModelsService, providerVendor);
  const identifierSuffix = originalMetadata?.id;
  const modelName = identifierSuffix && metadata.name.endsWith(` (${identifierSuffix})`) ? metadata.name.slice(0, -identifierSuffix.length - 3) : metadata.name;
  const groupName = languageModelsService.getLanguageModelGroups(providerVendor).find((group) => group.modelIdentifiers.includes(originalIdentifier))?.group?.name;
  return groupName && groupName !== providerName ? localize("chat.languageModelNameWithProviderAndGroup", "{0}/{1}/{2}", providerName, groupName, modelName) : localize("chat.languageModelNameWithProvider", "{0}/{1}", providerName, modelName);
}
const languageModelChatProviderType = {
  type: "object",
  required: ["vendor", "displayName"],
  properties: {
    vendor: {
      type: "string",
      description: localize("vscode.extension.contributes.languageModels.vendor", "A globally unique vendor of language model chat provider.")
    },
    displayName: {
      type: "string",
      description: localize("vscode.extension.contributes.languageModels.displayName", "The display name of the language model chat provider.")
    },
    configuration: {
      type: "object",
      description: localize("vscode.extension.contributes.languageModels.configuration", "Configuration options for the language model chat provider."),
      anyOf: [
        {
          $ref: "http://json-schema.org/draft-07/schema#"
        },
        {
          properties: {
            properties: {
              type: "object",
              additionalProperties: {
                $ref: "http://json-schema.org/draft-07/schema#",
                properties: {
                  secret: {
                    type: "boolean",
                    description: localize("vscode.extension.contributes.languageModels.configuration.secret", "Whether the property is a secret.")
                  }
                }
              }
            },
            additionalProperties: {
              $ref: "http://json-schema.org/draft-07/schema#",
              properties: {
                secret: {
                  type: "boolean",
                  description: localize("vscode.extension.contributes.languageModels.configuration.secret", "Whether the property is a secret.")
                }
              }
            }
          }
        }
      ]
    },
    managementCommand: {
      type: "string",
      description: localize("vscode.extension.contributes.languageModels.managementCommand", "A command to manage the language model chat provider, e.g. 'Manage Copilot models'. This is used in the chat model picker. If not provided, a gear icon is not rendered during vendor selection."),
      deprecated: true,
      deprecationMessage: localize("vscode.extension.contributes.languageModels.managementCommand.deprecated", "The managementCommand property is deprecated and will be removed in a future release. Use the new configuration property instead.")
    },
    deprecation: {
      type: "object",
      description: localize("vscode.extension.contributes.languageModels.deprecation", "Marks this language model chat provider as deprecated. When set, the Manage Models view renders the provider with a link pointing to a replacement."),
      properties: {
        link: {
          type: "string",
          description: localize("vscode.extension.contributes.languageModels.deprecation.link", "A URL opened when the user clicks the deprecation link shown next to the provider name. Use a 'vscode:extension/<publisher>.<name>' URI to open a replacement extension in the Extensions view.")
        }
      }
    },
    when: {
      type: "string",
      description: localize("vscode.extension.contributes.languageModels.when", "Condition which must be true to show this language model chat provider in the Manage Models list.")
    }
  }
};
function resolveProviderDeprecationLink(link, urlProtocol) {
  const uri = URI.parse(link);
  return uri.scheme === Schemas.vscode && urlProtocol ? uri.with({ scheme: urlProtocol }) : uri;
}
const languageModelChatProviderExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "languageModelChatProviders",
  jsonSchema: {
    description: localize("vscode.extension.contributes.languageModelChatProviders", "Contribute language model chat providers of a specific vendor."),
    oneOf: [
      languageModelChatProviderType,
      {
        type: "array",
        items: languageModelChatProviderType
      }
    ]
  },
  activationEventsGenerator: function* (contribs) {
    for (const contrib of contribs) {
      yield `onLanguageModelChatProvider:${contrib.vendor}`;
    }
  }
});
const CHAT_MODEL_RECENTLY_USED_STORAGE_KEY = "chatModelRecentlyUsed";
const CHAT_MODEL_PINNED_STORAGE_KEY = "chatModelPinned";
const CHAT_MODEL_VISIBILITY_STORAGE_KEY = "chatModelVisibility";
const AUTO_MODEL_IDENTIFIER = "copilot/auto";
function isAutoLanguageModel(model) {
  return model?.metadata.id === "auto" || model?.identifier === AUTO_MODEL_IDENTIFIER;
}
const CHAT_PARTICIPANT_NAME_REGISTRY_STORAGE_KEY = "chat.participantNameRegistry";
const CHAT_MODELS_CONTROL_STORAGE_KEY = "chat.modelsControl";
function createModelConfigurationActions(schema, currentConfig, setValue) {
  if (!schema?.properties) {
    return [];
  }
  const actions = [];
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (!propSchema.enum || !Array.isArray(propSchema.enum) || propSchema.enum.length < 1) {
      continue;
    }
    const currentValue = currentConfig[key] ?? propSchema.default;
    const label = (typeof propSchema.title === "string" ? propSchema.title : void 0) ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
    const defaultValue = propSchema.default;
    const enumItemLabels = propSchema.enumItemLabels;
    const enumDescriptions = propSchema.enumDescriptions;
    const enumActions = propSchema.enum.map((value, index) => {
      const itemLabel = enumItemLabels?.[index] ?? String(value);
      const displayLabel = value === defaultValue ? localize("models.enumDefault", "{0} (default)", itemLabel) : itemLabel;
      const tooltip = enumDescriptions?.[index] ?? "";
      return {
        id: `configureModel.${key}.${value}`,
        label: displayLabel,
        class: void 0,
        enabled: true,
        tooltip,
        checked: currentValue === value,
        run: () => setValue(key, value)
      };
    });
    actions.push(new SubmenuAction(`configureModel.${key}`, label, enumActions));
  }
  return actions;
}
let LanguageModelsService = class {
  constructor(_extensionService, _logService, _storageService, _contextKeyService, _languageModelsConfigurationService, _quickInputService, _secretStorageService, _productService, _requestService, _notificationService, _openerService, _telemetryService) {
    this._extensionService = _extensionService;
    this._logService = _logService;
    this._storageService = _storageService;
    this._contextKeyService = _contextKeyService;
    this._languageModelsConfigurationService = _languageModelsConfigurationService;
    this._quickInputService = _quickInputService;
    this._secretStorageService = _secretStorageService;
    this._productService = _productService;
    this._requestService = _requestService;
    this._notificationService = _notificationService;
    this._openerService = _openerService;
    this._telemetryService = _telemetryService;
    this._store = new DisposableStore();
    this._providers = /* @__PURE__ */ new Map();
    this._vendors = /* @__PURE__ */ new Map();
    /** Vendors for which a deprecation notice has already been shown this session. */
    this._deprecationNoticeShownVendors = /* @__PURE__ */ new Set();
    this._onDidChangeLanguageModelVendors = this._store.add(new Emitter());
    this.onDidChangeLanguageModelVendors = this._onDidChangeLanguageModelVendors.event;
    this._modelsGroups = /* @__PURE__ */ new Map();
    this._modelCache = /* @__PURE__ */ new Map();
    this._resolveLMSequencer = new SequencerByKey();
    this._modelConfigurations = /* @__PURE__ */ new Map();
    this._onLanguageModelChange = this._store.add(new Emitter());
    this.onDidChangeLanguageModels = this._onLanguageModelChange.event;
    this._recentlyUsedModelIds = [];
    this._pinnedModelIds = [];
    this._hiddenModelIds = /* @__PURE__ */ new Set();
    this._onDidChangeModelsControlManifest = this._store.add(new Emitter());
    this.onDidChangeModelsControlManifest = this._onDidChangeModelsControlManifest.event;
    this._onDidChangePinnedModels = this._store.add(new Emitter());
    this.onDidChangePinnedModels = this._onDidChangePinnedModels.event;
    this._onDidChangeModelVisibility = this._store.add(new Emitter());
    this.onDidChangeModelVisibility = this._onDidChangeModelVisibility.event;
    this._modelsControlManifest = { free: {}, paid: {} };
    this._chatControlDisposed = false;
    this._restrictedChatParticipants = observableValue(this, /* @__PURE__ */ Object.create(null));
    this.restrictedChatParticipants = this._restrictedChatParticipants;
    this._hasUserSelectableModels = ChatContextKeys.languageModelsAreUserSelectable.bindTo(_contextKeyService);
    this._hasNonCopilotUserSelectableModels = ChatContextKeys.nonCopilotLanguageModelsAreUserSelectable.bindTo(_contextKeyService);
    this._recentlyUsedModelIds = this._readRecentlyUsedModels();
    this._pinnedModelIds = this._readPinnedModels();
    this._readVisibility();
    this._initChatControlData();
    this._store.add(this.onDidChangeLanguageModels(() => {
      let hasUserSelectable = false;
      let hasNonCopilotUserSelectable = false;
      for (const model of this._modelCache.values()) {
        if (model.isUserSelectable === false) {
          continue;
        }
        hasUserSelectable = true;
        if (model.vendor !== COPILOT_VENDOR_ID) {
          hasNonCopilotUserSelectable = true;
          break;
        }
      }
      this._hasUserSelectableModels.set(hasUserSelectable);
      this._hasNonCopilotUserSelectableModels.set(hasNonCopilotUserSelectable);
      this._refreshModelsControlManifest();
    }));
    this._store.add(this._languageModelsConfigurationService.onDidChangeLanguageModelGroups((changedGroups) => this._onDidChangeLanguageModelGroups(changedGroups)));
    this._store.add(languageModelChatProviderExtensionPoint.setHandler((extensions, { added, removed }) => {
      const addedVendors = [];
      const removedVendors = [];
      for (const extension of added) {
        for (const item of Iterable.wrap(extension.value)) {
          if (this._vendors.has(item.vendor)) {
            extension.collector.error(localize("vscode.extension.contributes.languageModels.vendorAlreadyRegistered", "The vendor '{0}' is already registered and cannot be registered twice", item.vendor));
            continue;
          }
          if (isFalsyOrWhitespace(item.vendor)) {
            extension.collector.error(localize("vscode.extension.contributes.languageModels.emptyVendor", "The vendor field cannot be empty."));
            continue;
          }
          if (item.vendor.trim() !== item.vendor) {
            extension.collector.error(localize("vscode.extension.contributes.languageModels.whitespaceVendor", "The vendor field cannot start or end with whitespace."));
            continue;
          }
          addedVendors.push(item);
        }
      }
      for (const extension of removed) {
        for (const item of Iterable.wrap(extension.value)) {
          removedVendors.push(item);
        }
      }
      this.deltaLanguageModelChatProviderDescriptors(addedVendors, removedVendors);
    }));
  }
  static {
    this.SECRET_KEY_PREFIX = "chat.lm.secret.";
  }
  static {
    this.SECRET_INPUT = "${input:{0}}";
  }
  deltaLanguageModelChatProviderDescriptors(added, removed) {
    const addedVendorIds = [];
    const removedVendorIds = [];
    for (const item of added) {
      if (this._vendors.has(item.vendor)) {
        this._logService.error(`The vendor '${item.vendor}' is already registered and cannot be registered twice`);
        continue;
      }
      if (isFalsyOrWhitespace(item.vendor)) {
        this._logService.error("The vendor field cannot be empty.");
        continue;
      }
      if (item.vendor.trim() !== item.vendor) {
        this._logService.error("The vendor field cannot start or end with whitespace.");
        continue;
      }
      const vendor = {
        vendor: item.vendor,
        displayName: item.displayName,
        configuration: item.configuration,
        managementCommand: item.managementCommand,
        deprecation: item.deprecation,
        when: item.when,
        isDefault: item.vendor === COPILOT_VENDOR_ID
      };
      this._vendors.set(item.vendor, vendor);
      addedVendorIds.push(item.vendor);
    }
    for (const item of removed) {
      this._vendors.delete(item.vendor);
      this._providers.delete(item.vendor);
      this._clearModelCache(item.vendor);
      this._modelsGroups.delete(item.vendor);
      removedVendorIds.push(item.vendor);
    }
    for (const [vendor, _] of this._providers) {
      if (!this._vendors.has(vendor)) {
        this._providers.delete(vendor);
      }
    }
    if (addedVendorIds.length > 0 || removedVendorIds.length > 0) {
      this._onDidChangeLanguageModelVendors.fire([...addedVendorIds, ...removedVendorIds]);
      if (removedVendorIds.length > 0) {
        for (const vendor of removedVendorIds) {
          this._onLanguageModelChange.fire(vendor);
        }
      }
    }
  }
  async _onDidChangeLanguageModelGroups(changedGroups) {
    const changedVendors = new Set(changedGroups.map((g) => g.vendor));
    await Promise.all(Array.from(changedVendors).map((vendor) => this._resolveAllLanguageModels(vendor, true)));
  }
  getVendors() {
    return Array.from(this._vendors.values()).filter((vendor) => {
      if (!vendor.when) {
        return true;
      }
      const whenClause = ContextKeyExpr.deserialize(vendor.when);
      return whenClause ? this._contextKeyService.contextMatchesRules(whenClause) : false;
    });
  }
  getLanguageModelIds() {
    return Array.from(this._modelCache.keys());
  }
  lookupLanguageModel(modelIdentifier) {
    return this._modelCache.get(modelIdentifier);
  }
  lookupLanguageModelByQualifiedName(referenceName) {
    for (const [identifier, model] of this._modelCache.entries()) {
      if (ILanguageModelChatMetadata.matchesQualifiedName(referenceName, model)) {
        return { metadata: model, identifier };
      }
    }
    return void 0;
  }
  async _resolveAllLanguageModels(vendorId, silent) {
    const vendor = this._vendors.get(vendorId);
    if (!vendor) {
      return;
    }
    let provider = this._providers.get(vendorId);
    if (!provider) {
      await this._extensionService.activateByEvent(`onLanguageModelChatProvider:${vendorId}`);
      provider = this._providers.get(vendorId);
    }
    if (!provider) {
      this._logService.warn(`[LM] No provider registered for vendor ${vendorId}`);
      return;
    }
    return this._resolveLMSequencer.queue(vendorId, async () => {
      const allModels = [];
      const languageModelsGroups = [];
      try {
        const models = await provider.provideLanguageModelChatInfo({ silent }, CancellationToken.None);
        if (models.length) {
          allModels.push(...models);
          const modelIdentifiers = [];
          for (const m of models) {
            if (vendor.isDefault) {
              if (m.metadata.isUserSelectable !== false) {
                modelIdentifiers.push(m.identifier);
              } else {
                this._logService.trace(`[LM] Skipping model ${m.identifier} from model picker as it is not user selectable.`);
              }
            } else {
              modelIdentifiers.push(m.identifier);
            }
          }
          languageModelsGroups.push({ modelIdentifiers });
        }
      } catch (error) {
        languageModelsGroups.push({
          modelIdentifiers: [],
          status: {
            message: getErrorMessage(error),
            severity: Severity.Error
          }
        });
      }
      const groups = this._languageModelsConfigurationService.getLanguageModelsProviderGroups();
      const perModelConfigurations = /* @__PURE__ */ new Map();
      for (const group of groups) {
        if (group.vendor !== vendorId) {
          continue;
        }
        if (!vendor.configuration && allModels.length > 0) {
          if (group.settings) {
            for (const model of allModels) {
              const modelConfig = group.settings[model.metadata.id];
              if (modelConfig) {
                perModelConfigurations.set(model.identifier, { ...modelConfig });
              }
            }
          }
          languageModelsGroups.push({ group, modelIdentifiers: [] });
          continue;
        }
        const configuration = await this._resolveConfiguration(group, vendor.configuration);
        try {
          const models = await provider.provideLanguageModelChatInfo({ group: group.name, silent, configuration }, CancellationToken.None);
          if (models.length) {
            for (let i = 0; i < models.length; i++) {
              if (!models[i].metadata.detail) {
                models[i] = { ...models[i], metadata: { ...models[i].metadata, detail: group.name } };
              }
            }
            allModels.push(...models);
            languageModelsGroups.push({ group, modelIdentifiers: models.map((m) => m.identifier) });
          }
          if (group.settings) {
            for (const model of models) {
              const modelConfig = group.settings[model.metadata.id];
              if (modelConfig) {
                perModelConfigurations.set(model.identifier, { ...modelConfig });
              }
            }
          }
        } catch (error) {
          languageModelsGroups.push({
            group,
            modelIdentifiers: [],
            status: {
              message: getErrorMessage(error),
              severity: Severity.Error
            }
          });
        }
      }
      const wasResolved = this._modelsGroups.has(vendorId);
      const oldGroups = this._modelsGroups.get(vendorId) ?? [];
      this._modelsGroups.set(vendorId, languageModelsGroups);
      const oldModels = this._clearModelCache(vendorId);
      let hasChanges = !wasResolved;
      for (const model of allModels) {
        if (this._modelCache.has(model.identifier)) {
          this._logService.warn(`[LM] Model ${model.identifier} is already registered. Skipping.`);
          continue;
        }
        this._modelCache.set(model.identifier, model.metadata);
        hasChanges = hasChanges || !equals(oldModels.get(model.identifier), model.metadata);
        oldModels.delete(model.identifier);
      }
      this._logService.trace(`[LM] Resolved language models for vendor ${vendorId}`, allModels);
      hasChanges = hasChanges || oldModels.size > 0;
      if (!hasChanges) {
        hasChanges = this._hasGroupStructureChanged(oldGroups, languageModelsGroups);
      }
      this._clearModelConfigurations(vendorId);
      for (const [identifier, config] of perModelConfigurations) {
        if (this._modelCache.has(identifier)) {
          this._modelConfigurations.set(identifier, config);
        }
      }
      if (hasChanges) {
        this._onLanguageModelChange.fire(vendorId);
      } else {
        this._logService.trace(`[LM] No changes in language models for vendor ${vendorId}`);
      }
    });
  }
  _hasGroupStructureChanged(oldGroups, newGroups) {
    if (oldGroups.length !== newGroups.length) {
      return true;
    }
    for (let i = 0; i < oldGroups.length; i++) {
      const oldGroup = oldGroups[i];
      const newGroup = newGroups[i];
      if (oldGroup.group?.name !== newGroup.group?.name || oldGroup.group?.vendor !== newGroup.group?.vendor || oldGroup.status?.message !== newGroup.status?.message || oldGroup.status?.severity !== newGroup.status?.severity || oldGroup.modelIdentifiers.length !== newGroup.modelIdentifiers.length) {
        return true;
      }
    }
    return false;
  }
  getLanguageModelGroups(vendor) {
    return this._modelsGroups.get(vendor) ?? [];
  }
  hasResolvedVendor(vendor) {
    return this._modelsGroups.has(vendor);
  }
  async selectLanguageModels(selector) {
    if (selector.vendor) {
      await this._resolveAllLanguageModels(selector.vendor, true);
    } else {
      const allVendors = Array.from(this._vendors.keys());
      await Promise.all(allVendors.map((vendor) => this._resolveAllLanguageModels(vendor, true)));
    }
    const result = [];
    for (const [internalModelIdentifier, model] of this._modelCache) {
      if ((selector.vendor === void 0 || model.vendor === selector.vendor) && (selector.family === void 0 || model.family === selector.family) && (selector.version === void 0 || model.version === selector.version) && (selector.id === void 0 || model.id === selector.id)) {
        result.push(internalModelIdentifier);
      }
    }
    this._logService.trace("[LM] selected language models", selector, result);
    return result;
  }
  registerLanguageModelProvider(vendor, provider) {
    this._logService.trace("[LM] registering language model provider", vendor, provider);
    if (!this._vendors.has(vendor)) {
      throw new Error(`Chat model provider uses UNKNOWN vendor ${vendor}.`);
    }
    if (this._providers.has(vendor)) {
      throw new Error(`Chat model provider for vendor ${vendor} is already registered.`);
    }
    this._providers.set(vendor, provider);
    const modelChangeListener = provider.onDidChange(() => {
      this._resolveAllLanguageModels(vendor, true);
    });
    return toDisposable(() => {
      this._logService.trace("[LM] UNregistered language model provider", vendor);
      this._clearModelCache(vendor);
      this._modelsGroups.delete(vendor);
      this._providers.delete(vendor);
      modelChangeListener.dispose();
    });
  }
  async sendChatRequest(modelId, from, messages, options, token) {
    const metadata = this._modelCache.get(modelId);
    const provider = this._providers.get(metadata?.vendor || "");
    if (!provider) {
      throw new Error(`Chat provider for model ${modelId} is not registered.`);
    }
    if (metadata) {
      this._logProviderUsageTelemetry(metadata);
      this._maybeShowProviderDeprecationNotice(metadata);
    }
    const configuration = this.getModelConfiguration(modelId);
    const mergedOptions = configuration ? { ...options, configuration: { ...configuration, ...options.configuration } } : options;
    return provider.sendChatRequest(modelId, messages, from, mergedOptions, token);
  }
  /**
   * When a chat request is made against a deprecated provider (one that contributes a
   * `deprecation.link`), prompt the user once per session to install the replacement
   * extension. The notification can be dismissed, and offers a "Don't Show Again" choice that
   * is persisted across sessions via the notification service's `neverShowAgain` support.
   */
  _maybeShowProviderDeprecationNotice(metadata) {
    const vendor = this._vendors.get(metadata.vendor);
    const link = vendor?.deprecation?.link;
    if (!link) {
      return;
    }
    if (this._deprecationNoticeShownVendors.has(metadata.vendor)) {
      return;
    }
    this._deprecationNoticeShownVendors.add(metadata.vendor);
    const providerName = (vendor.displayName || metadata.vendor).replace(/\s*\(deprecated\)\s*$/i, "");
    this._notificationService.prompt(
      Severity.Info,
      localize("chat.providerDeprecation.message", "The internal {0} language model provider is being deprecated. Please migrate to the official extension.", providerName),
      [{
        label: localize("chat.providerDeprecation.install", "Install Extension"),
        run: () => {
          this._openerService.open(resolveProviderDeprecationLink(link, this._productService.urlProtocol));
        }
      }],
      {
        neverShowAgain: { id: `chat.providerDeprecation.${metadata.vendor}`, scope: NeverShowAgainScope.APPLICATION }
      }
    );
  }
  /**
   * Reports which in-built BYOK provider (or third-party extension) backs a model request. First-party
   * Copilot models are intentionally not reported here (see {@link getByokProviderTelemetryName}).
   */
  _logProviderUsageTelemetry(metadata) {
    const provider = getByokProviderTelemetryName(metadata?.vendor, metadata?.extension);
    if (!provider) {
      return;
    }
    this._telemetryService.publicLog2("chat.languageModelRequest", {
      provider,
      isBYOK: !!metadata?.isBYOK
    });
  }
  _resolveModelConfigurationWithDefaults(modelId, metadata) {
    const userConfig = this._modelConfigurations.get(modelId);
    const schema = metadata?.configurationSchema;
    if (!schema?.properties && !userConfig) {
      return void 0;
    }
    const defaults = {};
    if (schema?.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.default !== void 0) {
          defaults[key] = propSchema.default;
        }
      }
    }
    if (!userConfig && Object.keys(defaults).length === 0) {
      return void 0;
    }
    return { ...defaults, ...userConfig };
  }
  computeTokenLength(modelId, message, token) {
    const model = this._modelCache.get(modelId);
    if (!model) {
      throw new Error(`Chat model ${modelId} could not be found.`);
    }
    const provider = this._providers.get(model.vendor);
    if (!provider) {
      throw new Error(`Chat provider for model ${modelId} is not registered.`);
    }
    return provider.provideTokenCount(modelId, message, token);
  }
  getModelConfiguration(modelId) {
    const metadata = this._modelCache.get(modelId);
    return this._resolveModelConfigurationWithDefaults(modelId, metadata);
  }
  async setModelConfiguration(modelId, values) {
    const metadata = this._modelCache.get(modelId);
    if (!metadata) {
      return;
    }
    const allGroups = this._languageModelsConfigurationService.getLanguageModelsProviderGroups();
    let group;
    group = allGroups.find((g) => g.vendor === metadata.vendor && g.settings?.[metadata.id] !== void 0);
    if (!group) {
      const vendorGroups = this._modelsGroups.get(metadata.vendor);
      const containingGroup = vendorGroups?.find((vg) => vg.modelIdentifiers.includes(modelId) && vg.group)?.group;
      if (containingGroup) {
        group = allGroups.find((g) => g.vendor === containingGroup.vendor && g.name === containingGroup.name) ?? containingGroup;
      }
    }
    if (!group) {
      group = allGroups.find((g) => g.vendor === metadata.vendor);
    }
    const existingConfig = this._modelConfigurations.get(modelId) ?? {};
    const updatedConfig = { ...existingConfig, ...values };
    const schema = metadata.configurationSchema;
    if (schema?.properties) {
      for (const [key, value] of Object.entries(updatedConfig)) {
        const propSchema = schema.properties[key];
        if (propSchema?.default !== void 0 && propSchema.default === value) {
          delete updatedConfig[key];
        }
      }
    }
    if (group) {
      const existingSettings = group.settings ?? {};
      let updatedSettings;
      if (Object.keys(updatedConfig).length === 0) {
        updatedSettings = { ...existingSettings };
        delete updatedSettings[metadata.id];
      } else {
        updatedSettings = { ...existingSettings, [metadata.id]: updatedConfig };
      }
      const updatedGroup = {
        ...group,
        settings: Object.keys(updatedSettings).length > 0 ? updatedSettings : void 0
      };
      if (!updatedGroup.settings && Object.keys(updatedGroup).filter((k) => k !== "name" && k !== "vendor" && k !== "range" && k !== "modelsRange" && k !== "settings").length === 0) {
        await this._languageModelsConfigurationService.removeLanguageModelsProviderGroup(group);
      } else {
        await this._languageModelsConfigurationService.updateLanguageModelsProviderGroup(group, updatedGroup);
      }
    } else if (Object.keys(updatedConfig).length > 0) {
      const vendor = this._vendors.get(metadata.vendor);
      if (!vendor) {
        return;
      }
      const newGroup = {
        name: vendor.displayName,
        vendor: metadata.vendor,
        settings: { [metadata.id]: updatedConfig }
      };
      await this._languageModelsConfigurationService.addLanguageModelsProviderGroup(newGroup);
    }
    if (Object.keys(updatedConfig).length > 0) {
      this._modelConfigurations.set(modelId, updatedConfig);
    } else {
      this._modelConfigurations.delete(modelId);
    }
    this._onLanguageModelChange.fire(metadata.vendor);
  }
  getModelConfigurationActions(modelId) {
    const metadata = this._modelCache.get(modelId);
    const currentConfig = this._modelConfigurations.get(modelId) ?? {};
    return createModelConfigurationActions(
      metadata?.configurationSchema,
      currentConfig,
      (key, value) => this.setModelConfiguration(modelId, { [key]: value })
    );
  }
  async configureLanguageModelsProviderGroup(vendorId, providerGroupName) {
    const vendor = this.getVendors().find(({ vendor: vendor2 }) => vendor2 === vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found.`);
    }
    if (vendor.managementCommand) {
      await this._resolveAllLanguageModels(vendor.vendor, false);
      return;
    }
    const languageModelProviderGroups = this._languageModelsConfigurationService.getLanguageModelsProviderGroups();
    const existing = languageModelProviderGroups.find((g) => g.vendor === vendorId && g.name === providerGroupName);
    const name = await this.promptForName(languageModelProviderGroups, vendor, existing);
    if (!name) {
      return;
    }
    const existingConfiguration = existing ? await this._resolveConfiguration(existing, vendor.configuration) : void 0;
    try {
      const configuration = vendor.configuration ? await this.promptForConfiguration(name, vendor.configuration, existingConfiguration) : void 0;
      if (vendor.configuration && !configuration) {
        return;
      }
      const languageModelProviderGroup = await this._resolveLanguageModelProviderGroup(name, vendorId, configuration, vendor.configuration);
      const saved = existing ? await this._languageModelsConfigurationService.updateLanguageModelsProviderGroup(existing, languageModelProviderGroup) : await this._languageModelsConfigurationService.addLanguageModelsProviderGroup(languageModelProviderGroup);
      if (vendor.configuration && this.requireConfiguring(vendor.configuration)) {
        const snippet = this.getSnippetForFirstUnconfiguredProperty(configuration ?? {}, vendor.configuration);
        await this._languageModelsConfigurationService.configureLanguageModels({ group: saved, snippet });
      }
    } catch (error) {
      if (isCancellationError(error)) {
        return;
      }
      throw error;
    }
  }
  async renameLanguageModelsProviderGroup(vendorId, providerGroupName) {
    const vendor = this.getVendors().find(({ vendor: vendor2 }) => vendor2 === vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found.`);
    }
    const languageModelProviderGroups = this._languageModelsConfigurationService.getLanguageModelsProviderGroups();
    const existing = languageModelProviderGroups.find((group) => group.vendor === vendorId && group.name === providerGroupName);
    if (!existing) {
      throw new Error(`Language model provider group ${providerGroupName} for vendor ${vendorId} not found.`);
    }
    const name = await this.promptForName(languageModelProviderGroups, vendor, existing);
    if (!name || name === existing.name) {
      return;
    }
    await this._languageModelsConfigurationService.updateLanguageModelsProviderGroup(existing, { ...existing, name });
  }
  async updateLanguageModelsProviderGroupApiKey(vendorId, providerGroupName) {
    const vendor = this.getVendors().find(({ vendor: vendor2 }) => vendor2 === vendorId);
    const schema = vendor?.configuration;
    const apiKeySchema = schema?.properties?.apiKey;
    if (!vendor || !schema || !apiKeySchema) {
      return;
    }
    const existing = this._languageModelsConfigurationService.getLanguageModelsProviderGroups().find((group) => group.vendor === vendorId && group.name === providerGroupName);
    if (!existing) {
      throw new Error(`Language model provider group ${providerGroupName} for vendor ${vendorId} not found.`);
    }
    try {
      const existingConfiguration = await this._resolveConfiguration(existing, schema);
      const apiKey = await this.promptForValue(existing.name, "apiKey", apiKeySchema, !!schema.required?.includes("apiKey"), existingConfiguration);
      if (apiKey === void 0 || apiKey === existingConfiguration.apiKey) {
        return;
      }
      const configuration = { ...existingConfiguration, apiKey };
      const updated = {
        ...await this._resolveLanguageModelProviderGroup(existing.name, vendorId, configuration, schema),
        settings: existing.settings
      };
      await this._languageModelsConfigurationService.updateLanguageModelsProviderGroup(existing, updated);
      await this._deleteSecretsInConfiguration(existing, schema);
    } catch (error) {
      if (isCancellationError(error)) {
        return;
      }
      throw error;
    }
  }
  async addLanguageModelsProviderGroupModel(vendorId, providerGroupName) {
    const vendor = this.getVendors().find(({ vendor: vendor2 }) => vendor2 === vendorId);
    const schema = vendor?.configuration;
    const modelsSchema = schema?.properties?.models;
    if (!vendor || !modelsSchema) {
      return;
    }
    const group = this._languageModelsConfigurationService.getLanguageModelsProviderGroups().find((group2) => group2.vendor === vendorId && group2.name === providerGroupName);
    if (!group) {
      throw new Error(`Language model provider group ${providerGroupName} for vendor ${vendorId} not found.`);
    }
    const hasModels = Array.isArray(group.models);
    const snippet = hasModels ? this.getSnippetForArrayItem(modelsSchema) : this.getSnippetForProperty("models", modelsSchema);
    if (!snippet) {
      return;
    }
    await this._languageModelsConfigurationService.configureLanguageModels({
      group,
      snippet,
      snippetTarget: hasModels ? "models" : "group"
    });
  }
  async openLanguageModelsProviderGroupSettings(vendorId, providerGroupName) {
    const group = this._languageModelsConfigurationService.getLanguageModelsProviderGroups().find((group2) => group2.vendor === vendorId && group2.name === providerGroupName);
    if (!group) {
      throw new Error(`Language model provider group ${providerGroupName} for vendor ${vendorId} not found.`);
    }
    await this._languageModelsConfigurationService.configureLanguageModels({ group });
  }
  async configureModel(modelId) {
    const metadata = this._modelCache.get(modelId);
    if (!metadata || !metadata.configurationSchema) {
      return;
    }
    const vendorGroups = this._modelsGroups.get(metadata.vendor);
    let group;
    if (vendorGroups) {
      for (const vg of vendorGroups) {
        if (vg.modelIdentifiers.includes(modelId) && vg.group) {
          group = vg.group;
          break;
        }
      }
    }
    if (!group) {
      const vendor = this.getVendors().find((v) => v.vendor === metadata.vendor);
      if (!vendor) {
        return;
      }
      const groupName = vendor.displayName;
      const newGroup = { name: groupName, vendor: metadata.vendor, settings: { [metadata.id]: {} } };
      group = await this._languageModelsConfigurationService.addLanguageModelsProviderGroup(newGroup);
      await this._resolveAllLanguageModels(metadata.vendor, true);
    }
    const snippet = this._getModelConfigurationSnippet(metadata.id, metadata.configurationSchema);
    await this._languageModelsConfigurationService.configureLanguageModels({ group, snippet });
  }
  _getModelConfigurationSnippet(modelId, schema) {
    const properties = [];
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.defaultSnippets?.[0]) {
          const snippet = propSchema.defaultSnippets[0];
          let bodyText = snippet.bodyText ?? JSON.stringify(snippet.body, null, "			");
          bodyText = bodyText.replace(/"(\^[^"]*)"/g, (_, value) => value.substring(1));
          properties.push(`			"${key}": ${bodyText}`);
        } else if (propSchema.default !== void 0) {
          properties.push(`			"${key}": ${JSON.stringify(propSchema.default)}`);
        } else {
          properties.push(`			"${key}": \${${key}}`);
        }
      }
    }
    const modelContent = properties.length > 0 ? `{
${properties.join(",\n")}
		}` : "{\n			$0\n		}";
    return `"settings": {
		"${modelId}": ${modelContent}
	}`;
  }
  async addLanguageModelsProviderGroup(name, vendorId, configuration) {
    const vendor = this.getVendors().find(({ vendor: vendor2 }) => vendor2 === vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found.`);
    }
    const languageModelProviderGroup = await this._resolveLanguageModelProviderGroup(name, vendorId, configuration, vendor.configuration);
    await this._languageModelsConfigurationService.addLanguageModelsProviderGroup(languageModelProviderGroup);
  }
  async removeLanguageModelsProviderGroup(vendorId, providerGroupName) {
    const vendor = this.getVendors().find(({ vendor: vendor2 }) => vendor2 === vendorId);
    if (!vendor) {
      throw new Error(`Vendor ${vendorId} not found.`);
    }
    const languageModelProviderGroups = this._languageModelsConfigurationService.getLanguageModelsProviderGroups();
    const existing = languageModelProviderGroups.find((g) => g.vendor === vendorId && g.name === providerGroupName);
    if (!existing) {
      throw new Error(`Language model provider group ${providerGroupName} for vendor ${vendorId} not found.`);
    }
    await this._deleteSecretsInConfiguration(existing, vendor.configuration);
    await this._languageModelsConfigurationService.removeLanguageModelsProviderGroup(existing);
  }
  requireConfiguring(schema) {
    if (schema.additionalProperties) {
      return true;
    }
    if (!schema.properties) {
      return false;
    }
    for (const property of Object.keys(schema.properties)) {
      if (!this.canPromptForProperty(schema.properties[property])) {
        return true;
      }
    }
    return false;
  }
  getSnippetForFirstUnconfiguredProperty(configuration, schema) {
    if (!schema.properties) {
      return void 0;
    }
    for (const property of Object.keys(schema.properties)) {
      if (configuration[property] === void 0) {
        const propertySchema = schema.properties[property];
        const snippet = this.getSnippetForProperty(property, propertySchema);
        if (snippet) {
          return snippet;
        }
      }
    }
    return void 0;
  }
  getSnippetForProperty(property, propertySchema) {
    const bodyText = this.getDefaultSnippetBodyText(propertySchema);
    return bodyText ? `"${property}": ${bodyText}` : void 0;
  }
  getSnippetForArrayItem(propertySchema) {
    return this.getDefaultSnippetBodyText(propertySchema, true);
  }
  getDefaultSnippetBodyText(propertySchema, arrayItem = false) {
    const snippet = propertySchema.defaultSnippets?.[0];
    if (!snippet) {
      return void 0;
    }
    const bodyText = arrayItem ? Array.isArray(snippet.body) && snippet.body.length > 0 ? JSON.stringify(snippet.body[0], null, "	") : void 0 : snippet.bodyText ?? JSON.stringify(snippet.body, null, "	");
    if (!bodyText) {
      return void 0;
    }
    return bodyText.replace(/"(\^[^"]*)"/g, (_, value) => value.substring(1));
  }
  async promptForName(languageModelProviderGroups, vendor, existing) {
    let providerGroupName = existing?.name;
    if (!providerGroupName) {
      providerGroupName = vendor.displayName;
      let count = 1;
      while (languageModelProviderGroups.some((g) => g.vendor === vendor.vendor && g.name === providerGroupName)) {
        count++;
        providerGroupName = `${vendor.displayName} ${count}`;
      }
    }
    let result;
    const disposables = new DisposableStore();
    try {
      await new Promise((resolve) => {
        const inputBox = disposables.add(this._quickInputService.createInputBox());
        inputBox.title = localize("configureLanguageModelGroup", "Group Name");
        inputBox.placeholder = localize("languageModelGroupName", "Enter a name for the group");
        inputBox.value = providerGroupName;
        inputBox.ignoreFocusOut = true;
        disposables.add(inputBox.onDidChangeValue((value) => {
          if (!value) {
            inputBox.validationMessage = localize("enterName", "Please enter a name");
            inputBox.severity = Severity.Error;
            return;
          }
          if (languageModelProviderGroups.some((group) => group !== existing && group.vendor === vendor.vendor && group.name === value)) {
            inputBox.validationMessage = localize("nameExists", "A language models group with this name already exists");
            inputBox.severity = Severity.Error;
            return;
          }
          inputBox.validationMessage = void 0;
          inputBox.severity = Severity.Ignore;
        }));
        disposables.add(inputBox.onDidAccept(async () => {
          result = inputBox.value;
          inputBox.hide();
        }));
        disposables.add(inputBox.onDidHide(() => resolve()));
        inputBox.show();
      });
    } finally {
      disposables.dispose();
    }
    return result;
  }
  async promptForConfiguration(groupName, configuration, existing) {
    if (!configuration.properties) {
      return;
    }
    const result = existing ? { ...existing } : {};
    for (const property of Object.keys(configuration.properties)) {
      const propertySchema = configuration.properties[property];
      const required = !!configuration.required?.includes(property);
      const value = await this.promptForValue(groupName, property, propertySchema, required, existing);
      if (value !== void 0) {
        result[property] = value;
      }
    }
    return result;
  }
  async promptForValue(groupName, property, propertySchema, required, existing) {
    if (!propertySchema) {
      return void 0;
    }
    if (!this.canPromptForProperty(propertySchema)) {
      return void 0;
    }
    if (propertySchema.type === "array" && propertySchema.items && !Array.isArray(propertySchema.items) && propertySchema.items.enum) {
      const selectedItems = await this.promptForArray(groupName, property, propertySchema);
      if (selectedItems === void 0) {
        return void 0;
      }
      return selectedItems;
    }
    if (propertySchema.type === "string" && Array.isArray(propertySchema.enum) && propertySchema.enum.length > 0) {
      return this.promptForEnum(groupName, property, propertySchema, existing);
    }
    const value = await this.promptForInput(groupName, property, propertySchema, required, existing);
    if (value === void 0) {
      return void 0;
    }
    return value;
  }
  canPromptForProperty(propertySchema) {
    if (!propertySchema || typeof propertySchema === "boolean") {
      return false;
    }
    if (propertySchema.type === "array" && propertySchema.items && !Array.isArray(propertySchema.items) && propertySchema.items.enum) {
      return true;
    }
    if (propertySchema.type === "string" || propertySchema.type === "number" || propertySchema.type === "integer" || propertySchema.type === "boolean") {
      return true;
    }
    return false;
  }
  getDescriptionPlaintext(propertySchema) {
    if (propertySchema.description) {
      return propertySchema.description;
    }
    const md = propertySchema.markdownDescription;
    if (!md) {
      return void 0;
    }
    return md.replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  }
  async promptForArray(groupName, property, propertySchema) {
    if (!propertySchema.items || Array.isArray(propertySchema.items) || !propertySchema.items.enum) {
      return void 0;
    }
    const items = propertySchema.items.enum;
    const disposables = new DisposableStore();
    try {
      return await new Promise((resolve) => {
        const quickPick = disposables.add(this._quickInputService.createQuickPick());
        quickPick.title = `${groupName}: ${propertySchema.title ?? property}`;
        quickPick.items = items.map((item) => ({ label: item }));
        quickPick.placeholder = this.getDescriptionPlaintext(propertySchema) ?? localize("selectValue", "Select value for {0}", property);
        quickPick.canSelectMany = true;
        quickPick.ignoreFocusOut = true;
        disposables.add(quickPick.onDidAccept(() => {
          resolve(quickPick.selectedItems.map((item) => item.label));
          quickPick.hide();
        }));
        disposables.add(quickPick.onDidHide(() => {
          resolve(void 0);
        }));
        quickPick.show();
      });
    } finally {
      disposables.dispose();
    }
  }
  async promptForEnum(groupName, property, propertySchema, existing) {
    const values = propertySchema.enum;
    if (!Array.isArray(values) || values.length === 0) {
      return void 0;
    }
    const enumDescriptions = propertySchema.enumDescriptions;
    const enumItemLabels = Array.isArray(propertySchema.enumItemLabels) ? propertySchema.enumItemLabels : void 0;
    const initial = existing?.[property] !== void 0 ? String(existing[property]) : propertySchema.default !== void 0 ? String(propertySchema.default) : void 0;
    const items = values.map((value, index) => ({
      label: enumItemLabels?.[index] ?? String(value),
      description: enumDescriptions?.[index],
      id: String(value)
    }));
    const disposables = new DisposableStore();
    try {
      return await new Promise((resolve) => {
        const quickPick = disposables.add(this._quickInputService.createQuickPick());
        quickPick.title = `${groupName}: ${propertySchema.title ?? property}`;
        quickPick.items = items;
        quickPick.placeholder = this.getDescriptionPlaintext(propertySchema) ?? localize("selectValue", "Select value for {0}", property);
        quickPick.ignoreFocusOut = true;
        if (initial !== void 0) {
          const match = items.find((item) => item.id === initial);
          if (match) {
            quickPick.activeItems = [match];
          }
        }
        disposables.add(quickPick.onDidAccept(() => {
          const selected = quickPick.selectedItems[0];
          resolve(selected?.id);
          quickPick.hide();
        }));
        disposables.add(quickPick.onDidHide(() => {
          resolve(void 0);
        }));
        quickPick.show();
      });
    } finally {
      disposables.dispose();
    }
  }
  async promptForInput(groupName, property, propertySchema, required, existing) {
    const disposables = new DisposableStore();
    try {
      const validate = (value2) => {
        if (!value2 && required) {
          return localize("valueRequired", "Value is required");
        }
        return void 0;
      };
      const value = await new Promise((resolve, reject) => {
        const inputBox = disposables.add(this._quickInputService.createInputBox());
        inputBox.title = `${groupName}: ${propertySchema.title ?? property}`;
        inputBox.placeholder = localize("enterValue", "Enter value for {0}", property);
        inputBox.password = !!propertySchema.secret;
        inputBox.ignoreFocusOut = true;
        if (existing?.[property]) {
          inputBox.value = String(existing?.[property]);
        } else if (propertySchema.default) {
          inputBox.value = String(propertySchema.default);
        }
        const promptText = this.getDescriptionPlaintext(propertySchema);
        if (promptText) {
          inputBox.prompt = promptText;
        }
        disposables.add(inputBox.onDidChangeValue((value2) => {
          const message = validate(value2);
          if (message) {
            inputBox.validationMessage = message;
            inputBox.severity = Severity.Error;
          } else {
            inputBox.validationMessage = void 0;
            inputBox.severity = Severity.Ignore;
          }
        }));
        disposables.add(inputBox.onDidAccept(() => {
          const message = validate(inputBox.value);
          if (message) {
            inputBox.validationMessage = message;
            inputBox.severity = Severity.Error;
            return;
          }
          resolve(inputBox.value);
          inputBox.hide();
        }));
        disposables.add(inputBox.onDidHide((e) => {
          if (e.reason === QuickInputHideReason.Gesture) {
            reject(new CancellationError());
          } else {
            resolve(void 0);
          }
        }));
        inputBox.show();
      });
      if (!value) {
        return void 0;
      }
      if (propertySchema.type === "number" || propertySchema.type === "integer") {
        return Number(value);
      } else if (propertySchema.type === "boolean") {
        return value === "true";
      } else {
        return value;
      }
    } finally {
      disposables.dispose();
    }
  }
  encodeSecretKey(property) {
    return format(LanguageModelsService.SECRET_INPUT, property);
  }
  decodeSecretKey(secretInput) {
    if (!isString(secretInput)) {
      return void 0;
    }
    return secretInput.substring(secretInput.indexOf(":") + 1, secretInput.length - 1);
  }
  _clearModelCache(vendor) {
    const removed = /* @__PURE__ */ new Map();
    for (const [id, model] of this._modelCache.entries()) {
      if (model.vendor === vendor) {
        removed.set(id, model);
        this._modelCache.delete(id);
      }
    }
    return removed;
  }
  _clearModelConfigurations(vendor) {
    for (const [id] of this._modelConfigurations) {
      if (this._modelCache.get(id)?.vendor === vendor || id.startsWith(`${vendor}/`)) {
        this._modelConfigurations.delete(id);
      }
    }
  }
  async _resolveConfiguration(group, schema) {
    if (!schema) {
      return {};
    }
    const result = {};
    for (const key in group) {
      if (key === "vendor" || key === "name" || key === "range" || key === "modelsRange" || key === "settings") {
        continue;
      }
      let value = group[key];
      if (schema.properties?.[key]?.secret) {
        const secretKey = this.decodeSecretKey(value);
        value = secretKey ? await this._secretStorageService.get(secretKey) : void 0;
      }
      result[key] = value;
    }
    return result;
  }
  async _resolveLanguageModelProviderGroup(name, vendor, configuration, schema) {
    if (!schema) {
      return { name, vendor };
    }
    const result = {};
    for (const key in configuration) {
      let value = configuration[key];
      if (schema.properties?.[key]?.secret && isString(value)) {
        const secretKey = `${LanguageModelsService.SECRET_KEY_PREFIX}${hash(generateUuid()).toString(16)}`;
        await this._secretStorageService.set(secretKey, key === "apiKey" ? value.trim() : value);
        value = this.encodeSecretKey(secretKey);
      }
      result[key] = value;
    }
    return { name, vendor, ...result };
  }
  async _deleteSecretsInConfiguration(group, schema) {
    if (!schema) {
      return;
    }
    const { vendor, name, range, modelsRange, ...configuration } = group;
    for (const key in configuration) {
      const value = group[key];
      if (schema.properties?.[key]?.secret) {
        const secretKey = this.decodeSecretKey(value);
        if (secretKey) {
          await this._secretStorageService.delete(secretKey);
        }
      }
    }
  }
  async migrateLanguageModelsProviderGroup(languageModelsProviderGroup) {
    const { vendor, name, ...configuration } = languageModelsProviderGroup;
    if (!this._vendors.get(vendor)) {
      throw new Error(`Vendor ${vendor} not found.`);
    }
    await this._extensionService.activateByEvent(`onLanguageModelChatProvider:${vendor}`);
    const provider = this._providers.get(vendor);
    if (!provider) {
      throw new Error(`Chat model provider for vendor ${vendor} is not registered.`);
    }
    await provider.provideLanguageModelChatInfo({ group: name, silent: false, configuration }, CancellationToken.None);
    await this.addLanguageModelsProviderGroup(name, vendor, configuration);
  }
  //#region Recently used models
  _readRecentlyUsedModels() {
    return this._storageService.getObject(CHAT_MODEL_RECENTLY_USED_STORAGE_KEY, StorageScope.PROFILE, []);
  }
  _saveRecentlyUsedModels() {
    this._storageService.store(CHAT_MODEL_RECENTLY_USED_STORAGE_KEY, this._recentlyUsedModelIds, StorageScope.PROFILE, StorageTarget.USER);
  }
  getRecentlyUsedModelIds() {
    return this._recentlyUsedModelIds.filter((id) => this._modelCache.has(id) && id !== AUTO_MODEL_IDENTIFIER).slice(0, 4);
  }
  addToRecentlyUsedList(modelIdentifier) {
    if (modelIdentifier === AUTO_MODEL_IDENTIFIER) {
      return;
    }
    const index = this._recentlyUsedModelIds.indexOf(modelIdentifier);
    if (index !== -1) {
      this._recentlyUsedModelIds.splice(index, 1);
    }
    this._recentlyUsedModelIds.unshift(modelIdentifier);
    if (this._recentlyUsedModelIds.length > 20) {
      this._recentlyUsedModelIds.length = 20;
    }
    this._saveRecentlyUsedModels();
  }
  clearRecentlyUsedList() {
    this._recentlyUsedModelIds = [];
    this._saveRecentlyUsedModels();
  }
  //#endregion
  //#region Pinned models
  _readPinnedModels() {
    return this._storageService.getObject(CHAT_MODEL_PINNED_STORAGE_KEY, StorageScope.PROFILE, []);
  }
  _savePinnedModels() {
    this._storageService.store(CHAT_MODEL_PINNED_STORAGE_KEY, this._pinnedModelIds, StorageScope.PROFILE, StorageTarget.USER);
  }
  getPinnedModelIds() {
    return this._pinnedModelIds.filter((id) => id !== AUTO_MODEL_IDENTIFIER && this._modelCache.has(id));
  }
  pinModel(modelIdentifier) {
    if (modelIdentifier === AUTO_MODEL_IDENTIFIER || this._pinnedModelIds.includes(modelIdentifier)) {
      return;
    }
    this._pinnedModelIds.push(modelIdentifier);
    this._savePinnedModels();
    this._onDidChangePinnedModels.fire();
  }
  unpinModel(modelIdentifier) {
    const index = this._pinnedModelIds.indexOf(modelIdentifier);
    if (index === -1) {
      return;
    }
    this._pinnedModelIds.splice(index, 1);
    this._savePinnedModels();
    this._onDidChangePinnedModels.fire();
  }
  isModelPinned(modelIdentifier) {
    return modelIdentifier !== AUTO_MODEL_IDENTIFIER && this._pinnedModelIds.includes(modelIdentifier);
  }
  //#endregion
  //#region Model visibility
  _getGroupNameForVendor(vendor) {
    return this._vendors.get(vendor)?.displayName ?? vendor;
  }
  _getModelIdsInGroup(vendor, groupName) {
    const vendorGroups = this._modelsGroups.get(vendor);
    if (!vendorGroups) {
      return [];
    }
    const result = [];
    const fallbackName = this._getGroupNameForVendor(vendor);
    for (const g of vendorGroups) {
      const name = g.group?.name ?? fallbackName;
      if (name === groupName) {
        for (const id of g.modelIdentifiers) {
          const metadata = this._modelCache.get(id);
          if (metadata && ILanguageModelChatMetadata.getAgentHostByokManageModelsIdentifier(metadata) !== void 0) {
            continue;
          }
          result.push(id);
        }
      }
    }
    return result;
  }
  _readVisibility() {
    const raw = this._storageService.getObject(CHAT_MODEL_VISIBILITY_STORAGE_KEY, StorageScope.PROFILE, {});
    this._hiddenModelIds = new Set(Array.isArray(raw?.hiddenModels) ? raw.hiddenModels : []);
  }
  _saveVisibility() {
    this._storageService.store(
      CHAT_MODEL_VISIBILITY_STORAGE_KEY,
      { hiddenModels: Array.from(this._hiddenModelIds) },
      StorageScope.PROFILE,
      StorageTarget.USER
    );
  }
  isGroupHidden(vendor, groupName) {
    const modelIds = this._getModelIdsInGroup(vendor, groupName);
    return modelIds.length > 0 && modelIds.every((id) => this._hiddenModelIds.has(id));
  }
  isModelHidden(modelIdentifier) {
    return this._hiddenModelIds.has(modelIdentifier);
  }
  setGroupHidden(vendor, groupName, hidden) {
    this.setModelsHidden(this._getModelIdsInGroup(vendor, groupName), hidden);
  }
  setModelHidden(modelIdentifier, hidden) {
    this.setModelsHidden([modelIdentifier], hidden);
  }
  setModelsHidden(modelIdentifiers, hidden) {
    let changed = false;
    for (const id of modelIdentifiers) {
      if (hidden) {
        if (!this._hiddenModelIds.has(id)) {
          this._hiddenModelIds.add(id);
          changed = true;
        }
      } else if (this._hiddenModelIds.delete(id)) {
        changed = true;
      }
    }
    if (changed) {
      this._saveVisibility();
      this._onDidChangeModelVisibility.fire();
    }
  }
  getHiddenModelIds() {
    return Array.from(this._hiddenModelIds);
  }
  //#endregion
  //#region Models control manifest
  getModelsControlManifest() {
    return this._modelsControlManifest;
  }
  _setModelsControlManifest(response) {
    this._modelsControlRawResponse = response;
    this._refreshModelsControlManifest();
  }
  _refreshModelsControlManifest() {
    const response = this._modelsControlRawResponse;
    const free = {};
    const paid = {};
    if (response?.free) {
      const freeEntries = Array.isArray(response.free) ? response.free : Object.values(response.free);
      for (const entry of freeEntries) {
        if (!entry || !isObject(entry)) {
          continue;
        }
        free[entry.id] = { label: entry.label, featured: entry.featured, exists: this._modelCache.has(`copilot/${entry.id}`) };
      }
    }
    if (response?.paid) {
      const paidEntries = Array.isArray(response.paid) ? response.paid : Object.values(response.paid);
      for (const entry of paidEntries) {
        if (!entry || !isObject(entry)) {
          continue;
        }
        paid[entry.id] = { label: entry.label, featured: entry.featured, minVSCodeVersion: entry.minVSCodeVersion, exists: this._modelCache.has(`copilot/${entry.id}`) };
      }
    }
    this._modelsControlManifest = { free, paid };
    this._onDidChangeModelsControlManifest.fire(this._modelsControlManifest);
  }
  //#region Chat control data
  _initChatControlData() {
    this._chatControlUrl = this._productService.chatParticipantRegistry;
    if (!this._chatControlUrl) {
      return;
    }
    const raw = this._storageService.get(CHAT_PARTICIPANT_NAME_REGISTRY_STORAGE_KEY, StorageScope.APPLICATION);
    try {
      this._restrictedChatParticipants.set(JSON.parse(raw ?? "{}"), void 0);
    } catch (err) {
      this._storageService.remove(CHAT_PARTICIPANT_NAME_REGISTRY_STORAGE_KEY, StorageScope.APPLICATION);
    }
    const rawModels = this._storageService.get(CHAT_MODELS_CONTROL_STORAGE_KEY, StorageScope.APPLICATION);
    try {
      const models = JSON.parse(rawModels ?? "{}");
      if (isObject(models)) {
        this._setModelsControlManifest(models);
      }
    } catch (err) {
      this._storageService.remove(CHAT_MODELS_CONTROL_STORAGE_KEY, StorageScope.APPLICATION);
    }
    this._refreshChatControlData();
  }
  _refreshChatControlData() {
    if (this._chatControlDisposed) {
      return;
    }
    this._fetchChatControlData().catch((err) => this._logService.warn("Failed to fetch chat control data", err)).then(() => timeout(5 * 60 * 1e3)).then(() => this._refreshChatControlData());
  }
  async _fetchChatControlData() {
    this._logService.trace("[LM] Fetching chat control data from", this._chatControlUrl);
    let context;
    try {
      context = await this._requestService.request({ type: "GET", url: this._chatControlUrl, callSite: "languageModels.fetchChatControlData" }, CancellationToken.None);
    } catch (err) {
      this._logService.warn("[LM] Failed to request chat control data", getErrorMessage(err));
      return;
    }
    if (context.res.statusCode !== 200) {
      this._logService.warn(`[LM] Chat control data request failed with status ${context.res.statusCode}`);
      return;
    }
    let result;
    try {
      result = await asJson(context);
    } catch (err) {
      this._logService.warn("[LM] Failed to parse chat control response", getErrorMessage(err));
      return;
    }
    this._logService.trace("[LM] Received chat control response", result ? Object.keys(result) : "null");
    if (!result || result.version !== 1) {
      this._logService.warn("[LM] Unexpected chat control response version", result?.version);
      return;
    }
    const registry = result.restrictedChatParticipants;
    this._restrictedChatParticipants.set(registry, void 0);
    this._storageService.store(CHAT_PARTICIPANT_NAME_REGISTRY_STORAGE_KEY, JSON.stringify(registry), StorageScope.APPLICATION, StorageTarget.MACHINE);
    if (result.models) {
      this._logService.trace("[LM] Updating models control manifest", { freeCount: Object.keys(result.models.free ?? {}).length, paidCount: Object.keys(result.models.paid ?? {}).length });
      this._setModelsControlManifest(result.models);
      this._storageService.store(CHAT_MODELS_CONTROL_STORAGE_KEY, JSON.stringify(result.models), StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  }
  //#endregion
  dispose() {
    this._chatControlDisposed = true;
    this._store.dispose();
    this._providers.clear();
  }
};
LanguageModelsService = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ILanguageModelsConfigurationService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, ISecretStorageService),
  __decorateParam(7, IProductService),
  __decorateParam(8, IRequestService),
  __decorateParam(9, INotificationService),
  __decorateParam(10, IOpenerService),
  __decorateParam(11, ITelemetryService)
], LanguageModelsService);
export {
  COPILOT_VENDOR_ID,
  ChatImageMimeType,
  ChatMessageRole,
  ILanguageModelChatMetadata,
  ILanguageModelsService,
  ImageDetailLevel,
  LanguageModelPartAudience,
  LanguageModelsService,
  THIRD_PARTY_PROVIDER_TELEMETRY_NAME,
  createModelConfigurationActions,
  getByokProviderTelemetryName,
  getLanguageModelDisplayNameWithProvider,
  getLanguageModelProviderDisplayName,
  getTextResponseFromStream,
  isAutoLanguageModel,
  isILanguageModelChatSelector,
  isLanguageModelVendorAbsenceConclusive,
  languageModelChatProviderExtensionPoint,
  resolveProviderDeprecationLink
};
