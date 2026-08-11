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
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { Separator } from "../../../../base/common/actions.js";
import { SuggestController } from "../../../../editor/contrib/suggest/browser/suggestController.js";
import { localize } from "../../../../nls.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ADVANCED_SETTING_TAG, EXTENSION_SETTING_TAG, FEATURE_SETTING_TAG, GENERAL_TAG_SETTING_TAG, ID_SETTING_TAG, LANGUAGE_SETTING_TAG, MODIFIED_SETTING_TAG, POLICY_SETTING_TAG } from "../common/preferences.js";
let SettingsSearchFilterDropdownMenuActionViewItem = class extends DropdownMenuActionViewItem {
  constructor(action, options, actionRunner, searchWidget, contextMenuService) {
    super(
      action,
      { getActions: () => this.getActions() },
      contextMenuService,
      {
        ...options,
        actionRunner,
        classNames: action.class,
        anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
        menuAsChild: true
      }
    );
    this.searchWidget = searchWidget;
    this.suggestController = SuggestController.get(this.searchWidget.inputWidget);
  }
  render(container) {
    super.render(container);
  }
  doSearchWidgetAction(queryToAppend, triggerSuggest) {
    this.searchWidget.setValue(this.searchWidget.getValue().trimEnd() + " " + queryToAppend);
    this.searchWidget.focus();
    if (triggerSuggest && this.suggestController) {
      this.suggestController.triggerSuggest();
    }
  }
  /**
   * The created action appends a query to the search widget search string. It optionally triggers suggestions.
   */
  createAction(id, label, tooltip, queryToAppend, triggerSuggest) {
    return {
      id,
      label,
      tooltip,
      class: void 0,
      enabled: true,
      run: () => {
        this.doSearchWidgetAction(queryToAppend, triggerSuggest);
      }
    };
  }
  /**
   * The created action appends a query to the search widget search string, if the query does not exist.
   * Otherwise, it removes the query from the search widget search string.
   * The action does not trigger suggestions after adding or removing the query.
   */
  createToggleAction(id, label, tooltip, queryToAppend) {
    const splitCurrentQuery = this.searchWidget.getValue().split(" ");
    const queryContainsQueryToAppend = splitCurrentQuery.includes(queryToAppend);
    return {
      id,
      label,
      tooltip,
      class: void 0,
      enabled: true,
      checked: queryContainsQueryToAppend,
      run: () => {
        if (!queryContainsQueryToAppend) {
          const trimmedCurrentQuery = this.searchWidget.getValue().trimEnd();
          const newQuery = trimmedCurrentQuery ? trimmedCurrentQuery + " " + queryToAppend : queryToAppend;
          this.searchWidget.setValue(newQuery);
        } else {
          const queryWithRemovedTags = this.searchWidget.getValue().split(" ").filter((word) => word !== queryToAppend).join(" ");
          this.searchWidget.setValue(queryWithRemovedTags);
        }
        this.searchWidget.focus();
      }
    };
  }
  createMutuallyExclusiveToggleAction(id, label, tooltip, filter, excludeFilters) {
    const isFilterEnabled = this.searchWidget.getValue().split(" ").includes(filter);
    return {
      id,
      label,
      tooltip,
      class: void 0,
      enabled: true,
      checked: isFilterEnabled,
      run: () => {
        if (isFilterEnabled) {
          const queryWithRemovedTags = this.searchWidget.getValue().split(" ").filter((word) => word !== filter).join(" ");
          this.searchWidget.setValue(queryWithRemovedTags);
        } else {
          let newQuery = this.searchWidget.getValue().split(" ").filter((word) => !excludeFilters.includes(word) && word !== filter).join(" ").trimEnd();
          newQuery = newQuery ? newQuery + " " + filter : filter;
          this.searchWidget.setValue(newQuery);
        }
        this.searchWidget.focus();
      }
    };
  }
  getActions() {
    return [
      this.createToggleAction(
        "modifiedSettingsSearch",
        localize("modifiedSettingsSearch", "Modified"),
        localize("modifiedSettingsSearchTooltip", "Add or remove modified settings filter"),
        `@${MODIFIED_SETTING_TAG}`
      ),
      new Separator(),
      this.createAction(
        "extSettingsSearch",
        localize("extSettingsSearch", "Extension ID..."),
        localize("extSettingsSearchTooltip", "Add extension ID filter"),
        `@${EXTENSION_SETTING_TAG}`,
        true
      ),
      this.createAction(
        "featuresSettingsSearch",
        localize("featureSettingsSearch", "Feature..."),
        localize("featureSettingsSearchTooltip", "Add feature filter"),
        `@${FEATURE_SETTING_TAG}`,
        true
      ),
      this.createAction(
        "tagSettingsSearch",
        localize("tagSettingsSearch", "Tag..."),
        localize("tagSettingsSearchTooltip", "Add tag filter"),
        `@${GENERAL_TAG_SETTING_TAG}`,
        true
      ),
      this.createAction(
        "langSettingsSearch",
        localize("langSettingsSearch", "Language..."),
        localize("langSettingsSearchTooltip", "Add language ID filter"),
        `@${LANGUAGE_SETTING_TAG}`,
        true
      ),
      this.createAction(
        "idSettingsSearch",
        localize("idSettingsSearch", "Setting ID..."),
        localize("idSettingsSearchTooltip", "Add Setting ID filter"),
        `@${ID_SETTING_TAG}`,
        false
      ),
      new Separator(),
      this.createToggleAction(
        "onlineSettingsSearch",
        localize("onlineSettingsSearch", "Online services"),
        localize("onlineSettingsSearchTooltip", "Show settings for online services"),
        "@tag:usesOnlineServices"
      ),
      this.createToggleAction(
        "policySettingsSearch",
        localize("policySettingsSearch", "Organization policies"),
        localize("policySettingsSearchTooltip", "Show organization policy settings"),
        `@${POLICY_SETTING_TAG}`
      ),
      new Separator(),
      this.createMutuallyExclusiveToggleAction(
        "stableSettingsSearch",
        localize("stableSettings", "Stable"),
        localize("stableSettingsSearchTooltip", "Show stable settings"),
        `@stable`,
        ["@tag:preview", "@tag:experimental"]
      ),
      this.createMutuallyExclusiveToggleAction(
        "previewSettingsSearch",
        localize("previewSettings", "Preview"),
        localize("previewSettingsSearchTooltip", "Show preview settings"),
        `@tag:preview`,
        ["@stable", "@tag:experimental"]
      ),
      this.createMutuallyExclusiveToggleAction(
        "experimentalSettingsSearch",
        localize("experimental", "Experimental"),
        localize("experimentalSettingsSearchTooltip", "Show experimental settings"),
        `@tag:experimental`,
        ["@stable", "@tag:preview"]
      ),
      new Separator(),
      this.createToggleAction(
        "advancedSettingsSearch",
        localize("advancedSettingsSearch", "Advanced"),
        localize("advancedSettingsSearchTooltip", "Show advanced settings"),
        `@tag:${ADVANCED_SETTING_TAG}`
      )
    ];
  }
};
SettingsSearchFilterDropdownMenuActionViewItem = __decorateClass([
  __decorateParam(4, IContextMenuService)
], SettingsSearchFilterDropdownMenuActionViewItem);
export {
  SettingsSearchFilterDropdownMenuActionViewItem
};
