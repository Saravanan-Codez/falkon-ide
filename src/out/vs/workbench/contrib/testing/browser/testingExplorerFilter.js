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
import * as dom from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { Delayer } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { localize } from "../../../../nls.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ContextScopedSuggestEnabledInputWithHistory } from "../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js";
import { testingFilterIcon } from "./icons.js";
import { StoredValue } from "../common/storedValue.js";
import { ITestExplorerFilterState, TestFilterTerm } from "../common/testExplorerFilterState.js";
import { ITestService } from "../common/testService.js";
import { denamespaceTestTag } from "../common/testTypes.js";
const testFilterDescriptions = {
  [TestFilterTerm.Failed]: localize("testing.filters.showOnlyFailed", "Show Only Failed Tests"),
  [TestFilterTerm.Executed]: localize("testing.filters.showOnlyExecuted", "Show Only Executed Tests"),
  [TestFilterTerm.CurrentDoc]: localize("testing.filters.currentFile", "Show in Active File Only"),
  [TestFilterTerm.OpenedFiles]: localize("testing.filters.openedFiles", "Show in Opened Files Only"),
  [TestFilterTerm.Hidden]: localize("testing.filters.showExcludedTests", "Show Hidden Tests")
};
let TestingExplorerFilter = class extends BaseActionViewItem {
  constructor(action, options, state, instantiationService, testService) {
    super(null, action, options);
    this.state = state;
    this.instantiationService = instantiationService;
    this.testService = testService;
    this.focusEmitter = this._register(new Emitter());
    this.onDidFocus = this.focusEmitter.event;
    this.filtersAction = new Action("markersFiltersAction", localize("testing.filters.menu", "More Filters..."), "testing-filter-button " + ThemeIcon.asClassName(testingFilterIcon));
    this.history = this._register(instantiationService.createInstance(StoredValue, {
      key: "testing.filterHistory2",
      scope: StorageScope.WORKSPACE,
      target: StorageTarget.MACHINE
    }));
    this.updateFilterActiveState();
    this._register(testService.excluded.onTestExclusionsChanged(this.updateFilterActiveState, this));
  }
  /**
   * @override
   */
  render(container) {
    container.classList.add("testing-filter-action-item");
    const updateDelayer = this._register(new Delayer(400));
    const wrapper = this.wrapper = dom.$(".testing-filter-wrapper");
    container.appendChild(wrapper);
    let history = this.history.get({ lastValue: "", values: [] });
    if (history instanceof Array) {
      history = { lastValue: "", values: history };
    }
    if (history.lastValue) {
      this.state.setText(history.lastValue);
    }
    const input = this.input = this._register(this.instantiationService.createInstance(ContextScopedSuggestEnabledInputWithHistory, {
      id: "testing.explorer.filter",
      ariaLabel: localize("testExplorerFilterLabel", "Filter text for tests in the explorer"),
      parent: wrapper,
      suggestionProvider: {
        triggerCharacters: ["@"],
        provideResults: () => [
          ...Object.entries(testFilterDescriptions).map(([label, detail]) => ({ label, detail })),
          ...Iterable.map(this.testService.collection.tags.values(), (tag) => {
            const { ctrlId, tagId } = denamespaceTestTag(tag.id);
            const insertText = `@${ctrlId}:${tagId}`;
            return {
              label: `@${ctrlId}:${tagId}`,
              detail: this.testService.collection.getNodeById(ctrlId)?.item.label,
              insertText: tagId.includes(" ") ? `@${ctrlId}:"${tagId.replace(/(["\\])/g, "\\$1")}"` : insertText
            };
          })
        ].filter((r) => !this.state.text.value.includes(r.label))
      },
      resourceHandle: "testing:filter",
      suggestOptions: {
        value: this.state.text.value,
        placeholderText: localize("testExplorerFilter", "Filter (e.g. text, !exclude, @tag)")
      },
      history: history.values
    }));
    this._register(this.state.text.onDidChange((newValue) => {
      if (input.getValue() !== newValue) {
        input.setValue(newValue);
      }
    }));
    this._register(this.state.onDidRequestInputFocus(() => {
      input.focus();
    }));
    this._register(input.onDidFocus(() => {
      this.focusEmitter.fire();
    }));
    this._register(input.onInputDidChange(() => updateDelayer.trigger(() => {
      input.addToHistory();
      this.state.setText(input.getValue());
    })));
    const actionbar = this._register(new ActionBar(container, {
      actionViewItemProvider: (action, options) => {
        if (action.id === this.filtersAction.id) {
          return this.instantiationService.createInstance(FiltersDropdownMenuActionViewItem, action, options, this.state, this.actionRunner);
        }
        return void 0;
      }
    }));
    actionbar.push(this.filtersAction, { icon: true, label: false });
    this.layout(this.wrapper.clientWidth);
  }
  layout(width) {
    this.input.layout(new dom.Dimension(
      width - /* horizontal padding */
      24 - /* editor padding */
      8 - /* filter button padding */
      22,
      20
      // line height from suggestEnabledInput.ts
    ));
  }
  /**
   * Focuses the filter input.
   */
  focus() {
    this.input.focus();
  }
  /**
   * Persists changes to the input history.
   */
  saveState() {
    this.history.store({ lastValue: this.input.getValue(), values: this.input.getHistory() });
  }
  /**
   * @override
   */
  dispose() {
    this.saveState();
    super.dispose();
  }
  /**
   * Updates the 'checked' state of the filter submenu.
   */
  updateFilterActiveState() {
    this.filtersAction.checked = this.testService.excluded.hasAny;
  }
};
TestingExplorerFilter = __decorateClass([
  __decorateParam(2, ITestExplorerFilterState),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITestService)
], TestingExplorerFilter);
let FiltersDropdownMenuActionViewItem = class extends DropdownMenuActionViewItem {
  constructor(action, options, filters, actionRunner, contextMenuService, testService) {
    super(
      action,
      { getActions: () => this.getActions() },
      contextMenuService,
      {
        actionRunner,
        classNames: action.class,
        anchorAlignmentProvider: () => AnchorAlignment.RIGHT,
        menuAsChild: true
      }
    );
    this.filters = filters;
    this.testService = testService;
  }
  render(container) {
    super.render(container);
    this.updateChecked();
  }
  getActions() {
    return [
      ...[TestFilterTerm.Failed, TestFilterTerm.Executed, TestFilterTerm.CurrentDoc, TestFilterTerm.OpenedFiles].map((term) => ({
        checked: this.filters.isFilteringFor(term),
        class: void 0,
        enabled: true,
        id: term,
        label: testFilterDescriptions[term],
        run: () => this.filters.toggleFilteringFor(term),
        tooltip: "",
        dispose: () => null
      })),
      new Separator(),
      {
        checked: this.filters.fuzzy.value,
        class: void 0,
        enabled: true,
        id: "fuzzy",
        label: localize("testing.filters.fuzzyMatch", "Fuzzy Match"),
        run: () => this.filters.fuzzy.value = !this.filters.fuzzy.value,
        tooltip: ""
      },
      new Separator(),
      {
        checked: this.filters.isFilteringFor(TestFilterTerm.Hidden),
        class: void 0,
        enabled: this.testService.excluded.hasAny,
        id: "showExcluded",
        label: localize("testing.filters.showExcludedTests", "Show Hidden Tests"),
        run: () => this.filters.toggleFilteringFor(TestFilterTerm.Hidden),
        tooltip: ""
      },
      {
        class: void 0,
        enabled: this.testService.excluded.hasAny,
        id: "removeExcluded",
        label: localize("testing.filters.removeTestExclusions", "Unhide All Tests"),
        run: async () => this.testService.excluded.clear(),
        tooltip: ""
      }
    ];
  }
  updateChecked() {
    this.element.classList.toggle("checked", this._action.checked);
  }
};
FiltersDropdownMenuActionViewItem = __decorateClass([
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, ITestService)
], FiltersDropdownMenuActionViewItem);
export {
  TestingExplorerFilter
};
