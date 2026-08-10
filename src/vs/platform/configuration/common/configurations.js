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
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { deepClone, equals } from "../../../base/common/objects.js";
import { isEmptyObject, isString } from "../../../base/common/types.js";
import { ConfigurationModel } from "./configurationModels.js";
import { Extensions } from "./configurationRegistry.js";
import { ILogService, NullLogService } from "../../log/common/log.js";
import { IPolicyService } from "../../policy/common/policy.js";
import { Registry } from "../../registry/common/platform.js";
import { getErrorMessage } from "../../../base/common/errors.js";
import * as json from "../../../base/common/json.js";
class DefaultConfiguration extends Disposable {
  constructor(logService) {
    super();
    this.logService = logService;
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this._configurationModel = ConfigurationModel.createEmptyModel(logService);
  }
  get configurationModel() {
    return this._configurationModel;
  }
  async initialize() {
    this.resetConfigurationModel();
    this._register(Registry.as(Extensions.Configuration).onDidUpdateConfiguration(({ properties, defaultsOverrides }) => this.onDidUpdateConfiguration(Array.from(properties), defaultsOverrides)));
    return this.configurationModel;
  }
  reload() {
    this.resetConfigurationModel();
    return this.configurationModel;
  }
  onDidUpdateConfiguration(properties, defaultsOverrides) {
    this.updateConfigurationModel(properties, Registry.as(Extensions.Configuration).getConfigurationProperties());
    this._onDidChangeConfiguration.fire({ defaults: this.configurationModel, properties });
  }
  getConfigurationDefaultOverrides() {
    return {};
  }
  resetConfigurationModel() {
    this._configurationModel = ConfigurationModel.createEmptyModel(this.logService);
    const properties = Registry.as(Extensions.Configuration).getConfigurationProperties();
    this.updateConfigurationModel(Object.keys(properties), properties);
  }
  updateConfigurationModel(properties, configurationProperties) {
    const configurationDefaultsOverrides = this.getConfigurationDefaultOverrides();
    for (const key of properties) {
      const defaultOverrideValue = configurationDefaultsOverrides[key];
      const propertySchema = configurationProperties[key];
      if (defaultOverrideValue !== void 0) {
        this._configurationModel.setValue(key, defaultOverrideValue);
      } else if (propertySchema) {
        this._configurationModel.setValue(key, this.getDefaultValue(key, propertySchema));
      } else {
        this._configurationModel.removeValue(key);
      }
    }
  }
  getDefaultValue(_key, propertySchema) {
    return deepClone(propertySchema.default);
  }
}
class NullPolicyConfiguration {
  constructor() {
    this.onDidChangeConfiguration = Event.None;
    this.configurationModel = ConfigurationModel.createEmptyModel(new NullLogService());
  }
  async initialize() {
    return this.configurationModel;
  }
}
let PolicyConfiguration = class extends Disposable {
  constructor(defaultConfiguration, policyService, logService) {
    super();
    this.defaultConfiguration = defaultConfiguration;
    this.policyService = policyService;
    this.logService = logService;
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    /** Last definition submitted per policy name; avoids redundant re-registration. */
    this._submittedPolicyDefinitions = /* @__PURE__ */ new Map();
    /** Maps each policy-controlled setting key to its policy name, so removed keys can be re-resolved. */
    this._policyNameByKey = /* @__PURE__ */ new Map();
    this._configurationModel = ConfigurationModel.createEmptyModel(this.logService);
    this.configurationRegistry = Registry.as(Extensions.Configuration);
  }
  get configurationModel() {
    return this._configurationModel;
  }
  async initialize() {
    this.logService.trace("PolicyConfiguration#initialize");
    this.update(await this.updatePolicyDefinitions(this.defaultConfiguration.configurationModel.keys), false);
    this.update(await this.updatePolicyDefinitions(Object.keys(this.configurationRegistry.getExcludedConfigurationProperties())), false);
    this._register(this.policyService.onDidChange((policyNames) => this.onDidChangePolicies(policyNames)));
    this._register(this.defaultConfiguration.onDidChangeConfiguration(async ({ properties }) => this.update(await this.updatePolicyDefinitions(properties), true)));
    return this._configurationModel;
  }
  toPolicyDefinitionType(configType, policyName) {
    const configTypes = Array.isArray(configType) ? configType : [configType];
    const supportedTypes = configTypes.filter((type) => type === "string" || type === "number" || type === "array" || type === "object" || type === "boolean");
    if (supportedTypes.length === 0) {
      this.logService.warn(`PolicyConfiguration#updatePolicyDefinitions - policy '${policyName}' has unsupported type '${configType}'`);
      return void 0;
    }
    return supportedTypes.includes("number") ? "number" : supportedTypes.includes("boolean") ? "boolean" : "string";
  }
  async updatePolicyDefinitions(properties) {
    this.logService.trace("PolicyConfiguration#updatePolicyDefinitions", properties);
    const keys = [];
    const policyNames = /* @__PURE__ */ new Set();
    const configurationProperties = this.configurationRegistry.getConfigurationProperties();
    const excludedConfigurationProperties = this.configurationRegistry.getExcludedConfigurationProperties();
    for (const key of properties) {
      const config = configurationProperties[key] ?? excludedConfigurationProperties[key];
      if (!config) {
        keys.push(key);
        const removedPolicyName = this._policyNameByKey.get(key);
        if (removedPolicyName !== void 0) {
          this._policyNameByKey.delete(key);
          policyNames.add(removedPolicyName);
        }
        continue;
      }
      const policyName = config.policy?.name ?? config.policyReference?.name;
      if (policyName) {
        keys.push(key);
        policyNames.add(policyName);
        this._policyNameByKey.set(key, policyName);
      }
    }
    const changedDefinitions = {};
    for (const policyName of policyNames) {
      const definition = this.resolvePolicyDefinition(policyName);
      if (definition && !this.isSamePolicyDefinition(this._submittedPolicyDefinitions.get(policyName), definition)) {
        this._submittedPolicyDefinitions.set(policyName, definition);
        changedDefinitions[policyName] = definition;
      }
    }
    if (!isEmptyObject(changedDefinitions)) {
      await this.policyService.updatePolicyDefinitions(changedDefinitions);
    }
    return keys;
  }
  isSamePolicyDefinition(a, b) {
    return !!a && a.type === b.type && a.value === b.value && a.managedSettings === b.managedSettings && a.restrictedValue === b.restrictedValue;
  }
  /** Resolve the authoritative definition: owner wins; references provide a bare type fallback. */
  resolvePolicyDefinition(policyName) {
    const configurationProperties = this.configurationRegistry.getConfigurationProperties();
    const excludedConfigurationProperties = this.configurationRegistry.getExcludedConfigurationProperties();
    const ownerKey = this.configurationRegistry.getPolicyConfigurations().get(policyName);
    if (ownerKey !== void 0) {
      const config = configurationProperties[ownerKey] ?? excludedConfigurationProperties[ownerKey];
      if (config?.policy) {
        const type = this.toPolicyDefinitionType(config.type, policyName);
        const { value, managedSettings, restrictedValue } = config.policy;
        return type ? { type, value, managedSettings, restrictedValue } : void 0;
      }
    }
    const referenceKeys = this.configurationRegistry.getPolicyReferenceConfigurations().get(policyName);
    for (const referenceKey of referenceKeys ?? []) {
      const config = configurationProperties[referenceKey] ?? excludedConfigurationProperties[referenceKey];
      if (config?.policyReference) {
        const type = this.toPolicyDefinitionType(config.type, policyName);
        return type ? { type } : void 0;
      }
    }
    return void 0;
  }
  onDidChangePolicies(policyNames) {
    this.logService.trace("PolicyConfiguration#onDidChangePolicies", policyNames);
    const policyConfigurations = this.configurationRegistry.getPolicyConfigurations();
    const policyReferenceConfigurations = this.configurationRegistry.getPolicyReferenceConfigurations();
    const keys = [];
    for (const policyName of policyNames) {
      const owner = policyConfigurations.get(policyName);
      if (owner) {
        keys.push(owner);
      }
      const references = policyReferenceConfigurations.get(policyName);
      if (references) {
        keys.push(...references);
      }
    }
    this.update(keys, true);
  }
  update(keys, trigger) {
    this.logService.trace("PolicyConfiguration#update", keys);
    const configurationProperties = this.configurationRegistry.getConfigurationProperties();
    const excludedConfigurationProperties = this.configurationRegistry.getExcludedConfigurationProperties();
    const changed = [];
    const wasEmpty = this._configurationModel.isEmpty();
    for (const key of keys) {
      const property = configurationProperties[key] ?? excludedConfigurationProperties[key];
      const policyName = property?.policy?.name ?? property?.policyReference?.name;
      if (policyName) {
        let policyValue = this.policyService.getPolicyValue(policyName);
        const acceptsStringType = Array.isArray(property.type) ? property.type.includes("string") : property.type === "string";
        if (isString(policyValue) && !acceptsStringType) {
          try {
            policyValue = this.parse(policyValue);
          } catch (e) {
            this.logService.error(`Error parsing policy value ${policyName}:`, getErrorMessage(e));
            continue;
          }
        }
        if (wasEmpty ? policyValue !== void 0 : !equals(this._configurationModel.getValue(key), policyValue)) {
          changed.push([key, policyValue]);
        }
      } else {
        if (this._configurationModel.getValue(key) !== void 0) {
          changed.push([key, void 0]);
        }
      }
    }
    if (changed.length) {
      this.logService.trace("PolicyConfiguration#changed", changed);
      const old = this._configurationModel;
      this._configurationModel = ConfigurationModel.createEmptyModel(this.logService);
      for (const key of old.keys) {
        this._configurationModel.setValue(key, old.getValue(key));
      }
      for (const [key, policyValue] of changed) {
        if (policyValue === void 0) {
          this._configurationModel.removeValue(key);
        } else {
          this._configurationModel.setValue(key, policyValue);
        }
      }
      if (trigger) {
        this._onDidChangeConfiguration.fire(this._configurationModel);
      }
    }
  }
  parse(content) {
    let raw = {};
    let currentProperty = null;
    let currentParent = [];
    const previousParents = [];
    const parseErrors = [];
    function onValue(value) {
      if (Array.isArray(currentParent)) {
        currentParent.push(value);
      } else if (currentProperty !== null) {
        if (currentParent[currentProperty] !== void 0) {
          throw new Error(`Duplicate property found: ${currentProperty}`);
        }
        currentParent[currentProperty] = value;
      }
    }
    const visitor = {
      onObjectBegin: () => {
        const object = {};
        onValue(object);
        previousParents.push(currentParent);
        currentParent = object;
        currentProperty = null;
      },
      onObjectProperty: (name) => {
        currentProperty = name;
      },
      onObjectEnd: () => {
        currentParent = previousParents.pop();
      },
      onArrayBegin: () => {
        const array = [];
        onValue(array);
        previousParents.push(currentParent);
        currentParent = array;
        currentProperty = null;
      },
      onArrayEnd: () => {
        currentParent = previousParents.pop();
      },
      onLiteralValue: onValue,
      onError: (error, offset, length) => {
        parseErrors.push({ error, offset, length });
      }
    };
    if (content) {
      json.visit(content, visitor);
      raw = currentParent[0] || raw;
    }
    if (parseErrors.length > 0) {
      throw new Error(parseErrors.map((e) => getErrorMessage(e.error)).join("\n"));
    }
    return raw;
  }
};
PolicyConfiguration = __decorateClass([
  __decorateParam(1, IPolicyService),
  __decorateParam(2, ILogService)
], PolicyConfiguration);
export {
  DefaultConfiguration,
  NullPolicyConfiguration,
  PolicyConfiguration
};
