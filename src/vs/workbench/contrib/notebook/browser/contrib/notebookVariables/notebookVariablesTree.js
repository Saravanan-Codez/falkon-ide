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
import * as dom from "../../../../../../base/browser/dom.js";
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../../base/common/observable.js";
import { localize, localize2 } from "../../../../../../nls.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { WorkbenchObjectTree } from "../../../../../../platform/list/browser/listService.js";
import { DebugExpressionRenderer } from "../../../../debug/browser/debugExpressionRenderer.js";
const $ = dom.$;
const MAX_VALUE_RENDER_LENGTH_IN_VIEWLET = 1024;
const NOTEBOOK_TITLE = localize2("notebook.notebookVariables", "Notebook Variables");
const REPL_TITLE = localize2("notebook.ReplVariables", "REPL Variables");
class NotebookVariablesTree extends WorkbenchObjectTree {
}
class NotebookVariablesDelegate {
  getHeight(element) {
    return 22;
  }
  getTemplateId(element) {
    return NotebookVariableRenderer.ID;
  }
}
let NotebookVariableRenderer = class {
  static {
    this.ID = "variableElement";
  }
  get templateId() {
    return NotebookVariableRenderer.ID;
  }
  constructor(instantiationService) {
    this.expressionRenderer = instantiationService.createInstance(DebugExpressionRenderer);
  }
  renderTemplate(container) {
    const expression = dom.append(container, $(".expression"));
    const name = dom.append(expression, $("span.name"));
    const value = dom.append(expression, $("span.value"));
    const template = { expression, name, value, elementDisposables: new DisposableStore() };
    return template;
  }
  renderElement(element, _index, data) {
    const text = element.element.value.trim() !== "" ? `${element.element.name}:` : element.element.name;
    data.name.textContent = text;
    data.name.title = element.element.type ?? "";
    data.elementDisposables.add(this.expressionRenderer.renderValue(data.value, element.element, {
      colorize: true,
      maxValueLength: MAX_VALUE_RENDER_LENGTH_IN_VIEWLET,
      session: void 0
    }));
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.elementDisposables.dispose();
  }
};
NotebookVariableRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], NotebookVariableRenderer);
class NotebookVariableAccessibilityProvider {
  constructor() {
    this._widgetAriaLabel = observableValue("widgetAriaLabel", NOTEBOOK_TITLE.value);
  }
  getWidgetAriaLabel() {
    return this._widgetAriaLabel;
  }
  updateWidgetAriaLabel(label) {
    this._widgetAriaLabel.set(label, void 0);
  }
  getAriaLabel(element) {
    return localize("notebookVariableAriaLabel", "Variable {0}, value {1}", element.name, element.value);
  }
}
export {
  NOTEBOOK_TITLE,
  NotebookVariableAccessibilityProvider,
  NotebookVariableRenderer,
  NotebookVariablesDelegate,
  NotebookVariablesTree,
  REPL_TITLE
};
