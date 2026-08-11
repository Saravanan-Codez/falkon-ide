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
import * as dom from "../../../../../../../base/browser/dom.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { formatTokenCount } from "../../../../../../../base/common/numbers.js";
import { ThemeIcon } from "../../../../../../../base/common/themables.js";
import { localize } from "../../../../../../../nls.js";
import { ActionListItemKind } from "../../../../../../../platform/actionWidget/browser/actionList.js";
import { IActionWidgetService } from "../../../../../../../platform/actionWidget/browser/actionWidget.js";
import { ITelemetryService } from "../../../../../../../platform/telemetry/common/telemetry.js";
import { TelemetryTrustedValue } from "../../../../../../../platform/telemetry/common/telemetryUtils.js";
import { withChatInputPickerMotion } from "../chatInputPickerActionItem.js";
let ModelPickerConfiguration = class {
  constructor(_host, _actionWidgetService, _telemetryService) {
    this._host = _host;
    this._actionWidgetService = _actionWidgetService;
    this._telemetryService = _telemetryService;
    this._showRequestId = 0;
  }
  renderButton(button, compact, noModelsAvailable) {
    const model = this._host.getSelectedModel();
    const effortConfig = this._getConfigProperty("navigation");
    const tokensConfig = this._getConfigProperty("tokens");
    if (compact || !model || noModelsAvailable || !effortConfig && !tokensConfig) {
      button.style.display = "none";
      return;
    }
    const labelParts = [];
    const ariaParts = [];
    if (effortConfig && effortConfig.value !== void 0) {
      const enumIndex = effortConfig.schema.enum?.indexOf(effortConfig.value) ?? -1;
      const effortLabel = enumIndex >= 0 && effortConfig.schema.enumItemLabels?.[enumIndex] ? effortConfig.schema.enumItemLabels[enumIndex] : String(effortConfig.value);
      labelParts.push(effortLabel);
      ariaParts.push(effortConfig.schema.title ? localize("chat.modelPicker.navigationAriaLabel", "{0}: {1}", effortConfig.schema.title, effortLabel) : localize("chat.modelPicker.effortAriaLabel", "Thinking Effort: {0}", effortLabel));
    }
    if (tokensConfig && tokensConfig.value !== void 0) {
      const enumIndex = tokensConfig.schema.enum?.indexOf(tokensConfig.value) ?? -1;
      const tokensLabel = enumIndex >= 0 && tokensConfig.schema.enumItemLabels?.[enumIndex] ? tokensConfig.schema.enumItemLabels[enumIndex] : formatTokenCount(Number(tokensConfig.value));
      labelParts.push(tokensLabel);
      ariaParts.push(localize("chat.modelPicker.tokensAriaLabel", "Context Size: {0}", tokensLabel));
    }
    if (!labelParts.length) {
      const fallbackLabel = effortConfig?.schema.title ?? tokensConfig?.schema.title ?? localize("chat.modelPicker.configureLabel", "Configure");
      labelParts.push(fallbackLabel);
      ariaParts.push(fallbackLabel);
    }
    dom.reset(button, dom.$("span.chat-input-picker-label", void 0, labelParts.join(" ")));
    button.style.display = "";
    button.ariaLabel = ariaParts.join(", ");
  }
  show(button, focusGroup) {
    if (this._host.isDisabled() || !button || !this._host.getSelectedModel()) {
      return;
    }
    if (button.getAttribute("aria-expanded") === "true") {
      this._showRequestId++;
      this._actionWidgetService.hide(true);
      return;
    }
    const items = this._buildItems();
    if (!items.length) {
      return;
    }
    const previouslyFocusedElement = dom.getActiveElement();
    const showRequestId = ++this._showRequestId;
    const delegate = {
      onSelect: async (action) => {
        this._actionWidgetService.focusItemById(action.id);
        await action.run();
        this._actionWidgetService.updateItems(this._buildItems(), action.id);
      },
      onHide: () => {
        this._showRequestId++;
        if (this._activeButton === button) {
          this._activeButton = void 0;
        }
        button.setAttribute("aria-expanded", "false");
        const visibilityChange2 = this._host.onDidChangeVisibility?.(false);
        if (visibilityChange2) {
          void visibilityChange2.catch(() => {
          });
        }
        if (dom.isHTMLElement(previouslyFocusedElement)) {
          previouslyFocusedElement.focus();
        }
      }
    };
    button.setAttribute("aria-expanded", "true");
    this._activeButton = button;
    const showCacheBreakHint = this._host.shouldShowCacheBreakHint();
    const showActionWidget = () => {
      if (showRequestId !== this._showRequestId || button.getAttribute("aria-expanded") !== "true") {
        return;
      }
      this._actionWidgetService.show(
        "ChatModelConfigPicker",
        false,
        items,
        delegate,
        this._host.getActionWidgetAnchor?.(button) ?? button,
        this._host.getActionWidgetContainer?.(),
        [],
        {
          isChecked: (element) => element.kind === ActionListItemKind.Action ? !!element.item?.checked : void 0,
          getRole: (element) => element.kind === ActionListItemKind.Action ? "menuitemradio" : "separator",
          getWidgetRole: () => "menu"
        },
        withChatInputPickerMotion({
          headerText: showCacheBreakHint ? localize("chat.config.cacheBreakHint", "Changing these options mid-session resets the prompt cache and may increase cost.") : void 0,
          headerIcon: showCacheBreakHint ? Codicon.info : void 0,
          headerLink: showCacheBreakHint ? this._host.getCacheBreakLearnMoreLink() : void 0,
          headerDismiss: showCacheBreakHint ? this._host.dismissCacheBreakHint : void 0,
          reserveSubmenuSpace: false,
          anchorPosition: this._host.getAnchorPosition?.()
        })
      );
      if (focusGroup) {
        const groupItem = items.find((item) => item.kind === ActionListItemKind.Action && item.item?.id?.startsWith(`${focusGroup}.`));
        if (groupItem?.kind === ActionListItemKind.Action && groupItem.item) {
          this._actionWidgetService.focusItemById(groupItem.item.id);
        }
      }
    };
    const visibilityChange = this._host.onDidChangeVisibility?.(true);
    if (visibilityChange) {
      void visibilityChange.then(showActionWidget, () => {
        if (showRequestId !== this._showRequestId) {
          return;
        }
        this._showRequestId++;
        if (this._activeButton === button) {
          this._activeButton = void 0;
        }
        button.setAttribute("aria-expanded", "false");
        const hideVisibilityChange = this._host.onDidChangeVisibility?.(false);
        if (hideVisibilityChange) {
          void hideVisibilityChange.catch(() => {
          });
        }
        if (dom.isHTMLElement(previouslyFocusedElement)) {
          previouslyFocusedElement.focus();
        }
      });
    } else {
      showActionWidget();
    }
  }
  dispose() {
    this._showRequestId++;
    if (this._activeButton) {
      this._activeButton = void 0;
      this._actionWidgetService.hide(true);
    }
  }
  _getConfigProperty(group) {
    const model = this._host.getSelectedModel();
    if (!model) {
      return void 0;
    }
    const schema = model.metadata.configurationSchema;
    if (!schema?.properties) {
      return void 0;
    }
    const configurationAccess = this._host.getConfigurationAccess();
    const currentConfig = configurationAccess.getModelConfiguration(model.identifier) ?? {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.group !== group || !propSchema.enum?.length) {
        continue;
      }
      return { key, value: currentConfig[key] ?? propSchema.default, schema: propSchema };
    }
    return void 0;
  }
  _buildItems() {
    const model = this._host.getSelectedModel();
    if (!model) {
      return [];
    }
    const modelIdentifier = model.identifier;
    const configurationAccess = this._host.getConfigurationAccess();
    const items = [];
    const defaultLabel = localize("models.configDefault", "Default");
    const appendConfigSection = (group, fallbackHeaderLabel, formatValueLabel, logChange) => {
      const config = this._getConfigProperty(group);
      if (!config) {
        return;
      }
      const previousValue = String(config.value ?? "");
      const enumValues = config.schema.enum ?? [];
      if (items.length) {
        items.push({ kind: ActionListItemKind.Separator });
      }
      items.push({ kind: ActionListItemKind.Header, label: config.schema.title ?? fallbackHeaderLabel });
      for (let index = 0; index < enumValues.length; index++) {
        const value = enumValues[index];
        const isDefault = value === config.schema.default;
        const displayLabel = formatValueLabel(value, config.schema.enumItemLabels?.[index]);
        const enumDescription = config.schema.enumDescriptions?.[index];
        const ariaDescriptionParts = [isDefault ? defaultLabel : void 0, enumDescription].filter((part) => !!part);
        const checked = config.value === value;
        items.push({
          item: {
            id: `${group}.${value}`,
            enabled: true,
            checked,
            class: void 0,
            tooltip: enumDescription ?? "",
            label: displayLabel,
            run: () => {
              logChange(value, previousValue, config.key);
              return configurationAccess.setModelConfiguration(modelIdentifier, { [config.key]: value });
            }
          },
          kind: ActionListItemKind.Action,
          className: "chat-model-picker-config-option",
          label: displayLabel,
          description: isDefault ? defaultLabel : void 0,
          ariaDescription: ariaDescriptionParts.length ? ariaDescriptionParts.join(", ") : void 0,
          hover: enumDescription ? { content: enumDescription } : void 0,
          group: { title: "", icon: ThemeIcon.fromId(checked ? Codicon.check.id : Codicon.blank.id) },
          hideIcon: false
        });
      }
    };
    appendConfigSection(
      "navigation",
      localize("chat.effort.header", "Thinking Effort"),
      (value, enumLabel) => enumLabel ?? String(value),
      (value, previousValue, key) => this._telemetryService.publicLog2("chat.thinkingEffortChange", {
        model: model.metadata.vendor === "copilot" ? new TelemetryTrustedValue(modelIdentifier) : "unknown",
        // Third-party providers choose their own property keys, so only
        // first-party ones are reported as a controlled vocabulary.
        property: model.metadata.vendor === "copilot" ? key : "unknown",
        fromValue: previousValue,
        toValue: String(value)
      })
    );
    appendConfigSection(
      "tokens",
      localize("chat.tokens.header", "Context Size"),
      (value, enumLabel) => enumLabel ?? formatTokenCount(Number(value)),
      (value, previousValue) => this._telemetryService.publicLog2("chat.contextSizeChange", {
        model: model.metadata.vendor === "copilot" ? new TelemetryTrustedValue(modelIdentifier) : "unknown",
        fromValue: previousValue,
        toValue: String(value)
      })
    );
    return items;
  }
};
ModelPickerConfiguration = __decorateClass([
  __decorateParam(1, IActionWidgetService),
  __decorateParam(2, ITelemetryService)
], ModelPickerConfiguration);
export {
  ModelPickerConfiguration
};
