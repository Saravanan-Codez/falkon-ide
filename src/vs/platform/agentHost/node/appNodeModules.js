import { nodeModulesAsarUnpackedPath, nodeModulesPath } from "../../../base/common/network.js";
import product from "../../product/common/product.js";
function hasUnpackedNodeModulesArchive() {
  return !!process.versions["electron"] && !!product.commit && !process.env["VSCODE_DEV"];
}
function getAppNodeModulesPath() {
  return hasUnpackedNodeModulesArchive() ? nodeModulesAsarUnpackedPath : nodeModulesPath;
}
function getAppNodeModulesDirName() {
  return hasUnpackedNodeModulesArchive() ? "node_modules.asar.unpacked" : "node_modules";
}
export {
  getAppNodeModulesDirName,
  getAppNodeModulesPath
};
