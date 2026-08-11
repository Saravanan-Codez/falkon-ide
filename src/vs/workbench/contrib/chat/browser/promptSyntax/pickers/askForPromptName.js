import { localize } from "../../../../../../nls.js";
import { getPromptFileExtension } from "../../../common/promptSyntax/config/promptFileLocations.js";
import { PromptsType } from "../../../common/promptSyntax/promptTypes.js";
import { IQuickInputService } from "../../../../../../platform/quickinput/common/quickInput.js";
import { URI } from "../../../../../../base/common/uri.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import Severity from "../../../../../../base/common/severity.js";
import { isValidBasename } from "../../../../../../base/common/extpath.js";
async function askForPromptFileName(accessor, type, selectedFolder, existingFileName, fileExtensionOverride) {
  const quickInputService = accessor.get(IQuickInputService);
  const fileService = accessor.get(IFileService);
  const sanitizeInput = (input) => {
    const trimmedName = input.trim();
    if (!trimmedName) {
      return void 0;
    }
    const fileExtension = fileExtensionOverride ?? getPromptFileExtension(type);
    return trimmedName.endsWith(fileExtension) ? trimmedName : `${trimmedName}${fileExtension}`;
  };
  const validateInput = async (value) => {
    const fileName = sanitizeInput(value);
    if (!fileName) {
      return {
        content: localize("askForPromptFileName.error.empty", "Please enter a name."),
        severity: Severity.Warning
      };
    }
    if (!isValidBasename(fileName)) {
      return {
        content: localize("askForPromptFileName.error.invalid", "The name contains invalid characters."),
        severity: Severity.Error
      };
    }
    const fileUri = URI.joinPath(selectedFolder, fileName);
    if (await fileService.exists(fileUri)) {
      return {
        content: localize("askForPromptFileName.error.exists", "A file for the given name already exists."),
        severity: Severity.Error
      };
    }
    return void 0;
  };
  const placeHolder = existingFileName ? getPlaceholderStringForRename(type) : getPlaceholderStringForNew(type);
  const result = await quickInputService.input({ placeHolder, validateInput, value: existingFileName });
  if (!result) {
    return void 0;
  }
  return sanitizeInput(result);
}
function getPlaceholderStringForNew(type) {
  switch (type) {
    case PromptsType.instructions:
      return localize("askForInstructionsFileName.placeholder", "Enter the name of the instructions file");
    case PromptsType.prompt:
      return localize("askForPromptFileName.placeholder", "Enter the name of the prompt file");
    case PromptsType.agent:
      return localize("askForAgentFileName.placeholder", "Enter the name of the agent file");
    default:
      throw new Error("Unknown prompt type");
  }
}
function getPlaceholderStringForRename(type) {
  switch (type) {
    case PromptsType.instructions:
      return localize("askForRenamedInstructionsFileName.placeholder", "Enter a new name of the instructions file");
    case PromptsType.prompt:
      return localize("askForRenamedPromptFileName.placeholder", "Enter a new name of the prompt file");
    case PromptsType.agent:
      return localize("askForRenamedAgentFileName.placeholder", "Enter a new name of the agent file");
    default:
      throw new Error("Unknown prompt type");
  }
}
export {
  askForPromptFileName
};
