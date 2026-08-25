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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService, MODAL_GROUP } from "../../../services/editor/common/editorService.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { equals } from "../../../../base/common/objects.js";
import { visit } from "../../../../base/common/json.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { getCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { SnippetController2 } from "../../../../editor/contrib/snippet/browser/snippetController2.js";
import { ILanguageModelsConfigurationService } from "../common/languageModelsConfiguration.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ILanguageModelsService } from "../common/languageModels.js";
import { DEFAULT_EDITOR_ASSOCIATION } from "../../../common/editor.js";
let LanguageModelsConfigurationService = class extends Disposable {
  constructor(fileService, textFileService, textModelService, editorService, editorGroupsService, userDataProfileService, uriIdentityService) {
    super();
    this.fileService = fileService;
    this.textFileService = textFileService;
    this.textModelService = textModelService;
    this.editorService = editorService;
    this.editorGroupsService = editorGroupsService;
    this._onDidChangeLanguageModelGroups = this._register(new Emitter());
    this.onDidChangeLanguageModelGroups = this._onDidChangeLanguageModelGroups.event;
    this.languageModelsProviderGroups = [];
    this.modelsConfigurationFile = userDataProfileService.currentProfile.languageModelsResource;
    this._whenReady = this.updateLanguageModelsConfiguration().catch(() => {
    });
    this._register(fileService.watch(uriIdentityService.extUri.dirname(this.modelsConfigurationFile)));
    this._register(fileService.onDidFilesChange((e) => {
      if (e.contains(this.modelsConfigurationFile)) {
        this.updateLanguageModelsConfiguration();
      }
    }));
  }
  get configurationFile() {
    return this.modelsConfigurationFile;
  }
  get whenReady() {
    return this._whenReady;
  }
  setLanguageModelsConfiguration(languageModelsConfiguration) {
    const changedGroups = [];
    const oldGroupMap = new Map(this.languageModelsProviderGroups.map((g) => [`${g.vendor}:${g.name}`, g]));
    const newGroupMap = new Map(languageModelsConfiguration.map((g) => [`${g.vendor}:${g.name}`, g]));
    for (const [key, newGroup] of newGroupMap) {
      const oldGroup = oldGroupMap.get(key);
      if (!oldGroup || !equals(oldGroup, newGroup)) {
        changedGroups.push(newGroup);
      }
    }
    for (const [key, oldGroup] of oldGroupMap) {
      if (!newGroupMap.has(key)) {
        changedGroups.push(oldGroup);
      }
    }
    this.languageModelsProviderGroups = languageModelsConfiguration;
    if (changedGroups.length > 0) {
      this._onDidChangeLanguageModelGroups.fire(changedGroups);
    }
  }
  async updateLanguageModelsConfiguration() {
    const languageModelsProviderGroups = await this.withLanguageModelsProviderGroups();
    this.setLanguageModelsConfiguration(languageModelsProviderGroups);
  }
  getLanguageModelsProviderGroups() {
    return this.languageModelsProviderGroups;
  }
  async addLanguageModelsProviderGroup(toAdd) {
    await this.withLanguageModelsProviderGroups(async (languageModelsProviderGroups) => {
      if (languageModelsProviderGroups.some(({ name, vendor }) => name === toAdd.name && vendor === toAdd.vendor)) {
        throw new Error(`Language model group with name ${toAdd.name} already exists for vendor ${toAdd.vendor}`);
      }
      languageModelsProviderGroups.push(toAdd);
      return languageModelsProviderGroups;
    });
    await this.updateLanguageModelsConfiguration();
    const result = this.getLanguageModelsProviderGroups().find((group) => group.name === toAdd.name && group.vendor === toAdd.vendor);
    if (!result) {
      throw new Error(`Language model group with name ${toAdd.name} not found for vendor ${toAdd.vendor}`);
    }
    return result;
  }
  async updateLanguageModelsProviderGroup(from, to) {
    await this.withLanguageModelsProviderGroups(async (languageModelsProviderGroups) => {
      const result2 = [];
      for (const group of languageModelsProviderGroups) {
        if (group.name === from.name && group.vendor === from.vendor) {
          result2.push(to);
        } else {
          result2.push(group);
        }
      }
      return result2;
    });
    await this.updateLanguageModelsConfiguration();
    const result = this.getLanguageModelsProviderGroups().find((group) => group.name === to.name && group.vendor === to.vendor);
    if (!result) {
      throw new Error(`Language model group with name ${to.name} not found for vendor ${to.vendor}`);
    }
    return result;
  }
  async removeLanguageModelsProviderGroup(toRemove) {
    await this.withLanguageModelsProviderGroups(async (languageModelsProviderGroups) => {
      const result = [];
      for (const group of languageModelsProviderGroups) {
        if (group.name === toRemove.name && group.vendor === toRemove.vendor) {
          continue;
        }
        result.push(group);
      }
      return result;
    });
    await this.updateLanguageModelsConfiguration();
  }
  async configureLanguageModels(options) {
    const preferredGroup = this.editorGroupsService.getPart(this.editorGroupsService.activeGroup) === this.editorGroupsService.activeModalEditorPart ? MODAL_GROUP : void 0;
    const editor = await this.editorService.openEditor({
      resource: this.modelsConfigurationFile,
      options: { override: DEFAULT_EDITOR_ASSOCIATION.id }
    }, preferredGroup);
    if (!editor || !options?.group) {
      return;
    }
    const codeEditor = getCodeEditor(editor.getControl());
    if (!codeEditor) {
      return;
    }
    if (options.snippet) {
      const model = codeEditor.getModel();
      if (!model) {
        return;
      }
      const targetRange = options.snippetTarget === "models" ? options.group.modelsRange : options.group.range;
      if (!targetRange) {
        return;
      }
      const models = options.group.models;
      const isModelsArray = options.snippetTarget === "models" && Array.isArray(models);
      const emptyModelsArray = isModelsArray && models.length === 0;
      const insertBeforeModelsArrayEnd = emptyModelsArray || isModelsArray && targetRange.startLineNumber === targetRange.endLineNumber;
      const lastPropertyLine = targetRange.endLineNumber - 1;
      const insertPosition = insertBeforeModelsArrayEnd ? {
        lineNumber: targetRange.endLineNumber,
        column: targetRange.endColumn - 1
      } : {
        lineNumber: lastPropertyLine,
        column: model.getLineLength(lastPropertyLine) + 1
      };
      codeEditor.setPosition(insertPosition);
      codeEditor.revealPositionNearTop(insertPosition);
      codeEditor.focus();
      SnippetController2.get(codeEditor)?.insert(emptyModelsArray ? options.snippet : ",\n" + options.snippet);
    } else {
      if (!options.group.range) {
        return;
      }
      const position = { lineNumber: options.group.range.startLineNumber, column: options.group.range.startColumn };
      codeEditor.setPosition(position);
      codeEditor.revealPositionNearTop(position);
      codeEditor.focus();
    }
  }
  async withLanguageModelsProviderGroups(update) {
    const exists = await this.fileService.exists(this.modelsConfigurationFile);
    if (!exists) {
      await this.fileService.writeFile(this.modelsConfigurationFile, VSBuffer.fromString(JSON.stringify([], void 0, "	")));
    }
    const ref = await this.textModelService.createModelReference(this.modelsConfigurationFile);
    const model = ref.object.textEditorModel;
    try {
      const languageModelsProviderGroups = parseLanguageModelsProviderGroups(model);
      if (!update) {
        return languageModelsProviderGroups;
      }
      const updatedLanguageModelsProviderGroups = await update(languageModelsProviderGroups);
      for (const group of updatedLanguageModelsProviderGroups) {
        delete group.range;
        delete group.modelsRange;
      }
      model.setValue(JSON.stringify(updatedLanguageModelsProviderGroups, void 0, "	"));
      await this.textFileService.save(this.modelsConfigurationFile);
      return updatedLanguageModelsProviderGroups;
    } finally {
      ref.dispose();
    }
  }
};
LanguageModelsConfigurationService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IUserDataProfileService),
  __decorateParam(6, IUriIdentityService)
], LanguageModelsConfigurationService);
function parseLanguageModelsProviderGroups(model) {
  const configuration = [];
  let currentProperty = null;
  let currentParent = configuration;
  const previousParents = [];
  function onValue(value, offset, length) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value);
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value;
    }
  }
  const visitor = {
    onObjectBegin: (offset, length) => {
      const object = {};
      if (previousParents.length === 1 && Array.isArray(currentParent)) {
        const start = model.getPositionAt(offset);
        const end = model.getPositionAt(offset + length);
        object.range = {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column
        };
      }
      onValue(object, offset, length);
      previousParents.push(currentParent);
      currentParent = object;
      currentProperty = null;
    },
    onObjectProperty: (name, offset, length) => {
      currentProperty = name;
    },
    onObjectEnd: (offset, length) => {
      const parent = currentParent;
      if (parent.range) {
        const end = model.getPositionAt(offset + length);
        parent.range = {
          startLineNumber: parent.range.startLineNumber,
          startColumn: parent.range.startColumn,
          endLineNumber: end.lineNumber,
          endColumn: end.column
        };
      }
      if (parent._parentConfigurationRange) {
        const end = model.getPositionAt(offset + length);
        parent._parentConfigurationRange.endLineNumber = end.lineNumber;
        parent._parentConfigurationRange.endColumn = end.column;
        delete parent._parentConfigurationRange;
      }
      currentParent = previousParents.pop();
    },
    onArrayBegin: (offset, length) => {
      if (currentParent === configuration && previousParents.length === 0) {
        previousParents.push(currentParent);
        currentProperty = null;
        return;
      }
      const array = [];
      const parent = currentParent;
      if (currentProperty === "models" && parent.range) {
        const start = model.getPositionAt(offset);
        const end = model.getPositionAt(offset + length);
        parent.modelsRange = {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column
        };
        array._parentModelsRange = parent.modelsRange;
      }
      onValue(array, offset, length);
      previousParents.push(currentParent);
      currentParent = array;
      currentProperty = null;
    },
    onArrayEnd: (offset, length) => {
      const parent = currentParent;
      if (parent._parentConfigurationRange) {
        const end = model.getPositionAt(offset + length);
        parent._parentConfigurationRange.endLineNumber = end.lineNumber;
        parent._parentConfigurationRange.endColumn = end.column;
        delete parent._parentConfigurationRange;
      }
      if (parent._parentModelsRange) {
        const end = model.getPositionAt(offset + length);
        parent._parentModelsRange.endLineNumber = end.lineNumber;
        parent._parentModelsRange.endColumn = end.column;
        delete parent._parentModelsRange;
      }
      currentParent = previousParents.pop();
    },
    onLiteralValue: (value, offset, length) => {
      onValue(value, offset, length);
    }
  };
  visit(model.getValue(), visitor);
  return configuration;
}
const languageModelsSchemaId = "vscode://schemas/language-models";
let ChatLanguageModelsDataContribution = class extends Disposable {
  constructor(languageModelsService, languageModelsConfigurationService) {
    super();
    this.languageModelsService = languageModelsService;
    const registry = Registry.as(JSONExtensions.JSONContribution);
    this._register(registry.registerSchemaAssociation(languageModelsSchemaId, languageModelsConfigurationService.configurationFile.toString()));
    this.updateSchema(registry);
    this._register(this.languageModelsService.onDidChangeLanguageModels(() => this.updateSchema(registry)));
  }
  static {
    this.ID = "workbench.contrib.chatLanguageModelsData";
  }
  updateSchema(registry) {
    const vendors = this.languageModelsService.getVendors();
    const modelSchemas = [];
    const modelIds = this.languageModelsService.getLanguageModelIds();
    for (const modelId of modelIds) {
      const metadata = this.languageModelsService.lookupLanguageModel(modelId);
      if (metadata?.configurationSchema) {
        modelSchemas.push({
          if: {
            properties: {
              vendor: { const: metadata.vendor }
            }
          },
          then: {
            properties: {
              settings: {
                type: "object",
                properties: {
                  [metadata.id]: metadata.configurationSchema
                }
              }
            }
          }
        });
      }
    }
    const schema = {
      type: "array",
      items: {
        properties: {
          vendor: {
            type: "string",
            enum: vendors.map((v) => v.vendor)
          },
          name: { type: "string" },
          settings: {
            type: "object",
            description: localize("settings.perModelConfig", "Per-model settings")
          }
        },
        allOf: [
          ...vendors.map((vendor) => ({
            if: {
              properties: {
                vendor: { const: vendor.vendor }
              }
            },
            then: vendor.configuration
          })),
          ...modelSchemas
        ],
        required: ["vendor", "name"]
      }
    };
    registry.registerSchema(languageModelsSchemaId, schema);
  }
};
ChatLanguageModelsDataContribution = __decorateClass([
  __decorateParam(0, ILanguageModelsService),
  __decorateParam(1, ILanguageModelsConfigurationService)
], ChatLanguageModelsDataContribution);
export {
  ChatLanguageModelsDataContribution,
  LanguageModelsConfigurationService,
  parseLanguageModelsProviderGroups
};
