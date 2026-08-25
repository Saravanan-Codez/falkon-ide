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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { editorConfigurationBaseNode } from "../../../../editor/common/config/editorConfigurationSchema.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { pasteAsCommandId } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteContribution.js";
import { pasteAsPreferenceConfig } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js";
import { dropAsPreferenceConfig } from "../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js";
import * as nls from "../../../../nls.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
const dropEnumValues = [];
const dropAsPreferenceSchema = {
  type: "array",
  scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
  description: nls.localize("dropPreferredDescription", "Configures the preferred type of edit to use when dropping content.\n\nThis is an ordered list of edit kinds. The first available edit of a preferred kind will be used."),
  default: [],
  items: {
    description: nls.localize("dropKind", "The kind identifier of the drop edit."),
    anyOf: [
      { type: "string" },
      { enum: dropEnumValues }
    ]
  }
};
const pasteEnumValues = [];
const pasteAsPreferenceSchema = {
  type: "array",
  scope: ConfigurationScope.LANGUAGE_OVERRIDABLE,
  description: nls.localize("pastePreferredDescription", "Configures the preferred type of edit to use when pasting content.\n\nThis is an ordered list of edit kinds. The first available edit of a preferred kind will be used."),
  default: [],
  items: {
    description: nls.localize("pasteKind", "The kind identifier of the paste edit."),
    anyOf: [
      { type: "string" },
      { enum: pasteEnumValues }
    ]
  }
};
const editorConfiguration = Object.freeze({
  ...editorConfigurationBaseNode,
  properties: {
    [pasteAsPreferenceConfig]: pasteAsPreferenceSchema,
    [dropAsPreferenceConfig]: dropAsPreferenceSchema
  }
});
let DropOrPasteSchemaContribution = class extends Disposable {
  constructor(keybindingService, languageFeatures) {
    super();
    this.languageFeatures = languageFeatures;
    this._onDidChangeSchemaContributions = this._register(new Emitter());
    this._allProvidedDropKinds = [];
    this._allProvidedPasteKinds = [];
    this._register(
      Event.runAndSubscribe(
        Event.debounce(
          Event.any(languageFeatures.documentPasteEditProvider.onDidChange, languageFeatures.documentPasteEditProvider.onDidChange),
          () => {
          },
          1e3
        ),
        () => {
          this.updateProvidedKinds();
          this.updateConfigurationSchema();
          this._onDidChangeSchemaContributions.fire();
        }
      )
    );
    this._register(keybindingService.registerSchemaContribution({
      getSchemaAdditions: () => this.getKeybindingSchemaAdditions(),
      onDidChange: this._onDidChangeSchemaContributions.event
    }));
  }
  static {
    this.ID = "workbench.contrib.dropOrPasteIntoSchema";
  }
  updateProvidedKinds() {
    const dropKinds = /* @__PURE__ */ new Map();
    for (const provider of this.languageFeatures.documentDropEditProvider.allNoModel()) {
      for (const kind of provider.providedDropEditKinds ?? []) {
        dropKinds.set(kind.value, kind);
      }
    }
    this._allProvidedDropKinds = Array.from(dropKinds.values());
    const pasteKinds = /* @__PURE__ */ new Map();
    for (const provider of this.languageFeatures.documentPasteEditProvider.allNoModel()) {
      for (const kind of provider.providedPasteEditKinds ?? []) {
        pasteKinds.set(kind.value, kind);
      }
    }
    this._allProvidedPasteKinds = Array.from(pasteKinds.values());
  }
  updateConfigurationSchema() {
    pasteEnumValues.length = 0;
    for (const codeActionKind of this._allProvidedPasteKinds) {
      pasteEnumValues.push(codeActionKind.value);
    }
    dropEnumValues.length = 0;
    for (const codeActionKind of this._allProvidedDropKinds) {
      dropEnumValues.push(codeActionKind.value);
    }
    Registry.as(Extensions.Configuration).notifyConfigurationSchemaUpdated(editorConfiguration);
  }
  getKeybindingSchemaAdditions() {
    return [
      {
        if: {
          required: ["command"],
          properties: {
            "command": { const: pasteAsCommandId }
          }
        },
        then: {
          properties: {
            "args": {
              oneOf: [
                {
                  required: ["kind"],
                  properties: {
                    "kind": {
                      anyOf: [
                        { enum: Array.from(this._allProvidedPasteKinds.map((x) => x.value)) },
                        { type: "string" }
                      ]
                    }
                  }
                },
                {
                  required: ["preferences"],
                  properties: {
                    "preferences": {
                      type: "array",
                      items: {
                        anyOf: [
                          { enum: Array.from(this._allProvidedPasteKinds.map((x) => x.value)) },
                          { type: "string" }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    ];
  }
};
DropOrPasteSchemaContribution = __decorateClass([
  __decorateParam(0, IKeybindingService),
  __decorateParam(1, ILanguageFeaturesService)
], DropOrPasteSchemaContribution);
export {
  DropOrPasteSchemaContribution,
  editorConfiguration
};
