var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { HierarchicalKind } from "../../../../base/common/hierarchicalKind.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { codeActionCommandId, fixAllCommandId, organizeImportsCommandId, refactorCommandId, sourceActionCommandId } from "./codeAction.js";
import { CodeActionAutoApply, CodeActionCommandArgs, CodeActionKind } from "../common/types.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
let CodeActionKeybindingResolver = class {
  constructor(keybindingService) {
    this.keybindingService = keybindingService;
  }
  static {
    this.codeActionCommands = [
      refactorCommandId,
      codeActionCommandId,
      sourceActionCommandId,
      organizeImportsCommandId,
      fixAllCommandId
    ];
  }
  getResolver() {
    const allCodeActionBindings = new Lazy(() => this.keybindingService.getKeybindings().filter((item) => CodeActionKeybindingResolver.codeActionCommands.indexOf(item.command) >= 0).filter((item) => item.resolvedKeybinding).map((item) => {
      let commandArgs = item.commandArgs;
      if (item.command === organizeImportsCommandId) {
        commandArgs = { kind: CodeActionKind.SourceOrganizeImports.value };
      } else if (item.command === fixAllCommandId) {
        commandArgs = { kind: CodeActionKind.SourceFixAll.value };
      }
      return {
        resolvedKeybinding: item.resolvedKeybinding,
        ...CodeActionCommandArgs.fromUser(commandArgs, {
          kind: HierarchicalKind.None,
          apply: CodeActionAutoApply.Never
        })
      };
    }));
    return (action) => {
      if (action.kind) {
        const binding = this.bestKeybindingForCodeAction(action, allCodeActionBindings.value);
        return binding?.resolvedKeybinding;
      }
      return void 0;
    };
  }
  bestKeybindingForCodeAction(action, candidates) {
    if (!action.kind) {
      return void 0;
    }
    const kind = new HierarchicalKind(action.kind);
    return candidates.filter((candidate) => candidate.kind.contains(kind)).filter((candidate) => {
      if (candidate.preferred) {
        return action.isPreferred;
      }
      return true;
    }).reduceRight((currentBest, candidate) => {
      if (!currentBest) {
        return candidate;
      }
      return currentBest.kind.contains(candidate.kind) ? candidate : currentBest;
    }, void 0);
  }
};
CodeActionKeybindingResolver = __decorateClass([
  __decorateParam(0, IKeybindingService)
], CodeActionKeybindingResolver);
export {
  CodeActionKeybindingResolver
};
