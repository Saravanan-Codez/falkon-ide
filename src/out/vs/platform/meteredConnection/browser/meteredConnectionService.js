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
import { AbstractMeteredConnectionService, getIsBrowserConnectionMetered, IMeteredConnectionService } from "../common/meteredConnection.js";
let MeteredConnectionService = class extends AbstractMeteredConnectionService {
  constructor(configurationService) {
    super(configurationService, getIsBrowserConnectionMetered());
    const connection = navigator.connection;
    if (connection) {
      const onChange = () => this.setIsBrowserConnectionMetered(getIsBrowserConnectionMetered());
      connection.addEventListener("change", onChange);
      this._register(toDisposable(() => connection.removeEventListener("change", onChange)));
    }
  }
};
MeteredConnectionService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], MeteredConnectionService);
registerSingleton(IMeteredConnectionService, MeteredConnectionService, InstantiationType.Delayed);
export {
  MeteredConnectionService
};
