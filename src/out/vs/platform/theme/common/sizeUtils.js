import { Emitter } from "../../../base/common/event.js";
import { Extensions as JSONExtensions } from "../../jsonschemas/common/jsonContributionRegistry.js";
import * as platform from "../../registry/common/platform.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { RunOnceScheduler } from "../../../base/common/async.js";
function asCssVariableName(sizeIdent) {
  return `--vscode-${sizeIdent.replace(/\./g, "-")}`;
}
function asCssVariable(size2) {
  return `var(${asCssVariableName(size2)})`;
}
function asCssVariableWithDefault(size2, defaultCssValue) {
  return `var(${asCssVariableName(size2)}, ${defaultCssValue})`;
}
function isSizeDefaults(value) {
  return value !== null && typeof value === "object" && "light" in value && "dark" in value;
}
function size(value, unit = "px") {
  return { value, unit };
}
function sizeForAllThemes(value, unit = "px") {
  const sizeValue = size(value, unit);
  return {
    light: sizeValue,
    dark: sizeValue,
    hcDark: sizeValue,
    hcLight: sizeValue
  };
}
function sizeValueToCss(sizeValue) {
  return sizeValue.unit === "" ? `${sizeValue.value}` : `${sizeValue.value}${sizeValue.unit}`;
}
const Extensions = {
  SizeContribution: "base.contributions.sizes"
};
const DEFAULT_SIZE_CONFIG_VALUE = "default";
class SizeRegistry extends Disposable {
  constructor() {
    super();
    this._onDidChangeSchema = this._register(new Emitter());
    this.onDidChangeSchema = this._onDidChangeSchema.event;
    this.sizeSchema = { type: "object", properties: {} };
    this.sizeReferenceSchema = { type: "string", enum: [], enumDescriptions: [] };
    this.sizesById = {};
  }
  notifyThemeUpdate(theme) {
    for (const key of Object.keys(this.sizesById)) {
      const sizeVal = this.resolveDefaultSize(key, theme);
      if (sizeVal) {
        this.sizeSchema.properties[key].default = sizeValueToCss(sizeVal);
      }
    }
    this._onDidChangeSchema.fire();
  }
  registerSize(id, defaults, description, deprecationMessage) {
    const sizeContribution = { id, description, defaults, deprecationMessage };
    this.sizesById[id] = sizeContribution;
    const isUnitless = (() => {
      if (!defaults) {
        return false;
      }
      if (isSizeDefaults(defaults)) {
        const sample = defaults.dark ?? defaults.light ?? defaults.hcDark ?? defaults.hcLight;
        return sample?.unit === "";
      }
      return defaults.unit === "";
    })();
    const propertySchema = isUnitless ? {
      type: "string",
      pattern: "^(?:\\d+|default)$",
      patternErrorMessage: 'Value must be an integer (e.g., "400") or "default"'
    } : {
      type: "string",
      pattern: "^(?:\\d+(\\.\\d+)?(px|rem|em|%)|default)$",
      patternErrorMessage: 'Size must be a number followed by px, rem, em, or % (e.g., "12px", "1.5rem") or "default"'
    };
    if (deprecationMessage) {
      propertySchema.deprecationMessage = deprecationMessage;
    }
    this.sizeSchema.properties[id] = {
      description,
      ...propertySchema
    };
    this.sizeReferenceSchema.enum.push(id);
    this.sizeReferenceSchema.enumDescriptions.push(description);
    this._onDidChangeSchema.fire();
    return id;
  }
  deregisterSize(id) {
    delete this.sizesById[id];
    delete this.sizeSchema.properties[id];
    const index = this.sizeReferenceSchema.enum.indexOf(id);
    if (index !== -1) {
      this.sizeReferenceSchema.enum.splice(index, 1);
      this.sizeReferenceSchema.enumDescriptions.splice(index, 1);
    }
    this._onDidChangeSchema.fire();
  }
  getSizes() {
    return Object.keys(this.sizesById).map((id) => this.sizesById[id]);
  }
  resolveDefaultSize(id, theme) {
    const sizeDesc = this.sizesById[id];
    if (sizeDesc?.defaults) {
      const sizeValue = isSizeDefaults(sizeDesc.defaults) ? sizeDesc.defaults[theme.type] : sizeDesc.defaults;
      return sizeValue ?? void 0;
    }
    return void 0;
  }
  getSizeSchema() {
    return this.sizeSchema;
  }
  getSizeReferenceSchema() {
    return this.sizeReferenceSchema;
  }
  toString() {
    const sorter = (a, b) => {
      const cat1 = a.indexOf(".") === -1 ? 0 : 1;
      const cat2 = b.indexOf(".") === -1 ? 0 : 1;
      if (cat1 !== cat2) {
        return cat1 - cat2;
      }
      return a.localeCompare(b);
    };
    return Object.keys(this.sizesById).sort(sorter).map((k) => `- \`${k}\`: ${this.sizesById[k].description}`).join("\n");
  }
}
const sizeRegistry = new SizeRegistry();
platform.Registry.add(Extensions.SizeContribution, sizeRegistry);
function registerSize(id, defaults, description, deprecationMessage) {
  return sizeRegistry.registerSize(id, defaults, description, deprecationMessage);
}
function getSizeRegistry() {
  return sizeRegistry;
}
const workbenchSizesSchemaId = "vscode://schemas/workbench-sizes";
const schemaRegistry = platform.Registry.as(JSONExtensions.JSONContribution);
schemaRegistry.registerSchema(workbenchSizesSchemaId, sizeRegistry.getSizeSchema());
const delayer = new RunOnceScheduler(() => schemaRegistry.notifySchemaChanged(workbenchSizesSchemaId), 200);
sizeRegistry.onDidChangeSchema(() => {
  if (!delayer.isScheduled()) {
    delayer.schedule();
  }
});
export {
  DEFAULT_SIZE_CONFIG_VALUE,
  Extensions,
  asCssVariable,
  asCssVariableName,
  asCssVariableWithDefault,
  getSizeRegistry,
  isSizeDefaults,
  registerSize,
  size,
  sizeForAllThemes,
  sizeValueToCss,
  workbenchSizesSchemaId
};
