import { createDecorator } from "../../instantiation/common/instantiation.js";
const IRemoteExtensionsScannerService = createDecorator("IRemoteExtensionsScannerService");
const RemoteExtensionsScannerChannelName = "remoteExtensionsScanner";
export {
  IRemoteExtensionsScannerService,
  RemoteExtensionsScannerChannelName
};
