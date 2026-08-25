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
import * as DOM from "../../../../base/browser/dom.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as paths from "../../../../base/common/path.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { FileKind } from "../../../../platform/files/common/files.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { isEqual } from "../../../../base/common/resources.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { HiddenItemStrategy, MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { SearchContext } from "../common/constants.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { isSearchTreeMatch, isSearchTreeFileMatch, isSearchTreeFolderMatch, isTextSearchHeading, isSearchTreeFolderMatchWorkspaceRoot, isSearchTreeFolderMatchNoRoot, isPlainTextSearchHeading } from "./searchTreeModel/searchTreeCommon.js";
import { isSearchTreeAIFileMatch } from "./AISearch/aiSearchModelBase.js";
class SearchDelegate {
  static {
    this.ITEM_HEIGHT = 22;
  }
  getHeight(element) {
    return SearchDelegate.ITEM_HEIGHT;
  }
  getTemplateId(element) {
    if (isSearchTreeFolderMatch(element)) {
      return FolderMatchRenderer.TEMPLATE_ID;
    } else if (isSearchTreeFileMatch(element)) {
      return FileMatchRenderer.TEMPLATE_ID;
    } else if (isSearchTreeMatch(element)) {
      return MatchRenderer.TEMPLATE_ID;
    } else if (isTextSearchHeading(element)) {
      return TextSearchResultRenderer.TEMPLATE_ID;
    }
    console.error("Invalid search tree element", element);
    throw new Error("Invalid search tree element");
  }
}
let TextSearchResultRenderer = class extends Disposable {
  constructor(labels, contextService, instantiationService, contextKeyService) {
    super();
    this.labels = labels;
    this.contextService = contextService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = TextSearchResultRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "textResultMatch";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const textSearchResultElement = DOM.append(container, DOM.$(".textsearchresult"));
    const label = this.labels.create(textSearchResultElement, { supportDescriptionHighlights: true, supportHighlights: true, supportIcons: true });
    disposables.add(label);
    const actionBarContainer = DOM.append(textSearchResultElement, DOM.$(".actionBarContainer"));
    const contextKeyServiceMain = disposables.add(this.contextKeyService.createScoped(container));
    const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyServiceMain])));
    const actions = disposables.add(instantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.SearchActionMenu, {
      menuOptions: {
        shouldForwardArgs: true
      },
      highlightToggledItems: true,
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: (g) => /^inline/.test(g)
      }
    }));
    return { label, disposables, actions, contextKeyService: contextKeyServiceMain };
  }
  async renderElement(node, index, templateData) {
    if (isPlainTextSearchHeading(node.element)) {
      templateData.label.setLabel(nls.localize("searchFolderMatch.plainText.label", "Text Results"));
      SearchContext.AIResultsTitle.bindTo(templateData.contextKeyService).set(false);
      SearchContext.MatchFocusKey.bindTo(templateData.contextKeyService).set(false);
      SearchContext.FileFocusKey.bindTo(templateData.contextKeyService).set(false);
      SearchContext.FolderFocusKey.bindTo(templateData.contextKeyService).set(false);
    } else {
      try {
        await node.element.parent().searchModel.getAITextResultProviderName();
      } catch {
      }
      const localizedLabel = nls.localize({
        key: "searchFolderMatch.aiText.label",
        comment: ['This is displayed before the AI text search results, now always "AI-assisted results".']
      }, "AI-assisted results");
      templateData.label.setLabel(`$(${Codicon.searchSparkle.id}) ${localizedLabel}`);
      SearchContext.AIResultsTitle.bindTo(templateData.contextKeyService).set(true);
      SearchContext.MatchFocusKey.bindTo(templateData.contextKeyService).set(false);
      SearchContext.FileFocusKey.bindTo(templateData.contextKeyService).set(false);
      SearchContext.FolderFocusKey.bindTo(templateData.contextKeyService).set(false);
    }
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
  renderCompressedElements(node, index, templateData) {
  }
};
TextSearchResultRenderer = __decorateClass([
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService)
], TextSearchResultRenderer);
let FolderMatchRenderer = class extends Disposable {
  constructor(searchView, labels, contextService, labelService, instantiationService, contextKeyService) {
    super();
    this.searchView = searchView;
    this.labels = labels;
    this.contextService = contextService;
    this.labelService = labelService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = FolderMatchRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "folderMatch";
  }
  renderCompressedElements(node, index, templateData) {
    const compressed = node.element;
    const folder = compressed.elements[compressed.elements.length - 1];
    const label = compressed.elements.map((e) => e.name());
    if (folder.resource) {
      const fileKind = isSearchTreeFolderMatchWorkspaceRoot(folder) ? FileKind.ROOT_FOLDER : FileKind.FOLDER;
      templateData.label.setResource({ resource: folder.resource, name: label }, {
        fileKind,
        separator: this.labelService.getSeparator(folder.resource.scheme)
      });
    } else {
      templateData.label.setLabel(nls.localize("searchFolderMatch.other.label", "Other files"));
    }
    this.renderFolderDetails(folder, templateData);
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const folderMatchElement = DOM.append(container, DOM.$(".foldermatch"));
    const label = this.labels.create(folderMatchElement, { supportDescriptionHighlights: true, supportHighlights: true });
    disposables.add(label);
    const badge = new CountBadge(DOM.append(folderMatchElement, DOM.$(".badge")), {}, defaultCountBadgeStyles);
    disposables.add(badge);
    const actionBarContainer = DOM.append(folderMatchElement, DOM.$(".actionBarContainer"));
    const elementDisposables = new DisposableStore();
    disposables.add(elementDisposables);
    const contextKeyServiceMain = disposables.add(this.contextKeyService.createScoped(container));
    SearchContext.AIResultsTitle.bindTo(contextKeyServiceMain).set(false);
    SearchContext.MatchFocusKey.bindTo(contextKeyServiceMain).set(false);
    SearchContext.FileFocusKey.bindTo(contextKeyServiceMain).set(false);
    SearchContext.FolderFocusKey.bindTo(contextKeyServiceMain).set(true);
    const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyServiceMain])));
    const actions = disposables.add(instantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.SearchActionMenu, {
      menuOptions: {
        shouldForwardArgs: true
      },
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: (g) => /^inline/.test(g)
      }
    }));
    return {
      label,
      badge,
      actions,
      disposables,
      elementDisposables,
      contextKeyService: contextKeyServiceMain
    };
  }
  renderElement(node, index, templateData) {
    const folderMatch = node.element;
    if (folderMatch.resource) {
      const workspaceFolder = this.contextService.getWorkspaceFolder(folderMatch.resource);
      if (workspaceFolder && isEqual(workspaceFolder.uri, folderMatch.resource)) {
        templateData.label.setFile(folderMatch.resource, { fileKind: FileKind.ROOT_FOLDER, hidePath: true });
      } else {
        templateData.label.setFile(folderMatch.resource, { fileKind: FileKind.FOLDER, hidePath: this.searchView.isTreeLayoutViewVisible });
      }
    } else {
      templateData.label.setLabel(nls.localize("searchFolderMatch.other.label", "Other files"));
    }
    SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!folderMatch.hasOnlyReadOnlyMatches());
    templateData.elementDisposables.add(folderMatch.onChange(() => {
      SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!folderMatch.hasOnlyReadOnlyMatches());
    }));
    this.renderFolderDetails(folderMatch, templateData);
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
  renderFolderDetails(folder, templateData) {
    const count = folder.recursiveMatchCount();
    templateData.badge.setCount(count);
    templateData.badge.setTitleFormat(count > 1 ? nls.localize("searchFileMatches", "{0} files found", count) : nls.localize("searchFileMatch", "{0} file found", count));
    templateData.actions.context = { viewer: this.searchView.getControl(), element: folder };
  }
};
FolderMatchRenderer = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService)
], FolderMatchRenderer);
let FileMatchRenderer = class extends Disposable {
  constructor(searchView, labels, contextService, configurationService, instantiationService, contextKeyService) {
    super();
    this.searchView = searchView;
    this.labels = labels;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.templateId = FileMatchRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "fileMatch";
  }
  renderCompressedElements(node, index, templateData) {
    throw new Error("Should never happen since node is incompressible.");
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    disposables.add(elementDisposables);
    const fileMatchElement = DOM.append(container, DOM.$(".filematch"));
    const label = this.labels.create(fileMatchElement);
    disposables.add(label);
    const badge = new CountBadge(DOM.append(fileMatchElement, DOM.$(".badge")), {}, defaultCountBadgeStyles);
    disposables.add(badge);
    const actionBarContainer = DOM.append(fileMatchElement, DOM.$(".actionBarContainer"));
    const contextKeyServiceMain = disposables.add(this.contextKeyService.createScoped(container));
    SearchContext.AIResultsTitle.bindTo(contextKeyServiceMain).set(false);
    SearchContext.MatchFocusKey.bindTo(contextKeyServiceMain).set(false);
    SearchContext.FileFocusKey.bindTo(contextKeyServiceMain).set(true);
    SearchContext.FolderFocusKey.bindTo(contextKeyServiceMain).set(false);
    const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyServiceMain])));
    const actions = disposables.add(instantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.SearchActionMenu, {
      menuOptions: {
        shouldForwardArgs: true
      },
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: (g) => /^inline/.test(g)
      }
    }));
    return {
      el: fileMatchElement,
      label,
      badge,
      actions,
      disposables,
      elementDisposables,
      contextKeyService: contextKeyServiceMain
    };
  }
  renderElement(node, index, templateData) {
    const fileMatch = node.element;
    templateData.el.setAttribute("data-resource", fileMatch.resource.toString());
    const decorationConfig = this.configurationService.getValue("search").decorations;
    templateData.label.setFile(fileMatch.resource, { range: isSearchTreeAIFileMatch(fileMatch) ? fileMatch.getFullRange() : void 0, hidePath: this.searchView.isTreeLayoutViewVisible && !isSearchTreeFolderMatchNoRoot(fileMatch.parent()), hideIcon: false, fileDecorations: { colors: decorationConfig.colors, badges: decorationConfig.badges } });
    const count = fileMatch.count();
    templateData.badge.setCount(count);
    templateData.badge.setTitleFormat(count > 1 ? nls.localize("searchMatches", "{0} matches found", count) : nls.localize("searchMatch", "{0} match found", count));
    templateData.actions.context = { viewer: this.searchView.getControl(), element: fileMatch };
    SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!fileMatch.hasOnlyReadOnlyMatches());
    templateData.elementDisposables.add(fileMatch.onChange(() => {
      SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!fileMatch.hasOnlyReadOnlyMatches());
    }));
    const twistieContainer = templateData.el.parentElement?.parentElement?.querySelector(".monaco-tl-twistie");
    twistieContainer?.classList.add("force-twistie");
  }
  disposeElement(element, index, templateData) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
FileMatchRenderer = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IContextKeyService)
], FileMatchRenderer);
let MatchRenderer = class extends Disposable {
  constructor(searchView, contextService, configurationService, instantiationService, contextKeyService, hoverService) {
    super();
    this.searchView = searchView;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.hoverService = hoverService;
    this.templateId = MatchRenderer.TEMPLATE_ID;
  }
  static {
    this.TEMPLATE_ID = "match";
  }
  renderCompressedElements(node, index, templateData) {
    throw new Error("Should never happen since node is incompressible.");
  }
  renderTemplate(container) {
    container.classList.add("linematch");
    const lineNumber = DOM.append(container, DOM.$("span.matchLineNum"));
    const parent = DOM.append(container, DOM.$("a.plain.match"));
    const before = DOM.append(parent, DOM.$("span"));
    const match = DOM.append(parent, DOM.$("span.findInFileMatch"));
    const replace = DOM.append(parent, DOM.$("span.replaceMatch"));
    const after = DOM.append(parent, DOM.$("span"));
    const actionBarContainer = DOM.append(container, DOM.$("span.actionBarContainer"));
    const disposables = new DisposableStore();
    const contextKeyServiceMain = disposables.add(this.contextKeyService.createScoped(container));
    SearchContext.AIResultsTitle.bindTo(contextKeyServiceMain).set(false);
    SearchContext.MatchFocusKey.bindTo(contextKeyServiceMain).set(true);
    SearchContext.FileFocusKey.bindTo(contextKeyServiceMain).set(false);
    SearchContext.FolderFocusKey.bindTo(contextKeyServiceMain).set(false);
    const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyServiceMain])));
    const actions = disposables.add(instantiationService.createInstance(MenuWorkbenchToolBar, actionBarContainer, MenuId.SearchActionMenu, {
      menuOptions: {
        shouldForwardArgs: true
      },
      hiddenItemStrategy: HiddenItemStrategy.Ignore,
      toolbarOptions: {
        primaryGroup: (g) => /^inline/.test(g)
      }
    }));
    const parentHover = disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), parent, ""));
    const lineNumberHover = disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), lineNumber, ""));
    return {
      parent,
      before,
      match,
      replace,
      after,
      lineNumber,
      actions,
      parentHover,
      lineNumberHover,
      disposables,
      contextKeyService: contextKeyServiceMain
    };
  }
  renderElement(node, index, templateData) {
    const match = node.element;
    const preview = match.preview();
    const replace = this.searchView.model.isReplaceActive() && !!this.searchView.model.replaceString && !match.isReadonly;
    templateData.before.textContent = preview.before;
    templateData.match.textContent = preview.inside;
    templateData.match.classList.toggle("replace", replace);
    templateData.replace.textContent = replace ? match.replaceString : "";
    templateData.after.textContent = preview.after;
    const title = (preview.fullBefore + (replace ? match.replaceString : preview.inside) + preview.after).trim().substr(0, 999);
    templateData.parentHover.update(title);
    SearchContext.IsEditableItemKey.bindTo(templateData.contextKeyService).set(!match.isReadonly);
    const numLines = match.range().endLineNumber - match.range().startLineNumber;
    const extraLinesStr = numLines > 0 ? `+${numLines}` : "";
    const showLineNumbers = this.configurationService.getValue("search").showLineNumbers;
    const lineNumberStr = showLineNumbers ? `${match.range().startLineNumber}:` : "";
    templateData.lineNumber.classList.toggle("show", numLines > 0 || showLineNumbers);
    templateData.lineNumber.textContent = lineNumberStr + extraLinesStr;
    templateData.lineNumberHover.update(this.getMatchTitle(match, showLineNumbers));
    templateData.actions.context = { viewer: this.searchView.getControl(), element: match };
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
  getMatchTitle(match, showLineNumbers) {
    const startLine = match.range().startLineNumber;
    const numLines = match.range().endLineNumber - match.range().startLineNumber;
    const lineNumStr = showLineNumbers ? nls.localize("lineNumStr", "From line {0}", startLine, numLines) + " " : "";
    const numLinesStr = numLines > 0 ? "+ " + nls.localize("numLinesStr", "{0} more lines", numLines) : "";
    return lineNumStr + numLinesStr;
  }
};
MatchRenderer = __decorateClass([
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IHoverService)
], MatchRenderer);
let SearchAccessibilityProvider = class {
  constructor(searchView, labelService) {
    this.searchView = searchView;
    this.labelService = labelService;
  }
  getWidgetAriaLabel() {
    return nls.localize("search", "Search");
  }
  getAriaLabel(element) {
    if (isSearchTreeFolderMatch(element)) {
      const count = element.allDownstreamFileMatches().reduce((total, current) => total + current.count(), 0);
      return element.resource ? nls.localize("folderMatchAriaLabel", "{0} matches in folder root {1}, Search result", count, element.name()) : nls.localize("otherFilesAriaLabel", "{0} matches outside of the workspace, Search result", count);
    }
    if (isSearchTreeFileMatch(element)) {
      const path = this.labelService.getUriLabel(element.resource, { relative: true }) || element.resource.fsPath;
      return nls.localize("fileMatchAriaLabel", "{0} matches in file {1} of folder {2}, Search result", element.count(), element.name(), paths.dirname(path));
    }
    if (isSearchTreeMatch(element)) {
      const match = element;
      const searchModel = this.searchView.model;
      const replace = searchModel.isReplaceActive() && !!searchModel.replaceString;
      const matchString = match.getMatchString();
      const range = match.range();
      const matchText = match.text().substr(0, range.endColumn + 150);
      if (replace) {
        return nls.localize("replacePreviewResultAria", "'{0}' at column {1} replace {2} with {3}", matchText, range.startColumn, matchString, match.replaceString);
      }
      return nls.localize("searchResultAria", "'{0}' at column {1} found {2}", matchText, range.startColumn, matchString);
    }
    return null;
  }
};
SearchAccessibilityProvider = __decorateClass([
  __decorateParam(1, ILabelService)
], SearchAccessibilityProvider);
export {
  FileMatchRenderer,
  FolderMatchRenderer,
  MatchRenderer,
  SearchAccessibilityProvider,
  SearchDelegate,
  TextSearchResultRenderer
};
