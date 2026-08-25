import { Event } from "../../../base/common/event.js";
class NullWSLRemoteAgentHostService {
  constructor() {
    this.onDidChangeConnections = Event.None;
    this.onDidReportConnectProgress = Event.None;
    this.connections = [];
  }
  async isWSLAvailable() {
    return false;
  }
  async listDistros() {
    return [];
  }
  async listRunningDistros() {
    return [];
  }
  async connect(_config) {
    throw new Error("WSL is not available on this platform.");
  }
  async disconnect(_distro) {
    throw new Error("WSL is not available on this platform.");
  }
  async reconnect(_distro, _name) {
    throw new Error("WSL is not available on this platform.");
  }
  getCachedDistros() {
    return [];
  }
}
export {
  NullWSLRemoteAgentHostService
};
