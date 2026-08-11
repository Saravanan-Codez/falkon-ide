import "./bootstrap-server.js";
import { join } from "node:path";
import { devInjectNodeModuleLookupPath } from "./bootstrap-node.js";
import { bootstrapESM } from "./bootstrap-esm.js";
import { resolveNLSConfiguration } from "./vs/base/node/nls.js";
import { product } from "./bootstrap-meta.js";
const nlsConfiguration = await resolveNLSConfiguration({ userLocale: "en", osLocale: "en", commit: product.commit, userDataPath: "", nlsMetadataPath: import.meta.dirname });
process.env["VSCODE_NLS_CONFIG"] = JSON.stringify(nlsConfiguration);
if (process.env["VSCODE_DEV"]) {
  process.env["VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH"] = process.env["VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH"] || join(import.meta.dirname, "..", "remote", "node_modules");
  devInjectNodeModuleLookupPath(process.env["VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH"]);
} else {
  delete process.env["VSCODE_DEV_INJECT_NODE_MODULE_LOOKUP_PATH"];
}
await bootstrapESM();
await import("./vs/server/node/server.cli.js");
