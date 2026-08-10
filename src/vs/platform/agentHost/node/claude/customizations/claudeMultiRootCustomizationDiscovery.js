import { ResourceSet } from "../../../../../base/common/map.js";
import { CustomizationType } from "../../../common/state/protocol/channels-session/state.js";
import { scanClaudeCustomizationScope, scanClaudeDiskCustomizations } from "./scan/claudeAgentSkillScan.js";
import { scanClaudeNativePlugins, scanClaudeNativePluginsForRoots } from "./scan/claudeNativePluginScan.js";
import { selectFirstClaudeCustomizationByKey } from "./claudeCustomizationPolicy.js";
function distinctClaudeWorkingDirectories(workingDirectories) {
  const seen = new ResourceSet();
  const result = [];
  for (const directory of workingDirectories ?? []) {
    if (!seen.has(directory)) {
      seen.add(directory);
      result.push(directory);
    }
  }
  return result;
}
function isParsedAgent(item) {
  return item.customization.type === CustomizationType.Agent;
}
function isParsedSkill(item) {
  return item.customization.type === CustomizationType.Skill;
}
async function discoverClaudeMultiRootCustomizations(workingDirectories, userHome, fileService, logService) {
  const roots = distinctClaudeWorkingDirectories(workingDirectories);
  if (roots.length <= 1) {
    const [discovered2, nativePlugins2] = await Promise.all([
      scanClaudeDiskCustomizations(roots[0], userHome, fileService),
      scanClaudeNativePlugins(roots[0], userHome, fileService, logService)
    ]);
    return { workingDirectories: roots, discovered: discovered2, nativePlugins: nativePlugins2 };
  }
  const [scopes, nativePlugins] = await Promise.all([
    Promise.all([
      ...roots.map((root, index) => scanClaudeCustomizationScope(root, fileService, index === 0)),
      scanClaudeCustomizationScope(userHome, fileService)
    ]),
    scanClaudeNativePluginsForRoots(roots, userHome, fileService, logService)
  ]);
  const discovered = [
    ...selectFirstClaudeCustomizationByKey(scopes.map((items) => items.filter(isParsedAgent)), (item) => item.name),
    ...selectFirstClaudeCustomizationByKey(scopes.map((items) => items.filter(isParsedSkill)), (item) => item.name)
  ];
  return {
    workingDirectories: roots,
    discovered,
    nativePlugins
  };
}
export {
  discoverClaudeMultiRootCustomizations,
  distinctClaudeWorkingDirectories
};
