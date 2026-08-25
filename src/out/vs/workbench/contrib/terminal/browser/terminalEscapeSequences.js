var ShellIntegrationOscPs = /* @__PURE__ */ ((ShellIntegrationOscPs2) => {
  ShellIntegrationOscPs2[ShellIntegrationOscPs2["FinalTerm"] = 133] = "FinalTerm";
  ShellIntegrationOscPs2[ShellIntegrationOscPs2["VSCode"] = 633] = "VSCode";
  ShellIntegrationOscPs2[ShellIntegrationOscPs2["ITerm"] = 1337] = "ITerm";
  return ShellIntegrationOscPs2;
})(ShellIntegrationOscPs || {});
var VSCodeOscPt = /* @__PURE__ */ ((VSCodeOscPt2) => {
  VSCodeOscPt2["PromptStart"] = "A";
  VSCodeOscPt2["CommandStart"] = "B";
  VSCodeOscPt2["CommandExecuted"] = "C";
  VSCodeOscPt2["CommandFinished"] = "D";
  VSCodeOscPt2["CommandLine"] = "E";
  VSCodeOscPt2["ContinuationStart"] = "F";
  VSCodeOscPt2["ContinuationEnd"] = "G";
  VSCodeOscPt2["RightPromptStart"] = "H";
  VSCodeOscPt2["RightPromptEnd"] = "I";
  VSCodeOscPt2["Property"] = "P";
  return VSCodeOscPt2;
})(VSCodeOscPt || {});
var VSCodeOscProperty = /* @__PURE__ */ ((VSCodeOscProperty2) => {
  VSCodeOscProperty2["Task"] = "Task";
  VSCodeOscProperty2["Cwd"] = "Cwd";
  VSCodeOscProperty2["HasRichCommandDetection"] = "HasRichCommandDetection";
  return VSCodeOscProperty2;
})(VSCodeOscProperty || {});
var ITermOscPt = /* @__PURE__ */ ((ITermOscPt2) => {
  ITermOscPt2["SetMark"] = "SetMark";
  return ITermOscPt2;
})(ITermOscPt || {});
function VSCodeSequence(osc, data) {
  return oscSequence(633 /* VSCode */, osc, data);
}
function ITermSequence(osc, data) {
  return oscSequence(1337 /* ITerm */, osc, data);
}
function oscSequence(ps, pt, data) {
  let result = `\x1B]${ps};${pt}`;
  if (data) {
    result += `;${data}`;
  }
  result += `\x07`;
  return result;
}
export {
  ITermOscPt,
  ITermSequence,
  VSCodeOscProperty,
  VSCodeOscPt,
  VSCodeSequence
};
