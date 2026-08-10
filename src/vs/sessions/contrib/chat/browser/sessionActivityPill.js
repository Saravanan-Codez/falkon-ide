import { $ } from "../../../../base/browser/dom.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { localize } from "../../../../nls.js";
import { ActionListItemKind } from "../../../../platform/actionWidget/browser/actionList.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import "./media/sessionActivityPill.css";
class SessionActivityPill extends Disposable {
  constructor(_options, _actionWidgetService) {
    super();
    this._options = _options;
    this._actionWidgetService = _actionWidgetService;
    this._isVisible = observableValue(this, false);
    this._categories = [];
    this._activities = [];
    this.element = $(`.session-activity-pill.${_options.className}.hidden`);
    this.isVisible = this._isVisible;
    this._button = this._register(new Button(this.element, { secondary: true, small: true, supportIcons: true, ...defaultButtonStyles }));
    this._button.element.classList.add("session-activity-pill-button");
    this._register(this._button.onDidClick(() => this._onDidClick()));
  }
  setCategories(categories) {
    this._categories = categories.filter((category) => category.activities.length > 0);
    this._activities = this._categories.flatMap((category) => category.activities);
    this._render();
  }
  _render() {
    const count = this._activities.length;
    this._isVisible.set(count > 0, void 0);
    this.element.classList.toggle("hidden", count === 0);
    if (count === 0) {
      return;
    }
    let label;
    let accessibleLabel;
    if (count === 1) {
      const activity = this._activities[0];
      label = `$(${activity.icon.id}) ${activity.label}`;
      accessibleLabel = localize("sessionActivityPill.open", "Open {0}", activity.label);
    } else {
      const summary = this._options.getSummary(this._activities);
      label = `$(${summary.icon.id}) ${summary.label} $(${Codicon.chevronDown.id})`;
      accessibleLabel = summary.ariaLabel;
    }
    this._button.label = label;
    this._button.setTitle(accessibleLabel);
    this._button.setAriaLabel(accessibleLabel);
  }
  _onDidClick() {
    if (this._activities.length === 1) {
      this._openActivity(this._activities[0]);
      return;
    }
    if (this._activities.length > 1) {
      this._showPicker();
    }
  }
  _openActivity(activity) {
    Promise.resolve(this._options.openActivity(activity)).catch(onUnexpectedError);
  }
  _showPicker() {
    if (this._actionWidgetService.isVisible) {
      return;
    }
    const items = [];
    for (const category of this._categories) {
      if (items.length > 0) {
        items.push({ kind: ActionListItemKind.Separator, label: "" });
      }
      items.push({ kind: ActionListItemKind.Header, label: category.title, group: { title: category.title } });
      for (const activity of category.activities) {
        items.push({
          kind: ActionListItemKind.Action,
          label: activity.label,
          group: { title: "", icon: activity.icon },
          item: activity
        });
      }
    }
    const triggerElement = this._button.element;
    const delegate = {
      onSelect: (activity) => {
        this._actionWidgetService.hide();
        this._openActivity(activity);
      },
      onHide: () => triggerElement.focus()
    };
    this._actionWidgetService.show(
      this._options.widgetId,
      false,
      items,
      delegate,
      triggerElement,
      void 0,
      [],
      {
        getAriaLabel: (item) => item.label ?? "",
        getWidgetAriaLabel: () => this._options.getWidgetAriaLabel()
      },
      { minWidth: 220, maxWidth: 420 }
    );
  }
}
export {
  SessionActivityPill
};
