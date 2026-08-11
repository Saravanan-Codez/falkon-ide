import * as DOM from "../../../../base/browser/dom.js";
import * as nls from "../../../../nls.js";
import * as SearchEditorConstants from "../../searchEditor/browser/constants.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { VIEW_ID } from "../../../services/search/common/search.js";
import { isSearchTreeMatch, isSearchTreeFileMatch, isSearchTreeFolderMatch } from "./searchTreeModel/searchTreeCommon.js";
import { searchComparer } from "./searchCompare.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { Schemas } from "../../../../base/common/network.js";
const category = nls.localize2("search", "Search");
function isSearchViewFocused(viewsService) {
  const searchView = getSearchView(viewsService);
  return !!(searchView && DOM.isAncestorOfActiveElement(searchView.getContainer()));
}
function getSearchView(viewsService) {
  return viewsService.getActiveViewWithId(VIEW_ID);
}
function getElementsToOperateOn(viewer, currElement, sortConfig) {
  let elements = viewer.getSelection().filter((x) => x !== null).sort((a, b) => searchComparer(a, b, sortConfig?.sortOrder));
  if (currElement && !(elements.length > 1 && elements.includes(currElement))) {
    elements = [currElement];
  }
  return elements;
}
function shouldRefocus(elements, focusElement) {
  if (!focusElement) {
    return false;
  }
  return !focusElement || elements.includes(focusElement) || hasDownstreamMatch(elements, focusElement);
}
function hasDownstreamMatch(elements, focusElement) {
  for (const elem of elements) {
    if (isSearchTreeFileMatch(elem) && isSearchTreeMatch(focusElement) && elem.matches().includes(focusElement) || isSearchTreeFolderMatch(elem) && (isSearchTreeFileMatch(focusElement) && elem.getDownstreamFileMatch(focusElement.resource) || isSearchTreeMatch(focusElement) && elem.getDownstreamFileMatch(focusElement.parent().resource))) {
      return true;
    }
  }
  return false;
}
function openSearchView(viewsService, focus) {
  return viewsService.openView(VIEW_ID, focus).then((view) => view ?? void 0);
}
async function findInFilesCommand(accessor, _args = {}) {
  const searchConfig = accessor.get(IConfigurationService).getValue().search;
  const viewsService = accessor.get(IViewsService);
  const commandService = accessor.get(ICommandService);
  const args = {};
  if (Object.keys(_args).length !== 0) {
    const configurationResolverService = accessor.get(IConfigurationResolverService);
    const historyService = accessor.get(IHistoryService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const activeWorkspaceRootUri = historyService.getLastActiveWorkspaceRoot();
    const filteredActiveWorkspaceRootUri = activeWorkspaceRootUri?.scheme === Schemas.file || activeWorkspaceRootUri?.scheme === Schemas.vscodeRemote ? activeWorkspaceRootUri : void 0;
    const lastActiveWorkspaceRoot = filteredActiveWorkspaceRootUri ? workspaceContextService.getWorkspaceFolder(filteredActiveWorkspaceRootUri) ?? void 0 : void 0;
    for (const entry of Object.entries(_args)) {
      const name = entry[0];
      const value = entry[1];
      if (value !== void 0) {
        args[name] = typeof value === "string" ? await configurationResolverService.resolveAsync(lastActiveWorkspaceRoot, value) : value;
      }
    }
  }
  const mode = searchConfig?.mode;
  if (mode === "view") {
    openSearchView(viewsService, false).then((openedView) => {
      if (openedView) {
        const searchAndReplaceWidget = openedView.searchAndReplaceWidget;
        searchAndReplaceWidget.toggleReplace(typeof args.replace === "string");
        let updatedText = false;
        if (typeof args.query !== "string") {
          updatedText = openedView.updateTextFromFindWidgetOrSelection({ allowUnselectedWord: typeof args.replace !== "string" });
        }
        openedView.setSearchParameters(args);
        if (typeof args.showIncludesExcludes === "boolean") {
          openedView.toggleQueryDetails(false, args.showIncludesExcludes);
        }
        openedView.searchAndReplaceWidget.focus(void 0, updatedText, updatedText);
      }
    });
  } else {
    const convertArgs = (args2) => ({
      location: mode === "newEditor" ? "new" : "reuse",
      query: args2.query,
      filesToInclude: args2.filesToInclude,
      filesToExclude: args2.filesToExclude,
      matchWholeWord: args2.matchWholeWord,
      isCaseSensitive: args2.isCaseSensitive,
      isRegexp: args2.isRegex,
      useExcludeSettingsAndIgnoreFiles: args2.useExcludeSettingsAndIgnoreFiles,
      onlyOpenEditors: args2.onlyOpenEditors,
      showIncludesExcludes: !!(args2.filesToExclude || args2.filesToExclude || !args2.useExcludeSettingsAndIgnoreFiles)
    });
    commandService.executeCommand(SearchEditorConstants.OpenEditorCommandId, convertArgs(args));
  }
}
export {
  category,
  findInFilesCommand,
  getElementsToOperateOn,
  getSearchView,
  isSearchViewFocused,
  openSearchView,
  shouldRefocus
};
