import { localize } from "../../../../nls.js";
import { EXTENSION_IDENTIFIER_PATTERN } from "../../../../platform/extensionManagement/common/extensionManagement.js";
const ExtensionsConfigurationSchemaId = "vscode://schemas/extensions";
const ExtensionsConfigurationSchema = {
  id: ExtensionsConfigurationSchemaId,
  allowComments: true,
  allowTrailingCommas: true,
  type: "object",
  title: localize("app.extensions.json.title", "Extensions"),
  additionalProperties: false,
  properties: {
    recommendations: {
      type: "array",
      description: localize("app.extensions.json.recommendations", "List of extensions which should be recommended for users of this workspace. The identifier of an extension is always '${publisher}.${name}'. For example: 'vscode.csharp'."),
      items: {
        type: "string",
        pattern: EXTENSION_IDENTIFIER_PATTERN,
        errorMessage: localize("app.extension.identifier.errorMessage", "Expected format '${publisher}.${name}'. Example: 'vscode.csharp'.")
      }
    },
    unwantedRecommendations: {
      type: "array",
      description: localize("app.extensions.json.unwantedRecommendations", "List of extensions recommended by VS Code that should not be recommended for users of this workspace. The identifier of an extension is always '${publisher}.${name}'. For example: 'vscode.csharp'."),
      items: {
        type: "string",
        pattern: EXTENSION_IDENTIFIER_PATTERN,
        errorMessage: localize("app.extension.identifier.errorMessage", "Expected format '${publisher}.${name}'. Example: 'vscode.csharp'.")
      }
    }
  }
};
const ExtensionsConfigurationInitialContent = [
  "{",
  "	// See https://go.microsoft.com/fwlink/?LinkId=827846 to learn about workspace recommendations.",
  "	// Extension identifier format: ${publisher}.${name}. Example: vscode.csharp",
  "",
  "	// List of extensions which should be recommended for users of this workspace.",
  '	"recommendations": [',
  "		",
  "	],",
  "	// List of extensions recommended by VS Code that should not be recommended for users of this workspace.",
  '	"unwantedRecommendations": [',
  "		",
  "	]",
  "}"
].join("\n");
export {
  ExtensionsConfigurationInitialContent,
  ExtensionsConfigurationSchema,
  ExtensionsConfigurationSchemaId
};
