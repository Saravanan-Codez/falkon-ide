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
import "./media/agentGlobalConfigurationSettings.css";
import * as DOM from "../../../../../base/browser/dom.js";
import { Button } from "../../../../../base/browser/ui/button/button.js";
import { SelectBox } from "../../../../../base/browser/ui/selectBox/selectBox.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun } from "../../../../../base/common/observable.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { readAgentCustomizationSettings } from "../../../../../platform/agentHost/common/agentCustomizationSettings.js";
import { IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { Link } from "../../../../../platform/opener/browser/link.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { defaultButtonStyles, defaultSelectBoxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
let AHPAgentSettingsWidget = class extends Disposable {
  constructor(parent, agentProvider, target, contextViewService, notificationService, editorService, hoverService, openerService) {
    super();
    this.agentProvider = agentProvider;
    this.contextViewService = contextViewService;
    this.notificationService = notificationService;
    this.editorService = editorService;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.renderDisposables = this._register(new DisposableStore());
    this.targetListener = this._register(new MutableDisposable());
    this.container = DOM.append(parent, DOM.$(".agent-global-configuration-settings"));
    this._register(autorun((reader) => this.connect(target.read(reader))));
  }
  layout() {
    this.container.classList.toggle("narrow", this.container.clientWidth < 560);
  }
  focus() {
    this.focusTarget?.();
  }
  connect(target) {
    if (this.target === target && target) {
      return;
    }
    this.target = target;
    this.targetListener.value = target?.onDidChange(() => this.render());
    this.render();
  }
  render() {
    this.renderDisposables.clear();
    DOM.clearNode(this.container);
    this.focusTarget = void 0;
    const state = this.target?.getState();
    const descriptor = readAgentCustomizationSettings(state, this.agentProvider);
    if (!state?.config || !descriptor) {
      DOM.append(this.container, DOM.$(".agent-global-configuration-settings-status")).textContent = localize("agentSettings.unavailable", "These harness settings are not available from the connected agent host.");
      return;
    }
    const content = DOM.append(this.container, DOM.$(".agent-global-configuration-settings-content"));
    DOM.append(content, DOM.$("h1")).textContent = descriptor.title;
    DOM.append(content, DOM.$("p.agent-global-configuration-settings-intro")).textContent = descriptor.description;
    for (const group of new Set(descriptor.settings.map((setting) => setting.group))) {
      const section = DOM.append(content, DOM.$(".agent-global-configuration-settings-section"));
      DOM.append(section, DOM.$("h2")).textContent = group;
      const card = DOM.append(section, DOM.$(".agent-global-configuration-settings-card"));
      for (const setting of descriptor.settings.filter((setting2) => setting2.group === group)) {
        const schema = state.config.schema.properties[setting.key];
        if (schema) {
          this.renderSetting(card, descriptor, setting.key, setting.kind, setting.saveLabel, schema, state.config.values[setting.key]);
        }
      }
    }
    this.renderConfigurationFile(content, descriptor);
  }
  renderSetting(parent, _descriptor, key, kind, saveLabel, schema, value) {
    const row = DOM.append(parent, DOM.$(".agent-global-configuration-settings-row"));
    const labels = DOM.append(row, DOM.$(".agent-global-configuration-settings-labels"));
    DOM.append(labels, DOM.$(".agent-global-configuration-settings-label")).textContent = schema.title;
    if (schema.description) {
      DOM.append(labels, DOM.$(".agent-global-configuration-settings-description")).textContent = schema.description;
    }
    if (kind === "multiline") {
      row.classList.add("agent-global-configuration-settings-text-row");
      const input = DOM.append(row, DOM.$("textarea.agent-global-configuration-settings-text"));
      input.ariaLabel = schema.title;
      input.value = typeof value === "string" ? value : "";
      this.focusTarget ??= () => input.focus();
      const actions = DOM.append(row, DOM.$(".agent-global-configuration-settings-actions"));
      const button = this.renderDisposables.add(new Button(actions, { ...defaultButtonStyles, secondary: true }));
      button.label = saveLabel ?? localize("agentSettings.save", "Save");
      this.renderDisposables.add(button.onDidClick(() => void this.save(key, input.value.trim())));
      return;
    }
    const options = schema.enum?.map((option, index) => ({ text: schema.enumLabels?.[index] ?? String(option) })) ?? [];
    const selected = Math.max(0, schema.enum?.findIndex((option) => option === value) ?? 0);
    const selectContainer = DOM.append(row, DOM.$(".agent-global-configuration-settings-select"));
    const select = this.renderDisposables.add(new SelectBox(options, selected, this.contextViewService, { ...defaultSelectBoxStyles }, { ariaLabel: schema.title }));
    select.render(selectContainer);
    this.focusTarget ??= () => select.focus();
    this.renderDisposables.add(select.onDidSelect((event) => void this.save(key, schema.enum?.[event.index])));
  }
  async save(key, value) {
    try {
      await this.target?.setValue(key, value);
    } catch (error) {
      this.notificationService.error(error);
    }
  }
  renderConfigurationFile(parent, descriptor) {
    const file = descriptor.configurationFile;
    if (!file) {
      return;
    }
    const section = DOM.append(parent, DOM.$(".agent-global-configuration-settings-section"));
    DOM.append(section, DOM.$("h2")).textContent = file.title;
    DOM.append(section, DOM.$("p.agent-global-configuration-settings-section-description")).textContent = file.description;
    if (file.documentationUrl && file.documentationLabel) {
      this.renderDisposables.add(new Link(section, { label: file.documentationLabel, href: file.documentationUrl }, {}, this.hoverService, this.openerService));
    }
    const button = this.renderDisposables.add(new Button(section, { ...defaultButtonStyles, secondary: true }));
    button.label = file.openLabel;
    this.renderDisposables.add(button.onDidClick(() => this.editorService.openEditor({ resource: this.target?.mapResource(URI.parse(file.resource)) ?? URI.parse(file.resource), options: { pinned: true } })));
  }
};
AHPAgentSettingsWidget = __decorateClass([
  __decorateParam(3, IContextViewService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IOpenerService)
], AHPAgentSettingsWidget);
export {
  AHPAgentSettingsWidget
};
