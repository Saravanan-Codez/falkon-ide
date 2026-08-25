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
import { EventType } from "../../../../../base/browser/dom.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { localize } from "../../../../../nls.js";
import { IQuickInputService, QuickInputHideReason } from "../../../../../platform/quickinput/common/quickInput.js";
import { TerminalLinkQuickPickEvent } from "../../../terminal/browser/terminal.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Sequencer, timeout } from "../../../../../base/common/async.js";
import { PickerEditorState } from "../../../../browser/quickaccess.js";
import { getLinkSuffix } from "./terminalLinkParsing.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { basenameOrAuthority, dirname } from "../../../../../base/common/resources.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { AccessibleViewProviderId, IAccessibleViewService } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { hasKey } from "../../../../../base/common/types.js";
let TerminalLinkQuickpick = class extends DisposableStore {
  constructor(_accessibleViewService, instantiationService, _labelService, _quickInputService) {
    super();
    this._accessibleViewService = _accessibleViewService;
    this._labelService = _labelService;
    this._quickInputService = _quickInputService;
    this._editorSequencer = new Sequencer();
    this._onDidRequestMoreLinks = this.add(new Emitter());
    this.onDidRequestMoreLinks = this._onDidRequestMoreLinks.event;
    this._terminalScrollStateSaved = false;
    this._editorViewState = this.add(instantiationService.createInstance(PickerEditorState));
  }
  async show(instance, links) {
    this._instance = instance;
    const result = await Promise.race([links.all, timeout(500)]);
    const usingAllLinks = typeof result === "object";
    const resolvedLinks = usingAllLinks ? result : links.viewport;
    const wordPicks = resolvedLinks.wordLinks ? await this._generatePicks(resolvedLinks.wordLinks) : void 0;
    const filePicks = resolvedLinks.fileLinks ? await this._generatePicks(resolvedLinks.fileLinks) : void 0;
    const folderPicks = resolvedLinks.folderLinks ? await this._generatePicks(resolvedLinks.folderLinks) : void 0;
    const webPicks = resolvedLinks.webLinks ? await this._generatePicks(resolvedLinks.webLinks) : void 0;
    const picks = [];
    if (webPicks) {
      picks.push({ type: "separator", label: localize("terminal.integrated.urlLinks", "Url") });
      picks.push(...webPicks);
    }
    if (filePicks) {
      picks.push({ type: "separator", label: localize("terminal.integrated.localFileLinks", "File") });
      picks.push(...filePicks);
    }
    if (folderPicks) {
      picks.push({ type: "separator", label: localize("terminal.integrated.localFolderLinks", "Folder") });
      picks.push(...folderPicks);
    }
    if (wordPicks) {
      picks.push({ type: "separator", label: localize("terminal.integrated.searchLinks", "Workspace Search") });
      picks.push(...wordPicks);
    }
    const pick = this._quickInputService.createQuickPick({ useSeparators: true });
    const disposables = new DisposableStore();
    disposables.add(pick);
    pick.items = picks;
    pick.placeholder = localize("terminal.integrated.openDetectedLink", "Select the link to open, type to filter all links");
    pick.sortByLabel = false;
    pick.show();
    if (pick.activeItems.length > 0) {
      this._previewItem(pick.activeItems[0]);
    }
    let accepted = false;
    if (!usingAllLinks) {
      disposables.add(Event.once(pick.onDidChangeValue)(async () => {
        const allLinks = await links.all;
        if (accepted) {
          return;
        }
        const wordIgnoreLinks = [...allLinks.fileLinks ?? [], ...allLinks.folderLinks ?? [], ...allLinks.webLinks ?? []];
        const wordPicks2 = allLinks.wordLinks ? await this._generatePicks(allLinks.wordLinks, wordIgnoreLinks) : void 0;
        const filePicks2 = allLinks.fileLinks ? await this._generatePicks(allLinks.fileLinks) : void 0;
        const folderPicks2 = allLinks.folderLinks ? await this._generatePicks(allLinks.folderLinks) : void 0;
        const webPicks2 = allLinks.webLinks ? await this._generatePicks(allLinks.webLinks) : void 0;
        const picks2 = [];
        if (webPicks2) {
          picks2.push({ type: "separator", label: localize("terminal.integrated.urlLinks", "Url") });
          picks2.push(...webPicks2);
        }
        if (filePicks2) {
          picks2.push({ type: "separator", label: localize("terminal.integrated.localFileLinks", "File") });
          picks2.push(...filePicks2);
        }
        if (folderPicks2) {
          picks2.push({ type: "separator", label: localize("terminal.integrated.localFolderLinks", "Folder") });
          picks2.push(...folderPicks2);
        }
        if (wordPicks2) {
          picks2.push({ type: "separator", label: localize("terminal.integrated.searchLinks", "Workspace Search") });
          picks2.push(...wordPicks2);
        }
        pick.items = picks2;
      }));
    }
    disposables.add(pick.onDidChangeActive(async () => {
      const [item] = pick.activeItems;
      this._previewItem(item);
    }));
    return new Promise((r) => {
      disposables.add(pick.onDidHide(({ reason }) => {
        if (this._terminalScrollStateSaved) {
          const markTracker = this._instance?.xterm?.markTracker;
          if (markTracker) {
            markTracker.restoreScrollState();
            markTracker.clear();
            this._terminalScrollStateSaved = false;
          }
        }
        if (reason === QuickInputHideReason.Gesture) {
          this._editorViewState.restore();
        }
        disposables.dispose();
        if (pick.selectedItems.length === 0) {
          this._accessibleViewService.showLastProvider(AccessibleViewProviderId.Terminal);
        }
        r();
      }));
      disposables.add(Event.once(pick.onDidAccept)(() => {
        if (this._terminalScrollStateSaved) {
          const markTracker = this._instance?.xterm?.markTracker;
          if (markTracker) {
            markTracker.restoreScrollState();
            markTracker.clear();
            this._terminalScrollStateSaved = false;
          }
        }
        accepted = true;
        const event = new TerminalLinkQuickPickEvent(EventType.CLICK);
        const activeItem = pick.activeItems?.[0];
        if (activeItem && hasKey(activeItem, { link: true })) {
          activeItem.link.activate(event, activeItem.label);
        }
        disposables.dispose();
        r();
      }));
    });
  }
  /**
   * @param ignoreLinks Links with labels to not include in the picks.
   */
  async _generatePicks(links, ignoreLinks) {
    if (!links) {
      return;
    }
    const linkTextKeys = /* @__PURE__ */ new Set();
    const linkUriKeys = /* @__PURE__ */ new Set();
    const picks = [];
    for (const link of links) {
      let label = link.text;
      if (!linkTextKeys.has(label) && (!ignoreLinks || !ignoreLinks.some((e) => e.text === label))) {
        linkTextKeys.add(label);
        let description;
        if (hasKey(link, { uri: true }) && link.uri) {
          if (link.type === TerminalBuiltinLinkType.LocalFile || link.type === TerminalBuiltinLinkType.LocalFolderInWorkspace || link.type === TerminalBuiltinLinkType.LocalFolderOutsideWorkspace) {
            label = basenameOrAuthority(link.uri);
            description = this._labelService.getUriLabel(dirname(link.uri), { relative: true });
          }
          if (link.type === TerminalBuiltinLinkType.LocalFile) {
            if (link.parsedLink?.suffix?.row !== void 0) {
              label += `:${link.parsedLink.suffix.row}`;
              if (link.parsedLink?.suffix?.rowEnd !== void 0) {
                label += `-${link.parsedLink.suffix.rowEnd}`;
              }
              if (link.parsedLink?.suffix?.col !== void 0) {
                label += `:${link.parsedLink.suffix.col}`;
                if (link.parsedLink?.suffix?.colEnd !== void 0) {
                  label += `-${link.parsedLink.suffix.colEnd}`;
                }
              }
            }
          }
          if (linkUriKeys.has(label + "|" + (description ?? ""))) {
            continue;
          }
          linkUriKeys.add(label + "|" + (description ?? ""));
        }
        picks.push({ label, link, description });
      }
    }
    return picks.length > 0 ? picks : void 0;
  }
  _previewItem(item) {
    if (!item || !hasKey(item, { link: true }) || !item.link) {
      return;
    }
    const link = item.link;
    this._previewItemInTerminal(link);
    if (!hasKey(link, { uri: true }) || !link.uri) {
      return;
    }
    if (link.type !== TerminalBuiltinLinkType.LocalFile) {
      return;
    }
    this._previewItemInEditor(link);
  }
  _previewItemInEditor(link) {
    const linkSuffix = link.parsedLink ? link.parsedLink.suffix : getLinkSuffix(link.text);
    const selection = linkSuffix?.row === void 0 ? void 0 : {
      startLineNumber: linkSuffix.row ?? 1,
      startColumn: linkSuffix.col ?? 1,
      endLineNumber: linkSuffix.rowEnd,
      endColumn: linkSuffix.colEnd
    };
    this._editorViewState.set();
    this._editorSequencer.queue(async () => {
      await this._editorViewState.openTransientEditor({
        resource: link.uri,
        options: { preserveFocus: true, revealIfOpened: true, ignoreError: true, selection }
      });
    });
  }
  _previewItemInTerminal(link) {
    const xterm = this._instance?.xterm;
    if (!xterm) {
      return;
    }
    if (!this._terminalScrollStateSaved) {
      xterm.markTracker.saveScrollState();
      this._terminalScrollStateSaved = true;
    }
    xterm.markTracker.revealRange(link.range);
  }
};
TerminalLinkQuickpick = __decorateClass([
  __decorateParam(0, IAccessibleViewService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IQuickInputService)
], TerminalLinkQuickpick);
export {
  TerminalLinkQuickpick
};
