import { homedir } from "os";
import { platform } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
class NativeMcpDiscoveryHelperService {
  constructor() {
  }
  load() {
    return Promise.resolve({
      platform,
      homedir: URI.file(homedir()),
      winAppData: this.uriFromEnvVariable("APPDATA"),
      xdgHome: this.uriFromEnvVariable("XDG_CONFIG_HOME")
    });
  }
  uriFromEnvVariable(varName) {
    const envVar = process.env[varName];
    if (!envVar) {
      return void 0;
    }
    return URI.file(envVar);
  }
}
export {
  NativeMcpDiscoveryHelperService
};
