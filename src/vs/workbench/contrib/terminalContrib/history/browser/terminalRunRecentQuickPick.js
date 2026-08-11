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
import { isMacintosh, OperatingSystem } from "../../../../../base/common/platform.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService, QuickInputButtonLocation } from "../../../../../platform/quickinput/common/quickInput.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { collapseTildePath } from "../../../../../platform/terminal/common/terminalEnvironment.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { commandHistoryFuzzySearchIcon, commandHistoryOpenFileIcon, commandHistoryOutputIcon, commandHistoryRemoveIcon } from "../../../terminal/browser/terminalIcons.js";
import { TerminalStorageKeys } from "../../../terminal/common/terminalStorageKeys.js";
import { terminalStrings } from "../../../terminal/common/terminalStrings.js";
import { URI } from "../../../../../base/common/uri.js";
import { fromNow } from "../../../../../base/common/date.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { showWithPinnedItems } from "../../../../../platform/quickinput/browser/quickPickPin.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { AccessibleViewProviderId, IAccessibleViewService } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { getCommandHistory, getDirectoryHistory, getShellFileHistory } from "../common/history.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { extUri, extUriIgnorePathCase } from "../../../../../base/common/resources.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { isObject } from "../../../../../base/common/types.js";
async function showRunRecentQuickPick(accessor, instance, terminalInRunCommandPicker, type, filterMode, value) {
  if (!instance.xterm) {
    return;
  }
  const accessibleViewService = accessor.get(IAccessibleViewService);
  const editorService = accessor.get(IEditorService);
  const instantiationService = accessor.get(IInstantiationService);
  const quickInputService = accessor.get(IQuickInputService);
  const storageService = accessor.get(IStorageService);
  const pathService = accessor.get(IPathService);
  const runRecentStorageKey = `${TerminalStorageKeys.PinnedRecentCommandsPrefix}.${instance.shellType}`;
  let placeholder;
  let items = [];
  const commandMap = /* @__PURE__ */ new Set();
  const removeFromCommandHistoryButton = {
    iconClass: ThemeIcon.asClassName(commandHistoryRemoveIcon),
    tooltip: localize("removeCommand", "Remove from Command History")
  };
  const commandOutputButton = {
    iconClass: ThemeIcon.asClassName(commandHistoryOutputIcon),
    tooltip: localize("viewCommandOutput", "View Command Output"),
    alwaysVisible: false
  };
  const openResourceButtons = [];
  if (type === "command") {
    let formatLabel = function(label) {
      return label.replace(/\r?\n/g, "\u23CE").replace(/\s\s\s+/g, "\u22EF");
    };
    placeholder = isMacintosh ? localize("selectRecentCommandMac", "Select a command to run (hold Option-key to edit the command)") : localize("selectRecentCommand", "Select a command to run (hold Alt-key to edit the command)");
    const cmdDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
    const commands = cmdDetection?.commands;
    const executingCommand = cmdDetection?.executingCommand;
    if (executingCommand) {
      commandMap.add(executingCommand);
    }
    if (commands && commands.length > 0) {
      for (let i = commands.length - 1; i >= 0; i--) {
        const entry = commands[i];
        const label = entry.command.trim();
        if (label.length === 0 || commandMap.has(label)) {
          continue;
        }
        let description = collapseTildePath(entry.cwd, instance.userHome, instance.os === OperatingSystem.Windows ? "\\" : "/");
        if (entry.exitCode) {
          if (entry.exitCode === -1) {
            description += " failed";
          } else {
            description += ` exitCode: ${entry.exitCode}`;
          }
        }
        description = description.trim();
        const buttons = [commandOutputButton];
        const lastItem = items.length > 0 ? items[items.length - 1] : void 0;
        if (lastItem?.type !== "separator" && lastItem?.label === label) {
          lastItem.id = entry.timestamp.toString();
          lastItem.description = description;
          continue;
        }
        items.push({
          label: formatLabel(label),
          rawLabel: label,
          description,
          id: entry.timestamp.toString(),
          command: entry,
          buttons: entry.hasOutput() ? buttons : void 0
        });
        commandMap.add(label);
      }
    }
    if (executingCommand) {
      items.unshift({
        label: formatLabel(executingCommand),
        rawLabel: executingCommand,
        description: cmdDetection.cwd
      });
    }
    if (items.length > 0) {
      items.unshift({
        type: "separator",
        buttons: [],
        // HACK: Force full sized separators as there's no flag currently
        label: terminalStrings.currentSessionCategory
      });
    }
    const history = instantiationService.invokeFunction(getCommandHistory);
    const previousSessionItems = [];
    for (const [label, info] of history.entries) {
      if (!commandMap.has(label) && info.shellType === instance.shellType) {
        previousSessionItems.unshift({
          label: formatLabel(label),
          rawLabel: label,
          buttons: [removeFromCommandHistoryButton]
        });
        commandMap.add(label);
      }
    }
    if (previousSessionItems.length > 0) {
      items.push(
        {
          type: "separator",
          buttons: [],
          // HACK: Force full sized separators as there's no flag currently
          label: terminalStrings.previousSessionCategory
        },
        ...previousSessionItems
      );
    }
    const shellFileHistory = await instantiationService.invokeFunction(getShellFileHistory, instance.shellType);
    if (shellFileHistory !== void 0) {
      const dedupedShellFileItems = [];
      for (const label of shellFileHistory.commands) {
        if (!commandMap.has(label)) {
          dedupedShellFileItems.unshift({
            label: formatLabel(label),
            rawLabel: label
          });
        }
      }
      if (dedupedShellFileItems.length > 0) {
        const button = {
          iconClass: ThemeIcon.asClassName(commandHistoryOpenFileIcon),
          tooltip: localize("openShellHistoryFile", "Open File"),
          alwaysVisible: false,
          resource: shellFileHistory.sourceResource
        };
        openResourceButtons.push(button);
        items.push(
          {
            type: "separator",
            buttons: [button],
            label: localize("shellFileHistoryCategory", "{0} history", instance.shellType),
            description: shellFileHistory.sourceLabel
          },
          ...dedupedShellFileItems
        );
      }
    }
  } else {
    placeholder = isMacintosh ? localize("selectRecentDirectoryMac", "Select a directory to go to (hold Option-key to edit the command)") : localize("selectRecentDirectory", "Select a directory to go to (hold Alt-key to edit the command)");
    const uriComparer = instance.os === OperatingSystem.Windows ? extUriIgnorePathCase : extUri;
    const uniqueUris = new ResourceSet((o) => uriComparer.getComparisonKey(o));
    const cwds = instance.capabilities.get(TerminalCapability.CwdDetection)?.cwds || [];
    if (cwds && cwds.length > 0) {
      for (const label of cwds) {
        const itemUri = URI.file(label);
        if (!uniqueUris.has(itemUri)) {
          uniqueUris.add(itemUri);
          items.push({
            label: await instance.getUriLabelForShell(itemUri),
            rawLabel: label
          });
        }
      }
      items = items.reverse();
      items.unshift({ type: "separator", label: terminalStrings.currentSessionCategory });
    }
    const history = instantiationService.invokeFunction(getDirectoryHistory);
    const previousSessionItems = [];
    for (const [label, info] of history.entries) {
      if (info === null || info.remoteAuthority === instance.remoteAuthority) {
        const itemUri = info?.remoteAuthority ? await pathService.fileURI(label) : URI.file(label);
        if (!uniqueUris.has(itemUri)) {
          uniqueUris.add(itemUri);
          previousSessionItems.unshift({
            label: await instance.getUriLabelForShell(itemUri),
            rawLabel: label,
            buttons: [removeFromCommandHistoryButton]
          });
        }
      }
    }
    if (previousSessionItems.length > 0) {
      items.push(
        { type: "separator", label: terminalStrings.previousSessionCategory },
        ...previousSessionItems
      );
    }
  }
  if (items.length === 0) {
    return;
  }
  const disposables = new DisposableStore();
  const fuzzySearchButton = {
    iconClass: ThemeIcon.asClassName(commandHistoryFuzzySearchIcon),
    tooltip: localize("fuzzySearch", "Fuzzy search"),
    toggle: { checked: filterMode === "fuzzy" },
    location: QuickInputButtonLocation.Input
  };
  const outputProvider = disposables.add(instantiationService.createInstance(TerminalOutputProvider));
  const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
  const originalItems = items;
  quickPick.items = [...originalItems];
  quickPick.sortByLabel = false;
  quickPick.placeholder = placeholder;
  quickPick.matchOnLabelMode = filterMode || "contiguous";
  quickPick.buttons = [fuzzySearchButton];
  disposables.add(quickPick.onDidTriggerButton((button) => {
    if (button === fuzzySearchButton) {
      instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, fuzzySearchButton.toggle.checked ? "fuzzy" : "contiguous", quickPick.value);
    }
  }));
  disposables.add(quickPick.onDidTriggerItemButton(async (e) => {
    if (e.button === removeFromCommandHistoryButton) {
      if (type === "command") {
        instantiationService.invokeFunction(getCommandHistory)?.remove(e.item.label);
      } else {
        instantiationService.invokeFunction(getDirectoryHistory)?.remove(e.item.rawLabel);
      }
    } else if (e.button === commandOutputButton) {
      const selectedCommand = e.item.command;
      const output = selectedCommand?.getOutput();
      if (output && selectedCommand?.command) {
        const textContent = await outputProvider.provideTextContent(URI.from(
          {
            scheme: TerminalOutputProvider.scheme,
            path: `${selectedCommand.command}... ${fromNow(selectedCommand.timestamp, true)}`,
            fragment: output,
            query: `terminal-output-${selectedCommand.timestamp}-${instance.instanceId}`
          }
        ));
        if (textContent) {
          await editorService.openEditor({
            resource: textContent.uri
          });
        }
      }
    }
    await instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, filterMode, value);
  }));
  disposables.add(quickPick.onDidTriggerSeparatorButton(async (e) => {
    const resource = openResourceButtons.find((openResourceButton) => e.button === openResourceButton)?.resource;
    if (resource) {
      await editorService.openEditor({
        resource
      });
    }
  }));
  disposables.add(quickPick.onDidChangeValue(async (value2) => {
    if (!value2) {
      await instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, filterMode, value2);
    }
  }));
  let terminalScrollStateSaved = false;
  function restoreScrollState() {
    terminalScrollStateSaved = false;
    instance.xterm?.markTracker.restoreScrollState();
    instance.xterm?.markTracker.clear();
  }
  disposables.add(quickPick.onDidChangeActive(async () => {
    const xterm = instance.xterm;
    if (!xterm) {
      return;
    }
    const [item] = quickPick.activeItems;
    if (!item) {
      return;
    }
    function isItem(obj) {
      return isObject(obj) && "rawLabel" in obj;
    }
    if (isItem(item) && item.command && item.command.marker) {
      if (!terminalScrollStateSaved) {
        xterm.markTracker.saveScrollState();
        terminalScrollStateSaved = true;
      }
      const promptRowCount = item.command.getPromptRowCount();
      const commandRowCount = item.command.getCommandRowCount();
      xterm.markTracker.revealRange({
        start: {
          x: 1,
          y: item.command.marker.line - (promptRowCount - 1) + 1
        },
        end: {
          x: instance.cols,
          y: item.command.marker.line + (commandRowCount - 1) + 1
        }
      });
    } else {
      restoreScrollState();
    }
  }));
  disposables.add(quickPick.onDidAccept(async () => {
    const result = quickPick.activeItems[0];
    let text;
    if (type === "cwd") {
      text = `cd ${await instance.preparePathForShell(result.rawLabel)}`;
    } else {
      text = result.rawLabel;
    }
    quickPick.hide();
    terminalScrollStateSaved = false;
    instance.xterm?.markTracker.clear();
    instance.scrollToBottom();
    instance.runCommand(text, !quickPick.keyMods.alt);
    if (quickPick.keyMods.alt) {
      instance.focus();
    }
  }));
  disposables.add(quickPick.onDidHide(() => restoreScrollState()));
  if (value) {
    quickPick.value = value;
  }
  return new Promise((r) => {
    terminalInRunCommandPicker.set(true);
    disposables.add(showWithPinnedItems(storageService, runRecentStorageKey, quickPick, true));
    disposables.add(quickPick.onDidHide(() => {
      terminalInRunCommandPicker.set(false);
      accessibleViewService.showLastProvider(AccessibleViewProviderId.Terminal);
      r();
      disposables.dispose();
    }));
  });
}
let TerminalOutputProvider = class extends Disposable {
  constructor(textModelResolverService, _modelService) {
    super();
    this._modelService = _modelService;
    this._register(textModelResolverService.registerTextModelContentProvider(TerminalOutputProvider.scheme, this));
  }
  static {
    this.scheme = "TERMINAL_OUTPUT";
  }
  async provideTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    return this._modelService.createModel(resource.fragment, null, resource, false);
  }
};
TerminalOutputProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IModelService)
], TerminalOutputProvider);
export {
  showRunRecentQuickPick
};
