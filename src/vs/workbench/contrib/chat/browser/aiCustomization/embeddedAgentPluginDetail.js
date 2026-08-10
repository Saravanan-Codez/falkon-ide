import * as DOM from "../../../../../base/browser/dom.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { localize } from "../../../../../nls.js";
import { AgentPluginItemKind } from "../agentPluginEditor/agentPluginItems.js";
const $ = DOM.$;
class EmbeddedAgentPluginDetail extends Disposable {
  constructor(parent) {
    super();
    this.root = DOM.append(parent, $(".ai-customization-embedded-detail.embedded-plugin-detail"));
    this.headerEl = DOM.append(this.root, $(".embedded-detail-header"));
    this.leadingSlotEl = DOM.append(this.headerEl, $(".embedded-detail-leading-slot"));
    const headerText = DOM.append(this.headerEl, $(".embedded-detail-header-text"));
    this.nameEl = DOM.append(headerText, $("h2.embedded-detail-name"));
    this.nameEl.setAttribute("role", "heading");
    this.sourceEl = DOM.append(headerText, $(".embedded-detail-scope"));
    this.descriptionEl = DOM.append(this.root, $(".embedded-detail-description"));
    this.emptyEl = DOM.append(this.root, $(".embedded-detail-empty"));
    this.emptyEl.textContent = localize("pluginDetailEmpty", "No plugin selected.");
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
  setInput(item) {
    this.current = item;
    this.renderItem();
  }
  clearInput() {
    this.current = void 0;
    this.renderItem();
  }
  renderItem() {
    const item = this.current;
    const hasItem = !!item;
    this.emptyEl.style.display = hasItem ? "none" : "";
    this.root.classList.toggle("is-empty", !hasItem);
    if (!item) {
      this.nameEl.textContent = "";
      this.sourceEl.textContent = "";
      this.descriptionEl.textContent = "";
      return;
    }
    this.nameEl.textContent = item.name;
    const isMarketplace = item.kind === AgentPluginItemKind.Marketplace;
    const sourceLabel = item.marketplace ? isMarketplace ? localize("pluginSourceMarketplace", "From {0}", item.marketplace) : localize("pluginSourceInstalled", "Installed from {0}", item.marketplace) : isMarketplace ? localize("pluginSourceMarketplaceUnknown", "Marketplace plugin") : localize("pluginSourceLocal", "Installed plugin");
    this.sourceEl.textContent = sourceLabel;
    const description = (item.description || "").trim();
    this.descriptionEl.textContent = description;
    this.descriptionEl.style.display = description ? "" : "none";
  }
}
export {
  EmbeddedAgentPluginDetail
};
