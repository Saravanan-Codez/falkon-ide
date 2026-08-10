import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const ITerminalLinkProviderService = createDecorator("terminalLinkProviderService");
var TerminalBuiltinLinkType = /* @__PURE__ */ ((TerminalBuiltinLinkType2) => {
  TerminalBuiltinLinkType2["LocalFile"] = "LocalFile";
  TerminalBuiltinLinkType2["LocalFolderOutsideWorkspace"] = "LocalFolderOutsideWorkspace";
  TerminalBuiltinLinkType2["LocalFolderInWorkspace"] = "LocalFolderInWorkspace";
  TerminalBuiltinLinkType2["Search"] = "Search";
  TerminalBuiltinLinkType2["Url"] = "Url";
  return TerminalBuiltinLinkType2;
})(TerminalBuiltinLinkType || {});
export {
  ITerminalLinkProviderService,
  TerminalBuiltinLinkType
};
