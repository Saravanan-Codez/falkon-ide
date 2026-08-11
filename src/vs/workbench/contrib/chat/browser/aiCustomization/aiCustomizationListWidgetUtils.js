import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
function truncateToFirstLine(text) {
  const newlineIndex = text.search(/[\r\n]/);
  if (newlineIndex !== -1) {
    return text.substring(0, newlineIndex);
  }
  return text;
}
function getCustomizationSecondaryText(description, filename, promptType) {
  if (!description) {
    return filename;
  }
  return promptType === PromptsType.hook ? description : truncateToFirstLine(description);
}
function extractExtensionIdFromPath(uriPath) {
  const segments = uriPath.split("/");
  const globalStorageIdx = segments.lastIndexOf("globalStorage");
  if (globalStorageIdx > 0 && segments[globalStorageIdx - 1] === "User" && globalStorageIdx + 2 < segments.length) {
    const candidate = segments[globalStorageIdx + 1];
    if (/^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/i.test(candidate)) {
      return candidate;
    }
  }
  const extensionsIdx = segments.lastIndexOf("extensions");
  if (extensionsIdx < 0 || extensionsIdx + 1 >= segments.length) {
    return void 0;
  }
  const folderName = segments[extensionsIdx + 1];
  const versionMatch = folderName.match(/^(.+)-\d+\./);
  return versionMatch ? versionMatch[1] : void 0;
}
export {
  extractExtensionIdFromPath,
  getCustomizationSecondaryText,
  truncateToFirstLine
};
