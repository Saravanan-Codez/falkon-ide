function isAutoApproveRule(rule) {
  return !!rule && "sourceText" in rule;
}
function isNpmScriptAutoApproveRule(rule) {
  return !!rule && "type" in rule && rule.type === "npmScript";
}
export {
  isAutoApproveRule,
  isNpmScriptAutoApproveRule
};
