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
import { getLocation, parse } from "../../../../base/common/json.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { CompletionItemKind } from "../../../../editor/common/languages.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
let ExtensionsCompletionItemsProvider = class extends Disposable {
  constructor(extensionManagementService, languageFeaturesService) {
    super();
    this.extensionManagementService = extensionManagementService;
    this._register(languageFeaturesService.completionProvider.register({ language: "jsonc", pattern: "**/settings.json" }, {
      _debugDisplayName: "extensionsCompletionProvider",
      provideCompletionItems: async (model, position, _context, token) => {
        const getWordRangeAtPosition = (model2, position2) => {
          const wordAtPosition = model2.getWordAtPosition(position2);
          return wordAtPosition ? new Range(position2.lineNumber, wordAtPosition.startColumn, position2.lineNumber, wordAtPosition.endColumn) : null;
        };
        const location = getLocation(model.getValue(), model.getOffsetAt(position));
        const range = getWordRangeAtPosition(model, position) ?? Range.fromPositions(position, position);
        if (location.path[0] === "extensions.supportUntrustedWorkspaces" && location.path.length === 2 && location.isAtPropertyKey) {
          let alreadyConfigured = [];
          try {
            alreadyConfigured = Object.keys(parse(model.getValue())["extensions.supportUntrustedWorkspaces"]);
          } catch (e) {
          }
          return { suggestions: await this.provideSupportUntrustedWorkspacesExtensionProposals(alreadyConfigured, range) };
        }
        return { suggestions: [] };
      }
    }));
  }
  async provideSupportUntrustedWorkspacesExtensionProposals(alreadyConfigured, range) {
    const suggestions = [];
    const installedExtensions = (await this.extensionManagementService.getInstalled()).filter((e) => e.manifest.main);
    const proposedExtensions = installedExtensions.filter((e) => alreadyConfigured.indexOf(e.identifier.id) === -1);
    if (proposedExtensions.length) {
      suggestions.push(...proposedExtensions.map((e) => {
        const text = `"${e.identifier.id}": {
	"supported": true,
	"version": "${e.manifest.version}"
},`;
        return { label: e.identifier.id, kind: CompletionItemKind.Value, insertText: text, filterText: text, range };
      }));
    } else {
      const text = '"vscode.csharp": {\n	"supported": true,\n	"version": "0.0.0"\n},';
      suggestions.push({ label: localize("exampleExtension", "Example"), kind: CompletionItemKind.Value, insertText: text, filterText: text, range });
    }
    return suggestions;
  }
};
ExtensionsCompletionItemsProvider = __decorateClass([
  __decorateParam(0, IExtensionManagementService),
  __decorateParam(1, ILanguageFeaturesService)
], ExtensionsCompletionItemsProvider);
export {
  ExtensionsCompletionItemsProvider
};
