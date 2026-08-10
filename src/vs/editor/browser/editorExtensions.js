import * as nls from "../../nls.js";
import { URI } from "../../base/common/uri.js";
import { ICodeEditorService } from "./services/codeEditorService.js";
import { Position } from "../common/core/position.js";
import { IModelService } from "../common/services/model.js";
import { ITextModelService } from "../common/services/resolverService.js";
import { MenuId, MenuRegistry, Action2 } from "../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../platform/instantiation/common/instantiation.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../platform/keybinding/common/keybindingsRegistry.js";
import { Registry } from "../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../platform/telemetry/common/telemetry.js";
import { assertType } from "../../base/common/types.js";
import { KeyMod, KeyCode } from "../../base/common/keyCodes.js";
import { ILogService } from "../../platform/log/common/log.js";
import { getActiveElement } from "../../base/browser/dom.js";
import { TriggerInlineEditCommandsRegistry } from "./triggerInlineEditCommandsRegistry.js";
var EditorContributionInstantiation = /* @__PURE__ */ ((EditorContributionInstantiation2) => {
  EditorContributionInstantiation2[EditorContributionInstantiation2["Eager"] = 0] = "Eager";
  EditorContributionInstantiation2[EditorContributionInstantiation2["AfterFirstRender"] = 1] = "AfterFirstRender";
  EditorContributionInstantiation2[EditorContributionInstantiation2["BeforeFirstInteraction"] = 2] = "BeforeFirstInteraction";
  EditorContributionInstantiation2[EditorContributionInstantiation2["Eventually"] = 3] = "Eventually";
  EditorContributionInstantiation2[EditorContributionInstantiation2["Lazy"] = 4] = "Lazy";
  return EditorContributionInstantiation2;
})(EditorContributionInstantiation || {});
class Command {
  constructor(opts) {
    this.id = opts.id;
    this.precondition = opts.precondition;
    this._kbOpts = opts.kbOpts;
    this._menuOpts = opts.menuOpts;
    this.metadata = opts.metadata;
    this.canTriggerInlineEdits = opts.canTriggerInlineEdits;
  }
  register() {
    if (Array.isArray(this._menuOpts)) {
      this._menuOpts.forEach(this._registerMenuItem, this);
    } else if (this._menuOpts) {
      this._registerMenuItem(this._menuOpts);
    }
    if (this._kbOpts) {
      const kbOptsArr = Array.isArray(this._kbOpts) ? this._kbOpts : [this._kbOpts];
      for (const kbOpts of kbOptsArr) {
        let kbWhen = kbOpts.kbExpr;
        if (this.precondition) {
          if (kbWhen) {
            kbWhen = ContextKeyExpr.and(kbWhen, this.precondition);
          } else {
            kbWhen = this.precondition;
          }
        }
        const desc = {
          id: this.id,
          weight: kbOpts.weight,
          args: kbOpts.args,
          when: kbWhen,
          primary: kbOpts.primary,
          secondary: kbOpts.secondary,
          win: kbOpts.win,
          linux: kbOpts.linux,
          mac: kbOpts.mac
        };
        KeybindingsRegistry.registerKeybindingRule(desc);
      }
    }
    CommandsRegistry.registerCommand({
      id: this.id,
      handler: (accessor, args) => this.runCommand(accessor, args),
      metadata: this.metadata
    });
    if (this.canTriggerInlineEdits) {
      TriggerInlineEditCommandsRegistry.registerCommand(this.id);
    }
  }
  _registerMenuItem(item) {
    MenuRegistry.appendMenuItem(item.menuId, {
      group: item.group,
      command: {
        id: this.id,
        title: item.title,
        icon: item.icon,
        precondition: this.precondition
      },
      when: item.when,
      order: item.order
    });
  }
}
class MultiCommand extends Command {
  constructor() {
    super(...arguments);
    this._implementations = [];
  }
  /**
   * A higher priority gets to be looked at first
   */
  addImplementation(priority, name, implementation, when) {
    this._implementations.push({ priority, name, implementation, when });
    this._implementations.sort((a, b) => b.priority - a.priority);
    return {
      dispose: () => {
        for (let i = 0; i < this._implementations.length; i++) {
          if (this._implementations[i].implementation === implementation) {
            this._implementations.splice(i, 1);
            return;
          }
        }
      }
    };
  }
  runCommand(accessor, args) {
    const logService = accessor.get(ILogService);
    const contextKeyService = accessor.get(IContextKeyService);
    logService.trace(`Executing Command '${this.id}' which has ${this._implementations.length} bound.`);
    for (const impl of this._implementations) {
      if (impl.when) {
        const context = contextKeyService.getContext(getActiveElement());
        const value = impl.when.evaluate(context);
        if (!value) {
          continue;
        }
      }
      const result = impl.implementation(accessor, args);
      if (result) {
        logService.trace(`Command '${this.id}' was handled by '${impl.name}'.`);
        if (typeof result === "boolean") {
          return;
        }
        return result;
      }
    }
    logService.trace(`The Command '${this.id}' was not handled by any implementation.`);
  }
}
class ProxyCommand extends Command {
  constructor(command, opts) {
    super(opts);
    this.command = command;
  }
  runCommand(accessor, args) {
    return this.command.runCommand(accessor, args);
  }
}
class EditorCommand extends Command {
  /**
   * Create a command class that is bound to a certain editor contribution.
   */
  static bindToContribution(controllerGetter) {
    return class EditorControllerCommandImpl extends EditorCommand {
      constructor(opts) {
        super(opts);
        this._callback = opts.handler;
      }
      runEditorCommand(accessor, editor, args) {
        const controller = controllerGetter(editor);
        if (controller) {
          this._callback(controller, args);
        }
      }
    };
  }
  static runEditorCommand(accessor, args, precondition, runner) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
    if (!editor) {
      return;
    }
    return editor.invokeWithinContext((editorAccessor) => {
      const kbService = editorAccessor.get(IContextKeyService);
      if (!kbService.contextMatchesRules(precondition ?? void 0)) {
        return;
      }
      return runner(editorAccessor, editor, args);
    });
  }
  runCommand(accessor, args) {
    return EditorCommand.runEditorCommand(accessor, args, this.precondition, (accessor2, editor, args2) => this.runEditorCommand(accessor2, editor, args2));
  }
}
class EditorAction extends EditorCommand {
  static convertOptions(opts) {
    let menuOpts;
    if (Array.isArray(opts.menuOpts)) {
      menuOpts = opts.menuOpts;
    } else if (opts.menuOpts) {
      menuOpts = [opts.menuOpts];
    } else {
      menuOpts = [];
    }
    function withDefaults(item) {
      if (!item.menuId) {
        item.menuId = MenuId.EditorContext;
      }
      if (!item.title) {
        item.title = typeof opts.label === "string" ? opts.label : opts.label.value;
      }
      item.when = ContextKeyExpr.and(opts.precondition, item.when);
      return item;
    }
    if (Array.isArray(opts.contextMenuOpts)) {
      menuOpts.push(...opts.contextMenuOpts.map(withDefaults));
    } else if (opts.contextMenuOpts) {
      menuOpts.push(withDefaults(opts.contextMenuOpts));
    }
    opts.menuOpts = menuOpts;
    return opts;
  }
  constructor(opts) {
    super(EditorAction.convertOptions(opts));
    if (typeof opts.label === "string") {
      this.label = opts.label;
      this.alias = opts.alias ?? opts.label;
    } else {
      this.label = opts.label.value;
      this.alias = opts.alias ?? opts.label.original;
    }
  }
  runEditorCommand(accessor, editor, args) {
    this.reportTelemetry(accessor, editor);
    return this.run(accessor, editor, args || {});
  }
  reportTelemetry(accessor, editor) {
    accessor.get(ITelemetryService).publicLog2("editorActionInvoked", { name: this.label, id: this.id });
  }
}
class MultiEditorAction extends EditorAction {
  constructor() {
    super(...arguments);
    this._implementations = [];
  }
  /**
   * A higher priority gets to be looked at first
   */
  addImplementation(priority, implementation) {
    this._implementations.push([priority, implementation]);
    this._implementations.sort((a, b) => b[0] - a[0]);
    return {
      dispose: () => {
        for (let i = 0; i < this._implementations.length; i++) {
          if (this._implementations[i][1] === implementation) {
            this._implementations.splice(i, 1);
            return;
          }
        }
      }
    };
  }
  run(accessor, editor, args) {
    for (const impl of this._implementations) {
      const result = impl[1](accessor, editor, args);
      if (result) {
        if (typeof result === "boolean") {
          return;
        }
        return result;
      }
    }
  }
}
class EditorAction2 extends Action2 {
  run(accessor, ...args) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const editor = codeEditorService.getFocusedCodeEditor() || codeEditorService.getActiveCodeEditor();
    if (!editor) {
      return;
    }
    return editor.invokeWithinContext((editorAccessor) => {
      const kbService = editorAccessor.get(IContextKeyService);
      const logService = editorAccessor.get(ILogService);
      const enabled = kbService.contextMatchesRules(this.desc.precondition ?? void 0);
      if (!enabled) {
        logService.debug(`[EditorAction2] NOT running command because its precondition is FALSE`, this.desc.id, this.desc.precondition?.serialize());
        return;
      }
      return this.runEditorCommand(editorAccessor, editor, ...args);
    });
  }
}
function registerModelAndPositionCommand(id, handler) {
  CommandsRegistry.registerCommand(id, function(accessor, ...args) {
    const instaService = accessor.get(IInstantiationService);
    const [resource, position] = args;
    assertType(URI.isUri(resource));
    assertType(Position.isIPosition(position));
    const model = accessor.get(IModelService).getModel(resource);
    if (model) {
      const editorPosition = Position.lift(position);
      return instaService.invokeFunction(handler, model, editorPosition, ...args.slice(2));
    }
    return accessor.get(ITextModelService).createModelReference(resource).then((reference) => {
      return new Promise((resolve, reject) => {
        try {
          const result = instaService.invokeFunction(handler, reference.object.textEditorModel, Position.lift(position), args.slice(2));
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }).finally(() => {
        reference.dispose();
      });
    });
  });
}
function registerEditorCommand(editorCommand) {
  EditorContributionRegistry.INSTANCE.registerEditorCommand(editorCommand);
  return editorCommand;
}
function registerEditorAction(ctor) {
  const action = new ctor();
  EditorContributionRegistry.INSTANCE.registerEditorAction(action);
  return action;
}
function registerMultiEditorAction(action) {
  EditorContributionRegistry.INSTANCE.registerEditorAction(action);
  return action;
}
function registerInstantiatedEditorAction(editorAction) {
  EditorContributionRegistry.INSTANCE.registerEditorAction(editorAction);
}
function registerEditorContribution(id, ctor, instantiation) {
  EditorContributionRegistry.INSTANCE.registerEditorContribution(id, ctor, instantiation);
}
function registerDiffEditorContribution(id, ctor) {
  EditorContributionRegistry.INSTANCE.registerDiffEditorContribution(id, ctor);
}
var EditorExtensionsRegistry;
((EditorExtensionsRegistry2) => {
  function getEditorCommand(commandId) {
    return EditorContributionRegistry.INSTANCE.getEditorCommand(commandId);
  }
  EditorExtensionsRegistry2.getEditorCommand = getEditorCommand;
  function getEditorActions() {
    return EditorContributionRegistry.INSTANCE.getEditorActions();
  }
  EditorExtensionsRegistry2.getEditorActions = getEditorActions;
  function getEditorContributions() {
    return EditorContributionRegistry.INSTANCE.getEditorContributions();
  }
  EditorExtensionsRegistry2.getEditorContributions = getEditorContributions;
  function getSomeEditorContributions(ids) {
    return EditorContributionRegistry.INSTANCE.getEditorContributions().filter((c) => ids.indexOf(c.id) >= 0);
  }
  EditorExtensionsRegistry2.getSomeEditorContributions = getSomeEditorContributions;
  function getDiffEditorContributions() {
    return EditorContributionRegistry.INSTANCE.getDiffEditorContributions();
  }
  EditorExtensionsRegistry2.getDiffEditorContributions = getDiffEditorContributions;
})(EditorExtensionsRegistry || (EditorExtensionsRegistry = {}));
const Extensions = {
  EditorCommonContributions: "editor.contributions"
};
class EditorContributionRegistry {
  constructor() {
    this.editorContributions = [];
    this.diffEditorContributions = [];
    this.editorActions = [];
    this.editorCommands = /* @__PURE__ */ Object.create(null);
  }
  static {
    this.INSTANCE = new EditorContributionRegistry();
  }
  registerEditorContribution(id, ctor, instantiation) {
    this.editorContributions.push({ id, ctor, instantiation });
  }
  getEditorContributions() {
    return this.editorContributions.slice(0);
  }
  registerDiffEditorContribution(id, ctor) {
    this.diffEditorContributions.push({ id, ctor });
  }
  getDiffEditorContributions() {
    return this.diffEditorContributions.slice(0);
  }
  registerEditorAction(action) {
    action.register();
    this.editorActions.push(action);
  }
  getEditorActions() {
    return this.editorActions;
  }
  registerEditorCommand(editorCommand) {
    editorCommand.register();
    this.editorCommands[editorCommand.id] = editorCommand;
  }
  getEditorCommand(commandId) {
    return this.editorCommands[commandId] || null;
  }
}
Registry.add(Extensions.EditorCommonContributions, EditorContributionRegistry.INSTANCE);
function registerCommand(command) {
  command.register();
  return command;
}
const UndoCommand = registerCommand(new MultiCommand({
  id: "undo",
  precondition: void 0,
  kbOpts: {
    weight: KeybindingWeight.EditorCore,
    primary: KeyMod.CtrlCmd | KeyCode.KeyZ
  },
  menuOpts: [{
    menuId: MenuId.MenubarEditMenu,
    group: "1_do",
    title: nls.localize({ key: "miUndo", comment: ["&& denotes a mnemonic"] }, "&&Undo"),
    order: 1
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("undo", "Undo"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: "1_do",
    title: nls.localize("undo", "Undo"),
    order: 1
  }]
}));
registerCommand(new ProxyCommand(UndoCommand, { id: "default:undo", precondition: void 0 }));
const RedoCommand = registerCommand(new MultiCommand({
  id: "redo",
  precondition: void 0,
  kbOpts: {
    weight: KeybindingWeight.EditorCore,
    primary: KeyMod.CtrlCmd | KeyCode.KeyY,
    secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ],
    mac: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ }
  },
  menuOpts: [{
    menuId: MenuId.MenubarEditMenu,
    group: "1_do",
    title: nls.localize({ key: "miRedo", comment: ["&& denotes a mnemonic"] }, "&&Redo"),
    order: 2
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("redo", "Redo"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: "1_do",
    title: nls.localize("redo", "Redo"),
    order: 2
  }]
}));
registerCommand(new ProxyCommand(RedoCommand, { id: "default:redo", precondition: void 0 }));
const SelectAllCommand = registerCommand(new MultiCommand({
  id: "editor.action.selectAll",
  precondition: void 0,
  kbOpts: {
    weight: KeybindingWeight.EditorCore,
    kbExpr: null,
    primary: KeyMod.CtrlCmd | KeyCode.KeyA
  },
  menuOpts: [{
    menuId: MenuId.MenubarSelectionMenu,
    group: "1_basic",
    title: nls.localize({ key: "miSelectAll", comment: ["&& denotes a mnemonic"] }, "&&Select All"),
    order: 1
  }, {
    menuId: MenuId.CommandPalette,
    group: "",
    title: nls.localize("selectAll", "Select All"),
    order: 1
  }, {
    menuId: MenuId.SimpleEditorContext,
    group: "9_select",
    title: nls.localize("selectAll", "Select All"),
    order: 1
  }]
}));
export {
  Command,
  EditorAction,
  EditorAction2,
  EditorCommand,
  EditorContributionInstantiation,
  EditorExtensionsRegistry,
  MultiCommand,
  MultiEditorAction,
  ProxyCommand,
  RedoCommand,
  SelectAllCommand,
  UndoCommand,
  registerDiffEditorContribution,
  registerEditorAction,
  registerEditorCommand,
  registerEditorContribution,
  registerInstantiatedEditorAction,
  registerModelAndPositionCommand,
  registerMultiEditorAction
};
