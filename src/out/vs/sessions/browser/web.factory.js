import { SessionsBrowserMain } from "./web.main.js";
import { toDisposable } from "../../base/common/lifecycle.js";
import { mark } from "../../base/common/performance.js";
import { DeferredPromise } from "../../base/common/async.js";
import { CommandsRegistry } from "../../platform/commands/common/commands.js";
import { MenuRegistry, MenuId } from "../../platform/actions/common/actions.js";
const workbenchPromise = new DeferredPromise();
function create(domElement, options) {
  mark("code/didLoadWorkbenchMain");
  if (Array.isArray(options.commands)) {
    for (const command of options.commands) {
      CommandsRegistry.registerCommand(command.id, (_accessor, ...args) => {
        return command.handler(...args);
      });
      if (command.label) {
        MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: command.id, title: command.label } });
      }
    }
  }
  let instantiatedWorkbench = void 0;
  new SessionsBrowserMain(domElement, options).open().then((workbench) => {
    instantiatedWorkbench = workbench;
    workbenchPromise.complete(workbench);
  });
  return toDisposable(() => {
    if (instantiatedWorkbench) {
      instantiatedWorkbench.shutdown();
    } else {
      workbenchPromise.p.then((w) => w.shutdown());
    }
  });
}
export {
  create
};
