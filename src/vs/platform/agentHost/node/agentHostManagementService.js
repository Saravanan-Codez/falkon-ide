class AgentHostManagementService {
  constructor(_agentService, _connectionTrackerService) {
    this._agentService = _agentService;
    this._connectionTrackerService = _connectionTrackerService;
  }
  createSessionWithExtensions(config) {
    return this._agentService.createSession(config);
  }
  createChatWithExtensions(session, chat, options) {
    return this._agentService.createChat(session, chat, options);
  }
  shutdown() {
    return this._agentService.shutdown();
  }
  getNetworkDiagnosticsInfo() {
    return this._agentService.getNetworkDiagnosticsInfo();
  }
  getManagedSettingsDiagnostics() {
    return this._agentService.getManagedSettingsDiagnostics();
  }
  diagnosticsFetch(url) {
    return this._agentService.diagnosticsFetch(url);
  }
  startWebSocketServer() {
    return this._connectionTrackerService.startWebSocketServer();
  }
  getInspectInfo(tryEnable) {
    return this._connectionTrackerService.getInspectInfo(tryEnable);
  }
}
export {
  AgentHostManagementService
};
