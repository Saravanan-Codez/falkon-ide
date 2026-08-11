const VSCODE_LSP_TERMINAL_PROMPT_TRACKER = "vscode_lsp_terminal_prompt_tracker= {}\n";
const terminalLspSupportedLanguages = /* @__PURE__ */ new Set([
  {
    shellType: "python",
    languageId: "python",
    extension: "py"
  }
]);
function getTerminalLspSupportedLanguageObj(shellType) {
  for (const supportedLanguage of terminalLspSupportedLanguages) {
    if (supportedLanguage.shellType === shellType) {
      return supportedLanguage;
    }
  }
  return void 0;
}
export {
  VSCODE_LSP_TERMINAL_PROMPT_TRACKER,
  getTerminalLspSupportedLanguageObj,
  terminalLspSupportedLanguages
};
