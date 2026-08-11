import { getErrorMessage } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { equals } from "../../../base/common/objects.js";
class NativeManagedSettingsChannel {
  constructor(service) {
    this.service = service;
    this.disposables = new DisposableStore();
  }
  listen(_, event) {
    switch (event) {
      case "onDidChangeManagedSettings":
        return this.service.onDidChangeManagedSettings;
    }
    throw new Error(`Event not found: ${event}`);
  }
  call(_, command, arg) {
    switch (command) {
      case "getManagedSettings":
        return this.service.initialize();
      case "updatePolicyDefinitions":
        return this.service.updatePolicyDefinitions(arg);
    }
    throw new Error(`Call not found: ${command}`);
  }
  dispose() {
    this.disposables.dispose();
  }
}
class NativeManagedSettingsChannelClient extends Disposable {
  constructor(channel, logService) {
    super();
    this.channel = channel;
    this.logService = logService;
    this._managedSettings = {};
    this.hasReceivedManagedSettings = false;
    this._onDidChangeManagedSettings = this._register(new Emitter());
    this.onDidChangeManagedSettings = this._onDidChangeManagedSettings.event;
    this._register(this.channel.listen("onDidChangeManagedSettings")((managedSettings) => this.updateManagedSettings(managedSettings, true)));
    void this.initializeInBackground();
  }
  get managedSettings() {
    return this._managedSettings;
  }
  async initializeInBackground() {
    try {
      await this.initialize();
    } catch (error) {
      this.logService.warn("NativeManagedSettingsChannelClient#initialize - Failed to initialize native managed settings", getErrorMessage(error));
    }
  }
  async initialize() {
    const initializationPromise = this.initializationPromise ?? this.initializeFromChannel();
    this.initializationPromise = initializationPromise;
    try {
      await initializationPromise;
    } catch (error) {
      if (this.initializationPromise === initializationPromise) {
        this.initializationPromise = void 0;
      }
      throw error;
    }
    return this._managedSettings;
  }
  async initializeFromChannel() {
    const managedSettings = await this.channel.call("getManagedSettings");
    if (!this.hasReceivedManagedSettings) {
      this.updateManagedSettings(managedSettings, true);
    }
  }
  async updatePolicyDefinitions(policyDefinitions) {
    this.updateManagedSettings(await this.channel.call("updatePolicyDefinitions", policyDefinitions), false);
    return this._managedSettings;
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
  NativeManagedSettingsChannel,
  NativeManagedSettingsChannelClient
};
