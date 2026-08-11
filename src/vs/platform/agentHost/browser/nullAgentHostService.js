import { Event } from "../../../base/common/event.js";
import { constObservable } from "../../../base/common/observable.js";
const notSupported = () => {
  throw new Error("Local agent host is not supported in the browser.");
};
class NullAgentHostService {
  constructor() {
    this.clientId = "";
    this.onAgentHostExit = Event.None;
    this.onAgentHostStart = Event.None;
    this.onDidNotification = Event.None;
    this.onDidAction = Event.None;
    this.onMcpNotification = Event.None;
    this.authenticationPending = constObservable(false);
    this.initializeResult = constObservable(void 0);
  }
  setAuthenticationPending(_pending) {
  }
  startAgentHost() {
  }
  get rootState() {
    return notSupported();
  }
  getSubscription(_kind, _resource, _owner) {
    return notSupported();
  }
  getSubscriptionUnmanaged(_kind, _resource) {
    return void 0;
  }
  getInflightSessionCreate(_resource) {
    return void 0;
  }
  getActiveSubscriptions() {
    return [];
  }
  dispatch(_channel, _action) {
    notSupported();
  }
  async restartAgentHost() {
    notSupported();
  }
  async authenticate(_params) {
    return notSupported();
  }
  async getNetworkDiagnosticsInfo() {
    return notSupported();
  }
  async getManagedSettingsDiagnostics() {
    return [];
  }
  async diagnosticsFetch(_url) {
    return notSupported();
  }
  async listSessions() {
    return [];
  }
  async createSession(_config) {
    return notSupported();
  }
  async resolveSessionConfig(_params) {
    return notSupported();
  }
  async sessionConfigCompletions(_params) {
    return notSupported();
  }
  async completions(_params) {
    return { items: [] };
  }
  async getCompletionTriggerCharacters() {
    return [];
  }
  async startWebSocketServer() {
    return notSupported();
  }
  async getInspectInfo(_tryEnable) {
    return void 0;
  }
  async disposeSession(_session) {
  }
  async createChat(_session, _chat) {
    notSupported();
  }
  async disposeChat(_chat) {
  }
  async createTerminal(_params) {
    notSupported();
  }
  async disposeTerminal(_terminal) {
  }
  async invokeChangesetOperation(_params) {
    return notSupported();
  }
  async handleMcpRequest(_channel, _method, _params) {
    return notSupported();
  }
  async resourceList(_uri) {
    return notSupported();
  }
  async resourceRead(_uri) {
    return notSupported();
  }
  async resourceWrite(_params) {
    return notSupported();
  }
  async resourceCopy(_params) {
    return notSupported();
  }
  async resourceDelete(_params) {
    return notSupported();
  }
  async resourceMove(_params) {
    return notSupported();
  }
  async resourceResolve(_params) {
    return notSupported();
  }
  async resourceMkdir(_params) {
    return notSupported();
  }
  async createResourceWatch(_params) {
    return notSupported();
  }
  async watchResource(_params) {
    return notSupported();
  }
}
export {
  NullAgentHostService
};
