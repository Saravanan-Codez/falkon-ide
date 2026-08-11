import { extname } from "../../../../../../base/common/path.js";
import { joinPath } from "../../../../../../base/common/resources.js";
import { URI } from "../../../../../../base/common/uri.js";
import { parseFrontMatter } from "../../../../../../base/common/yaml.js";
import { SKILL_FILENAME } from "../../../common/promptSyntax/config/promptFileLocations.js";
import { PromptsType } from "../../../common/promptSyntax/promptTypes.js";
class AgentCustomizationContentExpander {
  constructor(fileService, logService) {
    this.fileService = fileService;
    this.logService = logService;
  }
  async expandPluginContents(pluginUri, groupKey, isBundleItem, source, pluginLabel, token) {
    const fsRoot = pluginUri;
    const children = [];
    try {
      if (!await this.fileService.canHandleResource(fsRoot)) {
        return [];
      }
      if (token.isCancellationRequested) {
        return [];
      }
      const dirNames = ["agents", "skills", "commands", "rules"];
      const promptTypes = [PromptsType.agent, PromptsType.skill, PromptsType.prompt, PromptsType.instructions];
      const stats = await this.fileService.resolveAll(dirNames.map((name) => ({ resource: URI.joinPath(fsRoot, name) })));
      if (token.isCancellationRequested) {
        return [];
      }
      for (let i = 0; i < dirNames.length; i++) {
        const stat = stats[i];
        const promptType = promptTypes[i];
        if (!stat.success || !stat.stat?.isDirectory || !stat.stat.children) {
          continue;
        }
        if (promptType === PromptsType.skill) {
          children.push(...await this.collectFromSkillDir(stat.stat.children, pluginUri, source, groupKey, isBundleItem, pluginLabel, token));
        } else {
          children.push(...await this.collectFromRegularDir(stat.stat.children, pluginUri, source, promptType, groupKey, isBundleItem, pluginLabel, token));
        }
      }
      children.sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`));
    } catch (err) {
      this.logService.trace(`[AgentCustomizationContentExpander] Failed to expand plugin ${pluginUri.toString()}: ${err}`);
      return [];
    }
    return children;
  }
  /**
   * Emits one item per skill subfolder that contains a SKILL.md file.
   * The skill metadata comes from SKILL.md frontmatter.
   */
  async collectFromSkillDir(entries, pluginUri, source, groupKey, isBundleItem, pluginLabel, token) {
    const eligible = [];
    const readMetaDataPromises = [];
    for (const child of entries) {
      if (child.name.startsWith(".")) {
        continue;
      }
      if (!child.isDirectory) {
        continue;
      }
      eligible.push(child);
      readMetaDataPromises.push(this.readPromptMetadata(joinPath(child.resource, SKILL_FILENAME), token));
    }
    const promptMetadata = await Promise.all(readMetaDataPromises);
    if (token.isCancellationRequested) {
      return [];
    }
    const items = [];
    for (let i = 0; i < eligible.length; i++) {
      const child = eligible[i];
      const meta = promptMetadata[i];
      if (!meta) {
        continue;
      }
      const uri = joinPath(child.resource, SKILL_FILENAME);
      const name = meta.name ?? child.name;
      const description = meta.description;
      const userInvocable = meta.userInvocable;
      items.push({
        uri,
        type: PromptsType.skill,
        name,
        description,
        source,
        groupKey,
        extensionId: void 0,
        pluginUri: isBundleItem ? void 0 : pluginUri,
        pluginLabel: isBundleItem ? void 0 : pluginLabel,
        userInvocable
      });
    }
    return items;
  }
  /**
   * Emits one item per markdown file for agent/rules/command folders.
   * Agents and instructions read frontmatter name/description, and
   * agents additionally surface userInvocable. Instruction (rules)
   * folders additionally accept `.mdc` files per the Open Plugins spec.
   */
  async collectFromRegularDir(entries, pluginUri, source, promptType, groupKey, isBundleItem, pluginLabel, token) {
    const eligible = [];
    for (const child of entries) {
      if (child.name.startsWith(".")) {
        continue;
      }
      if (child.isDirectory) {
        continue;
      }
      const ext = extname(child.name);
      if (ext !== ".md" && !(promptType === PromptsType.instructions && ext === ".mdc")) {
        continue;
      }
      eligible.push(child);
    }
    const parseMetadata = promptType === PromptsType.agent || promptType === PromptsType.instructions;
    const promptMetadata = parseMetadata ? await Promise.all(eligible.map((child) => this.readPromptMetadata(child.resource, token))) : void 0;
    if (token.isCancellationRequested) {
      return [];
    }
    const items = [];
    for (let i = 0; i < eligible.length; i++) {
      const child = eligible[i];
      const meta = promptMetadata?.[i];
      items.push({
        uri: child.resource,
        type: promptType,
        name: meta?.name ?? stripPromptFileExtensions(child.name),
        description: meta?.description,
        source,
        groupKey,
        extensionId: void 0,
        pluginUri: isBundleItem ? void 0 : pluginUri,
        pluginLabel: isBundleItem ? void 0 : pluginLabel,
        userInvocable: promptType === PromptsType.agent ? meta?.userInvocable : void 0
      });
    }
    return items;
  }
  /**
   * Reads a prompt markdown file and returns selected frontmatter
   * metadata. Returns `undefined` when the file is not markdown, or
   * when it cannot be read/parsed.
   */
  async readPromptMetadata(promptFileUri, token) {
    if (extname(promptFileUri.path) !== ".md") {
      return void 0;
    }
    try {
      const content = await this.fileService.readFile(promptFileUri);
      if (token.isCancellationRequested) {
        return void 0;
      }
      const frontmatter = parseFrontMatter(content.value.toString());
      if (frontmatter) {
        const name = frontmatter.getStringValue("name");
        const description = frontmatter.getStringValue("description");
        const userInvocableStr = frontmatter.getStringValue("user-invocable");
        const userInvocable = userInvocableStr === "true" ? true : userInvocableStr === "false" ? false : void 0;
        return { name, description, userInvocable };
      }
      return { name: void 0, description: void 0, userInvocable: void 0 };
    } catch (err) {
      this.logService.trace(`[AgentCustomizationContentExpander] Failed to read prompt metadata ${promptFileUri.toString()}: ${err}`);
      return void 0;
    }
  }
}
function stripPromptFileExtensions(filename) {
  const ext = extname(filename);
  if (!ext) {
    return filename;
  }
  const stem = filename.slice(0, -ext.length);
  const dotInStem = stem.lastIndexOf(".");
  return dotInStem > 0 ? stem.slice(0, dotInStem) : stem;
}
export {
  AgentCustomizationContentExpander
};
