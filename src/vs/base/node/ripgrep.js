import { Lazy } from "../common/lazy.js";
const _rgDiskPath = new Lazy(async () => {
  const m = await import("@vscode/ripgrep-universal");
  return m.rgPath.replace(/\bnode_modules\.asar\b/, "node_modules.asar.unpacked");
});
function rgDiskPath() {
  return _rgDiskPath.value;
}
export {
  rgDiskPath
};
