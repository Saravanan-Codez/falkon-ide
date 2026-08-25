import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { equals } from "../../../base/common/objects.js";
class FileManagedSettingsChannel {
  constructor(service) {
    this.service = service;
    this.disposables = new DisposableStore();
  }
  listen(_, event) {
    switch (event) {
      case "onDidChangeRawManagedSettings":
        return this.service.onDidChangeRawManagedSettings;
      case "onDidChangeManagedSettings":
        return this.service.onDidChangeManagedSettings;
    }
    throw new Error(`Event not found: ${event}`);
  }
  call(_, command) {
    switch (command) {
      case "getRawManagedSettings":
        return Promise.resolve(this.service.rawManagedSettings);
      case "getManagedSettings":
        return Promise.resolve(this.service.managedSettings);
    }
    throw new Error(`Call not found: ${command}`);
  }
  dispose() {
    this.disposables.dispose();
  }
}
class FileManagedSettingsChannelClient extends Disposable {
  constructor(channel) {
    super();
    this._rawManagedSettings = {};
    this.hasReceivedRawManagedSettings = false;
    this._managedSettings = {};
    this.hasReceivedManagedSettings = false;
    this._onDidChangeRawManagedSettings = this._register(new Emitter());
    this.onDidChangeRawManagedSettings = this._onDidChangeRawManagedSettings.event;
    this._onDidChangeManagedSettings = this._register(new Emitter());
    this.onDidChangeManagedSettings = this._onDidChangeManagedSettings.event;
    this._register(channel.listen("onDidChangeRawManagedSettings")((managedSettings) => this.updateRawManagedSettings(managedSettings, true)));
    this._register(channel.listen("onDidChangeManagedSettings")((managedSettings) => this.updateManagedSettings(managedSettings, true)));
    channel.call("getRawManagedSettings").then((managedSettings) => {
      if (!this.hasReceivedRawManagedSettings) {
        this.updateRawManagedSettings(managedSettings, true);
      }
    });
    channel.call("getManagedSettings").then((managedSettings) => {
      if (!this.hasReceivedManagedSettings) {
        this.updateManagedSettings(managedSettings, true);
      }
    });
  }
  get rawManagedSettings() {
    return this._rawManagedSettings;
  }
  get managedSettings() {
    return this._managedSettings;
  }
  updateRawManagedSettings(managedSettings, fireEvent) {
    this.hasReceivedRawManagedSettings = true;
    if (equals(this._rawManagedSettings, managedSettings)) {
      return;
    }
    this._rawManagedSettings = managedSettings;
    if (fireEvent) {
      this._onDidChangeRawManagedSettings.fire(this._rawManagedSettings);
    }
  }
  updateManagedSettings(managedSettings, fireEvent) {
    this.hasReceivedManagedSettings = true;
    if (equals(this._managedSettings, managedSettings)) {
      return;
    }
    this._managedSettings = managedSettings;
    if (fireEvent) {
      this._onDidChangeManagedSettings.fire(this._managedSettings);
    }
  }
}
export {
  FileManagedSettingsChannel,
  FileManagedSettingsChannelClient
};
