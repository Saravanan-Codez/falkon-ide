import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const isIChatRequestProblemsVariable = (obj) => typeof obj === "object" && obj !== null && "id" in obj && obj.id === "vscode.problems";
const IChatVariablesService = createDecorator("IChatVariablesService");
function toAttachedContextDynamicVariable(entry, range) {
  return {
    id: entry.id,
    fullName: entry.name,
    icon: entry.icon,
    modelDescription: entry.modelDescription,
    isFile: entry.kind === "file",
    isDirectory: entry.kind === "directory",
    isAttachmentReference: true,
    range,
    data: void 0
  };
}
export {
  IChatVariablesService,
  isIChatRequestProblemsVariable,
  toAttachedContextDynamicVariable
};
