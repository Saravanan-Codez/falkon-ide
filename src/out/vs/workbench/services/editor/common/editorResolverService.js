import * as glob from "../../../../base/common/glob.js";
import { Schemas } from "../../../../base/common/network.js";
import { posix } from "../../../../base/common/path.js";
import { basename } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
const IEditorResolverService = createDecorator("editorResolverService");
const editorsAssociationsSettingId = "workbench.editorAssociations";
const diffEditorsAssociationsSettingId = "workbench.diffEditorAssociations";
const markdownDefaultEditorAgentsWindowSettingId = "workbench.editor.markdownDefaultEditorInAgentsWindow";
function editorsAssociationsAgentsWindowDefault(options) {
  return {
    "*.md": options?.markdownDefaultEditor === true ? "vscode.markdown.editor" : "vscode.markdown.preview.editor"
  };
}
function diffEditorsAssociationsAgentsWindowDefault(options) {
  return editorsAssociationsAgentsWindowDefault(options);
}
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
const editorAssociationsConfigurationNode = {
  ...workbenchConfigurationNodeBase,
  properties: {
    [markdownDefaultEditorAgentsWindowSettingId]: {
      type: "boolean",
      default: true,
      tags: ["experimental"],
      experiment: { mode: "startup" },
      markdownDescription: localize("editor.markdownDefaultEditorInAgentsWindow", "Controls whether the Markdown editor is used as the default editor for Markdown files in the Agents window.")
    },
    [editorsAssociationsSettingId]: {
      type: "object",
      markdownDescription: localize("editor.editorAssociations", 'Configure [glob patterns](https://aka.ms/vscode-glob-patterns) to editors (for example `"*.hex": "hexEditor.hexedit"`). These have precedence over the default behavior.'),
      additionalProperties: {
        type: "string"
      },
      agentsWindow: {
        default: editorsAssociationsAgentsWindowDefault()
      }
    },
    [diffEditorsAssociationsSettingId]: {
      type: "object",
      markdownDescription: localize("editor.diffEditorAssociations", 'Configure [glob patterns](https://aka.ms/vscode-glob-patterns) to editors for diff views (for example `"*.md": "vscode.markdown.preview.editor"`). These override `workbench.editorAssociations` for diffs.'),
      additionalProperties: {
        type: "string"
      },
      agentsWindow: {
        default: diffEditorsAssociationsAgentsWindowDefault()
      }
    }
  }
};
configurationRegistry.registerConfiguration(editorAssociationsConfigurationNode);
var RegisteredEditorPriority = /* @__PURE__ */ ((RegisteredEditorPriority2) => {
  RegisteredEditorPriority2["builtin"] = "builtin";
  RegisteredEditorPriority2["option"] = "option";
  RegisteredEditorPriority2["exclusive"] = "exclusive";
  RegisteredEditorPriority2["default"] = "default";
  RegisteredEditorPriority2["explicit"] = "explicit";
  return RegisteredEditorPriority2;
})(RegisteredEditorPriority || {});
var ResolvedStatus = /* @__PURE__ */ ((ResolvedStatus2) => {
  ResolvedStatus2[ResolvedStatus2["ABORT"] = 1] = "ABORT";
  ResolvedStatus2[ResolvedStatus2["NONE"] = 2] = "NONE";
  return ResolvedStatus2;
})(ResolvedStatus || {});
function toRegisteredEditorPriorityInfo(priority) {
  if (typeof priority !== "string") {
    return {
      editor: priority.editor,
      diff: priority.diff,
      merge: priority.merge ?? priority.editor
    };
  }
  return {
    editor: priority,
    diff: priority,
    merge: priority
  };
}
function priorityToRank(priority) {
  switch (priority) {
    case "exclusive" /* exclusive */:
      return 5;
    case "default" /* default */:
      return 4;
    case "builtin" /* builtin */:
      return 3;
    // Text editor is priority 2
    case "option" /* option */:
      return 1;
    case "explicit" /* explicit */:
      return 0;
    default:
      return 1;
  }
}
function globMatchesResource(globPattern, resource) {
  const excludedSchemes = /* @__PURE__ */ new Set([
    Schemas.extension,
    Schemas.webviewPanel,
    Schemas.vscodeWorkspaceTrust,
    Schemas.vscodeSettings
  ]);
  if (excludedSchemes.has(resource.scheme)) {
    return false;
  }
  const matchOnPath = typeof globPattern === "string" && globPattern.indexOf(posix.sep) >= 0;
  const target = matchOnPath ? `${resource.scheme}:${resource.path}` : basename(resource);
  return glob.match(globPattern, target, { ignoreCase: true });
}
export {
  IEditorResolverService,
  RegisteredEditorPriority,
  ResolvedStatus,
  diffEditorsAssociationsAgentsWindowDefault,
  diffEditorsAssociationsSettingId,
  editorsAssociationsAgentsWindowDefault,
  editorsAssociationsSettingId,
  globMatchesResource,
  markdownDefaultEditorAgentsWindowSettingId,
  priorityToRank,
  toRegisteredEditorPriorityInfo
};
