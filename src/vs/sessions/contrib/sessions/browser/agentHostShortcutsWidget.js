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
import "./media/agentHostToolbar.css";
import * as DOM from "../../../../base/browser/dom.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Menus } from "../../../browser/menus.js";
const $ = DOM.$;
let AgentHostShortcutsWidget = class extends Disposable {
  constructor(container, options, instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this._render(container, options);
  }
  _render(parent, options) {
    const container = DOM.append(parent, $(".agent-host-toolbar"));
    const toolbarContainer = DOM.append(container, $(".agent-host-toolbar-content"));
    const toolbar = this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, toolbarContainer, Menus.SidebarAgentHost, {
      hiddenItemStrategy: HiddenItemStrategy.NoHide,
      toolbarOptions: { primaryGroup: () => true },
      telemetrySource: "sidebarAgentHost"
    }));
    this._register(toolbar.onDidChangeMenuItems(() => {
      options?.onDidChangeLayout?.();
    }));
  }
};
AgentHostShortcutsWidget = __decorateClass([
  __decorateParam(2, IInstantiationService)
], AgentHostShortcutsWidget);
export {
  AgentHostShortcutsWidget
};
