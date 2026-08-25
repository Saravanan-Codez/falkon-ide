class EditorContributionRegistry {
  static {
    this.INSTANCE = new EditorContributionRegistry();
  }
  constructor() {
    this.editorContributions = [];
  }
  registerEditorContribution(id, ctor) {
    this.editorContributions.push({ id, ctor });
  }
  getEditorContributions() {
    return this.editorContributions.slice(0);
  }
}
function registerNotebookContribution(id, ctor) {
  EditorContributionRegistry.INSTANCE.registerEditorContribution(id, ctor);
}
var NotebookEditorExtensionsRegistry;
((NotebookEditorExtensionsRegistry2) => {
  function getEditorContributions() {
    return EditorContributionRegistry.INSTANCE.getEditorContributions();
  }
  NotebookEditorExtensionsRegistry2.getEditorContributions = getEditorContributions;
  function getSomeEditorContributions(ids) {
    return EditorContributionRegistry.INSTANCE.getEditorContributions().filter((c) => ids.indexOf(c.id) >= 0);
  }
  NotebookEditorExtensionsRegistry2.getSomeEditorContributions = getSomeEditorContributions;
})(NotebookEditorExtensionsRegistry || (NotebookEditorExtensionsRegistry = {}));
export {
  NotebookEditorExtensionsRegistry,
  registerNotebookContribution
};
