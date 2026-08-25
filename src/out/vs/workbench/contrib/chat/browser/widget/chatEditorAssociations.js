import { globMatchesResource } from "../../../../services/editor/common/editorResolverService.js";
import { ChatConfiguration } from "../../common/constants.js";
function getEditorOverrideForChatResource(resource, configurationService) {
  const associations = configurationService.getValue(ChatConfiguration.EditorAssociations) ?? {};
  const sortedPatterns = Object.keys(associations).sort((a, b) => b.length - a.length);
  for (const pattern of sortedPatterns) {
    if (globMatchesResource(pattern, resource)) {
      return associations[pattern];
    }
  }
  return void 0;
}
export {
  getEditorOverrideForChatResource
};
