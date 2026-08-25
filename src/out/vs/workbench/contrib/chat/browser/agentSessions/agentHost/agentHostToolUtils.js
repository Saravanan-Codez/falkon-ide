function toolDataToDefinition(tool) {
  return {
    name: tool.toolReferenceName ?? tool.id,
    title: tool.displayName,
    description: tool.modelDescription,
    inputSchema: tool.inputSchema?.type === "object" ? tool.inputSchema : void 0
  };
}
export {
  toolDataToDefinition
};
