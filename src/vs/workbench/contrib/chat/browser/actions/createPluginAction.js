import { VSBuffer } from "../../../../../base/common/buffer.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { parse as parseJSONC } from "../../../../../base/common/jsonc.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { basename, dirname, joinPath } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { isUriComponents, URI } from "../../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IFileDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { InstalledAgentPluginsViewId } from "../chat.js";
import { ChatContextKeys } from "../../common/actions/chatContextKeys.js";
import { PromptsType } from "../../common/promptSyntax/promptTypes.js";
import { IPromptsService, PromptsStorage } from "../../common/promptSyntax/service/promptsService.js";
import { IMcpRegistry } from "../../../mcp/common/mcpRegistryTypes.js";
import { McpCollectionSortOrder, McpServerTransportType } from "../../../mcp/common/mcpTypes.js";
import { CHAT_CATEGORY } from "./chatActions.js";
const VALID_PLUGIN_NAME = /^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$/;
const INVALID_CONSECUTIVE = /--|[.][.]/;
function validatePluginName(name) {
  if (!name) {
    return localize("pluginNameRequired", "Plugin name is required.");
  }
  if (name.length > 64) {
    return localize("pluginNameTooLong", "Plugin name must be at most 64 characters.");
  }
  if (!VALID_PLUGIN_NAME.test(name)) {
    return localize("pluginNameInvalid", "Plugin name must contain only lowercase alphanumeric characters, hyphens, and periods, and must start and end with an alphanumeric character.");
  }
  if (INVALID_CONSECUTIVE.test(name)) {
    return localize("pluginNameConsecutive", "Plugin name must not contain consecutive hyphens or periods.");
  }
  return void 0;
}
function isUserDefined(storage) {
  return storage === PromptsStorage.local || storage === PromptsStorage.user;
}
function isUserDefinedMcpCollection(collection) {
  const order = collection.order;
  return order === McpCollectionSortOrder.User || order === McpCollectionSortOrder.WorkspaceFolder || order === McpCollectionSortOrder.Workspace;
}
function getResourceLabel(r) {
  if (r.name) {
    return r.name;
  }
  if (r.type === PromptsType.skill && basename(r.uri).toLowerCase() === "skill.md") {
    return basename(dirname(r.uri));
  }
  return basename(r.uri);
}
function getResourceFileName(r) {
  const label = getResourceLabel(r);
  const colonIndex = label.indexOf(":");
  return colonIndex >= 0 ? label.substring(colonIndex + 1) : label;
}
class CreatePluginAction extends Action2 {
  static {
    this.ID = "workbench.action.chat.createPlugin";
  }
  constructor() {
    super({
      id: CreatePluginAction.ID,
      title: localize2("chat.createPlugin", "Create Plugin"),
      category: CHAT_CATEGORY,
      f1: true,
      precondition: ChatContextKeys.enabled,
      icon: Codicon.save,
      menu: [{
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("view", InstalledAgentPluginsViewId),
          ChatContextKeys.Setup.hidden.negate(),
          ChatContextKeys.Setup.disabledInWorkspace.negate()
        ),
        group: "navigation",
        order: 2
      }]
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const promptsService = accessor.get(IPromptsService);
    const mcpRegistry = accessor.get(IMcpRegistry);
    const fileDialogService = accessor.get(IFileDialogService);
    const fileService = accessor.get(IFileService);
    const commandService = accessor.get(ICommandService);
    const notificationService = accessor.get(INotificationService);
    const [instructions, prompts, agents, skills, hooks] = await (async () => {
      const cts = new CancellationTokenSource();
      try {
        return await Promise.all([
          promptsService.listPromptFiles(PromptsType.instructions, cts.token),
          promptsService.listPromptFiles(PromptsType.prompt, cts.token),
          promptsService.listPromptFiles(PromptsType.agent, cts.token),
          promptsService.listPromptFiles(PromptsType.skill, cts.token),
          promptsService.listPromptFiles(PromptsType.hook, cts.token)
        ]);
      } finally {
        cts.dispose(true);
      }
    })();
    const mcpCollections = mcpRegistry.collections.get();
    let showAll = false;
    const buildTree = () => {
      const groups = [];
      const addGroup = (resources, resourceType, groupLabel, icon) => {
        const filtered = showAll ? resources : resources.filter((r) => isUserDefined(r.storage));
        if (filtered.length === 0) {
          return;
        }
        const children = filtered.map((r) => ({
          label: getResourceLabel(r),
          description: r.storage,
          resourceType,
          promptPath: r,
          checked: false
        }));
        groups.push({
          label: groupLabel,
          iconClass: ThemeIcon.asClassName(icon),
          checked: void 0,
          collapsed: false,
          pickable: false,
          children
        });
      };
      addGroup(instructions, "instruction", localize("instructions", "Instructions"), Codicon.book);
      addGroup(prompts, "prompt", localize("prompts", "Prompts"), Codicon.comment);
      addGroup(agents, "agent", localize("agents", "Agents"), Codicon.copilot);
      addGroup(skills, "skill", localize("skills", "Skills"), Codicon.lightbulb);
      addGroup(hooks, "hook", localize("hooks", "Hooks"), Codicon.zap);
      const mcpChildren = [];
      for (const collection of mcpCollections) {
        if (!showAll && !isUserDefinedMcpCollection(collection)) {
          continue;
        }
        const defs = collection.serverDefinitions.get();
        for (const def of defs) {
          mcpChildren.push({
            label: def.label,
            description: collection.label,
            resourceType: "mcp",
            mcpServer: { collection, definition: def },
            checked: false
          });
        }
      }
      if (mcpChildren.length > 0) {
        groups.push({
          label: localize("mcpServers", "MCP Servers"),
          iconClass: ThemeIcon.asClassName(Codicon.mcp),
          checked: void 0,
          collapsed: false,
          pickable: false,
          children: mcpChildren
        });
      }
      return groups;
    };
    const disposables = new DisposableStore();
    const tree = disposables.add(quickInputService.createQuickTree());
    tree.placeholder = localize("selectResources", "Select resources to include in the plugin");
    tree.matchOnDescription = true;
    tree.matchOnLabel = true;
    tree.sortByLabel = false;
    tree.title = localize("createPluginTitle", "Create Plugin");
    tree.setItemTree(buildTree());
    const toggleButton = { iconClass: ThemeIcon.asClassName(Codicon.filter), tooltip: localize("showAll", "Show Built-in, Extension, and Plugin Resources") };
    tree.buttons = [toggleButton];
    disposables.add(tree.onDidTriggerButton((button) => {
      if (button === toggleButton) {
        showAll = !showAll;
        tree.setItemTree(buildTree());
      }
    }));
    const selectedItems = await new Promise((resolve) => {
      disposables.add(tree.onDidAccept(() => {
        resolve(tree.checkedLeafItems);
        tree.hide();
      }));
      disposables.add(tree.onDidHide(() => {
        resolve(void 0);
      }));
      tree.show();
    });
    disposables.dispose();
    if (!selectedItems || selectedItems.length === 0) {
      return;
    }
    const selected = selectedItems.filter((i) => !!i.resourceType);
    const pluginName = await quickInputService.input({
      prompt: localize("pluginNamePrompt", "Enter a name for the plugin"),
      placeHolder: "my-plugin",
      validateInput: async (value) => validatePluginName(value)
    });
    if (!pluginName) {
      return;
    }
    const folderUris = await fileDialogService.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      title: localize("selectPluginLocation", "Select Plugin Save Location"),
      openLabel: localize("selectFolder", "Select Folder")
    });
    if (!folderUris || folderUris.length === 0) {
      return;
    }
    const targetDir = folderUris[0];
    const pluginRoot = joinPath(targetDir, pluginName);
    if (await fileService.exists(pluginRoot)) {
      notificationService.error(localize("pluginExists", "A directory named '{0}' already exists at this location. Please choose a different name or location.", pluginName));
      return;
    }
    try {
      await writePluginToDisk(fileService, pluginRoot, pluginName, selected);
      await updateMarketplaceIfNeeded(fileService, targetDir, pluginName);
      try {
        await commandService.executeCommand("revealFileInOS", pluginRoot);
      } catch {
      }
      notificationService.info(localize("pluginCreated", "Plugin '{0}' created successfully.", pluginName));
    } catch (err) {
      notificationService.error(localize("pluginCreateError", "Failed to create plugin: {0}", String(err)));
    }
  }
}
async function writePluginToDisk(fileService, pluginRoot, pluginName, selected) {
  await fileService.createFolder(pluginRoot);
  const manifestDir = joinPath(pluginRoot, ".plugin");
  await fileService.createFolder(manifestDir);
  const manifest = {
    name: pluginName,
    version: "1.0.0",
    description: ""
  };
  await fileService.writeFile(joinPath(manifestDir, "plugin.json"), VSBuffer.fromString(JSON.stringify(manifest, null, "	")));
  const byType = {
    instruction: selected.filter((i) => i.resourceType === "instruction"),
    prompt: selected.filter((i) => i.resourceType === "prompt"),
    agent: selected.filter((i) => i.resourceType === "agent"),
    skill: selected.filter((i) => i.resourceType === "skill"),
    hook: selected.filter((i) => i.resourceType === "hook"),
    mcp: selected.filter((i) => i.resourceType === "mcp")
  };
  if (byType.instruction.length > 0) {
    const rulesDir = joinPath(pluginRoot, "rules");
    await fileService.createFolder(rulesDir);
    for (const item of byType.instruction) {
      if (!item.promptPath) {
        continue;
      }
      const name = getResourceFileName(item.promptPath);
      const fileName = name.endsWith(".instructions.md") || name.endsWith(".mdc") || name.endsWith(".md") ? name : name + ".instructions.md";
      const content = await fileService.readFile(item.promptPath.uri);
      await fileService.writeFile(joinPath(rulesDir, fileName), content.value);
    }
  }
  if (byType.prompt.length > 0) {
    const commandsDir = joinPath(pluginRoot, "commands");
    await fileService.createFolder(commandsDir);
    for (const item of byType.prompt) {
      if (!item.promptPath) {
        continue;
      }
      const name = getResourceFileName(item.promptPath);
      const fileName = name.endsWith(".md") ? name : name + ".md";
      const content = await fileService.readFile(item.promptPath.uri);
      await fileService.writeFile(joinPath(commandsDir, fileName), content.value);
    }
  }
  if (byType.agent.length > 0) {
    const agentsDir = joinPath(pluginRoot, "agents");
    await fileService.createFolder(agentsDir);
    for (const item of byType.agent) {
      if (!item.promptPath) {
        continue;
      }
      const name = getResourceFileName(item.promptPath);
      const fileName = name.endsWith(".md") ? name : name + ".md";
      const content = await fileService.readFile(item.promptPath.uri);
      await fileService.writeFile(joinPath(agentsDir, fileName), content.value);
    }
  }
  if (byType.skill.length > 0) {
    const skillsDir = joinPath(pluginRoot, "skills");
    await fileService.createFolder(skillsDir);
    for (const item of byType.skill) {
      if (!item.promptPath) {
        continue;
      }
      const sourceUri = item.promptPath.uri;
      const skillName = getResourceFileName(item.promptPath);
      const sourceName = basename(sourceUri);
      const isFile = sourceName.toLowerCase() === "skill.md";
      const skillSourceDir = isFile ? joinPath(sourceUri, "..") : sourceUri;
      const destSkillDir = joinPath(skillsDir, skillName);
      await copyDirectory(fileService, skillSourceDir, destSkillDir);
    }
  }
  if (byType.hook.length > 0) {
    const hooksDir = joinPath(pluginRoot, "hooks");
    await fileService.createFolder(hooksDir);
    const mergedHooks = {};
    for (const item of byType.hook) {
      if (!item.promptPath) {
        continue;
      }
      try {
        const content = await fileService.readFile(item.promptPath.uri);
        const parsed = parseJSONC(content.value.toString());
        const hooksObj = parsed?.hooks ?? parsed;
        if (hooksObj && typeof hooksObj === "object") {
          for (const [hookType, commands] of Object.entries(hooksObj)) {
            if (Array.isArray(commands)) {
              if (!mergedHooks[hookType]) {
                mergedHooks[hookType] = [];
              }
              for (const cmd of commands) {
                mergedHooks[hookType].push(serializeHookCommand(cmd));
              }
            }
          }
        }
      } catch {
      }
    }
    const hooksJson = { hooks: mergedHooks };
    await fileService.writeFile(
      joinPath(hooksDir, "hooks.json"),
      VSBuffer.fromString(JSON.stringify(hooksJson, null, "	"))
    );
  }
  if (byType.mcp.length > 0) {
    const mcpServers = {};
    for (const item of byType.mcp) {
      if (!item.mcpServer) {
        continue;
      }
      const def = item.mcpServer.definition;
      mcpServers[def.label] = serializeMcpLaunch(def.launch);
    }
    const mcpJson = { mcpServers };
    await fileService.writeFile(
      joinPath(pluginRoot, ".mcp.json"),
      VSBuffer.fromString(JSON.stringify(mcpJson, null, "	"))
    );
  }
}
function serializeHookCommand(cmd) {
  const result = { type: "command" };
  if (typeof cmd.command === "string") {
    result["command"] = cmd.command;
  }
  if (typeof cmd.windows === "string") {
    result["windows"] = cmd.windows;
  }
  if (typeof cmd.linux === "string") {
    result["linux"] = cmd.linux;
  }
  if (typeof cmd.osx === "string") {
    result["osx"] = cmd.osx;
  }
  if (cmd.cwd !== void 0) {
    result["cwd"] = isUriComponents(cmd.cwd) ? URI.revive(cmd.cwd).fsPath : String(cmd.cwd);
  }
  if (cmd.env && typeof cmd.env === "object" && Object.keys(cmd.env).length > 0) {
    result["env"] = cmd.env;
  }
  if (typeof cmd.timeout === "number") {
    result["timeout"] = cmd.timeout;
  }
  return result;
}
function serializeMcpLaunch(launch) {
  if (launch.type === McpServerTransportType.Stdio) {
    const result = {
      type: "stdio",
      command: launch.command
    };
    if (launch.args.length > 0) {
      result["args"] = [...launch.args];
    }
    if (launch.cwd) {
      result["cwd"] = launch.cwd;
    }
    if (Object.keys(launch.env).length > 0) {
      result["env"] = { ...launch.env };
    }
    return result;
  } else {
    const result = {
      type: "http",
      url: launch.uri.toString()
    };
    if (launch.headers.length > 0) {
      const headers = {};
      for (const [key, value] of launch.headers) {
        headers[key] = value;
      }
      result["headers"] = headers;
    }
    return result;
  }
}
async function copyDirectory(fileService, source, target) {
  const stat = await fileService.resolve(source);
  if (stat.isDirectory) {
    await fileService.createFolder(target);
    if (stat.children) {
      for (const child of stat.children) {
        const childName = basename(child.resource);
        await copyDirectory(fileService, child.resource, joinPath(target, childName));
      }
    }
  } else {
    const content = await fileService.readFile(source);
    await fileService.writeFile(target, content.value);
  }
}
const MARKETPLACE_PATHS = [
  "marketplace.json",
  ".plugin/marketplace.json"
];
async function updateMarketplaceIfNeeded(fileService, targetDir, pluginName) {
  for (const relPath of MARKETPLACE_PATHS) {
    const marketplaceUri = joinPath(targetDir, relPath);
    if (await fileService.exists(marketplaceUri)) {
      try {
        const content = await fileService.readFile(marketplaceUri);
        const marketplace = parseJSONC(content.value.toString());
        if (marketplace && typeof marketplace === "object") {
          if (!Array.isArray(marketplace["plugins"])) {
            marketplace["plugins"] = [];
          }
          const plugins = marketplace["plugins"];
          if (plugins.some((p) => p.name === pluginName)) {
            return;
          }
          plugins.push({
            name: pluginName,
            source: `./${pluginName}/`
          });
          await fileService.writeFile(
            marketplaceUri,
            VSBuffer.fromString(JSON.stringify(marketplace, null, "	"))
          );
        }
      } catch {
      }
      return;
    }
  }
}
function registerCreatePluginAction() {
  const store = new DisposableStore();
  store.add(registerAction2(CreatePluginAction));
  return store;
}
export {
  copyDirectory,
  getResourceFileName,
  getResourceLabel,
  registerCreatePluginAction,
  serializeHookCommand,
  serializeMcpLaunch,
  updateMarketplaceIfNeeded,
  validatePluginName,
  writePluginToDisk
};
