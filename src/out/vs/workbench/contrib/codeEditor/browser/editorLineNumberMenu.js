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
import { Separator } from "../../../../base/common/actions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { registerEditorContribution, EditorContributionInstantiation } from "../../../../editor/browser/editorExtensions.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { TextEditorSelectionSource } from "../../../../platform/editor/common/editor.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
class GutterActionsRegistryImpl {
  constructor() {
    this._registeredGutterActionsGenerators = /* @__PURE__ */ new Set();
  }
  /**
   *
   * This exists solely to allow the debug and test contributions to add actions to the gutter context menu
   * which cannot be trivially expressed using when clauses and therefore cannot be statically registered.
   * If you want an action to show up in the gutter context menu, you should generally use MenuId.EditorLineNumberMenu instead.
   */
  registerGutterActionsGenerator(gutterActionsGenerator) {
    this._registeredGutterActionsGenerators.add(gutterActionsGenerator);
    return {
      dispose: () => {
        this._registeredGutterActionsGenerators.delete(gutterActionsGenerator);
      }
    };
  }
  getGutterActionsGenerators() {
    return Array.from(this._registeredGutterActionsGenerators.values());
  }
}
Registry.add("gutterActionsRegistry", new GutterActionsRegistryImpl());
const GutterActionsRegistry = Registry.as("gutterActionsRegistry");
let EditorLineNumberContextMenu = class extends Disposable {
  constructor(editor, contextMenuService, menuService, contextKeyService, instantiationService) {
    super();
    this.editor = editor;
    this.contextMenuService = contextMenuService;
    this.menuService = menuService;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this._register(this.editor.onMouseDown((e) => this.doShow(e, false)));
  }
  static {
    this.ID = "workbench.contrib.editorLineNumberContextMenu";
  }
  show(e) {
    this.doShow(e, true);
  }
  doShow(e, force) {
    const model = this.editor.getModel();
    if (!e.event.rightButton && !(isMacintosh && e.event.leftButton && e.event.ctrlKey) && !force || e.target.type !== MouseTargetType.GUTTER_LINE_NUMBERS && e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN || !e.target.position || !model) {
      return;
    }
    const lineNumber = e.target.position.lineNumber;
    const contextKeyService = this.contextKeyService.createOverlay([["editorLineNumber", lineNumber]]);
    const menu = this.menuService.createMenu(MenuId.EditorLineNumberContext, contextKeyService);
    const allActions = [];
    this.instantiationService.invokeFunction((accessor) => {
      for (const generator of GutterActionsRegistry.getGutterActionsGenerators()) {
        const collectedActions = /* @__PURE__ */ new Map();
        generator({ lineNumber, editor: this.editor, accessor }, {
          push: (action, group = "navigation") => {
            const actions = collectedActions.get(group) ?? [];
            actions.push(action);
            collectedActions.set(group, actions);
          }
        });
        for (const [group, actions] of collectedActions.entries()) {
          allActions.push([group, actions]);
        }
      }
      allActions.sort((a, b) => a[0].localeCompare(b[0]));
      const menuActions = menu.getActions({ arg: { lineNumber, uri: model.uri }, shouldForwardArgs: true });
      allActions.push(...menuActions);
      if (e.target.type === MouseTargetType.GUTTER_LINE_NUMBERS) {
        const currentSelections = this.editor.getSelections();
        const lineRange = {
          startLineNumber: lineNumber,
          endLineNumber: lineNumber,
          startColumn: 1,
          endColumn: model.getLineLength(lineNumber) + 1
        };
        const containsSelection = currentSelections?.some((selection) => !selection.isEmpty() && selection.intersectRanges(lineRange) !== null);
        if (!containsSelection) {
          this.editor.setSelection(lineRange, TextEditorSelectionSource.PROGRAMMATIC);
        }
      }
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.event,
        getActions: () => Separator.join(...allActions.map((a) => a[1])),
        onHide: () => menu.dispose()
      });
    });
  }
};
EditorLineNumberContextMenu = __decorateClass([
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IMenuService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IInstantiationService)
], EditorLineNumberContextMenu);
registerEditorContribution(EditorLineNumberContextMenu.ID, EditorLineNumberContextMenu, EditorContributionInstantiation.AfterFirstRender);
export {
  EditorLineNumberContextMenu,
  GutterActionsRegistry,
  GutterActionsRegistryImpl
};
