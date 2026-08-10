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
import { localize } from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { diffEditorsAssociationsAgentsWindowDefault, diffEditorsAssociationsSettingId, editorsAssociationsAgentsWindowDefault, editorsAssociationsSettingId, IEditorResolverService, markdownDefaultEditorAgentsWindowSettingId, RegisteredEditorPriority, toRegisteredEditorPriorityInfo } from "../../../services/editor/common/editorResolverService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { Event } from "../../../../base/common/event.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { ByteSize, getLargeFileConfirmationLimit } from "../../../../platform/files/common/files.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
let DynamicEditorConfigurations = class extends Disposable {
  constructor(editorResolverService, extensionService, environmentService, configurationService) {
    super();
    this.editorResolverService = editorResolverService;
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
    (async () => {
      await extensionService.whenInstalledExtensionsRegistered();
      this.updateDynamicEditorConfigurations();
      this.registerListeners();
    })();
  }
  static {
    this.ID = "workbench.contrib.dynamicEditorConfigurations";
  }
  static {
    this.AUTO_LOCK_DEFAULT_ENABLED = /* @__PURE__ */ new Set([
      "terminalEditor",
      "mainThreadWebview-simpleBrowser.view",
      "mainThreadWebview-browserPreview",
      "workbench.editor.processExplorer"
    ]);
  }
  static {
    this.AUTO_LOCK_EXTRA_EDITORS = [
      // List some editor input identifiers that are not
      // registered yet via the editor resolver infrastructure
      {
        id: "workbench.input.interactive",
        label: localize("interactiveWindow", "Interactive Window"),
        priority: toRegisteredEditorPriorityInfo(RegisteredEditorPriority.builtin)
      },
      {
        id: "mainThreadWebview-markdown.preview",
        label: localize("markdownPreview", "Markdown Preview"),
        priority: toRegisteredEditorPriorityInfo(RegisteredEditorPriority.builtin)
      },
      {
        id: "mainThreadWebview-simpleBrowser.view",
        label: localize("simpleBrowser", "Simple Browser"),
        priority: toRegisteredEditorPriorityInfo(RegisteredEditorPriority.builtin)
      },
      {
        id: "mainThreadWebview-browserPreview",
        label: localize("livePreview", "Live Preview"),
        priority: toRegisteredEditorPriorityInfo(RegisteredEditorPriority.builtin)
      }
    ];
  }
  static {
    this.AUTO_LOCK_REMOVE_EDITORS = /* @__PURE__ */ new Set([
      // List some editor types that the above `AUTO_LOCK_EXTRA_EDITORS`
      // already covers to avoid duplicates.
      "vscode-interactive-input",
      "interactive",
      "vscode.markdown.preview.editor"
    ]);
  }
  registerListeners() {
    this._register(Event.debounce(this.editorResolverService.onDidChangeEditorRegistrations, (_, e) => e)(() => this.updateDynamicEditorConfigurations()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(markdownDefaultEditorAgentsWindowSettingId)) {
        this.updateDynamicEditorConfigurations();
      }
    }));
  }
  updateDynamicEditorConfigurations() {
    const lockableEditors = [...this.editorResolverService.getEditors(), ...DynamicEditorConfigurations.AUTO_LOCK_EXTRA_EDITORS].filter((e) => !DynamicEditorConfigurations.AUTO_LOCK_REMOVE_EDITORS.has(e.id));
    const binaryEditorCandidates = this.editorResolverService.getEditors().filter((e) => e.priority.editor !== RegisteredEditorPriority.exclusive).map((e) => e.id);
    const autoLockGroupConfiguration = /* @__PURE__ */ Object.create(null);
    for (const editor of lockableEditors) {
      autoLockGroupConfiguration[editor.id] = {
        type: "boolean",
        default: DynamicEditorConfigurations.AUTO_LOCK_DEFAULT_ENABLED.has(editor.id),
        description: editor.label
      };
    }
    const defaultAutoLockGroupConfiguration = /* @__PURE__ */ Object.create(null);
    for (const editor of lockableEditors) {
      defaultAutoLockGroupConfiguration[editor.id] = DynamicEditorConfigurations.AUTO_LOCK_DEFAULT_ENABLED.has(editor.id);
    }
    const oldAutoLockConfigurationNode = this.autoLockConfigurationNode;
    this.autoLockConfigurationNode = {
      ...workbenchConfigurationNodeBase,
      properties: {
        "workbench.editor.autoLockGroups": {
          type: "object",
          description: localize("workbench.editor.autoLockGroups", "If an editor matching one of the listed types is opened as the first in an editor group and more than one group is open, the group is automatically locked. Locked groups will only be used for opening editors when explicitly chosen by a user gesture (for example drag and drop), but not by default. Consequently, the active editor in a locked group is less likely to be replaced accidentally with a different editor."),
          properties: autoLockGroupConfiguration,
          default: defaultAutoLockGroupConfiguration,
          additionalProperties: false
        }
      }
    };
    const oldDefaultBinaryEditorConfigurationNode = this.defaultBinaryEditorConfigurationNode;
    this.defaultBinaryEditorConfigurationNode = {
      ...workbenchConfigurationNodeBase,
      properties: {
        "workbench.editor.defaultBinaryEditor": {
          type: "string",
          default: "",
          // This allows for intellisense autocompletion
          enum: [...binaryEditorCandidates, ""],
          description: localize("workbench.editor.defaultBinaryEditor", "The default editor for files detected as binary. If undefined, the user will be presented with a picker.")
        }
      }
    };
    const oldEditorAssociationsConfigurationNode = this.editorAssociationsConfigurationNode;
    const markdownDefaultEditorEnabled = this.configurationService.getValue(markdownDefaultEditorAgentsWindowSettingId) === true;
    this.editorAssociationsConfigurationNode = {
      ...workbenchConfigurationNodeBase,
      properties: {
        [editorsAssociationsSettingId]: {
          type: "object",
          markdownDescription: localize("editor.editorAssociations", 'Configure [glob patterns](https://aka.ms/vscode-glob-patterns) to editors (for example `"*.hex": "hexEditor.hexedit"`). These have precedence over the default behavior.'),
          patternProperties: {
            ".*": {
              type: "string",
              enum: binaryEditorCandidates
            }
          },
          agentsWindow: {
            default: editorsAssociationsAgentsWindowDefault({ markdownDefaultEditor: markdownDefaultEditorEnabled })
          }
        }
      }
    };
    const oldDiffEditorAssociationsConfigurationNode = this.diffEditorAssociationsConfigurationNode;
    this.diffEditorAssociationsConfigurationNode = {
      ...workbenchConfigurationNodeBase,
      properties: {
        [diffEditorsAssociationsSettingId]: {
          type: "object",
          markdownDescription: localize("editor.diffEditorAssociations", 'Configure [glob patterns](https://aka.ms/vscode-glob-patterns) to editors for diff views (for example `"*.md": "vscode.markdown.preview.editor"`). These override `workbench.editorAssociations` for diffs.'),
          patternProperties: {
            ".*": {
              type: "string",
              enum: binaryEditorCandidates
            }
          },
          agentsWindow: {
            default: diffEditorsAssociationsAgentsWindowDefault({ markdownDefaultEditor: markdownDefaultEditorEnabled })
          }
        }
      }
    };
    const oldEditorLargeFileConfirmationConfigurationNode = this.editorLargeFileConfirmationConfigurationNode;
    this.editorLargeFileConfirmationConfigurationNode = {
      ...workbenchConfigurationNodeBase,
      properties: {
        "workbench.editorLargeFileConfirmation": {
          type: "number",
          default: getLargeFileConfirmationLimit(this.environmentService.remoteAuthority) / ByteSize.MB,
          minimum: 1,
          scope: ConfigurationScope.RESOURCE,
          markdownDescription: localize("editorLargeFileSizeConfirmation", "Controls the minimum size of a file in MB before asking for confirmation when opening in the editor. Note that this setting may not apply to all editor types and environments.")
        }
      }
    };
    this.configurationRegistry.updateConfigurations({
      add: [
        this.autoLockConfigurationNode,
        this.defaultBinaryEditorConfigurationNode,
        this.editorAssociationsConfigurationNode,
        this.diffEditorAssociationsConfigurationNode,
        this.editorLargeFileConfirmationConfigurationNode
      ],
      remove: coalesce([
        oldAutoLockConfigurationNode,
        oldDefaultBinaryEditorConfigurationNode,
        oldEditorAssociationsConfigurationNode,
        oldDiffEditorAssociationsConfigurationNode,
        oldEditorLargeFileConfirmationConfigurationNode
      ])
    });
  }
};
DynamicEditorConfigurations = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IConfigurationService)
], DynamicEditorConfigurations);
export {
  DynamicEditorConfigurations
};
