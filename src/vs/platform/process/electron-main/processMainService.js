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
import { listProcesses } from "../../../base/node/ps.js";
import { localize } from "../../../nls.js";
import { IDiagnosticsService, isRemoteDiagnosticError } from "../../diagnostics/common/diagnostics.js";
import { IDiagnosticsMainService } from "../../diagnostics/electron-main/diagnosticsMainService.js";
import { ILogService } from "../../log/common/log.js";
import { UtilityProcess } from "../../utilityProcess/electron-main/utilityProcess.js";
let ProcessMainService = class {
  constructor(logService, diagnosticsService, diagnosticsMainService) {
    this.logService = logService;
    this.diagnosticsService = diagnosticsService;
    this.diagnosticsMainService = diagnosticsMainService;
  }
  async resolveProcesses() {
    const mainProcessInfo = await this.diagnosticsMainService.getMainDiagnostics();
    const pidToNames = [];
    for (const window of mainProcessInfo.windows) {
      pidToNames.push([window.pid, `window [${window.id}] (${window.title})`]);
    }
    for (const { pid, name } of UtilityProcess.getAll()) {
      pidToNames.push([pid, name]);
    }
    const processes = [];
    try {
      processes.push({ name: localize("local", "Local"), rootProcess: await listProcesses(process.pid) });
      const remoteDiagnostics = await this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: true });
      remoteDiagnostics.forEach((data) => {
        if (isRemoteDiagnosticError(data)) {
          processes.push({
            name: data.hostName,
            rootProcess: data
          });
        } else {
          if (data.processes) {
            processes.push({
              name: data.hostName,
              rootProcess: data.processes
            });
          }
        }
      });
    } catch (e) {
      this.logService.error(`Listing processes failed: ${e}`);
    }
    return { pidToNames, processes };
  }
  async getSystemStatus() {
    const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: false, includeWorkspaceMetadata: false })]);
    return this.diagnosticsService.getDiagnostics(info, remoteData);
  }
  async getSystemInfo() {
    const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: false, includeWorkspaceMetadata: false })]);
    const msg = await this.diagnosticsService.getSystemInfo(info, remoteData);
    return msg;
  }
  async getPerformanceInfo(options) {
    try {
      const [info, remoteData] = await Promise.all([this.diagnosticsMainService.getMainDiagnostics(), this.diagnosticsMainService.getRemoteDiagnostics({ includeProcesses: true, includeWorkspaceMetadata: true })]);
      return await this.diagnosticsService.getPerformanceInfo(info, remoteData, options);
    } catch (error) {
      this.logService.warn("issueService#getPerformanceInfo ", error.message);
      throw error;
    }
  }
};
ProcessMainService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IDiagnosticsService),
  __decorateParam(2, IDiagnosticsMainService)
], ProcessMainService);
export {
  ProcessMainService
};
