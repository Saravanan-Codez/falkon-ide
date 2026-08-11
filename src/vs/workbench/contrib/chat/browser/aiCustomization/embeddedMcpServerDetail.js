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
import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { LocalMcpServerScope } from "../../../../services/mcp/common/mcpWorkbenchManagementService.js";
import { IMcpWorkbenchService } from "../../../mcp/common/mcpTypes.js";
import { userIcon, workspaceIcon } from "./aiCustomizationIcons.js";
const $ = DOM.$;
let EmbeddedMcpServerDetail = class extends Disposable {
  constructor(parent, mcpWorkbenchService) {
    super();
    this.mcpWorkbenchService = mcpWorkbenchService;
    this.root = DOM.append(parent, $(".ai-customization-embedded-detail.embedded-mcp-detail"));
    this.headerEl = DOM.append(this.root, $(".embedded-detail-header"));
    this.leadingSlotEl = DOM.append(this.headerEl, $(".embedded-detail-leading-slot"));
    const headerText = DOM.append(this.headerEl, $(".embedded-detail-header-text"));
    this.nameEl = DOM.append(headerText, $("h2.embedded-detail-name"));
    this.nameEl.setAttribute("role", "heading");
    this.scopeEl = DOM.append(headerText, $(".embedded-detail-scope"));
    this.descriptionEl = DOM.append(this.root, $(".embedded-detail-description"));
    this.emptyEl = DOM.append(this.root, $(".embedded-detail-empty"));
    this.emptyEl.textContent = localize("mcpDetailEmpty", "No MCP server selected.");
    this._register(this.mcpWorkbenchService.onChange((server) => {
      if (this.current && server && server.id === this.current.id) {
        this.current = server;
        this.renderItem();
      }
    }));
    this.renderItem();
  }
  get element() {
    return this.root;
  }
  get headerElement() {
    return this.headerEl;
  }
  /**
   * Header slot reserved for leading chrome (e.g. a back button).
   * Prefer this over reaching into the header element directly.
   */
  get leadingSlot() {
    return this.leadingSlotEl;
  }
  setInput(server) {
    this.current = server;
    this.renderItem();
  }
  clearInput() {
    this.current = void 0;
    this.renderItem();
  }
  renderItem() {
    const server = this.current;
    const hasItem = !!server;
    this.emptyEl.style.display = hasItem ? "none" : "";
    this.root.classList.toggle("is-empty", !hasItem);
    if (!server) {
      this.nameEl.textContent = "";
      this.scopeEl.textContent = "";
      this.descriptionEl.textContent = "";
      return;
    }
    this.nameEl.textContent = server.label || server.name;
    const scope = server.local?.scope;
    const scopeInfo = describeMcpScope(scope);
    if (scopeInfo) {
      this.scopeEl.textContent = scopeInfo.label;
      this.scopeEl.style.display = "";
    } else {
      this.scopeEl.replaceChildren();
      this.scopeEl.style.display = "none";
    }
    const description = (server.description || "").trim();
    this.descriptionEl.textContent = description;
    this.descriptionEl.style.display = description ? "" : "none";
  }
};
EmbeddedMcpServerDetail = __decorateClass([
  __decorateParam(1, IMcpWorkbenchService)
], EmbeddedMcpServerDetail);
function describeMcpScope(scope) {
  switch (scope) {
    case LocalMcpServerScope.Workspace:
      return { label: localize("mcpScopeWorkspace", "Workspace"), icon: workspaceIcon };
    case LocalMcpServerScope.User:
    case LocalMcpServerScope.RemoteUser:
      return { label: localize("mcpScopeUser", "User"), icon: userIcon };
    default:
      return void 0;
  }
}
export {
  EmbeddedMcpServerDetail
};
