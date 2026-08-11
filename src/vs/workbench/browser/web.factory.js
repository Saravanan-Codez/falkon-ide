import { Menu } from "./web.api.js";
import { BrowserMain } from "./web.main.js";
import { URI } from "../../base/common/uri.js";
import { toDisposable } from "../../base/common/lifecycle.js";
import { CommandsRegistry } from "../../platform/commands/common/commands.js";
import { mark } from "../../base/common/performance.js";
import { MenuId, MenuRegistry } from "../../platform/actions/common/actions.js";
import { DeferredPromise } from "../../base/common/async.js";
import { asArray } from "../../base/common/arrays.js";
let created = false;
const workbenchPromise = new DeferredPromise();
function create(domElement, options) {
  mark("code/didLoadWorkbenchMain");
  if (created) {
    throw new Error("Unable to create the VSCode workbench more than once.");
  } else {
    created = true;
  }
  if (Array.isArray(options.commands)) {
    for (const command of options.commands) {
      CommandsRegistry.registerCommand(command.id, (accessor, ...args) => {
        return command.handler(...args);
      });
      if (command.label) {
        for (const menu of asArray(command.menu ?? Menu.CommandPalette)) {
          MenuRegistry.appendMenuItem(asMenuId(menu), { command: { id: command.id, title: command.label } });
        }
      }
    }
  }
  let instantiatedWorkbench = void 0;
  new BrowserMain(domElement, options).open().then((workbench) => {
    instantiatedWorkbench = workbench;
    workbenchPromise.complete(workbench);
  });
  return toDisposable(() => {
    if (instantiatedWorkbench) {
      instantiatedWorkbench.shutdown();
    } else {
      workbenchPromise.p.then((instantiatedWorkbench2) => instantiatedWorkbench2.shutdown());
    }
  });
}
function asMenuId(menu) {
  switch (menu) {
    case Menu.CommandPalette:
      return MenuId.CommandPalette;
    case Menu.StatusBarWindowIndicatorMenu:
      return MenuId.StatusBarWindowIndicatorMenu;
  }
}
var commands;
((commands2) => {
  async function executeCommand(command, ...args) {
    const workbench = await workbenchPromise.p;
    return workbench.commands.executeCommand(command, ...args);
  }
  commands2.executeCommand = executeCommand;
})(commands || (commands = {}));
var logger;
((logger2) => {
  function log(level, message) {
    workbenchPromise.p.then((workbench) => workbench.logger.log(level, message));
  }
  logger2.log = log;
})(logger || (logger = {}));
var env;
((env2) => {
  async function retrievePerformanceMarks() {
    const workbench = await workbenchPromise.p;
    return workbench.env.retrievePerformanceMarks();
  }
  env2.retrievePerformanceMarks = retrievePerformanceMarks;
  async function getUriScheme() {
    const workbench = await workbenchPromise.p;
    return workbench.env.getUriScheme();
  }
  env2.getUriScheme = getUriScheme;
  async function openUri(target) {
    const workbench = await workbenchPromise.p;
    return workbench.env.openUri(URI.isUri(target) ? target : URI.from(target));
  }
  env2.openUri = openUri;
})(env || (env = {}));
var window;
((window2) => {
  async function withProgress(options, task) {
    const workbench = await workbenchPromise.p;
    return workbench.window.withProgress(options, task);
  }
  window2.withProgress = withProgress;
  async function createTerminal(options) {
    const workbench = await workbenchPromise.p;
    workbench.window.createTerminal(options);
  }
  window2.createTerminal = createTerminal;
  async function showInformationMessage(message, ...items) {
    const workbench = await workbenchPromise.p;
    return await workbench.window.showInformationMessage(message, ...items);
  }
  window2.showInformationMessage = showInformationMessage;
})(window || (window = {}));
var workspace;
((workspace2) => {
  async function didResolveRemoteAuthority() {
    const workbench = await workbenchPromise.p;
    await workbench.workspace.didResolveRemoteAuthority();
  }
  workspace2.didResolveRemoteAuthority = didResolveRemoteAuthority;
  async function openTunnel(tunnelOptions) {
    const workbench = await workbenchPromise.p;
    return workbench.workspace.openTunnel(tunnelOptions);
  }
  workspace2.openTunnel = openTunnel;
})(workspace || (workspace = {}));
export {
  commands,
  create,
  env,
  logger,
  window,
  workspace
};
