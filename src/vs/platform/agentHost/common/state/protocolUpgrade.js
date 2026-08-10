const VSCODE_UPGRADE_METHOD = "_vscodeUpgrade";
function readUnsupportedProtocolVersionErrorMeta(data) {
  if (!data || typeof data !== "object") {
    return void 0;
  }
  const meta = data["_meta"];
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return void 0;
  }
  const raw = meta;
  const result = {};
  if (typeof raw["vscodeUpgradeMethod"] === "string") {
    result.vscodeUpgradeMethod = raw["vscodeUpgradeMethod"];
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
export {
  VSCODE_UPGRADE_METHOD,
  readUnsupportedProtocolVersionErrorMeta
};
