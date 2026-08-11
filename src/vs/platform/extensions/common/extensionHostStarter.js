import { createDecorator } from "../../instantiation/common/instantiation.js";
const IExtensionHostStarter = createDecorator("extensionHostStarter");
const ipcExtensionHostStarterChannelName = "extensionHostStarter";
const extensionHostGraceTimeMs = 6e3;
export {
  IExtensionHostStarter,
  extensionHostGraceTimeMs,
  ipcExtensionHostStarterChannelName
};
