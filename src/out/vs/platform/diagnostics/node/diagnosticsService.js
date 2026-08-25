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
import * as fs from "fs";
import * as osLib from "os";
import { Promises } from "../../../base/common/async.js";
import { getNodeType, parse } from "../../../base/common/json.js";
import { Schemas } from "../../../base/common/network.js";
import { basename, join } from "../../../base/common/path.js";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { URI } from "../../../base/common/uri.js";
import { virtualMachineHint } from "../../../base/node/id.js";
import { Promises as pfs } from "../../../base/node/pfs.js";
import { listProcesses } from "../../../base/node/ps.js";
import { isRemoteDiagnosticError } from "../common/diagnostics.js";
import { ByteSize } from "../../files/common/files.js";
import { IProductService } from "../../product/common/productService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
const workspaceStatsCache = /* @__PURE__ */ new Map();
const NO_EXT_KEY = "\0no-extension";
async function collectWorkspaceStats(folder, filter, options) {
  const cacheKey = `${folder}::${filter.join(":")}::${options?.unbounded ? "unbounded" : "bounded"}`;
  if (!options?.skipCache) {
    const cached = workspaceStatsCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  } else {
    workspaceStatsCache.delete(cacheKey);
  }
  const configFilePatterns = [
    { tag: "grunt.js", filePattern: /^gruntfile\.js$/i },
    { tag: "gulp.js", filePattern: /^gulpfile\.js$/i },
    { tag: "tsconfig.json", filePattern: /^tsconfig\.json$/i },
    { tag: "package.json", filePattern: /^package\.json$/i },
    { tag: "jsconfig.json", filePattern: /^jsconfig\.json$/i },
    { tag: "tslint.json", filePattern: /^tslint\.json$/i },
    { tag: "eslint.json", filePattern: /^eslint\.json$/i },
    { tag: "tasks.json", filePattern: /^tasks\.json$/i },
    { tag: "launch.json", filePattern: /^launch\.json$/i },
    { tag: "mcp.json", filePattern: /^mcp\.json$/i },
    { tag: "settings.json", filePattern: /^settings\.json$/i },
    { tag: "webpack.config.js", filePattern: /^webpack\.config\.js$/i },
    { tag: "project.json", filePattern: /^project\.json$/i },
    { tag: "makefile", filePattern: /^makefile$/i },
    { tag: "sln", filePattern: /^.+\.sln$/i },
    { tag: "csproj", filePattern: /^.+\.csproj$/i },
    { tag: "cmake", filePattern: /^.+\.cmake$/i },
    { tag: "github-actions", filePattern: /^.+\.ya?ml$/i, relativePathPattern: /^\.github(?:\/|\\)workflows$/i },
    { tag: "devcontainer.json", filePattern: /^devcontainer\.json$/i },
    { tag: "dockerfile", filePattern: /^(dockerfile|docker\-compose\.ya?ml)$/i },
    { tag: "cursorrules", filePattern: /^\.cursorrules$/i },
    { tag: "cursorrules-dir", filePattern: /\.mdc$/i, relativePathPattern: /^\.cursor[\/\\]rules$/i },
    { tag: "github-instructions-dir", filePattern: /\.instructions\.md$/i, relativePathPattern: /^\.github[\/\\]instructions$/i },
    { tag: "github-prompts-dir", filePattern: /\.prompt\.md$/i, relativePathPattern: /^\.github[\/\\]prompts$/i },
    { tag: "clinerules", filePattern: /^\.clinerules$/i },
    { tag: "clinerules-dir", filePattern: /\.md$/i, relativePathPattern: /^\.clinerules$/i },
    { tag: "agent.md", filePattern: /^agent\.md$/i },
    { tag: "agents.md", filePattern: /^agents\.md$/i },
    { tag: "claude.md", filePattern: /^claude\.md$/i },
    { tag: "claude-settings", filePattern: /^settings\.json$/i, relativePathPattern: /^\.claude$/i },
    { tag: "claude-settings-local", filePattern: /^settings\.local\.json$/i, relativePathPattern: /^\.claude$/i },
    { tag: "claude-mcp", filePattern: /^mcp\.json$/i, relativePathPattern: /^\.claude$/i },
    { tag: "claude-commands-dir", filePattern: /\.md$/i, relativePathPattern: /^\.claude[\/\\]commands$/i },
    { tag: "claude-skills-dir", filePattern: /^SKILL\.md$/i, relativePathPattern: /^\.claude[\/\\]skills[\/\\]/i },
    { tag: "claude-rules-dir", filePattern: /\.md$/i, relativePathPattern: /^\.claude[\/\\]rules$/i },
    { tag: "gemini.md", filePattern: /^gemini\.md$/i },
    { tag: "copilot-instructions.md", filePattern: /^copilot\-instructions\.md$/i, relativePathPattern: /^\.github$/i }
  ];
  const fileTypes = /* @__PURE__ */ new Map();
  const configFiles = /* @__PURE__ */ new Map();
  const MAX_FILES = options?.unbounded ? Number.POSITIVE_INFINITY : 2e4;
  function collect(root, dir, filter2, token) {
    const relativePath = dir.substring(root.length + 1);
    return Promises.withAsyncBody(async (resolve) => {
      if (token.count >= MAX_FILES) {
        token.maxReached = true;
        resolve();
        return;
      }
      let files;
      token.readdirCount++;
      try {
        files = await pfs.readdir(dir, { withFileTypes: true });
      } catch (error) {
        resolve();
        return;
      }
      if (token.count >= MAX_FILES) {
        token.maxReached = true;
        resolve();
        return;
      }
      let pending = files.length;
      if (pending === 0) {
        resolve();
        return;
      }
      for (const file of files) {
        if (file.isDirectory()) {
          if (!filter2.includes(file.name)) {
            await collect(root, join(dir, file.name), filter2, token);
          }
          if (--pending === 0) {
            resolve();
            return;
          }
        } else {
          if (token.count >= MAX_FILES) {
            token.maxReached = true;
            resolve();
            return;
          }
          token.count++;
          const index = file.name.lastIndexOf(".");
          let fileType;
          if (index >= 0) {
            fileType = file.name.substring(index + 1) || void 0;
          }
          fileTypes.set(fileType ?? NO_EXT_KEY, (fileTypes.get(fileType ?? NO_EXT_KEY) ?? 0) + 1);
          for (const configFile of configFilePatterns) {
            if (configFile.relativePathPattern?.test(relativePath) !== false && configFile.filePattern.test(file.name)) {
              configFiles.set(configFile.tag, (configFiles.get(configFile.tag) ?? 0) + 1);
            }
          }
          if (--pending === 0) {
            resolve();
            return;
          }
        }
      }
    });
  }
  const statsPromise = Promises.withAsyncBody(async (resolve) => {
    const token = { count: 0, maxReached: false, readdirCount: 0 };
    const sw = new StopWatch(true);
    await collect(folder, folder, filter, token);
    const launchConfigs = await collectLaunchConfigs(folder);
    resolve({
      configFiles: asSortedItems(configFiles),
      fileTypes: asSortedItems(fileTypes),
      fileCount: token.count,
      maxFilesReached: token.maxReached,
      launchConfigFiles: launchConfigs,
      totalScanTime: sw.elapsed(),
      totalReaddirCount: token.readdirCount
    });
  });
  workspaceStatsCache.set(cacheKey, statsPromise);
  return statsPromise;
}
function asSortedItems(items) {
  return Array.from(items.entries(), ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
function getMachineInfo() {
  const machineInfo = {
    os: `${osLib.type()} ${osLib.arch()} ${osLib.release()}`,
    memory: `${(osLib.totalmem() / ByteSize.GB).toFixed(2)}GB (${(osLib.freemem() / ByteSize.GB).toFixed(2)}GB free)`,
    vmHint: `${Math.round(virtualMachineHint.value() * 100)}%`
  };
  const cpus = osLib.cpus();
  if (cpus && cpus.length > 0) {
    machineInfo.cpus = `${cpus[0].model} (${cpus.length} x ${cpus[0].speed})`;
  }
  return machineInfo;
}
async function collectLaunchConfigs(folder) {
  try {
    const launchConfigs = /* @__PURE__ */ new Map();
    const launchConfig = join(folder, ".vscode", "launch.json");
    const contents = await fs.promises.readFile(launchConfig);
    const errors = [];
    const json = parse(contents.toString(), errors);
    if (errors.length) {
      console.log(`Unable to parse ${launchConfig}`);
      return [];
    }
    if (getNodeType(json) === "object" && json["configurations"]) {
      for (const each of json["configurations"]) {
        const type = each["type"];
        if (type) {
          if (launchConfigs.has(type)) {
            launchConfigs.set(type, launchConfigs.get(type) + 1);
          } else {
            launchConfigs.set(type, 1);
          }
        }
      }
    }
    return asSortedItems(launchConfigs);
  } catch (error) {
    return [];
  }
}
let DiagnosticsService = class {
  constructor(telemetryService, productService) {
    this.telemetryService = telemetryService;
    this.productService = productService;
  }
  formatMachineInfo(info) {
    const output = [];
    output.push(`OS Version:       ${info.os}`);
    output.push(`CPUs:             ${info.cpus}`);
    output.push(`Memory (System):  ${info.memory}`);
    output.push(`VM:               ${info.vmHint}`);
    return output.join("\n");
  }
  formatEnvironment(info) {
    const output = [];
    output.push(`Version:          ${this.productService.nameShort} ${this.productService.version} (${this.productService.commit || "Commit unknown"}, ${this.productService.date || "Date unknown"})`);
    output.push(`OS Version:       ${osLib.type()} ${osLib.arch()} ${osLib.release()}`);
    const cpus = osLib.cpus();
    if (cpus && cpus.length > 0) {
      output.push(`CPUs:             ${cpus[0].model} (${cpus.length} x ${cpus[0].speed})`);
    }
    output.push(`Memory (System):  ${(osLib.totalmem() / ByteSize.GB).toFixed(2)}GB (${(osLib.freemem() / ByteSize.GB).toFixed(2)}GB free)`);
    if (!isWindows) {
      output.push(`Load (avg):       ${osLib.loadavg().map((l) => Math.round(l)).join(", ")}`);
    }
    output.push(`VM:               ${Math.round(virtualMachineHint.value() * 100)}%`);
    output.push(`Screen Reader:    ${info.screenReader ? "yes" : "no"}`);
    output.push(`Process Argv:     ${info.mainArguments.join(" ")}`);
    output.push(`GPU Status:       ${this.expandGPUFeatures(info.gpuFeatureStatus)}`);
    if (info.gpuLogMessages && info.gpuLogMessages.length > 0) {
      output.push(`GPU Log Messages:`);
      info.gpuLogMessages.forEach((msg) => {
        output.push(`${msg.header}: ${msg.message}`);
      });
    }
    return output.join("\n");
  }
  async getPerformanceInfo(info, remoteData, options) {
    return Promise.all([listProcesses(info.mainPID), this.formatWorkspaceMetadata(info, options)]).then(async (result) => {
      let [rootProcess, workspaceInfo] = result;
      let processInfo = this.formatProcessList(info, rootProcess);
      remoteData.forEach((diagnostics) => {
        if (isRemoteDiagnosticError(diagnostics)) {
          processInfo += `
${diagnostics.errorMessage}`;
          workspaceInfo += `
${diagnostics.errorMessage}`;
        } else {
          processInfo += `

Remote: ${diagnostics.hostName}`;
          if (diagnostics.processes) {
            processInfo += `
${this.formatProcessList(info, diagnostics.processes)}`;
          }
          if (diagnostics.workspaceMetadata) {
            workspaceInfo += `
|  Remote: ${diagnostics.hostName}`;
            for (const folder of Object.keys(diagnostics.workspaceMetadata)) {
              const metadata = diagnostics.workspaceMetadata[folder];
              let countMessage = `${metadata.fileCount} files`;
              if (metadata.maxFilesReached) {
                countMessage = `more than ${countMessage}`;
              }
              workspaceInfo += `|    Folder (${folder}): ${countMessage}`;
              workspaceInfo += this.formatWorkspaceStats(metadata);
            }
          }
        }
      });
      return {
        processInfo,
        workspaceInfo
      };
    });
  }
  async getSystemInfo(info, remoteData) {
    const { memory, vmHint, os, cpus } = getMachineInfo();
    const systemInfo = {
      os,
      memory,
      cpus,
      vmHint,
      processArgs: `${info.mainArguments.join(" ")}`,
      gpuStatus: info.gpuFeatureStatus,
      screenReader: `${info.screenReader ? "yes" : "no"}`,
      remoteData
    };
    if (!isWindows) {
      systemInfo.load = `${osLib.loadavg().map((l) => Math.round(l)).join(", ")}`;
    }
    if (isLinux) {
      systemInfo.linuxEnv = {
        desktopSession: process.env["DESKTOP_SESSION"],
        xdgSessionDesktop: process.env["XDG_SESSION_DESKTOP"],
        xdgCurrentDesktop: process.env["XDG_CURRENT_DESKTOP"],
        xdgSessionType: process.env["XDG_SESSION_TYPE"]
      };
    }
    return Promise.resolve(systemInfo);
  }
  async getDiagnostics(info, remoteDiagnostics) {
    const output = [];
    return listProcesses(info.mainPID).then(async (rootProcess) => {
      output.push("");
      output.push(this.formatEnvironment(info));
      output.push("");
      output.push(this.formatProcessList(info, rootProcess));
      if (info.windows.some((window) => window.folderURIs && window.folderURIs.length > 0 && !window.remoteAuthority)) {
        output.push("");
        output.push("Workspace Stats: ");
        output.push(await this.formatWorkspaceMetadata(info));
      }
      remoteDiagnostics.forEach((diagnostics) => {
        if (isRemoteDiagnosticError(diagnostics)) {
          output.push(`
${diagnostics.errorMessage}`);
        } else {
          output.push("\n\n");
          output.push(`Remote:           ${diagnostics.hostName}`);
          output.push(this.formatMachineInfo(diagnostics.machineInfo));
          if (diagnostics.processes) {
            output.push(this.formatProcessList(info, diagnostics.processes));
          }
          if (diagnostics.workspaceMetadata) {
            for (const folder of Object.keys(diagnostics.workspaceMetadata)) {
              const metadata = diagnostics.workspaceMetadata[folder];
              let countMessage = `${metadata.fileCount} files`;
              if (metadata.maxFilesReached) {
                countMessage = `more than ${countMessage}`;
              }
              output.push(`Folder (${folder}): ${countMessage}`);
              output.push(this.formatWorkspaceStats(metadata));
            }
          }
        }
      });
      output.push("");
      output.push("");
      return output.join("\n");
    });
  }
  formatWorkspaceStats(workspaceStats) {
    const output = [];
    const lineLength = 60;
    let col = 0;
    const appendAndWrap = (name, count) => {
      const item = ` ${name}(${count})`;
      if (col + item.length > lineLength) {
        output.push(line);
        line = "|                 ";
        col = line.length;
      } else {
        col += item.length;
      }
      line += item;
    };
    let line = "|      File types:";
    const maxShown = 10;
    const namedTypes = workspaceStats.fileTypes.filter((t) => t.name !== NO_EXT_KEY);
    const noExtCount = workspaceStats.fileTypes.filter((t) => t.name === NO_EXT_KEY).reduce((sum, t) => sum + t.count, 0);
    const max = Math.min(namedTypes.length, maxShown);
    for (let i = 0; i < max; i++) {
      const item = namedTypes[i];
      appendAndWrap(item.name, item.count);
    }
    let otherCount = noExtCount;
    for (let i = max; i < namedTypes.length; i++) {
      otherCount += namedTypes[i].count;
    }
    if (otherCount > 0) {
      appendAndWrap("other", otherCount);
    }
    output.push(line);
    if (workspaceStats.configFiles.length >= 0) {
      line = "|      Conf files:";
      col = 0;
      workspaceStats.configFiles.forEach((item) => {
        appendAndWrap(item.name, item.count);
      });
      output.push(line);
    }
    if (workspaceStats.launchConfigFiles.length > 0) {
      let line2 = "|      Launch Configs:";
      workspaceStats.launchConfigFiles.forEach((each) => {
        const item = each.count > 1 ? ` ${each.name}(${each.count})` : ` ${each.name}`;
        line2 += item;
      });
      output.push(line2);
    }
    return output.join("\n");
  }
  expandGPUFeatures(gpuFeatures) {
    const longestFeatureName = Math.max(...Object.keys(gpuFeatures).map((feature) => feature.length));
    return Object.keys(gpuFeatures).map((feature) => `${feature}:  ${" ".repeat(longestFeatureName - feature.length)}  ${gpuFeatures[feature]}`).join("\n                  ");
  }
  formatWorkspaceMetadata(info, options) {
    const output = [];
    const workspaceStatPromises = [];
    info.windows.forEach((window) => {
      if (window.folderURIs.length === 0 || !!window.remoteAuthority) {
        return;
      }
      output.push(`|  Window (${window.title})`);
      window.folderURIs.forEach((uriComponents) => {
        const folderUri = URI.revive(uriComponents);
        if (folderUri.scheme === Schemas.file) {
          const folder = folderUri.fsPath;
          workspaceStatPromises.push(collectWorkspaceStats(folder, ["node_modules", ".git"], options).then((stats) => {
            let countMessage = `${stats.fileCount} files`;
            if (stats.maxFilesReached) {
              countMessage = `more than ${countMessage}`;
            }
            output.push(`|    Folder (${basename(folder)}): ${countMessage}`);
            output.push(this.formatWorkspaceStats(stats));
          }).catch((error) => {
            output.push(`|      Error: Unable to collect workspace stats for folder ${folder} (${error.toString()})`);
          }));
        } else {
          output.push(`|    Folder (${folderUri.toString()}): Workspace stats not available.`);
        }
      });
    });
    return Promise.all(workspaceStatPromises).then((_) => output.join("\n")).catch((e) => `Unable to collect workspace stats: ${e}`);
  }
  formatProcessList(info, rootProcess) {
    const mapProcessToName = /* @__PURE__ */ new Map();
    info.windows.forEach((window) => mapProcessToName.set(window.pid, `window [${window.id}] (${window.title})`));
    info.pidToNames.forEach(({ pid, name }) => mapProcessToName.set(pid, name));
    const output = [];
    output.push("CPU %	Mem MB	   PID	Process");
    if (rootProcess) {
      this.formatProcessItem(info.mainPID, mapProcessToName, output, rootProcess, 0);
    }
    return output.join("\n");
  }
  formatProcessItem(mainPid, mapProcessToName, output, item, indent) {
    const isRoot = indent === 0;
    let name;
    if (isRoot) {
      name = item.pid === mainPid ? this.productService.applicationName : "remote-server";
    } else {
      if (mapProcessToName.has(item.pid)) {
        name = mapProcessToName.get(item.pid);
      } else {
        name = `${"  ".repeat(indent)} ${item.name}`;
      }
    }
    const memory = process.platform === "win32" ? item.mem : osLib.totalmem() * (item.mem / 100);
    output.push(`${item.load.toFixed(0).padStart(5, " ")}	${(memory / ByteSize.MB).toFixed(0).padStart(6, " ")}	${item.pid.toFixed(0).padStart(6, " ")}	${name}`);
    if (Array.isArray(item.children)) {
      item.children.forEach((child) => this.formatProcessItem(mainPid, mapProcessToName, output, child, indent + 1));
    }
  }
  async getWorkspaceFileExtensions(workspace) {
    const items = /* @__PURE__ */ new Set();
    for (const { uri } of workspace.folders) {
      const folderUri = URI.revive(uri);
      if (folderUri.scheme !== Schemas.file) {
        continue;
      }
      const folder = folderUri.fsPath;
      try {
        const stats = await collectWorkspaceStats(folder, ["node_modules", ".git"]);
        stats.fileTypes.forEach((item) => {
          if (item.name !== NO_EXT_KEY) {
            items.add(item.name);
          }
        });
      } catch {
      }
    }
    return { extensions: [...items] };
  }
  async reportWorkspaceStats(workspace) {
    for (const { uri } of workspace.folders) {
      const folderUri = URI.revive(uri);
      if (folderUri.scheme !== Schemas.file) {
        continue;
      }
      const folder = folderUri.fsPath;
      try {
        const stats = await collectWorkspaceStats(folder, ["node_modules", ".git"]);
        this.telemetryService.publicLog2("workspace.stats", {
          "workspace.id": workspace.telemetryId,
          rendererSessionId: workspace.rendererSessionId
        });
        stats.fileTypes.forEach((e) => {
          if (e.name === NO_EXT_KEY) {
            return;
          }
          this.telemetryService.publicLog2("workspace.stats.file", {
            rendererSessionId: workspace.rendererSessionId,
            type: e.name,
            count: e.count
          });
        });
        stats.launchConfigFiles.forEach((e) => {
          this.telemetryService.publicLog2("workspace.stats.launchConfigFile", {
            rendererSessionId: workspace.rendererSessionId,
            type: e.name,
            count: e.count
          });
        });
        stats.configFiles.forEach((e) => {
          this.telemetryService.publicLog2("workspace.stats.configFiles", {
            rendererSessionId: workspace.rendererSessionId,
            type: e.name,
            count: e.count
          });
        });
        this.telemetryService.publicLog2("workspace.stats.metadata", { duration: stats.totalScanTime, reachedLimit: stats.maxFilesReached, fileCount: stats.fileCount, readdirCount: stats.totalReaddirCount });
      } catch {
      }
    }
  }
};
DiagnosticsService = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IProductService)
], DiagnosticsService);
export {
  DiagnosticsService,
  collectLaunchConfigs,
  collectWorkspaceStats,
  getMachineInfo
};
