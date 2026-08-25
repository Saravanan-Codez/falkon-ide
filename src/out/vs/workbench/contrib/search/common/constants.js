import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
var SearchCommandIds = /* @__PURE__ */ ((SearchCommandIds2) => {
  SearchCommandIds2["FindInFilesActionId"] = "workbench.action.findInFiles";
  SearchCommandIds2["FocusActiveEditorCommandId"] = "search.action.focusActiveEditor";
  SearchCommandIds2["FocusSearchFromResults"] = "search.action.focusSearchFromResults";
  SearchCommandIds2["OpenMatch"] = "search.action.openResult";
  SearchCommandIds2["OpenMatchToSide"] = "search.action.openResultToSide";
  SearchCommandIds2["RemoveActionId"] = "search.action.remove";
  SearchCommandIds2["CopyPathCommandId"] = "search.action.copyPath";
  SearchCommandIds2["CopyMatchCommandId"] = "search.action.copyMatch";
  SearchCommandIds2["CopyAllCommandId"] = "search.action.copyAll";
  SearchCommandIds2["OpenInEditorCommandId"] = "search.action.openInEditor";
  SearchCommandIds2["ClearSearchHistoryCommandId"] = "search.action.clearHistory";
  SearchCommandIds2["FocusSearchListCommandID"] = "search.action.focusSearchList";
  SearchCommandIds2["ReplaceActionId"] = "search.action.replace";
  SearchCommandIds2["ReplaceAllInFileActionId"] = "search.action.replaceAllInFile";
  SearchCommandIds2["ReplaceAllInFolderActionId"] = "search.action.replaceAllInFolder";
  SearchCommandIds2["CloseReplaceWidgetActionId"] = "closeReplaceInFilesWidget";
  SearchCommandIds2["ToggleCaseSensitiveCommandId"] = "toggleSearchCaseSensitive";
  SearchCommandIds2["ToggleWholeWordCommandId"] = "toggleSearchWholeWord";
  SearchCommandIds2["ToggleRegexCommandId"] = "toggleSearchRegex";
  SearchCommandIds2["TogglePreserveCaseId"] = "toggleSearchPreserveCase";
  SearchCommandIds2["AddCursorsAtSearchResults"] = "addCursorsAtSearchResults";
  SearchCommandIds2["RevealInSideBarForSearchResults"] = "search.action.revealInSideBar";
  SearchCommandIds2["ReplaceInFilesActionId"] = "workbench.action.replaceInFiles";
  SearchCommandIds2["ShowAllSymbolsActionId"] = "workbench.action.showAllSymbols";
  SearchCommandIds2["QuickTextSearchActionId"] = "workbench.action.quickTextSearch";
  SearchCommandIds2["CancelSearchActionId"] = "search.action.cancel";
  SearchCommandIds2["RefreshSearchResultsActionId"] = "search.action.refreshSearchResults";
  SearchCommandIds2["FocusNextSearchResultActionId"] = "search.action.focusNextSearchResult";
  SearchCommandIds2["FocusPreviousSearchResultActionId"] = "search.action.focusPreviousSearchResult";
  SearchCommandIds2["ToggleSearchOnTypeActionId"] = "workbench.action.toggleSearchOnType";
  SearchCommandIds2["CollapseSearchResultsActionId"] = "search.action.collapseSearchResults";
  SearchCommandIds2["ExpandSearchResultsActionId"] = "search.action.expandSearchResults";
  SearchCommandIds2["ExpandRecursivelyCommandId"] = "search.action.expandRecursively";
  SearchCommandIds2["ClearSearchResultsActionId"] = "search.action.clearSearchResults";
  SearchCommandIds2["GetSearchResultsActionId"] = "search.action.getSearchResults";
  SearchCommandIds2["ViewAsTreeActionId"] = "search.action.viewAsTree";
  SearchCommandIds2["ViewAsListActionId"] = "search.action.viewAsList";
  SearchCommandIds2["ShowAIResultsActionId"] = "search.action.showAIResults";
  SearchCommandIds2["HideAIResultsActionId"] = "search.action.hideAIResults";
  SearchCommandIds2["SearchWithAIActionId"] = "search.action.searchWithAI";
  SearchCommandIds2["ToggleQueryDetailsActionId"] = "workbench.action.search.toggleQueryDetails";
  SearchCommandIds2["ExcludeFolderFromSearchId"] = "search.action.excludeFromSearch";
  SearchCommandIds2["ExcludeFileTypeFromSearchId"] = "search.action.excludeFileTypeFromSearch";
  SearchCommandIds2["IncludeFileTypeInSearchId"] = "search.action.includeFileTypeInSearch";
  SearchCommandIds2["FocusNextInputActionId"] = "search.focus.nextInputBox";
  SearchCommandIds2["FocusPreviousInputActionId"] = "search.focus.previousInputBox";
  SearchCommandIds2["RestrictSearchToFolderId"] = "search.action.restrictSearchToFolder";
  SearchCommandIds2["FindInFolderId"] = "filesExplorer.findInFolder";
  SearchCommandIds2["FindInWorkspaceId"] = "filesExplorer.findInWorkspace";
  return SearchCommandIds2;
})(SearchCommandIds || {});
const SearchContext = {
  SearchViewVisibleKey: new RawContextKey("searchViewletVisible", true),
  SearchViewFocusedKey: new RawContextKey("searchViewletFocus", false),
  SearchResultListFocusedKey: new RawContextKey("searchResultListFocused", true),
  InputBoxFocusedKey: new RawContextKey("inputBoxFocus", false),
  SearchInputBoxFocusedKey: new RawContextKey("searchInputBoxFocus", false),
  ReplaceInputBoxFocusedKey: new RawContextKey("replaceInputBoxFocus", false),
  PatternIncludesFocusedKey: new RawContextKey("patternIncludesInputBoxFocus", false),
  PatternExcludesFocusedKey: new RawContextKey("patternExcludesInputBoxFocus", false),
  ReplaceActiveKey: new RawContextKey("replaceActive", false),
  HasSearchResults: new RawContextKey("hasSearchResult", false),
  FirstMatchFocusKey: new RawContextKey("firstMatchFocus", false),
  FileMatchOrMatchFocusKey: new RawContextKey("fileMatchOrMatchFocus", false),
  // This is actually, Match or File or Folder
  FileMatchOrFolderMatchFocusKey: new RawContextKey("fileMatchOrFolderMatchFocus", false),
  FileMatchOrFolderMatchWithResourceFocusKey: new RawContextKey("fileMatchOrFolderMatchWithResourceFocus", false),
  // Excludes "Other files"
  FileFocusKey: new RawContextKey("fileMatchFocus", false),
  FolderFocusKey: new RawContextKey("folderMatchFocus", false),
  ResourceFolderFocusKey: new RawContextKey("folderMatchWithResourceFocus", false),
  IsEditableItemKey: new RawContextKey("isEditableItem", true),
  MatchFocusKey: new RawContextKey("matchFocus", false),
  SearchResultHeaderFocused: new RawContextKey("searchResultHeaderFocused", false),
  ViewHasSearchPatternKey: new RawContextKey("viewHasSearchPattern", false),
  ViewHasReplacePatternKey: new RawContextKey("viewHasReplacePattern", false),
  ViewHasFilePatternKey: new RawContextKey("viewHasFilePattern", false),
  ViewHasSomeCollapsibleKey: new RawContextKey("viewHasSomeCollapsibleResult", false),
  InTreeViewKey: new RawContextKey("inTreeView", false),
  hasAIResultProvider: new RawContextKey("hasAIResultProviderKey", false),
  AIResultsTitle: new RawContextKey("aiResultsTitle", false),
  AIResultsRequested: new RawContextKey("aiResultsRequested", false)
};
export {
  SearchCommandIds,
  SearchContext
};
