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
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { basenameOrAuthority, dirname } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { getSelectionKeyboardEvent } from "../../../../../platform/list/browser/listService.js";
import { PickerQuickAccessProvider, TriggerAction } from "../../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { DefaultQuickAccessFilterValue } from "../../../../../platform/quickinput/common/quickAccess.js";
import { QuickInputButtonLocation, QuickInputHideReason } from "../../../../../platform/quickinput/common/quickInput.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { searchDetailsIcon, searchOpenInFileIcon, searchActivityBarIcon } from "../searchIcons.js";
import { getEditorSelectionFromMatch } from "../searchView.js";
import { getOutOfWorkspaceEditorResources } from "../../common/search.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
import { QueryBuilder } from "../../../../services/search/common/queryBuilder.js";
import { VIEW_ID } from "../../../../services/search/common/search.js";
import { Event } from "../../../../../base/common/event.js";
import { PickerEditorState } from "../../../../browser/quickaccess.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { Sequencer } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { SearchModelImpl } from "../searchTreeModel/searchModel.js";
import { SearchModelLocation } from "../searchTreeModel/searchTreeCommon.js";
import { searchComparer } from "../searchCompare.js";
const TEXT_SEARCH_QUICK_ACCESS_PREFIX = "%";
const DEFAULT_TEXT_QUERY_BUILDER_OPTIONS = {
  _reason: "quickAccessSearch",
  disregardIgnoreFiles: false,
  disregardExcludeSettings: false,
  onlyOpenEditors: false,
  expandPatterns: true
};
const MAX_FILES_SHOWN = 30;
const MAX_RESULTS_PER_FILE = 10;
const DEBOUNCE_DELAY = 75;
let TextSearchQuickAccess = class extends PickerQuickAccessProvider {
  constructor(_instantiationService, _contextService, _editorService, _labelService, _viewsService, _configurationService) {
    super(TEXT_SEARCH_QUICK_ACCESS_PREFIX, { canAcceptInBackground: true, shouldSkipTrimPickFilter: true });
    this._instantiationService = _instantiationService;
    this._contextService = _contextService;
    this._editorService = _editorService;
    this._labelService = _labelService;
    this._viewsService = _viewsService;
    this._configurationService = _configurationService;
    this.currentAsyncSearch = Promise.resolve({
      results: [],
      messages: []
    });
    this.queryBuilder = this._instantiationService.createInstance(QueryBuilder);
    this.searchModel = this._register(this._instantiationService.createInstance(SearchModelImpl));
    this.editorViewState = this._register(this._instantiationService.createInstance(PickerEditorState));
    this.searchModel.location = SearchModelLocation.QUICK_ACCESS;
    this.editorSequencer = new Sequencer();
  }
  _getTextQueryBuilderOptions(charsPerLine) {
    return {
      ...DEFAULT_TEXT_QUERY_BUILDER_OPTIONS,
      ...{
        extraFileResources: this._instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
        maxResults: this.configuration.maxResults ?? void 0,
        isSmartCase: this.configuration.smartCase
      },
      previewOptions: {
        matchLines: 1,
        charsPerLine
      }
    };
  }
  dispose() {
    this.searchModel.dispose();
    super.dispose();
  }
  provide(picker, token, runOptions) {
    const disposables = new DisposableStore();
    if (TEXT_SEARCH_QUICK_ACCESS_PREFIX.length < picker.value.length) {
      picker.valueSelection = [TEXT_SEARCH_QUICK_ACCESS_PREFIX.length, picker.value.length];
    }
    picker.buttons = [{
      location: QuickInputButtonLocation.Inline,
      iconClass: ThemeIcon.asClassName(Codicon.goToSearch),
      tooltip: localize("goToSearch", "Open in Search View")
    }];
    this.editorViewState.reset();
    disposables.add(picker.onDidTriggerButton(async () => {
      await this.moveToSearchViewlet(void 0);
      picker.hide();
    }));
    const onDidChangeActive = () => {
      const [item] = picker.activeItems;
      if (item?.match) {
        this.editorViewState.set();
        const itemMatch = item.match;
        this.editorSequencer.queue(async () => {
          await this.editorViewState.openTransientEditor({
            resource: itemMatch.parent().resource,
            options: { preserveFocus: true, revealIfOpened: true, ignoreError: true, selection: itemMatch.range() }
          });
        });
      }
    };
    disposables.add(Event.debounce(picker.onDidChangeActive, (last, event) => event, DEBOUNCE_DELAY, true)(onDidChangeActive));
    disposables.add(Event.once(picker.onWillHide)(({ reason }) => {
      if (reason === QuickInputHideReason.Gesture) {
        this.editorViewState.restore();
      }
    }));
    disposables.add(Event.once(picker.onDidHide)(({ reason }) => {
      this.searchModel.searchResult.toggleHighlights(false);
    }));
    disposables.add(super.provide(picker, token, runOptions));
    disposables.add(picker.onDidAccept(() => this.searchModel.searchResult.toggleHighlights(false)));
    return disposables;
  }
  get configuration() {
    const editorConfig = this._configurationService.getValue().workbench?.editor;
    const searchConfig = this._configurationService.getValue().search;
    return {
      openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview,
      preserveInput: searchConfig.quickAccess.preserveInput,
      maxResults: searchConfig.maxResults,
      smartCase: searchConfig.smartCase,
      sortOrder: searchConfig.sortOrder
    };
  }
  get defaultFilterValue() {
    if (this.configuration.preserveInput) {
      return DefaultQuickAccessFilterValue.LAST;
    }
    return void 0;
  }
  doSearch(contentPattern, token) {
    if (contentPattern === "") {
      return void 0;
    }
    const folderResources = this._contextService.getWorkspace().folders;
    const content = {
      pattern: contentPattern
    };
    this.searchModel.searchResult.toggleHighlights(false);
    const charsPerLine = content.isRegExp ? 1e4 : 1e3;
    const query = this.queryBuilder.text(content, folderResources.map((folder) => folder.uri), this._getTextQueryBuilderOptions(charsPerLine));
    const result = this.searchModel.search(query, void 0, token);
    const getAsyncResults = async () => {
      this.currentAsyncSearch = result.asyncResults;
      await result.asyncResults;
      const syncResultURIs = new ResourceSet(result.syncResults.map((e) => e.resource));
      return this.searchModel.searchResult.matches(false).filter((e) => !syncResultURIs.has(e.resource));
    };
    return {
      syncResults: this.searchModel.searchResult.matches(false),
      asyncResults: getAsyncResults()
    };
  }
  async moveToSearchViewlet(currentElem) {
    this._viewsService.openView(VIEW_ID, false);
    const viewlet = this._viewsService.getActiveViewWithId(VIEW_ID);
    await viewlet.replaceSearchModel(this.searchModel, this.currentAsyncSearch);
    this.searchModel = this._instantiationService.createInstance(SearchModelImpl);
    this.searchModel.location = SearchModelLocation.QUICK_ACCESS;
    const viewer = viewlet?.getControl();
    if (currentElem && viewer && viewer.hasNode(currentElem)) {
      viewer.setFocus([currentElem], getSelectionKeyboardEvent());
      viewer.setSelection([currentElem], getSelectionKeyboardEvent());
      viewer.reveal(currentElem);
    } else {
      viewlet.searchAndReplaceWidget.focus();
    }
  }
  _getPicksFromMatches(matches, limit, firstFile) {
    matches = matches.sort((a, b) => {
      if (firstFile) {
        if (firstFile === a.resource) {
          return -1;
        } else if (firstFile === b.resource) {
          return 1;
        }
      }
      return searchComparer(a, b, this.configuration.sortOrder);
    });
    const files = matches.length > limit ? matches.slice(0, limit) : matches;
    const picks = [];
    for (let fileIndex = 0; fileIndex < matches.length; fileIndex++) {
      if (fileIndex === limit) {
        picks.push({
          type: "separator"
        });
        picks.push({
          label: localize("QuickSearchSeeMoreFiles", "See More Files"),
          iconClass: ThemeIcon.asClassName(searchDetailsIcon),
          accept: async () => {
            await this.moveToSearchViewlet(matches[limit]);
          }
        });
        break;
      }
      const iFileInstanceMatch = files[fileIndex];
      const label = basenameOrAuthority(iFileInstanceMatch.resource);
      const description = this._labelService.getUriLabel(dirname(iFileInstanceMatch.resource), { relative: true });
      picks.push({
        label,
        type: "separator",
        description,
        buttons: [{
          iconClass: ThemeIcon.asClassName(searchOpenInFileIcon),
          tooltip: localize("QuickSearchOpenInFile", "Open File")
        }],
        trigger: async () => {
          await this.handleAccept(iFileInstanceMatch, {});
          return TriggerAction.CLOSE_PICKER;
        }
      });
      const results = iFileInstanceMatch.matches() ?? [];
      for (let matchIndex = 0; matchIndex < results.length; matchIndex++) {
        const element = results[matchIndex];
        if (matchIndex === MAX_RESULTS_PER_FILE) {
          picks.push({
            label: localize("QuickSearchMore", "More"),
            iconClass: ThemeIcon.asClassName(searchDetailsIcon),
            accept: async () => {
              await this.moveToSearchViewlet(element);
            }
          });
          break;
        }
        const preview = element.preview();
        const previewText = (preview.before + preview.inside + preview.after).trim().substring(0, 999);
        const match = [{
          start: preview.before.length,
          end: preview.before.length + preview.inside.length
        }];
        picks.push({
          label: `${previewText}`,
          highlights: {
            label: match
          },
          buttons: [{
            iconClass: ThemeIcon.asClassName(searchActivityBarIcon),
            tooltip: localize("showMore", "Open in Search View")
          }],
          ariaLabel: `Match at location ${element.range().startLineNumber}:${element.range().startColumn} - ${previewText}`,
          accept: async (keyMods, event) => {
            await this.handleAccept(iFileInstanceMatch, {
              keyMods,
              selection: getEditorSelectionFromMatch(element, this.searchModel),
              preserveFocus: event.inBackground,
              forcePinned: event.inBackground
            });
          },
          trigger: async () => {
            await this.moveToSearchViewlet(element);
            return TriggerAction.CLOSE_PICKER;
          },
          match: element
        });
      }
    }
    return picks;
  }
  async handleAccept(iFileInstanceMatch, options) {
    const editorOptions = {
      preserveFocus: options.preserveFocus,
      pinned: options.keyMods?.ctrlCmd || options.forcePinned || this.configuration.openEditorPinned,
      selection: options.selection
    };
    const targetGroup = options.keyMods?.alt || this.configuration.openEditorPinned && options.keyMods?.ctrlCmd || options.forceOpenSideBySide ? SIDE_GROUP : ACTIVE_GROUP;
    await this._editorService.openEditor({
      resource: iFileInstanceMatch.resource,
      options: editorOptions
    }, targetGroup);
  }
  _getPicks(contentPattern, disposables, token) {
    const searchModelAtTimeOfSearch = this.searchModel;
    if (contentPattern === "") {
      this.searchModel.searchResult.clear();
      return [{
        label: localize("enterSearchTerm", "Enter a term to search for across your files.")
      }];
    }
    const conditionalTokenCts = disposables.add(new CancellationTokenSource());
    disposables.add(token.onCancellationRequested(() => {
      if (searchModelAtTimeOfSearch.location === SearchModelLocation.QUICK_ACCESS) {
        conditionalTokenCts.cancel();
      }
    }));
    const allMatches = this.doSearch(contentPattern, conditionalTokenCts.token);
    if (!allMatches) {
      return null;
    }
    const matches = allMatches.syncResults;
    const syncResult = this._getPicksFromMatches(matches, MAX_FILES_SHOWN, this._editorService.activeEditor?.resource);
    if (syncResult.length > 0) {
      this.searchModel.searchResult.toggleHighlights(true);
    }
    if (matches.length >= MAX_FILES_SHOWN) {
      return syncResult;
    }
    return {
      picks: syncResult,
      additionalPicks: allMatches.asyncResults.then((asyncResults) => asyncResults.length + syncResult.length === 0 ? [{
        label: localize("noAnythingResults", "No matching results")
      }] : this._getPicksFromMatches(asyncResults, MAX_FILES_SHOWN - matches.length)).then((picks) => {
        if (picks.length > 0) {
          this.searchModel.searchResult.toggleHighlights(true);
        }
        return picks;
      })
    };
  }
};
TextSearchQuickAccess = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IViewsService),
  __decorateParam(5, IConfigurationService)
], TextSearchQuickAccess);
export {
  TEXT_SEARCH_QUICK_ACCESS_PREFIX,
  TextSearchQuickAccess
};
