import { localize, localize2 } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { Action } from "../../../../../base/common/actions.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { isCancellationError } from "../../../../../base/common/errors.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { StopWatch } from "../../../../../base/common/stopwatch.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { isCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { EndOfLinePreference } from "../../../../../editor/common/model.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { SnippetController2 } from "../../../../../editor/contrib/snippet/browser/snippetController2.js";
import { IEditorService } from "../../../../../workbench/services/editor/common/editorService.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IRemoteAgentHostService, parseRemoteAgentHostInput, RemoteAgentHostConnectionStatus, RemoteAgentHostEntryType, RemoteAgentHostInputValidationError, RemoteAgentHostsEnabledSettingId } from "../../../../../platform/agentHost/common/remoteAgentHostService.js";
import { ISSHRemoteAgentHostService, isSSHHostKeyDeniedError, SSHAuthMethod } from "../../../../../platform/agentHost/common/sshRemoteAgentHost.js";
import { ITunnelAgentHostService, TUNNEL_ADDRESS_PREFIX } from "../../../../../platform/agentHost/common/tunnelAgentHost.js";
import { IWSLRemoteAgentHostService, WSL_INSTALL_DOCS_URL } from "../../../../../platform/agentHost/common/wslRemoteAgentHost.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IAuthenticationService } from "../../../../../workbench/services/authentication/common/authentication.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { SessionsCategories } from "../../../../common/categories.js";
import { categorizeSSHConnectError, logSSHConnectAttempt } from "../../../../common/sessionsTelemetry.js";
import { SessionWorkspacePickerGroupContext } from "../../../../common/contextkeys.js";
import { Menus } from "../../../../browser/menus.js";
import { ISessionsService } from "../../../../services/sessions/browser/sessionsService.js";
import { ISessionsProvidersService } from "../../../../services/sessions/browser/sessionsProvidersService.js";
import { isAgentHostProvider } from "../../../../common/agentHostSessionsProvider.js";
import { runServerUpgrade } from "./remoteHostOptions.js";
import { SESSION_WORKSPACE_GROUP_REMOTE } from "../../../../services/sessions/common/session.js";
import { ISessionsPartService } from "../../../../services/sessions/browser/sessionsPartService.js";
const RemoteAgentHostCommandIds = {
  addRemoteAgentHost: "sessions.remoteAgentHost.add",
  connectViaSSH: "workbench.action.sessions.connectViaSSH",
  addNewSSHHost: "workbench.action.sessions.addNewSSHHost",
  configureSSHHosts: "workbench.action.sessions.configureSSHHosts",
  connectViaTunnel: "workbench.action.sessions.connectViaTunnel",
  connectViaWSL: "workbench.action.sessions.connectViaWSL",
  manageRemoteAgentHosts: "workbench.action.sessions.manageRemoteAgentHosts",
  updateRemoteAgentHost: "workbench.action.sessions.updateRemoteAgentHost"
};
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RemoteAgentHostCommandIds.addRemoteAgentHost,
      title: localize2("addRemoteAgentHost", "Add Remote Agent Host..."),
      category: SessionsCategories.Sessions,
      f1: true,
      precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true)
    });
  }
  async run(accessor) {
    const remoteAgentHostService = accessor.get(IRemoteAgentHostService);
    const quickInputService = accessor.get(IQuickInputService);
    const notificationService = accessor.get(INotificationService);
    const address = await quickInputService.input({
      title: localize("addRemoteTitle", "Add Remote Agent Host"),
      prompt: localize("addRemotePrompt", "Paste a host, host:port, or WebSocket URL. Example: {0}", "ws://127.0.0.1:8089"),
      placeHolder: "ws://127.0.0.1:8080?tkn=abc-123",
      ignoreFocusLost: true,
      validateInput: async (value) => {
        const result = parseRemoteAgentHostInput(value);
        if (result.error === RemoteAgentHostInputValidationError.Empty) {
          return localize("addRemoteValidationEmpty", "Enter a remote agent host address.");
        }
        if (result.error === RemoteAgentHostInputValidationError.Invalid) {
          return localize("addRemoteValidationInvalid", "Enter a valid host, host:port, or WebSocket URL.");
        }
        return void 0;
      }
    });
    if (!address) {
      return;
    }
    const parsed = parseRemoteAgentHostInput(address);
    if (!parsed.parsed) {
      return;
    }
    const defaultName = parsed.parsed.suggestedName;
    const name = await quickInputService.input({
      title: localize("nameRemoteTitle", "Name Remote Agent Host"),
      prompt: localize("nameRemotePrompt", "Enter a display name for this remote agent host."),
      placeHolder: localize("nameRemotePlaceholder", "My Remote"),
      value: defaultName,
      valueSelection: [0, defaultName.length],
      ignoreFocusLost: true,
      validateInput: async (value) => value.trim() ? void 0 : localize("nameRemoteValidationEmpty", "Enter a name for this remote agent host.")
    });
    if (!name?.trim()) {
      return;
    }
    try {
      await remoteAgentHostService.addRemoteAgentHost({
        name: name.trim(),
        connectionToken: parsed.parsed.connectionToken,
        connection: {
          type: RemoteAgentHostEntryType.WebSocket,
          address: parsed.parsed.address
        }
      });
    } catch {
      notificationService.error(localize("addRemoteFailed", "Failed to connect to remote agent host {0}.", parsed.parsed.address));
    }
  }
});
function parseSSHHostInput(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return void 0;
  }
  const atIdx = trimmed.indexOf("@");
  if (atIdx === 0 || atIdx === trimmed.length - 1) {
    return void 0;
  }
  let username;
  let hostPart;
  if (atIdx !== -1) {
    username = trimmed.substring(0, atIdx);
    hostPart = trimmed.substring(atIdx + 1);
  } else {
    hostPart = trimmed;
  }
  if (!hostPart) {
    return void 0;
  }
  let host;
  let port;
  const colonIdx = hostPart.lastIndexOf(":");
  if (colonIdx !== -1) {
    host = hostPart.substring(0, colonIdx);
    const portStr = hostPart.substring(colonIdx + 1);
    if (!host) {
      return void 0;
    }
    if (portStr) {
      const portNum = Number(portStr);
      if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) {
        return void 0;
      }
      port = portNum;
    }
  } else {
    host = hostPart;
  }
  if (!host) {
    return void 0;
  }
  return { host, username, port };
}
function validateSSHHostInput(value) {
  const v = value.trim();
  if (!v) {
    return localize("sshHostEmpty", "Enter an SSH host.");
  }
  const atIdx = v.indexOf("@");
  if (atIdx === 0) {
    return localize("sshUsernameMissingInHost", "Enter a username before '@'.");
  }
  if (atIdx === v.length - 1) {
    return localize("sshHostMissingAfterAt", "Enter a host name after '@'.");
  }
  const hostPart = atIdx !== -1 ? v.substring(atIdx + 1) : v;
  if (!hostPart) {
    return localize("sshHostMissingAfterAt", "Enter a host name after '@'.");
  }
  const colonIdx = hostPart.lastIndexOf(":");
  if (colonIdx !== -1) {
    const hostName = hostPart.substring(0, colonIdx);
    const portStr = hostPart.substring(colonIdx + 1);
    if (!hostName) {
      return localize("sshHostMissingAfterAt", "Enter a host name after '@'.");
    }
    if (portStr) {
      const portNum = Number(portStr);
      if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) {
        return localize("sshHostInvalidPort", "Enter a valid port number.");
      }
    }
  }
  return void 0;
}
async function promptToConnectViaSSH(accessor, options = {}) {
  const sshService = accessor.get(ISSHRemoteAgentHostService);
  const quickInputService = accessor.get(IQuickInputService);
  const notificationService = accessor.get(INotificationService);
  const instantiationService = accessor.get(IInstantiationService);
  const commandService = accessor.get(ICommandService);
  const configHosts = await sshService.listSSHConfigHosts().catch(() => []);
  const aliasItems = configHosts.map((h) => ({
    kind: "alias",
    hostAlias: h,
    label: h
  }));
  const addHostItem = {
    kind: "add-config",
    label: "$(plus) " + localize("sshAddNewHost", "Add New SSH Host..."),
    alwaysShow: true
  };
  const configureHostsItem = {
    kind: "configure",
    label: localize("sshConfigureHosts", "Configure SSH Hosts..."),
    alwaysShow: true
  };
  const newHostItem = {
    kind: "new-host",
    hostInput: "",
    label: "",
    alwaysShow: true
  };
  const result = await new Promise((resolve) => {
    const store = new DisposableStore();
    const picker = store.add(quickInputService.createQuickPick());
    picker.title = localize("sshHostTitle", "Connect via SSH");
    picker.placeholder = localize("sshHostPickerPlaceholder", "Select configured SSH host or enter user@host");
    picker.ignoreFocusOut = true;
    picker.matchOnDescription = true;
    if (options.showBackButton) {
      picker.buttons = [quickInputService.backButton];
    }
    let newHostVisible = false;
    const updateItems = () => {
      const items = [...aliasItems];
      if (newHostVisible) {
        items.push(newHostItem);
      }
      items.push(addHostItem);
      items.push(configureHostsItem);
      picker.items = items;
    };
    updateItems();
    store.add(picker.onDidChangeValue((value) => {
      const parsed2 = parseSSHHostInput(value);
      if (parsed2) {
        newHostItem.hostInput = value.trim();
        newHostItem.label = `\u27A4 ${value.trim()}`;
        if (!newHostVisible) {
          newHostVisible = true;
          updateItems();
        } else {
          picker.items = picker.items;
        }
      } else if (newHostVisible) {
        newHostVisible = false;
        updateItems();
      }
    }));
    store.add(picker.onDidTriggerButton((button) => {
      if (button === quickInputService.backButton) {
        resolve("back");
        picker.hide();
      }
    }));
    store.add(picker.onDidAccept(() => {
      const selected = picker.selectedItems[0];
      resolve(selected);
      picker.hide();
    }));
    store.add(picker.onDidHide(() => {
      resolve(void 0);
      store.dispose();
    }));
    picker.show();
  });
  if (result === "back") {
    return "back";
  }
  if (!result) {
    return;
  }
  if (result.kind === "add-config" || result.kind === "configure") {
    const cmdId = result.kind === "add-config" ? RemoteAgentHostCommandIds.addNewSSHHost : RemoteAgentHostCommandIds.configureSSHHosts;
    const onBackToSSH = () => instantiationService.invokeFunction((a) => promptToConnectViaSSH(a, options));
    await commandService.executeCommand(cmdId, onBackToSSH);
    return;
  }
  if (result.kind === "alias") {
    await instantiationService.invokeFunction(
      (accessor2) => connectToConfiguredSSHHost(accessor2, result.hostAlias)
    );
    return;
  }
  const newHost = result;
  const parsed = parseSSHHostInput(newHost.hostInput);
  if (!parsed) {
    notificationService.error(validateSSHHostInput(newHost.hostInput) ?? localize("sshHostInvalid", "Invalid SSH host."));
    return;
  }
  await instantiationService.invokeFunction(
    (accessor2) => promptForCredentialsAndConnect(accessor2, parsed.host, parsed.username, parsed.port)
  );
}
async function connectToConfiguredSSHHost(accessor, hostAlias) {
  const sshService = accessor.get(ISSHRemoteAgentHostService);
  const notificationService = accessor.get(INotificationService);
  const instantiationService = accessor.get(IInstantiationService);
  let resolvedConfig;
  try {
    resolvedConfig = await sshService.resolveSSHConfig(hostAlias);
  } catch (err) {
    notificationService.error(localize("sshResolveConfigFailed", "Failed to resolve SSH config for {0}: {1}", hostAlias, String(err)));
    return;
  }
  const host = resolvedConfig.hostname;
  const username = resolvedConfig.user;
  const port = resolvedConfig.port !== 22 ? resolvedConfig.port : void 0;
  const suggestedName = hostAlias;
  const defaultKeyPath = resolvedConfig.identityFile[0];
  if (username) {
    const config = {
      host,
      port,
      username,
      authMethod: SSHAuthMethod.Agent,
      privateKeyPath: defaultKeyPath,
      identityAgent: resolvedConfig.identityAgent,
      agentForward: resolvedConfig.forwardAgent || void 0,
      name: suggestedName,
      sshConfigHost: hostAlias
    };
    const connection = await instantiationService.invokeFunction(
      (accessor2) => connectWithProgress(accessor2, config, suggestedName)
    );
    if (connection) {
      await instantiationService.invokeFunction((accessor2) => promptForRemoteFolder(accessor2, connection));
    }
    return;
  }
  await instantiationService.invokeFunction(
    (accessor2) => promptForCredentialsAndConnect(accessor2, host, void 0, port, suggestedName, defaultKeyPath, resolvedConfig.identityAgent)
  );
}
async function promptForCredentialsAndConnect(accessor, host, username, port, suggestedName, defaultKeyPath, identityAgent) {
  const quickInputService = accessor.get(IQuickInputService);
  const instantiationService = accessor.get(IInstantiationService);
  if (!username) {
    const usernameInput = await quickInputService.input({
      title: localize("sshUsernameTitle", "SSH Username"),
      prompt: localize("sshUsernamePrompt", "Enter the username for {0}.", host),
      placeHolder: "root",
      ignoreFocusLost: true,
      validateInput: async (value) => value.trim() ? void 0 : localize("sshUsernameEmpty", "Enter a username.")
    });
    if (!usernameInput) {
      return;
    }
    username = usernameInput.trim();
  }
  const authPicks = [
    {
      method: SSHAuthMethod.Agent,
      label: localize("sshAuthAgent", "SSH Agent"),
      description: localize("sshAuthAgentDesc", "Use the running SSH agent for authentication")
    },
    {
      method: SSHAuthMethod.KeyFile,
      label: localize("sshAuthKey", "Private Key File"),
      description: localize("sshAuthKeyDesc", "Authenticate with a private key file")
    },
    {
      method: SSHAuthMethod.Password,
      label: localize("sshAuthPassword", "Password"),
      description: localize("sshAuthPasswordDesc", "Authenticate with a password")
    }
  ];
  const authPicked = await quickInputService.pick(authPicks, {
    title: localize("sshAuthTitle", "Authentication Method"),
    placeHolder: localize("sshAuthPlaceholder", "Choose how to authenticate with {0}", host)
  });
  if (!authPicked) {
    return;
  }
  const authMethod = authPicked.method;
  let privateKeyPath;
  let password;
  if (authMethod === SSHAuthMethod.KeyFile) {
    const keyPath = await quickInputService.input({
      title: localize("sshKeyTitle", "Private Key Path"),
      prompt: localize("sshKeyPrompt", "Enter the path to your SSH private key."),
      placeHolder: "~/.ssh/id_rsa",
      value: defaultKeyPath ?? "~/.ssh/id_rsa",
      ignoreFocusLost: true,
      validateInput: async (value) => value.trim() ? void 0 : localize("sshKeyEmpty", "Enter a key file path.")
    });
    if (!keyPath) {
      return;
    }
    privateKeyPath = keyPath.trim();
  } else if (authMethod === SSHAuthMethod.Password) {
    const pw = await quickInputService.input({
      title: localize("sshPasswordTitle", "SSH Password"),
      prompt: localize("sshPasswordPrompt", "Enter the password for {0}@{1}.", username, host),
      password: true,
      ignoreFocusLost: true,
      validateInput: async (value) => value ? void 0 : localize("sshPasswordEmpty", "Enter a password.")
    });
    if (!pw) {
      return;
    }
    password = pw;
  }
  const defaultName = suggestedName ?? `${username}@${host}`;
  const name = await quickInputService.input({
    title: localize("sshNameTitle", "Name Remote"),
    prompt: localize("sshNamePrompt", "Enter a display name for this SSH remote."),
    placeHolder: localize("sshNamePlaceholder", "My Remote"),
    value: defaultName,
    valueSelection: [0, defaultName.length],
    ignoreFocusLost: true,
    validateInput: async (value) => value.trim() ? void 0 : localize("sshNameEmpty", "Enter a name.")
  });
  if (!name) {
    return;
  }
  const config = {
    host,
    port,
    username,
    authMethod,
    privateKeyPath,
    identityAgent,
    password,
    name: name.trim()
  };
  const connection = await instantiationService.invokeFunction(
    (accessor2) => connectWithProgress(accessor2, config, host)
  );
  if (connection) {
    await instantiationService.invokeFunction((accessor2) => promptForRemoteFolder(accessor2, connection));
  }
}
async function connectWithProgress(accessor, config, displayHost) {
  const sshService = accessor.get(ISSHRemoteAgentHostService);
  const notificationService = accessor.get(INotificationService);
  const telemetryService = accessor.get(ITelemetryService);
  const stopwatch = StopWatch.create(false);
  const handle = notificationService.notify({
    severity: Severity.Info,
    message: localize("sshConnecting", "Connecting to {0} via SSH...", displayHost),
    progress: { infinite: true }
  });
  const expectedKey = config.sshConfigHost ? `ssh:${config.sshConfigHost}` : `${config.username}@${config.host}:${config.port ?? 22}`;
  const progressListener = sshService.onDidReportConnectProgress?.((progress) => {
    if (progress.connectionKey === expectedKey) {
      handle.updateMessage(progress.message);
    }
  });
  try {
    const connection = await sshService.connect(config);
    logSSHConnectAttempt(telemetryService, {
      operation: "connect",
      userInitiated: config.userInitiated ?? true,
      attempt: 1,
      durationMs: stopwatch.elapsed(),
      success: true,
      willRetry: false
    });
    handle.close();
    return connection;
  } catch (err) {
    logSSHConnectAttempt(telemetryService, {
      operation: "connect",
      userInitiated: config.userInitiated ?? true,
      attempt: 1,
      durationMs: stopwatch.elapsed(),
      success: false,
      willRetry: false,
      errorCategory: categorizeSSHConnectError(err)
    });
    handle.close();
    if (isCancellationError(err) || isSSHHostKeyDeniedError(err)) {
      return void 0;
    }
    notificationService.error(localize("sshConnectFailed", "Failed to connect via SSH to {0}: {1}", displayHost, String(err)));
    return void 0;
  } finally {
    progressListener?.dispose();
  }
}
async function promptForRemoteFolder(accessor, connection) {
  const sessionsProvidersService = accessor.get(ISessionsProvidersService);
  const sessionsService = accessor.get(ISessionsService);
  const sessionsPartService = accessor.get(ISessionsPartService);
  const provider = sessionsProvidersService.getProviders().find((p) => isAgentHostProvider(p) && p.remoteAddress === connection.localAddress);
  if (!provider) {
    return;
  }
  const browseAction = provider.browseActions[0];
  if (!browseAction) {
    return;
  }
  const workspace = await browseAction.run();
  if (!workspace) {
    return;
  }
  const folderUri = workspace.folders[0]?.root;
  if (!folderUri) {
    return;
  }
  sessionsService.openNewSession();
  sessionsPartService.getSessionView(sessionsService.activeSession.get()?.sessionId)?.selectWorkspace(folderUri);
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RemoteAgentHostCommandIds.connectViaSSH,
      title: localize2("connectViaSSH", "Connect to Remote Agent Host via SSH"),
      shortTitle: localize2("connectViaSSHShort", "SSH..."),
      category: SessionsCategories.Sessions,
      f1: true,
      icon: Codicon.remote,
      precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
      menu: {
        id: Menus.SessionWorkspaceManage,
        order: 20,
        when: SessionWorkspacePickerGroupContext.isEqualTo(SESSION_WORKSPACE_GROUP_REMOTE)
      }
    });
  }
  async run(accessor, onBack) {
    const result = await promptToConnectViaSSH(accessor, { showBackButton: !!onBack });
    if (result === "back") {
      onBack?.();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RemoteAgentHostCommandIds.addNewSSHHost,
      title: localize2("addNewSSHHost", "Add New SSH Host..."),
      category: SessionsCategories.Sessions,
      f1: true,
      precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true)
    });
  }
  async run(accessor) {
    const sshService = accessor.get(ISSHRemoteAgentHostService);
    const editorService = accessor.get(IEditorService);
    const fileService = accessor.get(IFileService);
    const notificationService = accessor.get(INotificationService);
    let configUri;
    try {
      configUri = await sshService.ensureUserSSHConfig();
    } catch (err) {
      notificationService.error(localize("sshConfigCreateFailed", "Failed to create SSH config file: {0}", String(err)));
      return;
    }
    const editorPane = await editorService.openEditor({ resource: configUri, options: { pinned: true } });
    if (!editorPane) {
      return;
    }
    const control = editorPane.getControl();
    if (!isCodeEditor(control) || !control.hasModel()) {
      return;
    }
    const editor = control;
    const model = editor.getModel();
    if (!model) {
      return;
    }
    let appendNewline = false;
    try {
      const stat = await fileService.stat(configUri);
      if (stat.size > 0) {
        const content = model.getValueInRange(model.getFullModelRange(), EndOfLinePreference.LF);
        appendNewline = content.length > 0 && !content.endsWith("\n");
      }
    } catch {
    }
    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);
    editor.setSelection(new Range(lastLine, lastCol, lastLine, lastCol));
    const snippet = (appendNewline ? "\n" : "") + "Host ${1:alias}\n    HostName ${2:hostname}\n    User ${3:user}\n";
    SnippetController2.get(editor)?.insert(snippet);
    editor.focus();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RemoteAgentHostCommandIds.configureSSHHosts,
      title: localize2("configureSSHHosts", "Configure SSH Hosts..."),
      category: SessionsCategories.Sessions,
      f1: true,
      precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true)
    });
  }
  async run(accessor, onBack) {
    const sshService = accessor.get(ISSHRemoteAgentHostService);
    const editorService = accessor.get(IEditorService);
    const quickInputService = accessor.get(IQuickInputService);
    const notificationService = accessor.get(INotificationService);
    let configFiles;
    try {
      configFiles = await sshService.listSSHConfigFiles();
    } catch (err) {
      notificationService.error(localize("sshConfigListFailed", "Failed to list SSH config files: {0}", String(err)));
      return;
    }
    if (configFiles.length === 0) {
      try {
        const uri = await sshService.ensureUserSSHConfig();
        await editorService.openEditor({ resource: uri, options: { pinned: true } });
      } catch (err) {
        notificationService.error(localize("sshConfigOpenFailed", "Failed to open SSH config file: {0}", String(err)));
      }
      return;
    }
    const userConfigUri = configFiles[0];
    const items = configFiles.map((uri, index) => ({
      label: uri.fsPath,
      uri,
      isUserConfig: index === 0
    }));
    if (items.length === 1 && !onBack) {
      const picked2 = items[0];
      try {
        const uri = picked2.isUserConfig ? await sshService.ensureUserSSHConfig().catch(() => userConfigUri) : picked2.uri;
        await editorService.openEditor({ resource: uri, options: { pinned: true } });
      } catch (err) {
        notificationService.error(localize("sshConfigOpenFailed", "Failed to open SSH config file: {0}", String(err)));
      }
      return;
    }
    const picked = await new Promise((resolve) => {
      const store = new DisposableStore();
      const picker = store.add(quickInputService.createQuickPick());
      picker.title = localize("sshConfigPickTitle", "Select SSH configuration file to edit");
      picker.placeholder = localize("sshConfigPickPlaceholder", "Select an SSH configuration file");
      picker.items = items;
      if (onBack) {
        picker.buttons = [quickInputService.backButton];
      }
      store.add(picker.onDidTriggerButton((button) => {
        if (button === quickInputService.backButton) {
          resolve("back");
          picker.hide();
        }
      }));
      store.add(picker.onDidAccept(() => {
        resolve(picker.selectedItems[0]);
        picker.hide();
      }));
      store.add(picker.onDidHide(() => {
        resolve(void 0);
        store.dispose();
      }));
      picker.show();
    });
    if (picked === "back") {
      onBack?.();
      return;
    }
    if (!picked) {
      return;
    }
    try {
      const uri = picked.isUserConfig ? await sshService.ensureUserSSHConfig().catch(() => userConfigUri) : picked.uri;
      await editorService.openEditor({ resource: uri, options: { pinned: true } });
    } catch (err) {
      notificationService.error(localize("sshConfigOpenFailed", "Failed to open SSH config file: {0}", String(err)));
    }
  }
});
async function promptToConnectViaTunnel(accessor, options = {}) {
  const tunnelService = accessor.get(ITunnelAgentHostService);
  const quickInputService = accessor.get(IQuickInputService);
  const notificationService = accessor.get(INotificationService);
  const authenticationService = accessor.get(IAuthenticationService);
  const instantiationService = accessor.get(IInstantiationService);
  const productService = accessor.get(IProductService);
  const dialogService = accessor.get(IDialogService);
  const authProvider = "github";
  const scopes = productService.tunnelApplicationConfig?.authenticationProviders?.[authProvider]?.scopes ?? [];
  try {
    if (!(await authenticationService.getSessions(authProvider, scopes)).length) {
      await authenticationService.createSession(authProvider, scopes, { activateImmediate: true });
    }
  } catch {
    notificationService.error(localize("tunnelAuthFailed", "Authentication failed. Please try again."));
    return;
  }
  const store = new DisposableStore();
  const tunnelPicker = store.add(quickInputService.createQuickPick());
  tunnelPicker.title = localize("tunnelPickTitle", "Connect via Dev Tunnel");
  tunnelPicker.placeholder = localize("tunnelPickPlaceholder", "Select a dev tunnel to connect to");
  tunnelPicker.busy = true;
  if (options.showBackButton) {
    tunnelPicker.buttons = [quickInputService.backButton];
  }
  tunnelPicker.show();
  let tunnels;
  try {
    tunnels = await tunnelService.listTunnels();
  } catch (err) {
    store.dispose();
    notificationService.error(localize("tunnelListFailed", "Failed to list dev tunnels: {0}", err instanceof Error ? err.message : String(err)));
    return;
  }
  if (tunnels.length === 0) {
    store.dispose();
    notificationService.info(localize("tunnelNoneFound", "No dev tunnels with agent host support were found. Start a tunnel with 'code tunnel' on another machine."));
    return;
  }
  const deleteTunnelButton = {
    iconClass: ThemeIcon.asClassName(Codicon.trash),
    tooltip: localize("tunnelDeleteTooltip", "Delete Dev Tunnel")
  };
  const toTunnelPickItems = (tunnelInfos) => tunnelInfos.map((tunnel) => ({
    label: tunnel.name,
    description: tunnel.hostConnectionCount > 0 ? localize("tunnelPickOnline", "{0} \xB7 Online", tunnel.tunnelId) : localize("tunnelPickOffline", "{0} \xB7 Offline", tunnel.tunnelId),
    buttons: tunnelService.canDeleteTunnels ? [deleteTunnelButton] : void 0,
    tunnel
  }));
  tunnelPicker.items = toTunnelPickItems(tunnels);
  tunnelPicker.busy = false;
  const picked = await new Promise((resolve) => {
    let isDeleting = false;
    store.add(tunnelPicker.onDidTriggerButton((button) => {
      if (button === quickInputService.backButton) {
        resolve("back");
        tunnelPicker.hide();
      }
    }));
    store.add(tunnelPicker.onDidAccept(() => {
      if (isDeleting) {
        return;
      }
      resolve(tunnelPicker.selectedItems[0]);
      tunnelPicker.hide();
    }));
    store.add(tunnelPicker.onDidTriggerItemButton(async (event) => {
      if (event.button !== deleteTunnelButton || isDeleting) {
        return;
      }
      const previousIgnoreFocusOut = tunnelPicker.ignoreFocusOut;
      isDeleting = true;
      tunnelPicker.ignoreFocusOut = true;
      let keepOpen = true;
      try {
        const confirmation = await dialogService.confirm({
          type: "warning",
          message: localize("tunnelDeleteConfirmation", "Are you sure you want to delete dev tunnel '{0}'?", event.item.tunnel.name),
          detail: localize("tunnelDeleteDetail", "The tunnel may be recreated if a machine starts hosting it again."),
          primaryButton: localize("tunnelDeleteButton", "&&Delete")
        });
        if (!confirmation.confirmed) {
          return;
        }
        tunnelPicker.busy = true;
        await tunnelService.deleteTunnel(event.item.tunnel);
        const refreshedTunnels = await tunnelService.listTunnels();
        if (refreshedTunnels.length === 0) {
          keepOpen = false;
          notificationService.info(localize("tunnelNoneFoundAfterDelete", "No dev tunnels with agent host support were found. Start a tunnel with 'code tunnel' on another machine."));
          return;
        }
        tunnelPicker.items = toTunnelPickItems(refreshedTunnels);
      } catch (err) {
        notificationService.error(localize("tunnelDeleteFailed", "Failed to delete dev tunnel '{0}': {1}", event.item.tunnel.name, err instanceof Error ? err.message : String(err)));
      } finally {
        tunnelPicker.busy = false;
        tunnelPicker.ignoreFocusOut = previousIgnoreFocusOut;
        isDeleting = false;
        if (keepOpen) {
          tunnelPicker.show();
        } else {
          resolve(void 0);
          tunnelPicker.hide();
          store.dispose();
        }
      }
    }));
    store.add(tunnelPicker.onDidHide(() => {
      if (isDeleting) {
        return;
      }
      resolve(void 0);
      store.dispose();
    }));
  });
  if (picked === "back") {
    return "back";
  }
  if (!picked) {
    return;
  }
  const handle = notificationService.notify({
    severity: Severity.Info,
    message: localize("tunnelConnecting", "Connecting to tunnel '{0}'...", picked.tunnel.name),
    progress: { infinite: true }
  });
  try {
    await tunnelService.connect(picked.tunnel, authProvider);
    handle.close();
  } catch (err) {
    handle.close();
    notificationService.error(localize("tunnelConnectFailed", "Failed to connect to tunnel '{0}': {1}", picked.tunnel.name, err instanceof Error ? err.message : String(err)));
    return;
  }
  await instantiationService.invokeFunction((accessor2) => promptForTunnelFolder(accessor2, picked.tunnel));
}
async function promptForTunnelFolder(accessor, tunnel) {
  const sessionsProvidersService = accessor.get(ISessionsProvidersService);
  const sessionsService = accessor.get(ISessionsService);
  const sessionsPartService = accessor.get(ISessionsPartService);
  const tunnelAddress = `${TUNNEL_ADDRESS_PREFIX}${tunnel.tunnelId}`;
  const provider = sessionsProvidersService.getProviders().find((p) => isAgentHostProvider(p) && p.remoteAddress === tunnelAddress);
  if (!provider) {
    return;
  }
  const browseAction = provider.browseActions[0];
  if (!browseAction) {
    return;
  }
  const workspace = await browseAction.run();
  if (!workspace) {
    return;
  }
  const folderUri = workspace.folders[0]?.root;
  if (!folderUri) {
    return;
  }
  sessionsService.openNewSession();
  sessionsPartService.getSessionView(sessionsService.activeSession.get()?.sessionId)?.selectWorkspace(folderUri, provider.id);
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RemoteAgentHostCommandIds.connectViaTunnel,
      title: localize2("connectViaTunnel", "Connect to Remote Agent Host via Dev Tunnel"),
      shortTitle: localize2("connectViaTunnelShort", "Tunnels..."),
      category: SessionsCategories.Sessions,
      f1: true,
      icon: Codicon.cloud,
      precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true),
      menu: {
        id: Menus.SessionWorkspaceManage,
        order: 10,
        when: SessionWorkspacePickerGroupContext.isEqualTo(SESSION_WORKSPACE_GROUP_REMOTE)
      }
    });
  }
  async run(accessor, onBack) {
    const result = await promptToConnectViaTunnel(accessor, { showBackButton: !!onBack });
    if (result === "back") {
      onBack?.();
    }
  }
});
async function promptToConnectViaWSL(accessor, options = {}) {
  const wslService = accessor.get(IWSLRemoteAgentHostService);
  const notificationService = accessor.get(INotificationService);
  const quickInputService = accessor.get(IQuickInputService);
  const openerService = accessor.get(IOpenerService);
  const instantiationService = accessor.get(IInstantiationService);
  const logService = accessor.get(ILogService);
  const installAction = new Action(
    "wsl.openDocs",
    localize("wslInstallDocsAction", "Install WSL"),
    void 0,
    true,
    () => openerService.open(URI.parse(WSL_INSTALL_DOCS_URL))
  );
  if (!await wslService.isWSLAvailable()) {
    notificationService.notify({
      severity: Severity.Info,
      message: localize("wslNotInstalled", "Windows Subsystem for Linux is not installed or not enabled."),
      actions: { primary: [installAction] }
    });
    return;
  }
  let distros;
  try {
    distros = await wslService.listDistros();
  } catch (err) {
    logService.error("[WSL] listDistros failed", err);
    notificationService.error(localize("wslListFailed", "Failed to list WSL distributions: {0}", toErrorMessage(err)));
    return;
  }
  if (distros.length === 0) {
    notificationService.notify({
      severity: Severity.Info,
      message: localize("wslNoDistros", "No WSL 2 distributions are installed."),
      actions: { primary: [installAction] }
    });
    return;
  }
  const items = distros.map((d) => ({
    label: d.name,
    description: d.isRunning ? localize("wslDistroRunning", "Running") : localize("wslDistroStopped", "Stopped"),
    detail: d.isDefault ? localize("wslDistroDefault", "Default distribution") : void 0,
    distro: d
  }));
  let picked;
  if (items.length === 1 && !options.showBackButton) {
    picked = items[0];
  } else {
    const result = await new Promise((resolve) => {
      const store = new DisposableStore();
      const picker = store.add(quickInputService.createQuickPick());
      picker.title = localize("wslPickTitle", "Connect via WSL");
      picker.placeholder = localize("wslPickPlaceholder", "Select a WSL distribution to connect to");
      picker.items = items;
      if (options.showBackButton) {
        picker.buttons = [quickInputService.backButton];
      }
      store.add(picker.onDidTriggerButton((button) => {
        if (button === quickInputService.backButton) {
          resolve("back");
          picker.hide();
        }
      }));
      store.add(picker.onDidAccept(() => {
        resolve(picker.selectedItems[0]);
        picker.hide();
      }));
      store.add(picker.onDidHide(() => {
        resolve(void 0);
        store.dispose();
      }));
      picker.show();
    });
    if (result === "back") {
      return "back";
    }
    if (!result) {
      return;
    }
    picked = result;
  }
  const handle = notificationService.notify({
    severity: Severity.Info,
    message: localize("wslConnecting", "Connecting to WSL distribution '{0}'...", picked.distro.name),
    progress: { infinite: true }
  });
  const expectedKey = `wsl:${picked.distro.name}`;
  const progressListener = wslService.onDidReportConnectProgress?.((progress) => {
    if (progress.connectionKey === expectedKey) {
      handle.updateMessage(progress.message);
    }
  });
  try {
    await wslService.connect({ distro: picked.distro.name, name: picked.distro.name });
    handle.close();
  } catch (err) {
    handle.close();
    if (isCancellationError(err)) {
      return;
    }
    logService.error(`[WSL] Connect to '${picked.distro.name}' failed`, err);
    notificationService.error(localize("wslConnectFailed", "Failed to connect to WSL distribution '{0}': {1}", picked.distro.name, toErrorMessage(err)));
    return;
  } finally {
    progressListener?.dispose();
  }
  await instantiationService.invokeFunction((accessor2) => promptForWSLFolder(accessor2, picked.distro.name));
}
async function promptForWSLFolder(accessor, distro) {
  const sessionsProvidersService = accessor.get(ISessionsProvidersService);
  const sessionsService = accessor.get(ISessionsService);
  const sessionsPartService = accessor.get(ISessionsPartService);
  const wslAddress = `wsl:${distro}`;
  const provider = sessionsProvidersService.getProviders().find((p) => isAgentHostProvider(p) && p.remoteAddress === wslAddress);
  if (!provider) {
    return;
  }
  const browseAction = provider.browseActions[0];
  if (!browseAction) {
    return;
  }
  const workspace = await browseAction.run();
  if (!workspace) {
    return;
  }
  const folderUri = workspace.folders[0]?.root;
  if (!folderUri) {
    return;
  }
  sessionsService.openNewSession();
  sessionsPartService.getSessionView(sessionsService.activeSession.get()?.sessionId)?.selectWorkspace(folderUri, provider.id);
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RemoteAgentHostCommandIds.connectViaWSL,
      title: localize2("connectViaWSL", "Connect to Remote Agent Host via WSL"),
      shortTitle: localize2("connectViaWSLShort", "WSL..."),
      category: SessionsCategories.Sessions,
      f1: true,
      icon: Codicon.terminalLinux,
      precondition: ContextKeyExpr.and(
        ContextKeyExpr.equals("isWindows", true),
        ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true)
      ),
      menu: {
        id: Menus.SessionWorkspaceManage,
        order: 15,
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("isWindows", true),
          SessionWorkspacePickerGroupContext.isEqualTo(SESSION_WORKSPACE_GROUP_REMOTE)
        )
      }
    });
  }
  async run(accessor, onBack) {
    const result = await promptToConnectViaWSL(accessor, { showBackButton: !!onBack });
    if (result === "back") {
      onBack?.();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RemoteAgentHostCommandIds.updateRemoteAgentHost,
      title: localize2("updateRemoteAgentHost", "Update Remote Agent Host Server..."),
      category: SessionsCategories.Sessions,
      f1: true,
      precondition: ContextKeyExpr.equals(`config.${RemoteAgentHostsEnabledSettingId}`, true)
    });
  }
  async run(accessor) {
    const sessionsProvidersService = accessor.get(ISessionsProvidersService);
    const quickInputService = accessor.get(IQuickInputService);
    const notificationService = accessor.get(INotificationService);
    const instantiationService = accessor.get(IInstantiationService);
    const remoteHosts = sessionsProvidersService.getProviders().filter(isAgentHostProvider).filter((provider) => !!provider.remoteAddress);
    let incompatibleCount = 0;
    const upgradable = remoteHosts.map((provider) => {
      const status = provider.connectionStatus?.get();
      if (!RemoteAgentHostConnectionStatus.isIncompatible(status)) {
        return void 0;
      }
      incompatibleCount++;
      return status.vscodeUpgradeMethod ? { provider, method: status.vscodeUpgradeMethod } : void 0;
    }).filter((entry) => !!entry);
    if (upgradable.length === 0) {
      notificationService.info(incompatibleCount > 0 ? localize("updateRemoteAgentHost.noneUpgradable", "No remote agent hosts can be updated from here. Incompatible hosts must be updated manually, then reconnected.") : localize("updateRemoteAgentHost.none", "No remote agent hosts need updating."));
      return;
    }
    let target = upgradable[0];
    if (upgradable.length > 1) {
      const picked = await quickInputService.pick(
        upgradable.map((entry) => ({
          label: entry.provider.label,
          description: entry.provider.remoteAddress,
          entry
        })),
        { placeHolder: localize("updateRemoteAgentHost.pick", "Select a remote agent host to update") }
      );
      if (!picked) {
        return;
      }
      target = picked.entry;
    }
    await instantiationService.invokeFunction(runServerUpgrade, target.provider, target.method);
  }
});
export {
  RemoteAgentHostCommandIds,
  parseSSHHostInput
};
