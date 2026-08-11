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
import { Registry } from "../../../platform/registry/common/platform.js";
import { Extensions, IOutputService, OUTPUT_VIEW_ID, OutputChannelUpdateMode } from "../../services/output/common/output.js";
import { MainContext, ExtHostContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { URI } from "../../../base/common/uri.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { Event } from "../../../base/common/event.js";
import { IViewsService } from "../../services/views/common/viewsService.js";
import { isNumber } from "../../../base/common/types.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IStatusbarService, StatusbarAlignment } from "../../services/statusbar/browser/statusbar.js";
import { localize } from "../../../nls.js";
let MainThreadOutputService = class extends Disposable {
  constructor(extHostContext, outputService, viewsService, configurationService, statusbarService) {
    super();
    this._outputStatusItem = this._register(new MutableDisposable());
    this._outputService = outputService;
    this._viewsService = viewsService;
    this._configurationService = configurationService;
    this._statusbarService = statusbarService;
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostOutputService);
    const setVisibleChannel = () => {
      const visibleChannel = this._viewsService.isViewVisible(OUTPUT_VIEW_ID) ? this._outputService.getActiveChannel() : void 0;
      this._proxy.$setVisibleChannel(visibleChannel ? visibleChannel.id : null);
      this._outputStatusItem.value = void 0;
    };
    this._register(Event.any(this._outputService.onActiveOutputChannel, Event.filter(this._viewsService.onDidChangeViewVisibility, ({ id }) => id === OUTPUT_VIEW_ID))(() => setVisibleChannel()));
    setVisibleChannel();
  }
  async $register(label, file, languageId, extensionId) {
    const idCounter = (MainThreadOutputService._extensionIdPool.get(extensionId) || 0) + 1;
    MainThreadOutputService._extensionIdPool.set(extensionId, idCounter);
    const id = `extension-output-${extensionId}-#${idCounter}-${label}`;
    const resource = URI.revive(file);
    Registry.as(Extensions.OutputChannels).registerChannel({ id, label, source: { resource }, log: false, languageId, extensionId });
    this._register(toDisposable(() => this.$dispose(id)));
    return id;
  }
  async $update(channelId, mode, till) {
    const channel = this._getChannel(channelId);
    if (channel) {
      if (mode === OutputChannelUpdateMode.Append) {
        channel.update(mode);
      } else if (isNumber(till)) {
        channel.update(mode, till);
      }
    }
  }
  async $reveal(channelId, preserveFocus) {
    const channel = this._getChannel(channelId);
    if (!channel) {
      return;
    }
    const viewsToShowQuietly = this._configurationService.getValue("workbench.view.showQuietly") ?? {};
    if (!this._viewsService.isViewVisible(OUTPUT_VIEW_ID) && viewsToShowQuietly[OUTPUT_VIEW_ID]) {
      this._showChannelQuietly(channel);
      return;
    }
    this._outputService.showChannel(channel.id, preserveFocus);
  }
  // Show status bar indicator
  _showChannelQuietly(channel) {
    const statusProperties = {
      name: localize("status.showOutput", "Show Output"),
      text: "$(output)",
      ariaLabel: localize("status.showOutputAria", "Show {0} Output Channel", channel.label),
      command: `workbench.action.output.show.${channel.id}`,
      tooltip: localize("status.showOutputTooltip", "Show {0} Output Channel", channel.label),
      kind: "prominent"
    };
    if (!this._outputStatusItem.value) {
      this._outputStatusItem.value = this._statusbarService.addEntry(
        statusProperties,
        "status.view.showQuietly",
        StatusbarAlignment.RIGHT,
        { location: { id: "status.notifications", priority: Number.NEGATIVE_INFINITY }, alignment: StatusbarAlignment.LEFT }
      );
    } else {
      this._outputStatusItem.value.update(statusProperties);
    }
  }
  async $close(channelId) {
    if (this._viewsService.isViewVisible(OUTPUT_VIEW_ID)) {
      const activeChannel = this._outputService.getActiveChannel();
      if (activeChannel && channelId === activeChannel.id) {
        this._viewsService.closeView(OUTPUT_VIEW_ID);
      }
    }
  }
  async $dispose(channelId) {
    const channel = this._getChannel(channelId);
    channel?.dispose();
  }
  _getChannel(channelId) {
    return this._outputService.getChannel(channelId);
  }
};
MainThreadOutputService._extensionIdPool = /* @__PURE__ */ new Map();
MainThreadOutputService = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadOutputService),
  __decorateParam(1, IOutputService),
  __decorateParam(2, IViewsService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IStatusbarService)
], MainThreadOutputService);
export {
  MainThreadOutputService
};
