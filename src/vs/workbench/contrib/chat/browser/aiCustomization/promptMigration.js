import { splitLinesIncludeSeparators } from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { SKILL_FILENAME, VALID_SKILL_NAME_REGEX, getCleanPromptName } from "../../common/promptSyntax/config/promptFileLocations.js";
import { PromptFileParser, PromptHeaderAttributes } from "../../common/promptSyntax/promptFileParser.js";
import { PromptsStorage } from "../../common/promptSyntax/service/promptsService.js";
const retainedPromptHeaderKeys = /* @__PURE__ */ new Set([
  PromptHeaderAttributes.name,
  PromptHeaderAttributes.description,
  PromptHeaderAttributes.argumentHint
]);
function getPromptMigrationInfo(promptFiles) {
  const workspacePromptCount = promptFiles.filter((file) => file.storage === PromptsStorage.local).length;
  const userPromptCount = promptFiles.filter((file) => file.storage === PromptsStorage.user).length;
  const totalPromptCount = workspacePromptCount + userPromptCount;
  if (totalPromptCount === 0) {
    return void 0;
  }
  return {
    totalPromptCount,
    workspacePromptCount,
    userPromptCount
  };
}
function pickSkillSourceFolder(promptFile, skillSourceFolders) {
  return skillSourceFolders.find((folder) => folder.source === promptFile.storage);
}
function migratePromptFileToSkill(promptFile, content, skillNameOverride) {
  const parser = new PromptFileParser();
  const parsed = parser.parse(promptFile.uri, content);
  const friendlyName = promptFile.name?.trim() || parsed.header?.name?.trim() || getCleanPromptName(promptFile.uri);
  const skillName = skillNameOverride ?? sanitizeSkillName(friendlyName);
  const description = promptFile.description?.trim() || parsed.header?.description?.trim() || friendlyName;
  const argumentHint = parsed.header?.argumentHint?.trim();
  const argumentHintAttribute = parsed.header?.getAttribute(PromptHeaderAttributes.argumentHint);
  const body = getPromptBody(parsed, content);
  const unsupportedHeaderKeys = parsed.header?.attributes.filter((attribute) => !retainedPromptHeaderKeys.has(attribute.key)).map((attribute) => attribute.key) ?? [];
  const headerLines = [
    "---",
    `name: ${skillName}`,
    `description: ${description}`,
    "disable-model-invocation: true"
  ];
  if (argumentHint) {
    headerLines.push(`argument-hint: ${formatMigratedHeaderValue(argumentHint, argumentHintAttribute)}`);
  }
  headerLines.push("---", "");
  return {
    skillName,
    content: `${headerLines.join("\n")}${body}`,
    unsupportedHeaderKeys
  };
}
function formatMigratedHeaderValue(value, sourceAttribute) {
  if (sourceAttribute?.value.type === "scalar") {
    switch (sourceAttribute.value.format) {
      case "single":
        return `'${value.replace(/'/g, `''`)}'`;
      case "double":
        return JSON.stringify(value);
      case "none":
        return value;
    }
  }
  return value;
}
async function migratePromptFilesToSkills(promptFiles, skillSourceFoldersByStorage, fileService, onMigrationError, options) {
  const reservedSkillNames = /* @__PURE__ */ new Map();
  const unsupportedHeaderKeys = /* @__PURE__ */ new Set();
  const failedPromptFileNames = [];
  const convertedSkillFileUris = [];
  let convertedCount = 0;
  const deleteOriginalPromptFiles = options?.deleteOriginalPromptFiles ?? true;
  for (const promptFile of promptFiles) {
    const skillSourceFolder = skillSourceFoldersByStorage.get(promptFile.storage);
    if (!skillSourceFolder) {
      continue;
    }
    try {
      const content = (await fileService.readFile(promptFile.uri)).value.toString();
      const migratedPrompt = migratePromptFileToSkill(promptFile, content);
      const reservedNamesForFolder = reservedSkillNames.get(skillSourceFolder.uri.toString()) ?? /* @__PURE__ */ new Set();
      reservedSkillNames.set(skillSourceFolder.uri.toString(), reservedNamesForFolder);
      const skillName = await getAvailableMigratedSkillName(skillSourceFolder.uri, migratedPrompt.skillName, reservedNamesForFolder, fileService);
      const migratedSkill = skillName === migratedPrompt.skillName ? migratedPrompt : migratePromptFileToSkill(promptFile, content, skillName);
      for (const key of migratedSkill.unsupportedHeaderKeys) {
        unsupportedHeaderKeys.add(key);
      }
      const skillFileUri = createSkillFileUri(skillSourceFolder.uri, skillName);
      await fileService.createFolder(skillSourceFolder.uri);
      await fileService.createFolder(dirname(skillFileUri));
      await fileService.writeFile(skillFileUri, VSBuffer.fromString(migratedSkill.content));
      if (deleteOriginalPromptFiles) {
        await fileService.del(promptFile.uri);
      }
      convertedSkillFileUris.push(skillFileUri);
      convertedCount++;
    } catch (error) {
      failedPromptFileNames.push(basename(promptFile.uri));
      onMigrationError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }
  return {
    convertedCount,
    failedPromptFileNames,
    unsupportedHeaderKeys: Array.from(unsupportedHeaderKeys).sort(),
    convertedSkillFileUris
  };
}
function getPromptBody(parsed, content) {
  const linesWithEol = splitLinesIncludeSeparators(content);
  if (!parsed.body) {
    return "";
  }
  return linesWithEol.slice(parsed.body.range.startLineNumber - 1).join("").replace(/^\r?\n/, "");
}
function createSkillFileUri(skillSourceFolder, skillName) {
  return URI.joinPath(skillSourceFolder, skillName, SKILL_FILENAME);
}
function sanitizeSkillName(name) {
  const strippedName = name.replace(/<[^>]+>/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  const trimmedName = trimSkillName(strippedName, 0);
  if (trimmedName && VALID_SKILL_NAME_REGEX.test(trimmedName)) {
    return trimmedName;
  }
  return "migrated-skill";
}
function trimSkillName(skillName, suffixLength) {
  const maxBaseLength = Math.max(1, 64 - suffixLength);
  return skillName.slice(0, maxBaseLength).replace(/-+$/g, "");
}
async function getAvailableMigratedSkillName(skillSourceFolder, baseSkillName, reservedNames, fileService) {
  let candidate = baseSkillName;
  let counter = 2;
  while (reservedNames.has(candidate) || await fileService.exists(createSkillFileUri(skillSourceFolder, candidate))) {
    const suffix = `-${counter++}`;
    const trimmedBaseName = trimSkillName(baseSkillName, suffix.length);
    candidate = `${trimmedBaseName}${suffix}`;
  }
  reservedNames.add(candidate);
  return candidate;
}
export {
  createSkillFileUri,
  getPromptMigrationInfo,
  migratePromptFileToSkill,
  migratePromptFilesToSkills,
  pickSkillSourceFolder,
  trimSkillName
};
