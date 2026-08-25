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
import { isFalsyOrEmpty } from "../../../../../base/common/arrays.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Event } from "../../../../../base/common/event.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { observableFromEvent, observableSignalFromEvent, autorun, transaction } from "../../../../../base/common/observable.js";
import { basename, joinPath } from "../../../../../base/common/resources.js";
import { isFalsyOrWhitespace } from "../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { assertType, isObject } from "../../../../../base/common/types.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { ILifecycleService, LifecyclePhase } from "../../../../services/lifecycle/common/lifecycle.js";
import { IUserDataProfileService } from "../../../../services/userDataProfile/common/userDataProfile.js";
import { CHAT_CATEGORY, CHAT_CONFIG_MENU_ID } from "../actions/chatActions.js";
import { ILanguageModelToolsService, isToolSet, ToolAndToolSetEnablementMap, ToolDataSource } from "../../common/tools/languageModelToolsService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { Codicon, getAllCodicons } from "../../../../../base/common/codicons.js";
import { isValidBasename } from "../../../../../base/common/extpath.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { parse } from "../../../../../base/common/jsonc.js";
import * as JSONContributionRegistry from "../../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ChatViewId, IChatWidgetService } from "../chat.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
const toolEnumValues = [];
const toolEnumDescriptions = [];
const toolSetSchemaId = "vscode://schemas/toolsets";
const toolSetsSchema = {
  id: toolSetSchemaId,
  allowComments: true,
  allowTrailingCommas: true,
  defaultSnippets: [{
    label: localize("schema.default", "Empty tool set"),
    body: { "${1:toolSetName}": { "tools": ["${2:someTool}", "${3:anotherTool}"], "description": "${4:description}", "icon": "${5:tools}" } }
  }],
  type: "object",
  description: localize("toolsetSchema.json", "User tool sets configuration"),
  additionalProperties: {
    type: "object",
    required: ["tools"],
    additionalProperties: false,
    properties: {
      tools: {
        description: localize("schema.tools", "A list of tools or tool sets to include in this tool set. Cannot be empty and must reference tools the way they are referenced in prompts."),
        type: "array",
        minItems: 1,
        items: {
          type: "string",
          enum: toolEnumValues,
          enumDescriptions: toolEnumDescriptions
        }
      },
      icon: {
        description: localize("schema.icon", 'Icon to use for this tool set in the UI. Uses the "\\$(name)"-syntax, like "\\$(zap)"'),
        type: "string",
        enum: Array.from(getAllCodicons(), (icon) => icon.id),
        markdownEnumDescriptions: Array.from(getAllCodicons(), (icon) => `$(${icon.id})`)
      },
      description: {
        description: localize("schema.description", "A short description of this tool set."),
        type: "string"
      }
    }
  }
};
const reg = Registry.as(JSONContributionRegistry.Extensions.JSONContribution);
class RawToolSetsShape {
  static {
    this.suffix = ".toolsets.jsonc";
  }
  static isToolSetFileName(uri) {
    return basename(uri).endsWith(RawToolSetsShape.suffix);
  }
  static from(data, logService) {
    if (!isObject(data)) {
      throw new Error(`Invalid tool set data`);
    }
    const map = /* @__PURE__ */ new Map();
    for (const [name, value] of Object.entries(data)) {
      if (isFalsyOrWhitespace(name)) {
        logService.error(`Tool set name cannot be empty`);
      }
      if (isFalsyOrEmpty(value.tools)) {
        logService.error(`Tool set '${name}' cannot have an empty tools array`);
      }
      map.set(name, {
        name,
        tools: value.tools,
        description: value.description,
        icon: value.icon
      });
    }
    return new class extends RawToolSetsShape {
    }(map);
  }
  constructor(entries) {
    this.entries = Object.freeze(new Map(entries));
  }
}
let UserToolSetsContributions = class extends Disposable {
  constructor(extensionService, lifecycleService, _languageModelToolsService, _userDataProfileService, _fileService, _logService) {
    super();
    this._languageModelToolsService = _languageModelToolsService;
    this._userDataProfileService = _userDataProfileService;
    this._fileService = _fileService;
    this._logService = _logService;
    Promise.allSettled([
      extensionService.whenInstalledExtensionsRegistered,
      lifecycleService.when(LifecyclePhase.Restored)
    ]).then(() => this._initToolSets());
    const toolsObs = observableFromEvent(this, _languageModelToolsService.onDidChangeTools, () => Array.from(_languageModelToolsService.getAllToolsIncludingDisabled()));
    const store = this._store.add(new DisposableStore());
    this._store.add(autorun((r) => {
      const tools = toolsObs.read(r);
      const toolSets = this._languageModelToolsService.toolSets.read(r);
      const data = [];
      for (const tool of tools) {
        if (tool.canBeReferencedInPrompt) {
          data.push({
            name: this._languageModelToolsService.getFullReferenceName(tool),
            sourceLabel: ToolDataSource.classify(tool.source).label,
            sourceOrdinal: ToolDataSource.classify(tool.source).ordinal,
            description: tool.userDescription ?? tool.modelDescription
          });
        }
      }
      for (const toolSet of toolSets) {
        data.push({
          name: this._languageModelToolsService.getFullReferenceName(toolSet),
          sourceLabel: ToolDataSource.classify(toolSet.source).label,
          sourceOrdinal: ToolDataSource.classify(toolSet.source).ordinal,
          description: toolSet.description
        });
      }
      toolEnumValues.length = 0;
      toolEnumDescriptions.length = 0;
      data.sort((a, b) => {
        if (a.sourceOrdinal !== b.sourceOrdinal) {
          return a.sourceOrdinal - b.sourceOrdinal;
        }
        if (a.sourceLabel !== b.sourceLabel) {
          return a.sourceLabel.localeCompare(b.sourceLabel);
        }
        return a.name.localeCompare(b.name);
      });
      for (const item of data) {
        toolEnumValues.push(item.name);
        toolEnumDescriptions.push(localize("tool.description", "{1} ({0})\n\n{2}", item.sourceLabel, item.name, item.description));
      }
      store.clear();
      reg.registerSchema(toolSetSchemaId, toolSetsSchema, store);
    }));
  }
  static {
    this.ID = "chat.userToolSets";
  }
  _initToolSets() {
    const promptFolder = observableFromEvent(this, this._userDataProfileService.onDidChangeCurrentProfile, () => this._userDataProfileService.currentProfile.promptsHome);
    const toolsSig = observableSignalFromEvent(this, this._languageModelToolsService.onDidChangeTools);
    const fileEventSig = observableSignalFromEvent(this, Event.filter(this._fileService.onDidFilesChange, (e) => e.affects(promptFolder.get())));
    const store = this._store.add(new DisposableStore());
    const getFilesInFolder = async (folder) => {
      try {
        return (await this._fileService.resolve(folder)).children ?? [];
      } catch (err) {
        return [];
      }
    };
    this._store.add(autorun(async (r) => {
      store.clear();
      toolsSig.read(r);
      fileEventSig.read(r);
      const uri = promptFolder.read(r);
      const cts = new CancellationTokenSource();
      store.add(toDisposable(() => cts.dispose(true)));
      const entries = await getFilesInFolder(uri);
      if (cts.token.isCancellationRequested) {
        return;
      }
      for (const entry of entries) {
        if (!entry.isFile || !RawToolSetsShape.isToolSetFileName(entry.resource)) {
          continue;
        }
        store.add(this._fileService.watch(entry.resource));
        let data;
        try {
          const content = await this._fileService.readFile(entry.resource, void 0, cts.token);
          const rawObj = parse(content.value.toString());
          data = RawToolSetsShape.from(rawObj, this._logService);
        } catch (err) {
          this._logService.error(`Error reading tool set file ${entry.resource.toString()}:`, err);
          continue;
        }
        if (cts.token.isCancellationRequested) {
          return;
        }
        for (const [name, value] of data.entries) {
          const tools = [];
          const toolSets = [];
          value.tools.forEach((name2) => {
            const toolOrToolSet = this._languageModelToolsService.getToolByFullReferenceName(name2);
            if (isToolSet(toolOrToolSet)) {
              toolSets.push(toolOrToolSet);
              return;
            } else if (toolOrToolSet) {
              tools.push(toolOrToolSet);
              return;
            }
            const tool = this._languageModelToolsService.getToolByName(name2);
            if (tool) {
              tools.push(tool);
              return;
            }
            const toolSet = this._languageModelToolsService.getToolSetByName(name2);
            if (toolSet) {
              toolSets.push(toolSet);
              return;
            }
          });
          if (tools.length === 0 && toolSets.length === 0) {
            continue;
          }
          const toolset = this._languageModelToolsService.createToolSet(
            { type: "user", file: entry.resource, label: basename(entry.resource) },
            `user/${entry.resource.toString()}/${name}`,
            name,
            {
              // toolReferenceName: value.referenceName,
              icon: value.icon ? ThemeIcon.fromId(value.icon) : void 0,
              description: value.description,
              deprecated: true
            }
          );
          transaction((tx) => {
            store.add(toolset);
            tools.forEach((tool) => store.add(toolset.addTool(tool, tx)));
            toolSets.forEach((toolSet) => store.add(toolset.addToolSet(toolSet, tx)));
          });
        }
      }
    }));
  }
};
UserToolSetsContributions = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, ILifecycleService),
  __decorateParam(2, ILanguageModelToolsService),
  __decorateParam(3, IUserDataProfileService),
  __decorateParam(4, IFileService),
  __decorateParam(5, ILogService)
], UserToolSetsContributions);
function getSelectionFromArg(arg) {
  if (!isObject(arg)) {
    return void 0;
  }
  const selection = arg.selection;
  if (!(selection instanceof ToolAndToolSetEnablementMap)) {
    return void 0;
  }
  return selection;
}
function getEnabledSelectionReferences(selection, toolsService) {
  const enabledToolSets = [];
  const enabledTools = [];
  for (const [item, enabled] of selection) {
    if (!enabled) {
      continue;
    }
    if (isToolSet(item)) {
      if (Iterable.every(item.getTools(), (tool) => selection.get(tool) !== false)) {
        enabledToolSets.push(item);
      }
    } else {
      enabledTools.push(item);
    }
  }
  const coveredToolIds = /* @__PURE__ */ new Set();
  for (const toolSet of enabledToolSets) {
    for (const tool of toolSet.getTools()) {
      coveredToolIds.add(tool.id);
    }
  }
  const references = [];
  const seen = /* @__PURE__ */ new Set();
  const addReference = (referenceName) => {
    if (seen.has(referenceName)) {
      return;
    }
    seen.add(referenceName);
    references.push(referenceName);
  };
  for (const toolSet of enabledToolSets) {
    addReference(toolsService.getFullReferenceName(toolSet));
  }
  for (const tool of enabledTools) {
    if (coveredToolIds.has(tool.id)) {
      continue;
    }
    const referenceName = toolsService.getFullReferenceName(tool);
    if (toolsService.getToolByFullReferenceName(referenceName) !== tool) {
      continue;
    }
    addReference(referenceName);
  }
  return references;
}
function createToolSetFileContents(toolSetName, toolReferences) {
  const serializedReferences = toolReferences.map((reference) => `			${JSON.stringify(reference)}`).join(",\n");
  return [
    "{",
    `	${JSON.stringify(toolSetName)}: {`,
    '		"tools": [',
    serializedReferences,
    "		],",
    '		"description": "",',
    '		"icon": "tools"',
    "	}",
    "}"
  ].join("\n");
}
function deleteToolSetFromFileContents(rawContents, toolSetName) {
  const parsed = parse(rawContents);
  if (!isObject(parsed)) {
    return void 0;
  }
  const record = parsed;
  if (!Object.hasOwn(record, toolSetName)) {
    return void 0;
  }
  delete record[toolSetName];
  return { contents: JSON.stringify(record, void 0, "	"), isEmpty: Object.keys(record).length === 0 };
}
class ConfigureToolSets extends Action2 {
  static {
    this.ID = "chat.configureToolSets";
  }
  constructor() {
    super({
      id: ConfigureToolSets.ID,
      title: localize2("chat.configureToolSets", "Configure Tool Sets..."),
      shortTitle: localize("chat.configureToolSets.short", "Tool Sets"),
      category: CHAT_CATEGORY,
      f1: true,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.Tools.toolsCount.greater(0)),
      menu: [
        {
          id: CHAT_CONFIG_MENU_ID,
          when: ContextKeyExpr.equals("view", ChatViewId),
          order: 11,
          group: "2_level"
        },
        {
          id: MenuId.ViewTitle,
          when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals("view", ChatViewId)),
          order: 11,
          group: "2_level"
        }
      ]
    });
  }
  async run(accessor, options) {
    const toolsService = accessor.get(ILanguageModelToolsService);
    const quickInputService = accessor.get(IQuickInputService);
    const editorService = accessor.get(IEditorService);
    const userDataProfileService = accessor.get(IUserDataProfileService);
    const fileService = accessor.get(IFileService);
    const textFileService = accessor.get(ITextFileService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    const picks = [];
    const currentSelection = getSelectionFromArg(options) ?? chatWidgetService.lastFocusedWidget?.input.selectedToolsModel.entriesMap.get() ?? ToolAndToolSetEnablementMap.fromEntries([]);
    const selectedReferences = getEnabledSelectionReferences(currentSelection, toolsService);
    if (selectedReferences.length > 0) {
      picks.push({
        label: localize("chat.configureToolSets.createFromCurrentSelection", "Create from current selection..."),
        kind: "createFromSelection",
        alwaysShow: true,
        iconClass: ThemeIcon.asClassName(Codicon.plus)
      });
    }
    picks.push({
      label: localize("chat.configureToolSets.add", "Create new tool sets file..."),
      kind: "createNewFile",
      alwaysShow: true,
      iconClass: ThemeIcon.asClassName(Codicon.plus)
    });
    for (const toolSet of toolsService.toolSets.get()) {
      if (toolSet.source.type !== "user") {
        continue;
      }
      picks.push({
        label: toolSet.referenceName,
        kind: "existing",
        toolset: toolSet,
        tooltip: toolSet.description,
        iconClass: ThemeIcon.asClassName(toolSet.icon)
      });
    }
    const pick = await quickInputService.pick(picks, {
      canPickMany: false,
      placeHolder: localize("chat.configureToolSets.placeholder", "Select a tool set to configure")
    });
    if (!pick) {
      return;
    }
    let resource;
    if (!pick.toolset) {
      const name = await quickInputService.input({
        placeHolder: localize("input.placeholder", "Type tool sets file name"),
        validateInput: async (input) => {
          if (!input) {
            return localize("bad_name1", "Invalid file name");
          }
          if (!isValidBasename(input)) {
            return localize("bad_name2", "'{0}' is not a valid file name", input);
          }
          if (pick.kind === "createFromSelection") {
            const candidate = joinPath(userDataProfileService.currentProfile.promptsHome, `${input}${RawToolSetsShape.suffix}`);
            if (await fileService.exists(candidate)) {
              return localize("chat.configureToolSets.fileAlreadyExists", "A file with this name already exists");
            }
          }
          return void 0;
        }
      });
      if (isFalsyOrWhitespace(name)) {
        return;
      }
      resource = joinPath(userDataProfileService.currentProfile.promptsHome, `${name}${RawToolSetsShape.suffix}`);
      if (pick.kind === "createFromSelection") {
        const toolSetName = await quickInputService.input({
          placeHolder: localize("toolSetName.placeholder", "Type new tool set name"),
          validateInput: async (input) => {
            if (isFalsyOrWhitespace(input)) {
              return localize("toolSetName.bad_name", "Tool set name cannot be empty");
            }
            return void 0;
          }
        });
        if (!toolSetName || isFalsyOrWhitespace(toolSetName)) {
          return;
        }
        await textFileService.write(resource, createToolSetFileContents(toolSetName, selectedReferences));
      } else if (!await fileService.exists(resource)) {
        await textFileService.write(resource, [
          "// Place your tool sets here...",
          "// Example:",
          "// {",
          '// 	"toolSetName": {',
          '// 		"tools": [',
          '// 			"someTool",',
          '// 			"anotherTool"',
          "// 		],",
          '// 		"description": "description",',
          '// 		"icon": "tools"',
          "// 	}",
          "// }"
        ].join("\n"));
      }
    } else {
      assertType(pick.toolset.source.type === "user");
      resource = pick.toolset.source.file;
    }
    await editorService.openEditor({ resource, options: { pinned: true } });
  }
}
export {
  ConfigureToolSets,
  RawToolSetsShape,
  UserToolSetsContributions,
  createToolSetFileContents,
  deleteToolSetFromFileContents,
  getEnabledSelectionReferences
};
