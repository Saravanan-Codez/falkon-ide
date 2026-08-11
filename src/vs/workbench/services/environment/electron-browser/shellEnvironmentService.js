import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { process } from "../../../../base/parts/sandbox/electron-browser/globals.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
const IShellEnvironmentService = createDecorator("shellEnvironmentService");
class ShellEnvironmentService {
  getShellEnv() {
    return process.shellEnv();
  }
}
registerSingleton(IShellEnvironmentService, ShellEnvironmentService, InstantiationType.Delayed);
export {
  IShellEnvironmentService,
  ShellEnvironmentService
};
