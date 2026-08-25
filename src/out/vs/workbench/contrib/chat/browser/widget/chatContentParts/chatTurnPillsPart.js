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
import * as dom from "../../../../../../base/browser/dom.js";
import { $ } from "../../../../../../base/browser/dom.js";
import { toAction } from "../../../../../../base/common/actions.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { combinedDisposable, Disposable } from "../../../../../../base/common/lifecycle.js";
import { autorun, constObservable, derived, derivedOpts } from "../../../../../../base/common/observable.js";
import { basename, getComparisonKey, isEqual } from "../../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { URI } from "../../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { FileKind } from "../../../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { IOpenerService } from "../../../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../../../../browser/labels.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { createFileIconThemableTreeContainerScope } from "../../../../files/browser/views/explorerView.js";
import { MultiDiffEditorInput } from "../../../../multiDiffEditor/browser/multiDiffEditorInput.js";
import { MultiDiffEditorItem } from "../../../../multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { IChatResponseFileChangesService } from "../../chatResponseFileChangesService.js";
import { diffStatsEqual, EMPTY_DIFF_STATS, observeTurnStatusPillsEnabled, openChatTurnFile, previewFilesEqual, previewKind } from "../chatTurnPills.js";
import { renderChangesSummaryFileList } from "./chatChangesSummaryPart.js";
import { ChatCollapsibleContentPart } from "./chatCollapsibleContentPart.js";
let ChatTurnPillsContentPart = class extends Disposable {
  constructor(_content, _context, chatResponseFileChangesService, _openerService, _hoverService, _editorService, _configurationService, themeService, _instantiationService, _labelService) {
    super();
    this._content = _content;
    this._openerService = _openerService;
    this._hoverService = _hoverService;
    this._editorService = _editorService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._labelService = _labelService;
    this.domNode = $(".chat-turn-pills-part");
    this._diffs = chatResponseFileChangesService.getChangesForRequest(_content.sessionResource, _content.requestId) ?? constObservable([]);
    const stats = derivedOpts({ owner: this, equalsFn: diffStatsEqual }, (reader) => {
      const diffs = this._diffs.read(reader);
      if (diffs.length === 0) {
        return EMPTY_DIFF_STATS;
      }
      let insertions = 0, deletions = 0;
      for (const diff of diffs) {
        insertions += diff.added;
        deletions += diff.removed;
      }
      return { files: diffs.length, insertions, deletions };
    });
    const previewDiffs = chatResponseFileChangesService.getFileEditsForRequest?.(_content.sessionResource, _content.requestId) ?? constObservable([]);
    const previewFiles = derivedOpts({ owner: this, equalsFn: previewFilesEqual }, (reader) => {
      const created = [];
      const edited = [];
      const seen = /* @__PURE__ */ new Set();
      const addDiffs = (diffs) => {
        for (const diff of diffs) {
          if (!diff.isOutsideWorkspace) {
            continue;
          }
          const kind = previewKind(diff.modifiedURI);
          if (!kind) {
            continue;
          }
          const key = getComparisonKey(diff.modifiedURI);
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          const isCreated = isEqual(diff.originalURI, diff.modifiedURI);
          (isCreated ? created : edited).push({ uri: diff.modifiedURI, kind, created: isCreated });
        }
      };
      addDiffs(previewDiffs.read(reader));
      return [...created, ...edited];
    });
    const turnStatusPillsEnabled = observeTurnStatusPillsEnabled(this._configurationService);
    const changesEnabled = derived(this, (reader) => turnStatusPillsEnabled.read(reader));
    const previewEnabled = derived(this, (reader) => turnStatusPillsEnabled.read(reader));
    const showChanges = derived(this, (reader) => changesEnabled.read(reader) && stats.read(reader).files > 0);
    const showPreview = derived(this, (reader) => previewEnabled.read(reader) && previewFiles.read(reader).length > 0);
    const root = this.domNode.appendChild($(".checkpoint-file-changes-summary.checkpoint-file-changes-compact"));
    this._register(createFileIconThemableTreeContainerScope(root, themeService));
    const details = root.appendChild(document.createElement("details"));
    details.classList.add("checkpoint-file-changes-disclosure");
    const header = details.appendChild(document.createElement("summary"));
    header.classList.add("checkpoint-file-changes-summary-header");
    const resourceLabels = this._register(this._instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER));
    this._register(this._renderChangesHeader(header, stats, showChanges));
    this._register(this._renderPreviewAction(header, previewFiles, showPreview, resourceLabels));
    this._register(this._renderChevron(header, details, showChanges));
    this._register(dom.addDisposableListener(header, "click", () => {
      root.dispatchEvent(new CustomEvent(ChatCollapsibleContentPart.userToggleEvent, { bubbles: true }));
    }));
    const listDiffs = derived(this, (reader) => showChanges.read(reader) ? this._diffs.read(reader) : []);
    this._register(renderChangesSummaryFileList(details, listDiffs, this._instantiationService, this._editorService, this._configurationService, {
      getRowActions: (diff) => this._getRowActions(diff)
    }));
    this._register(autorun((reader) => {
      this.domNode.style.display = showChanges.read(reader) || showPreview.read(reader) ? "" : "none";
    }));
  }
  _renderChangesHeader(header, stats, showChanges) {
    const filesLabel = header.appendChild($("span.chat-file-changes-label"));
    const counts = header.appendChild(document.createElement("button"));
    counts.classList.add("chat-file-changes-counts");
    counts.type = "button";
    const addedLabel = counts.appendChild($("span.insertions"));
    const removedLabel = counts.appendChild($("span.deletions"));
    const hoverDisposable = this._hoverService.setupDelayedHover(counts, () => ({
      content: localize2("chat.viewTurnFileChangesSummary", "View All File Changes")
    }));
    const clickDisposable = dom.addDisposableListener(counts, "click", (e) => {
      this._openChanges();
      dom.EventHelper.stop(e, true);
    });
    return combinedDisposable(hoverDisposable, clickDisposable, autorun((reader) => {
      const { files, insertions, deletions } = stats.read(reader);
      const fileCountLabel = files === 1 ? localize("chat.turnChanges.oneFile", "1 file changed") : localize("chat.turnChanges.manyFiles", "{0} files changed", files);
      filesLabel.textContent = fileCountLabel;
      addedLabel.textContent = `+${insertions}`;
      removedLabel.textContent = `-${deletions}`;
      counts.setAttribute("aria-label", localize(
        "chat.turnChanges.viewAllAccessible",
        "View all file changes, {0} lines added, {1} lines deleted",
        insertions,
        deletions
      ));
      header.setAttribute("aria-label", localize(
        "chat.turnChanges.accessibleSummary",
        "{0}, {1} lines added, {2} lines deleted",
        fileCountLabel,
        insertions,
        deletions
      ));
      const show = showChanges.read(reader);
      filesLabel.classList.toggle("hidden", !show);
      counts.classList.toggle("hidden", !show);
    }));
  }
  _renderPreviewAction(header, previewFiles, showPreview, resourceLabels) {
    const container = header.appendChild($(".chat-turn-preview"));
    container.appendChild($("span.chat-turn-preview-separator", { "aria-hidden": "true" }));
    const button = container.appendChild(document.createElement("button"));
    button.classList.add("chat-turn-preview-action");
    button.type = "button";
    const label = this._register(resourceLabels.create(button, { hoverTargetOverride: button }));
    const clickDisposable = dom.addDisposableListener(button, "click", (e) => {
      this._openPrimaryPreview(previewFiles.get());
      dom.EventHelper.stop(e, true);
    });
    return combinedDisposable(clickDisposable, autorun((reader) => {
      const files = previewFiles.read(reader);
      const primaryFile = files.at(0);
      if (primaryFile) {
        const name = basename(primaryFile.uri);
        label.setResource(
          { resource: primaryFile.uri, name },
          {
            fileKind: FileKind.FILE,
            title: localize("chat.turnPreview.tooltip", "{0} \u2022 Open File", this._labelService.getUriLabel(primaryFile.uri))
          }
        );
        button.setAttribute("aria-label", localize("chat.turnPreview.ariaLabel", "Open File: {0}", name));
      }
      container.classList.toggle("hidden", !showPreview.read(reader));
    }));
  }
  _renderChevron(header, details, showChanges) {
    const chevron = header.appendChild($("span.chat-file-changes-chevron.chat-collapsible-hover-chevron", { "aria-hidden": "true" }));
    chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
    const setExpansionState = () => {
      header.setAttribute("aria-expanded", String(details.open));
      chevron.classList.toggle("expanded", details.open);
    };
    setExpansionState();
    return combinedDisposable(
      dom.addDisposableListener(details, "toggle", setExpansionState),
      autorun((reader) => {
        chevron.classList.toggle("hidden", !showChanges.read(reader));
      })
    );
  }
  _openChanges() {
    const diffs = this._diffs.get();
    if (diffs.length === 0) {
      return;
    }
    const source = URI.parse(`multi-diff-editor:${Date.now().toString()}-${Math.random().toString(36).slice(2)}`);
    const input = this._instantiationService.createInstance(
      MultiDiffEditorInput,
      source,
      localize("chatTurnPills.changes.title", "Turn File Changes"),
      diffs.map((diff) => new MultiDiffEditorItem(diff.originalURI, diff.modifiedURI, void 0)),
      false
    );
    this._editorService.openEditor(input);
  }
  _openPrimaryPreview(files) {
    const primaryFile = files.at(0);
    if (primaryFile) {
      openChatTurnFile(primaryFile, this._openerService, this._configurationService);
    }
  }
  /**
   * Row actions for the changed-files list: markdown files get a labelless,
   * icon-free action that opens the file.
   */
  _getRowActions(diff) {
    const kind = previewKind(diff.modifiedURI);
    if (!kind) {
      return [];
    }
    const file = { uri: diff.modifiedURI, kind, created: isEqual(diff.originalURI, diff.modifiedURI) };
    return [toAction({
      id: "chat.turnChanges.previewFile",
      label: localize("chat.turnChanges.preview", "Preview"),
      run: () => openChatTurnFile(file, this._openerService, this._configurationService)
    })];
  }
  hasSameContent(other, _followingContent, _element) {
    return other.kind === "turnPills" && other.requestId === this._content.requestId && isEqual(other.sessionResource, this._content.sessionResource);
  }
};
ChatTurnPillsContentPart = __decorateClass([
  __decorateParam(2, IChatResponseFileChangesService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ILabelService)
], ChatTurnPillsContentPart);
export {
  ChatTurnPillsContentPart
};
