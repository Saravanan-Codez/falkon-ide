import { parse as parseJSONC } from "../../../../../base/common/jsonc.js";
import { setProperty, applyEdits } from "../../../../../base/common/jsonEdit.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ChatViewId } from "../chat.js";
import { CHAT_CATEGORY, CHAT_CONFIG_MENU_ID } from "../actions/chatActions.js";
import { localize, localize2 } from "../../../../../nls.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IPromptsService, PromptsStorage } from "../../common/promptSyntax/service/promptsService.js";
import { PromptsType, Target, getSourceDescription } from "../../common/promptSyntax/promptTypes.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { HOOK_METADATA, HOOKS_BY_TARGET } from "../../common/promptSyntax/hookTypes.js";
import { formatHookCommandLabel, getEffectiveCommandFieldKey } from "../../common/promptSyntax/hookSchema.js";
import { getCopilotCliHookTypeName, resolveCopilotCliHookType } from "../../common/promptSyntax/hookCopilotCliCompat.js";
import { getHookSourceFormat, HookSourceFormat, buildNewHookEntry } from "../../common/promptSyntax/hookCompatibility.js";
import { getClaudeHookTypeName, resolveClaudeHookType } from "../../common/promptSyntax/hookClaudeCompat.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { findHookCommandSelection, findHookCommandInYaml, parseAllHookFiles } from "./hookUtils.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IPathService } from "../../../../services/path/common/pathService.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IBulkEditService, ResourceTextEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { OperatingSystem, OS } from "../../../../../base/common/platform.js";
const CONFIGURE_HOOKS_ACTION_ID = "workbench.action.chat.configure.hooks";
function usesCopilotCliNaming(hooksObj) {
  for (const key of Object.keys(hooksObj)) {
    if (resolveCopilotCliHookType(key) !== void 0) {
      return true;
    }
  }
  return false;
}
function getHookTypeKeyName(hookTypeId, useCopilotCliNamingConvention) {
  if (useCopilotCliNamingConvention) {
    const copilotCliName = getCopilotCliHookTypeName(hookTypeId);
    if (copilotCliName) {
      return copilotCliName;
    }
  }
  return hookTypeId;
}
async function addHookToFile(hookFileUri, hookTypeId, fileService, editorService, notificationService, bulkEditService, openEditorOverride) {
  let hooksContent;
  const fileExists = await fileService.exists(hookFileUri);
  if (fileExists) {
    const existingContent = await fileService.readFile(hookFileUri);
    try {
      hooksContent = parseJSONC(existingContent.value.toString());
      if (!hooksContent.hooks) {
        hooksContent.hooks = {};
      }
    } catch {
      notificationService.error(localize("commands.new.hook.parseError", "Failed to parse existing hooks file. Please fix the JSON syntax errors and try again."));
      await editorService.openEditor({ resource: hookFileUri });
      return;
    }
  } else {
    hooksContent = { hooks: {} };
  }
  const sourceFormat = getHookSourceFormat(hookFileUri);
  const isClaude = sourceFormat === HookSourceFormat.Claude;
  const useCopilotCliNamingConvention = !isClaude && usesCopilotCliNaming(hooksContent.hooks);
  const hookTypeKeyName = isClaude ? getClaudeHookTypeName(hookTypeId) ?? hookTypeId : getHookTypeKeyName(hookTypeId, useCopilotCliNamingConvention);
  let existingKeyForType;
  for (const key of Object.keys(hooksContent.hooks)) {
    const resolvedType = isClaude ? resolveClaudeHookType(key) : resolveCopilotCliHookType(key);
    if (resolvedType === hookTypeId || key === hookTypeId) {
      existingKeyForType = key;
      break;
    }
  }
  const keyToUse = existingKeyForType ?? hookTypeKeyName;
  const newHookEntry = buildNewHookEntry(sourceFormat);
  const existingHooks = hooksContent.hooks[keyToUse];
  const newHookIndex = Array.isArray(existingHooks) ? existingHooks.length : 0;
  let jsonContent;
  if (fileExists) {
    const originalText = (await fileService.readFile(hookFileUri)).value.toString();
    const detectedEol = originalText.includes("\r\n") ? "\r\n" : "\n";
    const formattingOptions = { tabSize: 1, insertSpaces: false, eol: detectedEol };
    const edits = setProperty(originalText, ["hooks", keyToUse, newHookIndex], newHookEntry, formattingOptions);
    jsonContent = applyEdits(originalText, edits);
  } else {
    const newContent = { hooks: { [keyToUse]: [newHookEntry] } };
    jsonContent = JSON.stringify(newContent, null, "	");
  }
  const existingEditor = editorService.editors.find((e) => isEqual(e.resource, hookFileUri));
  if (existingEditor) {
    await editorService.openEditor({
      resource: hookFileUri,
      options: {
        pinned: false
      }
    });
    const editor = getCodeEditor(editorService.activeTextEditorControl);
    if (editor && editor.hasModel() && isEqual(editor.getModel().uri, hookFileUri)) {
      const model = editor.getModel();
      model.pushEditOperations([], [{
        range: model.getFullModelRange(),
        text: jsonContent
      }], () => null);
      const selection = findHookCommandSelection(jsonContent, keyToUse, newHookIndex, "command");
      if (selection && selection.endLineNumber !== void 0 && selection.endColumn !== void 0) {
        editor.setSelection({
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn
        });
        editor.revealLineInCenter(selection.startLineNumber);
      }
    } else {
      await bulkEditService.apply([
        new ResourceTextEdit(hookFileUri, { range: new Range(1, 1, Number.MAX_SAFE_INTEGER, 1), text: jsonContent })
      ], { label: localize("addHook", "Add Hook") });
      const selection = findHookCommandSelection(jsonContent, keyToUse, newHookIndex, "command");
      await editorService.openEditor({
        resource: hookFileUri,
        options: {
          selection,
          pinned: false
        }
      });
    }
  } else {
    if (!fileExists) {
      await fileService.writeFile(hookFileUri, VSBuffer.fromString(jsonContent));
    } else {
      await editorService.openEditor({
        resource: hookFileUri,
        options: { pinned: false }
      });
      await bulkEditService.apply([
        new ResourceTextEdit(hookFileUri, { range: new Range(1, 1, Number.MAX_SAFE_INTEGER, 1), text: jsonContent })
      ], { label: localize("addHook", "Add Hook") });
    }
    const selection = findHookCommandSelection(jsonContent, keyToUse, newHookIndex, "command");
    if (openEditorOverride) {
      await openEditorOverride(hookFileUri, { selection });
    } else {
      await editorService.openEditor({
        resource: hookFileUri,
        options: {
          selection,
          pinned: false
        }
      });
    }
  }
}
function awaitPick(picker, backButton) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (value) => {
      if (!resolved) {
        resolved = true;
        disposables.dispose();
        resolve(value);
      }
    };
    const disposables = new DisposableStore();
    disposables.add(picker.onDidAccept(() => {
      done(picker.activeItems[0]);
    }));
    disposables.add(picker.onDidTriggerButton((button) => {
      if (button === backButton) {
        done("back");
      }
    }));
    disposables.add(picker.onDidHide(() => {
      done(void 0);
    }));
  });
}
var Step = /* @__PURE__ */ ((Step2) => {
  Step2[Step2["SelectHookType"] = 1] = "SelectHookType";
  Step2[Step2["SelectHook"] = 2] = "SelectHook";
  Step2[Step2["SelectFile"] = 3] = "SelectFile";
  Step2[Step2["SelectFolder"] = 4] = "SelectFolder";
  Step2[Step2["EnterFilename"] = 5] = "EnterFilename";
  return Step2;
})(Step || {});
async function showConfigureHooksQuickPick(accessor, options) {
  const promptsService = accessor.get(IPromptsService);
  const quickInputService = accessor.get(IQuickInputService);
  const fileService = accessor.get(IFileService);
  const labelService = accessor.get(ILabelService);
  const editorService = accessor.get(IEditorService);
  const workspaceService = accessor.get(IWorkspaceContextService);
  const pathService = accessor.get(IPathService);
  const notificationService = accessor.get(INotificationService);
  const bulkEditService = accessor.get(IBulkEditService);
  const remoteAgentService = accessor.get(IRemoteAgentService);
  const remoteEnv = await remoteAgentService.getEnvironment();
  const targetOS = remoteEnv?.os ?? OS;
  const workspaceFolder = workspaceService.getWorkspace().folders[0];
  const workspaceRootUri = workspaceFolder?.uri;
  const userHomeUri = await pathService.userHome();
  const userHome = userHomeUri.fsPath ?? userHomeUri.path;
  const hookEntries = await parseAllHookFiles(
    promptsService,
    fileService,
    labelService,
    workspaceRootUri,
    userHome,
    targetOS,
    CancellationToken.None,
    { includeAgentHooks: true }
  );
  const hookCountByType = /* @__PURE__ */ new Map();
  for (const entry of hookEntries) {
    hookCountByType.set(entry.hookType, (hookCountByType.get(entry.hookType) ?? 0) + 1);
  }
  const store = new DisposableStore();
  const picker = store.add(quickInputService.createQuickPick({ useSeparators: true }));
  const backButton = quickInputService.backButton;
  picker.show();
  let step = 1 /* SelectHookType */;
  let selectedHookType;
  let selectedHook;
  let selectedFile;
  let selectedFolder;
  const stepHistory = [];
  const goBack = () => stepHistory.pop();
  try {
    while (true) {
      switch (step) {
        case 1 /* SelectHookType */: {
          const makeItem = ([hookType, meta]) => {
            const count = hookCountByType.get(hookType) ?? 0;
            const countLabel = count > 0 ? ` (${count})` : "";
            return {
              label: `${meta.label}${countLabel}`,
              description: meta.description,
              hookType,
              hookTypeMeta: meta
            };
          };
          let pickerItems;
          if (options?.target) {
            const targetHookTypes = new Set(Object.values(HOOKS_BY_TARGET[options.target]));
            pickerItems = Object.entries(HOOK_METADATA).filter(([hookType]) => targetHookTypes.has(hookType)).map(makeItem);
          } else {
            const vscodeTypes = new Set(Object.values(HOOKS_BY_TARGET[Target.VSCode]));
            const copilotTypes = new Set(Object.values(HOOKS_BY_TARGET[Target.GitHubCopilot]));
            const allEntries = Object.entries(HOOK_METADATA);
            const shared = allEntries.filter(([h]) => vscodeTypes.has(h) && copilotTypes.has(h));
            const vscodeOnly = allEntries.filter(([h]) => vscodeTypes.has(h) && !copilotTypes.has(h));
            const copilotOnly = allEntries.filter(([h]) => !vscodeTypes.has(h) && copilotTypes.has(h));
            pickerItems = [];
            if (shared.length > 0) {
              pickerItems.push({ type: "separator", label: localize("hookSection.default", "Local/Copilot CLI Agents") });
              pickerItems.push(...shared.map(makeItem));
            }
            if (vscodeOnly.length > 0) {
              pickerItems.push({ type: "separator", label: localize("hookSection.vscodeOnly", "Local Agents") });
              pickerItems.push(...vscodeOnly.map(makeItem));
            }
            if (copilotOnly.length > 0) {
              pickerItems.push({ type: "separator", label: localize("hookSection.copilotCliOnly", "Copilot CLI Agents") });
              pickerItems.push(...copilotOnly.map(makeItem));
            }
          }
          picker.items = pickerItems;
          picker.value = "";
          picker.placeholder = localize("commands.hooks.selectEvent.placeholder", "Select a lifecycle event");
          picker.title = localize("commands.hooks.title", "Hooks");
          picker.buttons = [];
          const result = await awaitPick(picker, backButton);
          if (!result || result === "back") {
            return;
          }
          selectedHookType = result;
          stepHistory.push(1 /* SelectHookType */);
          step = 2 /* SelectHook */;
          break;
        }
        case 2 /* SelectHook */: {
          const hooksOfType = hookEntries.filter((h) => h.hookType === selectedHookType.hookType);
          const fileHooks = hooksOfType.filter((h) => !h.agentName);
          const agentHooks = hooksOfType.filter((h) => h.agentName);
          const hookItems = [];
          hookItems.push({
            label: `$(plus) ${localize("commands.addNewHook.label", "Add new hook...")}`,
            isAddNewHook: true,
            alwaysShow: true
          });
          if (fileHooks.length > 0) {
            hookItems.push({
              type: "separator",
              label: localize("existingHooks", "Existing Hooks")
            });
            for (const entry of fileHooks) {
              const description = labelService.getUriLabel(entry.fileUri, { relative: true });
              hookItems.push({
                label: entry.commandLabel,
                description,
                hookEntry: entry
              });
            }
          }
          if (agentHooks.length > 0) {
            const agentNames = [...new Set(agentHooks.map((h) => h.agentName))];
            for (const agentName of agentNames) {
              hookItems.push({
                type: "separator",
                label: localize("agentHooks", "Agent: {0}", agentName)
              });
              for (const entry of agentHooks.filter((h) => h.agentName === agentName)) {
                const description = labelService.getUriLabel(entry.fileUri, { relative: true });
                hookItems.push({
                  label: entry.commandLabel,
                  description,
                  hookEntry: entry
                });
              }
            }
          }
          if (hooksOfType.length === 0) {
            selectedHook = hookItems[0];
          } else {
            picker.items = hookItems;
            picker.value = "";
            picker.placeholder = localize("commands.hooks.selectHook.placeholder", "Select a hook to open or add a new one");
            picker.title = selectedHookType.hookTypeMeta.label;
            picker.buttons = [backButton];
            const result = await awaitPick(picker, backButton);
            if (result === "back") {
              step = goBack() ?? 1 /* SelectHookType */;
              break;
            }
            if (!result) {
              return;
            }
            selectedHook = result;
            stepHistory.push(2 /* SelectHook */);
          }
          if (selectedHook.hookEntry) {
            const entry = selectedHook.hookEntry;
            let selection;
            if (entry.agentName) {
              try {
                const content = await fileService.readFile(entry.fileUri);
                const commandText = formatHookCommandLabel(entry.command, targetOS);
                if (commandText) {
                  selection = findHookCommandInYaml(content.value.toString(), commandText);
                }
              } catch {
              }
            } else {
              const commandFieldName = getEffectiveCommandFieldKey(entry.command, targetOS);
              if (commandFieldName) {
                try {
                  const content = await fileService.readFile(entry.fileUri);
                  selection = findHookCommandSelection(
                    content.value.toString(),
                    entry.originalHookTypeId,
                    entry.index,
                    commandFieldName
                  );
                } catch {
                }
              }
            }
            if (options?.openEditor) {
              await options.openEditor(entry.fileUri, { selection });
            } else {
              await editorService.openEditor({
                resource: entry.fileUri,
                options: {
                  selection,
                  pinned: false
                }
              });
            }
            return;
          }
          step = 3 /* SelectFile */;
          break;
        }
        case 3 /* SelectFile */: {
          const hookFiles = await promptsService.listPromptFilesForStorage(PromptsType.hook, PromptsStorage.local, CancellationToken.None);
          const fileItems = [];
          fileItems.push({
            label: `$(new-file) ${localize("commands.createNewHookFile.label", "Create new hook config file...")}`,
            isCreateNewFile: true,
            alwaysShow: true
          });
          if (hookFiles.length > 0) {
            fileItems.push({
              type: "separator",
              label: localize("existingHookFiles", "Existing Hook Files")
            });
            for (const hookFile of hookFiles) {
              const relativePath = labelService.getUriLabel(hookFile.uri, { relative: true });
              fileItems.push({
                label: relativePath,
                fileUri: hookFile.uri
              });
            }
          }
          if (hookFiles.length === 0) {
            selectedFile = fileItems[0];
          } else {
            picker.items = fileItems;
            picker.value = "";
            picker.placeholder = localize("commands.hooks.selectFile.placeholder", "Select a hook file or create a new one");
            picker.title = localize("commands.hooks.addHook.title", "Add Hook");
            picker.buttons = [backButton];
            const result = await awaitPick(picker, backButton);
            if (result === "back") {
              step = goBack() ?? 2 /* SelectHook */;
              break;
            }
            if (!result) {
              return;
            }
            selectedFile = result;
            stepHistory.push(3 /* SelectFile */);
          }
          if (selectedFile.fileUri) {
            await addHookToFile(
              selectedFile.fileUri,
              selectedHookType.hookType,
              fileService,
              editorService,
              notificationService,
              bulkEditService,
              options?.openEditor
            );
            return;
          }
          step = 4 /* SelectFolder */;
          break;
        }
        case 4 /* SelectFolder */: {
          const allFolders = await promptsService.getSourceFolders(PromptsType.hook);
          if (allFolders.length === 0) {
            notificationService.error(localize("commands.hook.noLocalFolders", "Please open a workspace folder to configure hooks."));
            return;
          }
          selectedFolder = allFolders[0];
          if (allFolders.length > 1) {
            const folderItems = allFolders.map((folder, index) => {
              const basePath = labelService.getUriLabel(folder.uri, { relative: folder.storage === PromptsStorage.local });
              const label = index === 0 ? localize("commands.hook.defaultFolder", "{0} (default)", basePath) : basePath;
              return {
                label,
                description: folder.source ? getSourceDescription(folder.source) : void 0,
                folder
              };
            });
            picker.items = folderItems;
            picker.value = "";
            picker.placeholder = localize("commands.hook.selectFolder.placeholder", "Select a location for the hook file");
            picker.title = localize("commands.hook.selectFolder.title", "Hook File Location");
            picker.buttons = [backButton];
            const result = await awaitPick(picker, backButton);
            if (result === "back") {
              step = goBack() ?? 3 /* SelectFile */;
              break;
            }
            if (!result) {
              return;
            }
            selectedFolder = result.folder;
            stepHistory.push(4 /* SelectFolder */);
          }
          step = 5 /* EnterFilename */;
          break;
        }
        case 5 /* EnterFilename */: {
          picker.hide();
          const fileNameResult = await new Promise((resolve) => {
            let resolved = false;
            const done = (value) => {
              if (!resolved) {
                resolved = true;
                inputDisposables.dispose();
                resolve(value);
              }
            };
            const inputDisposables = new DisposableStore();
            const inputBox = inputDisposables.add(quickInputService.createInputBox());
            inputBox.prompt = localize("commands.hook.filename.prompt", "Enter hook file name");
            inputBox.placeholder = localize("commands.hook.filename.placeholder", "e.g., hooks, diagnostics, security");
            inputBox.title = localize("commands.hook.filename.title", "Hook File Name");
            inputBox.buttons = [backButton];
            inputBox.ignoreFocusOut = true;
            inputDisposables.add(inputBox.onDidAccept(async () => {
              const value = inputBox.value;
              if (!value || !value.trim()) {
                inputBox.validationMessage = localize("commands.hook.filename.required", "File name is required");
                return;
              }
              const name = value.trim();
              if (/[/\\:*?"<>|]/.test(name)) {
                inputBox.validationMessage = localize("commands.hook.filename.invalidChars", "File name contains invalid characters");
                return;
              }
              done(name);
            }));
            inputDisposables.add(inputBox.onDidChangeValue(() => {
              inputBox.validationMessage = void 0;
            }));
            inputDisposables.add(inputBox.onDidTriggerButton((button) => {
              if (button === backButton) {
                done("back");
              }
            }));
            inputDisposables.add(inputBox.onDidHide(() => {
              done(void 0);
            }));
            inputBox.show();
          });
          if (fileNameResult === "back") {
            picker.show();
            step = goBack() ?? 4 /* SelectFolder */;
            break;
          }
          if (!fileNameResult) {
            return;
          }
          await fileService.createFolder(selectedFolder.uri);
          const hookFileName = fileNameResult.endsWith(".json") ? fileNameResult : `${fileNameResult}.json`;
          const hookFileUri = URI.joinPath(selectedFolder.uri, hookFileName);
          if (await fileService.exists(hookFileUri)) {
            await addHookToFile(
              hookFileUri,
              selectedHookType.hookType,
              fileService,
              editorService,
              notificationService,
              bulkEditService,
              options?.openEditor
            );
            return;
          }
          const newFileFormat = getHookSourceFormat(hookFileUri);
          const isClaudeNewFile = newFileFormat === HookSourceFormat.Claude;
          const isCopilotCliOnly = !isClaudeNewFile && !new Set(Object.values(HOOKS_BY_TARGET[Target.VSCode])).has(selectedHookType.hookType) && new Set(Object.values(HOOKS_BY_TARGET[Target.GitHubCopilot])).has(selectedHookType.hookType);
          const hookTypeKey = isClaudeNewFile ? getClaudeHookTypeName(selectedHookType.hookType) ?? selectedHookType.hookType : isCopilotCliOnly ? getCopilotCliHookTypeName(selectedHookType.hookType) ?? selectedHookType.hookType : selectedHookType.hookType;
          const newFileHookEntry = isCopilotCliOnly ? { type: "command", [targetOS === OperatingSystem.Windows ? "powershell" : "bash"]: "" } : buildNewHookEntry(newFileFormat);
          const commandFieldKey = isCopilotCliOnly ? targetOS === OperatingSystem.Windows ? "powershell" : "bash" : "command";
          const hooksContent = {
            ...isCopilotCliOnly ? { version: 1 } : {},
            hooks: {
              [hookTypeKey]: [
                newFileHookEntry
              ]
            }
          };
          const jsonContent = JSON.stringify(hooksContent, null, "	");
          await fileService.writeFile(hookFileUri, VSBuffer.fromString(jsonContent));
          options?.onHookFileCreated?.(hookFileUri);
          const selection = findHookCommandSelection(jsonContent, hookTypeKey, 0, commandFieldKey);
          if (options?.openEditor) {
            await options.openEditor(hookFileUri, { selection });
          } else {
            await editorService.openEditor({
              resource: hookFileUri,
              options: {
                selection,
                pinned: false
              }
            });
          }
          return;
        }
      }
    }
  } finally {
    store.dispose();
  }
}
class ManageHooksAction extends Action2 {
  constructor() {
    super({
      id: CONFIGURE_HOOKS_ACTION_ID,
      title: localize2("configure-hooks", "Configure Hooks..."),
      shortTitle: localize2("configure-hooks.short", "Hooks"),
      icon: Codicon.zap,
      f1: true,
      precondition: ChatContextKeys.enabled,
      category: CHAT_CATEGORY,
      menu: {
        id: CHAT_CONFIG_MENU_ID,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.equals("view", ChatViewId)),
        order: 12,
        group: "1_level"
      }
    });
  }
  async run(accessor) {
    return showConfigureHooksQuickPick(accessor);
  }
}
function registerHookActions() {
  registerAction2(ManageHooksAction);
}
export {
  registerHookActions,
  showConfigureHooksQuickPick
};
