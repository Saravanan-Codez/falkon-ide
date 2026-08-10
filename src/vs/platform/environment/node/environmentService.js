import { homedir, tmpdir } from "os";
import { AbstractNativeEnvironmentService, parseDebugParams } from "../common/environmentService.js";
import { getUserDataPath } from "./userDataPath.js";
class NativeEnvironmentService extends AbstractNativeEnvironmentService {
  constructor(args, productService) {
    const homeDir = homedir();
    super(args, {
      homeDir,
      tmpDir: tmpdir(),
      userDataDir: getUserDataPath(args, productService.nameShort)
    }, productService);
  }
}
function parsePtyHostDebugPort(args, isBuilt) {
  return parseDebugParams(args["inspect-ptyhost"], args["inspect-brk-ptyhost"], 5877, isBuilt, args.extensionEnvironment);
}
function parseAgentHostDebugPort(args, isBuilt) {
  return parseDebugParams(args["inspect-agenthost"], args["inspect-brk-agenthost"], 5878, isBuilt, args.extensionEnvironment);
}
function parseSharedProcessDebugPort(args, isBuilt) {
  return parseDebugParams(args["inspect-sharedprocess"], args["inspect-brk-sharedprocess"], 5879, isBuilt, args.extensionEnvironment);
}
export {
  NativeEnvironmentService,
  parseAgentHostDebugPort,
  parsePtyHostDebugPort,
  parseSharedProcessDebugPort
};
