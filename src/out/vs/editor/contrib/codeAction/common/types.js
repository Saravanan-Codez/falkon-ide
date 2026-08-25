import { onUnexpectedExternalError } from "../../../../base/common/errors.js";
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
const CodeActionKind = new class {
  constructor() {
    this.QuickFix = new HierarchicalKind("quickfix");
    this.Refactor = new HierarchicalKind("refactor");
    this.RefactorExtract = this.Refactor.append("extract");
    this.RefactorInline = this.Refactor.append("inline");
    this.RefactorMove = this.Refactor.append("move");
    this.RefactorRewrite = this.Refactor.append("rewrite");
    this.Notebook = new HierarchicalKind("notebook");
    this.Source = new HierarchicalKind("source");
    this.SourceOrganizeImports = this.Source.append("organizeImports");
    this.SourceFixAll = this.Source.append("fixAll");
    this.SurroundWith = this.Refactor.append("surround");
  }
}();
var CodeActionAutoApply = /* @__PURE__ */ ((CodeActionAutoApply2) => {
  CodeActionAutoApply2["IfSingle"] = "ifSingle";
  CodeActionAutoApply2["First"] = "first";
  CodeActionAutoApply2["Never"] = "never";
  return CodeActionAutoApply2;
})(CodeActionAutoApply || {});
var CodeActionTriggerSource = /* @__PURE__ */ ((CodeActionTriggerSource2) => {
  CodeActionTriggerSource2["Refactor"] = "refactor";
  CodeActionTriggerSource2["RefactorPreview"] = "refactor preview";
  CodeActionTriggerSource2["Lightbulb"] = "lightbulb";
  CodeActionTriggerSource2["Default"] = "other (default)";
  CodeActionTriggerSource2["SourceAction"] = "source action";
  CodeActionTriggerSource2["QuickFix"] = "quick fix action";
  CodeActionTriggerSource2["FixAll"] = "fix all";
  CodeActionTriggerSource2["OrganizeImports"] = "organize imports";
  CodeActionTriggerSource2["AutoFix"] = "auto fix";
  CodeActionTriggerSource2["QuickFixHover"] = "quick fix hover window";
  CodeActionTriggerSource2["OnSave"] = "save participants";
  CodeActionTriggerSource2["ProblemsView"] = "problems view";
  return CodeActionTriggerSource2;
})(CodeActionTriggerSource || {});
function mayIncludeActionsOfKind(filter, providedKind) {
  if (filter.include && !filter.include.intersects(providedKind)) {
    return false;
  }
  if (filter.excludes) {
    if (filter.excludes.some((exclude) => excludesAction(providedKind, exclude, filter.include))) {
      return false;
    }
  }
  if (!filter.includeSourceActions && CodeActionKind.Source.contains(providedKind)) {
    return false;
  }
  return true;
}
function filtersAction(filter, action) {
  const actionKind = action.kind ? new HierarchicalKind(action.kind) : void 0;
  if (filter.include) {
    if (!actionKind || !filter.include.contains(actionKind)) {
      return false;
    }
  }
  if (filter.excludes) {
    if (actionKind && filter.excludes.some((exclude) => excludesAction(actionKind, exclude, filter.include))) {
      return false;
    }
  }
  if (!filter.includeSourceActions) {
    if (actionKind && CodeActionKind.Source.contains(actionKind)) {
      return false;
    }
  }
  if (filter.onlyIncludePreferredActions) {
    if (!action.isPreferred) {
      return false;
    }
  }
  return true;
}
function excludesAction(providedKind, exclude, include) {
  if (!exclude.contains(providedKind)) {
    return false;
  }
  if (include && exclude.contains(include)) {
    return false;
  }
  return true;
}
class CodeActionCommandArgs {
  constructor(kind, apply, preferred) {
    this.kind = kind;
    this.apply = apply;
    this.preferred = preferred;
  }
  static fromUser(arg, defaults) {
    if (!arg || typeof arg !== "object") {
      return new CodeActionCommandArgs(defaults.kind, defaults.apply, false);
    }
    return new CodeActionCommandArgs(
      CodeActionCommandArgs.getKindFromUser(arg, defaults.kind),
      CodeActionCommandArgs.getApplyFromUser(arg, defaults.apply),
      CodeActionCommandArgs.getPreferredUser(arg)
    );
  }
  static getApplyFromUser(arg, defaultAutoApply) {
    switch (typeof arg.apply === "string" ? arg.apply.toLowerCase() : "") {
      case "first":
        return "first" /* First */;
      case "never":
        return "never" /* Never */;
      case "ifsingle":
        return "ifSingle" /* IfSingle */;
      default:
        return defaultAutoApply;
    }
  }
  static getKindFromUser(arg, defaultKind) {
    return typeof arg.kind === "string" ? new HierarchicalKind(arg.kind) : defaultKind;
  }
  static getPreferredUser(arg) {
    return typeof arg.preferred === "boolean" ? arg.preferred : false;
  }
}
class CodeActionItem {
  constructor(action, provider, highlightRange) {
    this.action = action;
    this.provider = provider;
    this.highlightRange = highlightRange;
  }
  async resolve(token) {
    if (this.provider?.resolveCodeAction && !this.action.edit) {
      let action;
      try {
        action = await this.provider.resolveCodeAction(this.action, token);
      } catch (err) {
        onUnexpectedExternalError(err);
      }
      if (action) {
        this.action.edit = action.edit;
      }
    }
    return this;
  }
}
export {
  CodeActionAutoApply,
  CodeActionCommandArgs,
  CodeActionItem,
  CodeActionKind,
  CodeActionTriggerSource,
  filtersAction,
  mayIncludeActionsOfKind
};
