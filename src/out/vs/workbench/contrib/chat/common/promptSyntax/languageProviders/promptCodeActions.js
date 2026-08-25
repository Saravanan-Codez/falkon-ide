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
import { Range } from "../../../../../../editor/common/core/range.js";
import { localize } from "../../../../../../nls.js";
import { ILanguageModelToolsService } from "../../tools/languageModelToolsService.js";
import { getPromptsTypeForLanguageId, PromptsType } from "../promptTypes.js";
import { IPromptsService } from "../service/promptsService.js";
import { parseCommaSeparatedList, PromptHeaderAttributes } from "../promptFileParser.js";
import { Lazy } from "../../../../../../base/common/lazy.js";
import { LEGACY_MODE_FILE_EXTENSION } from "../config/promptFileLocations.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { MARKERS_OWNER_ID, PromptValidatorMarkerCode } from "./promptValidator.js";
import { IMarkerService } from "../../../../../../platform/markers/common/markers.js";
import { CodeActionKind } from "../../../../../../editor/contrib/codeAction/common/types.js";
import { getTarget, isVSCodeOrDefaultTarget } from "./promptFileAttributes.js";
let PromptCodeActionProvider = class {
  constructor(promptsService, languageModelToolsService, fileService, markerService) {
    this.promptsService = promptsService;
    this.languageModelToolsService = languageModelToolsService;
    this.fileService = fileService;
    this.markerService = markerService;
    /**
     * Debug display name for this provider.
     */
    this._debugDisplayName = "PromptCodeActionProvider";
  }
  async provideCodeActions(model, range, context, token) {
    const promptType = getPromptsTypeForLanguageId(model.getLanguageId());
    if (!promptType || promptType === PromptsType.instructions) {
      return void 0;
    }
    const result = [];
    const promptAST = this.promptsService.getParsedPromptFile(model);
    switch (promptType) {
      case PromptsType.agent:
        this.getUpdateToolsCodeActions(promptAST, promptType, model, range, result);
        this.getEnableMcpServerCodeActions(model, range, result);
        await this.getMigrateModeFileCodeActions(model, result);
        break;
      case PromptsType.prompt:
        this.getUpdateModeCodeActions(promptAST, model, range, result);
        this.getUpdateToolsCodeActions(promptAST, promptType, model, range, result);
        this.getEnableMcpServerCodeActions(model, range, result);
        break;
    }
    if (result.length === 0) {
      return void 0;
    }
    return {
      actions: result,
      dispose: () => {
      }
    };
  }
  getMarkers(model, range) {
    const markers = this.markerService.read({ resource: model.uri, owner: MARKERS_OWNER_ID });
    return markers.filter((marker) => range.containsRange(marker));
  }
  createCodeAction(model, range, title, edits, command) {
    return {
      title,
      ...edits ? { edit: { edits } } : {},
      ...command ? { command } : {},
      ranges: [range],
      diagnostics: this.getMarkers(model, range),
      kind: CodeActionKind.QuickFix.value
    };
  }
  getEnableMcpServerCodeActions(model, range, result) {
    const markersInRange = this.getMarkersInRange(model, range);
    for (const marker of markersInRange) {
      const markerCode = this.getMarkerCode(marker);
      if (markerCode === PromptValidatorMarkerCode.MissingGithubMcpServer) {
        result.push(this.createCodeAction(
          model,
          range,
          localize("enableGithubMcpServerSetting", "Enable Built-in GitHub MCP Server"),
          void 0,
          { id: "workbench.action.openSettings", title: "", arguments: ["@id:github.copilot.chat.githubMcpServer.enabled"] }
        ));
        result.push(this.createCodeAction(
          model,
          range,
          localize("installGithubMcpServer", "Install GitHub MCP Server from Marketplace"),
          void 0,
          { id: "workbench.extensions.search", title: "", arguments: ["@mcp github"] }
        ));
      } else if (markerCode === PromptValidatorMarkerCode.MissingPlaywrightMcpServer) {
        result.push(this.createCodeAction(
          model,
          range,
          localize("installPlaywrightMcpServer", "Install Playwright MCP Server from Marketplace"),
          void 0,
          { id: "workbench.extensions.search", title: "", arguments: ["@mcp playwright"] }
        ));
      } else if (markerCode === PromptValidatorMarkerCode.UnknownExtensionReference) {
        const reference = model.getValueInRange(new Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn)).trim();
        const extensionId = reference.split("/")[0].replace(/^['"]|['"]$/g, "");
        if (extensionId) {
          result.push(this.createCodeAction(
            model,
            range,
            localize("searchExtensionMarketplace", "Search Marketplace for Extension '{0}'", extensionId),
            void 0,
            { id: "workbench.extensions.search", title: "", arguments: [`@id:${extensionId}`] }
          ));
        }
      } else if (markerCode === PromptValidatorMarkerCode.UnknownMcpServerReference) {
        const reference = model.getValueInRange(new Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn)).trim();
        const serverId = reference.replace(/^['"]|['"]$/g, "");
        if (serverId) {
          result.push(this.createCodeAction(
            model,
            range,
            localize("searchMcpServerMarketplace", "Search Marketplace for MCP Server '{0}'", serverId),
            void 0,
            { id: "workbench.extensions.search", title: "", arguments: [`@mcp ${serverId}`] }
          ));
        }
      } else {
        const reference = model.getValueInRange(new Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn)).trim();
        if (reference) {
          const extensionId = reference.split("/")[0].replace(/^['"]|['"]$/g, "");
          result.push(this.createCodeAction(
            model,
            range,
            localize("searchExtensionMarketplaceGeneric", "Search Marketplace for Extension '{0}'", extensionId),
            void 0,
            { id: "workbench.extensions.search", title: "", arguments: [`@id:${extensionId}`] }
          ));
          const serverId = reference.replace(/^['"]|['"]$/g, "");
          result.push(this.createCodeAction(
            model,
            range,
            localize("searchMcpServerMarketplaceGeneric", "Search Marketplace for MCP Server '{0}'", serverId),
            void 0,
            { id: "workbench.extensions.search", title: "", arguments: [`@mcp ${serverId}`] }
          ));
        }
      }
    }
  }
  getMarkerCode(marker) {
    if (!marker.code) {
      return void 0;
    }
    return typeof marker.code === "string" ? marker.code : marker.code.value;
  }
  getMarkersInRange(model, range) {
    const markers = this.markerService.read({ resource: model.uri, owner: MARKERS_OWNER_ID });
    return markers.filter((marker) => {
      const markerRange = new Range(marker.startLineNumber, marker.startColumn, marker.endLineNumber, marker.endColumn);
      return markerRange.intersectRanges(range);
    });
  }
  getUpdateModeCodeActions(promptFile, model, range, result) {
    const modeAttr = promptFile.header?.getAttribute(PromptHeaderAttributes.mode);
    if (!modeAttr?.range.containsRange(range)) {
      return;
    }
    const keyRange = new Range(modeAttr.range.startLineNumber, modeAttr.range.startColumn, modeAttr.range.startLineNumber, modeAttr.range.startColumn + modeAttr.key.length);
    result.push(this.createCodeAction(
      model,
      keyRange,
      localize("renameToAgent", "Rename to 'agent'"),
      [asWorkspaceTextEdit(model, { range: keyRange, text: "agent" })]
    ));
  }
  async getMigrateModeFileCodeActions(model, result) {
    if (model.uri.path.endsWith(LEGACY_MODE_FILE_EXTENSION)) {
      const location = this.promptsService.getAgentFileURIFromModeFile(model.uri);
      if (location && await this.fileService.canMove(model.uri, location)) {
        const edit = { oldResource: model.uri, newResource: location, options: { overwrite: false, copy: false } };
        result.push(this.createCodeAction(
          model,
          new Range(1, 1, 1, 4),
          localize("migrateToAgent", "Migrate to custom agent file"),
          [edit]
        ));
      }
    }
  }
  getUpdateToolsCodeActions(promptFile, promptType, model, range, result) {
    if (!promptFile.header) {
      return;
    }
    const toolsAttr = promptFile.header.getAttribute(PromptHeaderAttributes.tools);
    if (!toolsAttr || !toolsAttr.value.range.containsRange(range)) {
      return;
    }
    const target = getTarget(promptType, promptFile.header);
    if (!isVSCodeOrDefaultTarget(target)) {
      return;
    }
    let value = toolsAttr.value;
    if (value.type === "scalar") {
      value = parseCommaSeparatedList(value);
    }
    if (value.type !== "sequence") {
      return;
    }
    const values = value.items;
    const deprecatedNames = new Lazy(() => this.languageModelToolsService.getDeprecatedFullReferenceNames());
    const edits = [];
    for (const item of values) {
      if (item.type !== "scalar") {
        continue;
      }
      const newNames = deprecatedNames.value.get(item.value);
      if (newNames && newNames.size > 0) {
        const quote = model.getValueInRange(new Range(item.range.startLineNumber, item.range.startColumn, item.range.endLineNumber, item.range.startColumn + 1));
        if (newNames.size === 1) {
          const newName = Array.from(newNames)[0];
          const text = quote === `'` || quote === '"' ? quote + newName + quote : newName;
          const edit = { range: item.range, text };
          edits.push(edit);
          if (item.range.containsRange(range)) {
            result.push(this.createCodeAction(
              model,
              item.range,
              localize("updateToolName", "Update to '{0}'", newName),
              [asWorkspaceTextEdit(model, edit)]
            ));
          }
        } else {
          const newNamesArray = Array.from(newNames).sort((a, b) => a.localeCompare(b));
          const separator = model.getValueInRange(new Range(item.range.startLineNumber, item.range.endColumn, item.range.endLineNumber, item.range.endColumn + 2));
          const useCommaSpace = separator.includes(",");
          const delimiterText = useCommaSpace ? ", " : ",";
          const newNamesText = newNamesArray.map(
            (name) => quote === `'` || quote === '"' ? quote + name + quote : name
          ).join(delimiterText);
          const edit = { range: item.range, text: newNamesText };
          edits.push(edit);
          if (item.range.containsRange(range)) {
            result.push(this.createCodeAction(
              model,
              item.range,
              localize("expandToolNames", "Expand to {0} tools", newNames.size),
              [asWorkspaceTextEdit(model, edit)]
            ));
          }
        }
      }
    }
    if (edits.length && result.length === 0 || edits.length > 1) {
      result.push(
        this.createCodeAction(
          model,
          value.range,
          localize("updateAllToolNames", "Update all tool names"),
          edits.map((edit) => asWorkspaceTextEdit(model, edit))
        )
      );
    }
  }
};
PromptCodeActionProvider = __decorateClass([
  __decorateParam(0, IPromptsService),
  __decorateParam(1, ILanguageModelToolsService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IMarkerService)
], PromptCodeActionProvider);
function asWorkspaceTextEdit(model, textEdit) {
  return {
    versionId: model.getVersionId(),
    resource: model.uri,
    textEdit
  };
}
export {
  PromptCodeActionProvider
};
