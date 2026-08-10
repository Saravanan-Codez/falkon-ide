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
import { localize } from "../../../../nls.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ITimelineService } from "../../timeline/common/timeline.js";
import { IWorkingCopyHistoryService } from "../../../services/workingCopy/common/workingCopyHistory.js";
import { URI } from "../../../../base/common/uri.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { API_OPEN_DIFF_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { LocalHistoryFileSystemProvider } from "./localHistoryFileSystemProvider.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { SaveSourceRegistry } from "../../../common/editor.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { COMPARE_WITH_FILE_LABEL, toDiffEditorArguments } from "./localHistoryCommands.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { getLocalHistoryDateFormatter, LOCAL_HISTORY_ICON_ENTRY, LOCAL_HISTORY_MENU_CONTEXT_VALUE } from "./localHistory.js";
import { Schemas } from "../../../../base/common/network.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { getVirtualWorkspaceAuthority } from "../../../../platform/workspace/common/virtualWorkspace.js";
let LocalHistoryTimeline = class extends Disposable {
  constructor(timelineService, workingCopyHistoryService, pathService, fileService, environmentService, configurationService, contextService) {
    super();
    this.timelineService = timelineService;
    this.workingCopyHistoryService = workingCopyHistoryService;
    this.pathService = pathService;
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.id = "timeline.localHistory";
    this.label = localize("localHistory", "Local History");
    this.scheme = "*";
    // we try to show local history for all schemes if possible
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.timelineProviderDisposable = this._register(new MutableDisposable());
    this.registerComponents();
    this.registerListeners();
  }
  static {
    this.ID = "workbench.contrib.localHistoryTimeline";
  }
  static {
    this.LOCAL_HISTORY_ENABLED_SETTINGS_KEY = "workbench.localHistory.enabled";
  }
  registerComponents() {
    this.updateTimelineRegistration();
    this._register(this.fileService.registerProvider(LocalHistoryFileSystemProvider.SCHEMA, new LocalHistoryFileSystemProvider(this.fileService)));
  }
  updateTimelineRegistration() {
    if (this.configurationService.getValue(LocalHistoryTimeline.LOCAL_HISTORY_ENABLED_SETTINGS_KEY)) {
      this.timelineProviderDisposable.value = this.timelineService.registerTimelineProvider(this);
    } else {
      this.timelineProviderDisposable.clear();
    }
  }
  registerListeners() {
    this._register(this.workingCopyHistoryService.onDidAddEntry((e) => this.onDidChangeWorkingCopyHistoryEntry(e.entry)));
    this._register(this.workingCopyHistoryService.onDidChangeEntry((e) => this.onDidChangeWorkingCopyHistoryEntry(e.entry)));
    this._register(this.workingCopyHistoryService.onDidReplaceEntry((e) => this.onDidChangeWorkingCopyHistoryEntry(e.entry)));
    this._register(this.workingCopyHistoryService.onDidRemoveEntry((e) => this.onDidChangeWorkingCopyHistoryEntry(e.entry)));
    this._register(this.workingCopyHistoryService.onDidRemoveEntries(() => this.onDidChangeWorkingCopyHistoryEntry(
      void 0
      /* all entries */
    )));
    this._register(this.workingCopyHistoryService.onDidMoveEntries(() => this.onDidChangeWorkingCopyHistoryEntry(
      void 0
      /* all entries */
    )));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(LocalHistoryTimeline.LOCAL_HISTORY_ENABLED_SETTINGS_KEY)) {
        this.updateTimelineRegistration();
      }
    }));
  }
  onDidChangeWorkingCopyHistoryEntry(entry) {
    this._onDidChange.fire({
      id: this.id,
      uri: entry?.workingCopy.resource,
      reset: true
      // there is no other way to indicate that items might have been replaced/removed
    });
  }
  async provideTimeline(uri, options, token) {
    const items = [];
    let resource = void 0;
    if (uri.scheme === LocalHistoryFileSystemProvider.SCHEMA) {
      resource = LocalHistoryFileSystemProvider.fromLocalHistoryFileSystem(uri).associatedResource;
    } else if (uri.scheme === this.pathService.defaultUriScheme || uri.scheme === Schemas.vscodeUserData) {
      resource = uri;
    } else if (this.fileService.hasProvider(uri)) {
      resource = URI.from({
        scheme: this.pathService.defaultUriScheme,
        authority: this.environmentService.remoteAuthority ?? getVirtualWorkspaceAuthority(this.contextService.getWorkspace()),
        path: uri.path
      });
    }
    if (resource) {
      const entries = await this.workingCopyHistoryService.getEntries(resource, token);
      for (const entry of entries) {
        items.push(this.toTimelineItem(entry));
      }
    }
    return {
      source: this.id,
      items
    };
  }
  toTimelineItem(entry) {
    return {
      handle: entry.id,
      label: SaveSourceRegistry.getSourceLabel(entry.source),
      tooltip: new MarkdownString(`$(history) ${getLocalHistoryDateFormatter().format(entry.timestamp)}

${SaveSourceRegistry.getSourceLabel(entry.source)}${entry.sourceDescription ? ` (${entry.sourceDescription})` : ``}`, { supportThemeIcons: true }),
      source: this.id,
      timestamp: entry.timestamp,
      themeIcon: LOCAL_HISTORY_ICON_ENTRY,
      contextValue: LOCAL_HISTORY_MENU_CONTEXT_VALUE,
      command: {
        id: API_OPEN_DIFF_EDITOR_COMMAND_ID,
        title: COMPARE_WITH_FILE_LABEL.value,
        arguments: toDiffEditorArguments(entry, entry.workingCopy.resource)
      }
    };
  }
};
LocalHistoryTimeline = __decorateClass([
  __decorateParam(0, ITimelineService),
  __decorateParam(1, IWorkingCopyHistoryService),
  __decorateParam(2, IPathService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IWorkspaceContextService)
], LocalHistoryTimeline);
export {
  LocalHistoryTimeline
};
