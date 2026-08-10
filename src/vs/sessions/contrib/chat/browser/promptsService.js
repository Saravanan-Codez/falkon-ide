import { CancellationToken } from "../../../../base/common/cancellation.js";
import { FileAccess } from "../../../../base/common/network.js";
import { basename, joinPath } from "../../../../base/common/resources.js";
import { SKILL_FILENAME } from "../../../../workbench/contrib/chat/common/promptSyntax/config/promptFileLocations.js";
import { PromptsType } from "../../../../workbench/contrib/chat/common/promptSyntax/promptTypes.js";
import { PromptsStorage } from "../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js";
import { PromptsService } from "../../../../workbench/contrib/chat/common/promptSyntax/service/promptsServiceImpl.js";
const BUILTIN_SKILLS_URI = FileAccess.asFileUri("vs/sessions/skills");
class AgenticPromptsService extends PromptsService {
  async getBuiltinSkills() {
    if (!this._builtinSkillsCache) {
      this._builtinSkillsCache = this.discoverBuiltinSkills();
    }
    return this._builtinSkillsCache;
  }
  async discoverBuiltinSkills() {
    try {
      const stat = await this.fileService.resolve(BUILTIN_SKILLS_URI);
      if (!stat.children) {
        return [];
      }
      const skills = [];
      for (const child of stat.children) {
        if (!child.isDirectory) {
          continue;
        }
        const skillFileUri = joinPath(child.resource, SKILL_FILENAME);
        try {
          const parsed = await this.parseNew(skillFileUri, CancellationToken.None);
          const rawName = parsed.header?.name;
          const rawDescription = parsed.header?.description;
          if (!rawName || !rawDescription) {
            continue;
          }
          const name = sanitizeSkillText(rawName, 64);
          const description = sanitizeSkillText(rawDescription, 1024);
          const folderName = basename(child.resource);
          if (name !== folderName) {
            continue;
          }
          skills.push({
            uri: skillFileUri,
            storage: PromptsStorage.builtIn,
            name,
            description,
            disableModelInvocation: parsed.header?.disableModelInvocation === true,
            userInvocable: parsed.header?.userInvocable !== false
          });
        } catch (e) {
          this.logger.warn(`[AgenticPromptsService] Failed to parse built-in skill: ${skillFileUri}`, e instanceof Error ? e.message : String(e));
        }
      }
      return skills;
    } catch {
      return [];
    }
  }
  async getBuiltinSkillPaths() {
    const skills = await this.getBuiltinSkills();
    return skills.map((s) => ({
      uri: s.uri,
      storage: PromptsStorage.builtIn,
      type: PromptsType.skill,
      name: s.name,
      description: s.description
    }));
  }
  /**
   * Contributes the built-in skills bundled with the Agents app. The base
   * {@link PromptsService} merges these into skill discovery
   * (`findAgentSkills()`), `listPromptFiles(skill)` and
   * `listPromptFilesForStorage(skill, PromptsStorage.builtIn)`, applying its
   * own parsing, sanitization and duplicate-name precedence (built-ins have
   * the lowest priority, so user/workspace skills of the same name win).
   */
  async getBuiltinPromptFiles(type, token) {
    if (type !== PromptsType.skill) {
      return [];
    }
    return this.getBuiltinSkillPaths();
  }
}
function sanitizeSkillText(text, maxLength) {
  const sanitized = text.replace(/<[^>]+>/g, "");
  return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
}
export {
  AgenticPromptsService,
  BUILTIN_SKILLS_URI
};
