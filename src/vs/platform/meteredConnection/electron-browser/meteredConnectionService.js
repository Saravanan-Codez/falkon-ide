var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { toDisposable } from "../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../instantiation/common/extensions.js";
import { IMainProcessService } from "../../ipc/common/mainProcessService.js";
import { AbstractMeteredConnectionService, getIsBrowserConnectionMetered, IMeteredConnectionService } from "../common/meteredConnection.js";
import { METERED_CONNECTION_CHANNEL, MeteredConnectionCommand } from "../common/meteredConnectionIpc.js";
let NativeMeteredConnectionService = class extends AbstractMeteredConnectionService {
  constructor(configurationService, mainProcessService) {
    super(configurationService, getIsBrowserConnectionMetered());
    this._channel = mainProcessService.getChannel(METERED_CONNECTION_CHANNEL);
    const connection = navigator.connection;
    if (connection) {
      const onChange = () => this.setIsBrowserConnectionMetered(getIsBrowserConnectionMetered());
      connection.addEventListener("change", onChange);
      this._register(toDisposable(() => connection.removeEventListener("change", onChange)));
    }
  }
  /**
   * Notify the main process about changes to the navigator connection state.
   */
  onChangeBrowserConnection() {
    super.onChangeBrowserConnection();
    this._channel.call(MeteredConnectionCommand.SetIsBrowserConnectionMetered, this.isBrowserConnectionMetered);
  }
};
NativeMeteredConnectionService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IMainProcessService)
], NativeMeteredConnectionService);
registerSingleton(IMeteredConnectionService, NativeMeteredConnectionService, InstantiationType.Delayed);
export {
  NativeMeteredConnectionService
};
