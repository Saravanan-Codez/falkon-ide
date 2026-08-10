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
import { validateConstraint } from "../../../base/common/types.js";
import * as extHostTypes from "./extHostTypes.js";
import * as extHostTypeConverter from "./extHostTypeConverters.js";
import { cloneAndChange } from "../../../base/common/objects.js";
import { MainContext } from "./extHost.protocol.js";
import { isNonEmptyArray } from "../../../base/common/arrays.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { revive } from "../../../base/common/marshalling.js";
import { Range } from "../../../editor/common/core/range.js";
import { Position } from "../../../editor/common/core/position.js";
import { URI } from "../../../base/common/uri.js";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { TestItemImpl } from "./extHostTestItem.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { TelemetryTrustedValue } from "../../../platform/telemetry/common/telemetryUtils.js";
import { IExtHostTelemetry } from "./extHostTelemetry.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { isCancellationError } from "../../../base/common/errors.js";
let ExtHostCommands = class {
  constructor(extHostRpc, logService, extHostTelemetry) {
    this._commands = /* @__PURE__ */ new Map();
    this._apiCommands = /* @__PURE__ */ new Map();
    this.#proxy = extHostRpc.getProxy(MainContext.MainThreadCommands);
    this._logService = logService;
    this.#extHostTelemetry = extHostTelemetry;
    this.#telemetry = extHostRpc.getProxy(MainContext.MainThreadTelemetry);
    this.converter = new CommandsConverter(
      this,
      (id) => {
        const candidate = this._apiCommands.get(id);
        return candidate?.result === ApiCommandResult.Void ? candidate : void 0;
      },
      logService
    );
    this._argumentProcessors = [
      {
        processArgument(a) {
          return revive(a);
        }
      },
      {
        processArgument(arg) {
          return cloneAndChange(arg, function(obj) {
            if (Range.isIRange(obj)) {
              return extHostTypeConverter.Range.to(obj);
            }
            if (Position.isIPosition(obj)) {
              return extHostTypeConverter.Position.to(obj);
            }
            if (Range.isIRange(obj.range) && URI.isUri(obj.uri)) {
              return extHostTypeConverter.location.to(obj);
            }
            if (obj instanceof VSBuffer) {
              return obj.buffer.buffer;
            }
            if (!Array.isArray(obj)) {
              return obj;
            }
          });
        }
      }
    ];
  }
  #proxy;
  #telemetry;
  #extHostTelemetry;
  registerArgumentProcessor(processor) {
    this._argumentProcessors.push(processor);
  }
  registerApiCommand(apiCommand) {
    const registration = this.registerCommand(false, apiCommand.id, async (...apiArgs) => {
      const internalArgs = apiCommand.args.map((arg, i) => {
        if (!arg.validate(apiArgs[i])) {
          throw new Error(`Invalid argument '${arg.name}' when running '${apiCommand.id}', received: ${typeof apiArgs[i] === "object" ? JSON.stringify(apiArgs[i], null, "	") : apiArgs[i]} `);
        }
        return arg.convert(apiArgs[i]);
      });
      const internalResult = await this.executeCommand(apiCommand.internalId, ...internalArgs);
      return apiCommand.result.convert(internalResult, apiArgs, this.converter);
    }, void 0, {
      description: apiCommand.description,
      args: apiCommand.args,
      returns: apiCommand.result.description
    });
    this._apiCommands.set(apiCommand.id, apiCommand);
    return new extHostTypes.Disposable(() => {
      registration.dispose();
      this._apiCommands.delete(apiCommand.id);
    });
  }
  registerCommand(global, id, callback, thisArg, metadata, extension) {
    this._logService.trace("ExtHostCommands#registerCommand", id);
    if (!id.trim().length) {
      throw new Error("invalid id");
    }
    if (this._commands.has(id)) {
      throw new Error(`command '${id}' already exists`);
    }
    this._commands.set(id, { callback, thisArg, metadata, extension });
    if (global) {
      this.#proxy.$registerCommand(id);
    }
    return new extHostTypes.Disposable(() => {
      if (this._commands.delete(id)) {
        if (global) {
          this.#proxy.$unregisterCommand(id);
        }
      }
    });
  }
  executeCommand(id, ...args) {
    this._logService.trace("ExtHostCommands#executeCommand", id);
    return this._doExecuteCommand(id, args, true);
  }
  async _doExecuteCommand(id, args, retry) {
    if (this._commands.has(id)) {
      this.#proxy.$fireCommandActivationEvent(id);
      return this._executeContributedCommand(id, args, false);
    } else {
      let hasBuffers = false;
      const toArgs = cloneAndChange(args, function(value) {
        if (value instanceof extHostTypes.Position) {
          return extHostTypeConverter.Position.from(value);
        } else if (value instanceof extHostTypes.Range) {
          return extHostTypeConverter.Range.from(value);
        } else if (value instanceof extHostTypes.Location) {
          return extHostTypeConverter.location.from(value);
        } else if (extHostTypes.NotebookRange.isNotebookRange(value)) {
          return extHostTypeConverter.NotebookRange.from(value);
        } else if (value instanceof ArrayBuffer) {
          hasBuffers = true;
          return VSBuffer.wrap(new Uint8Array(value));
        } else if (value instanceof Uint8Array) {
          hasBuffers = true;
          return VSBuffer.wrap(value);
        } else if (value instanceof VSBuffer) {
          hasBuffers = true;
          return value;
        }
        if (!Array.isArray(value)) {
          return value;
        }
      });
      try {
        const result = await this.#proxy.$executeCommand(id, hasBuffers ? new SerializableObjectWithBuffers(toArgs) : toArgs, retry);
        return revive(result);
      } catch (e) {
        if (e instanceof Error && e.message === "$executeCommand:retry") {
          return this._doExecuteCommand(id, args, false);
        } else {
          throw e;
        }
      }
    }
  }
  async _executeContributedCommand(id, args, annotateError) {
    const command = this._commands.get(id);
    if (!command) {
      throw new Error("Unknown command");
    }
    const { callback, thisArg, metadata } = command;
    if (metadata?.args) {
      for (let i = 0; i < metadata.args.length; i++) {
        try {
          validateConstraint(args[i], metadata.args[i].constraint);
        } catch (err) {
          throw new Error(`Running the contributed command: '${id}' failed. Illegal argument '${metadata.args[i].name}' - ${metadata.args[i].description}`);
        }
      }
    }
    const stopWatch = StopWatch.create();
    try {
      return await callback.apply(thisArg, args);
    } catch (err) {
      if (id === this.converter.delegatingCommandId) {
        const actual = this.converter.getActualCommand(...args);
        if (actual) {
          id = actual.command;
        }
      }
      if (!isCancellationError(err)) {
        this._logService.error(err, id, command.extension?.identifier);
      }
      if (!annotateError) {
        throw err;
      }
      if (command.extension?.identifier) {
        const reported = this.#extHostTelemetry.onExtensionError(command.extension.identifier, err);
        this._logService.trace("forwarded error to extension?", reported, command.extension?.identifier);
      }
      throw new class CommandError extends Error {
        constructor() {
          super(toErrorMessage(err));
          this.id = id;
          this.source = command.extension?.displayName ?? command.extension?.name;
        }
      }();
    } finally {
      this._reportTelemetry(command, id, stopWatch.elapsed());
    }
  }
  _reportTelemetry(command, id, duration) {
    if (!command.extension) {
      return;
    }
    if (id.startsWith("code.copilot.logStructured")) {
      return;
    }
    this.#telemetry.$publicLog2("Extension:ActionExecuted", {
      extensionId: command.extension.identifier.value,
      id: new TelemetryTrustedValue(id),
      duration
    });
  }
  $executeContributedCommand(id, ...args) {
    this._logService.trace("ExtHostCommands#$executeContributedCommand", id);
    const cmdHandler = this._commands.get(id);
    if (!cmdHandler) {
      return Promise.reject(new Error(`Contributed command '${id}' does not exist.`));
    } else {
      args = args.map((arg) => this._argumentProcessors.reduce((r, p) => p.processArgument(r, cmdHandler.extension), arg));
      return this._executeContributedCommand(id, args, true);
    }
  }
  getCommands(filterUnderscoreCommands = false) {
    this._logService.trace("ExtHostCommands#getCommands", filterUnderscoreCommands);
    return this.#proxy.$getCommands().then((result) => {
      if (filterUnderscoreCommands) {
        result = result.filter((command) => command[0] !== "_");
      }
      return result;
    });
  }
  $getContributedCommandMetadata() {
    const result = /* @__PURE__ */ Object.create(null);
    for (const [id, command] of this._commands) {
      const { metadata } = command;
      if (metadata) {
        result[id] = metadata;
      }
    }
    return Promise.resolve(result);
  }
};
ExtHostCommands = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IExtHostTelemetry)
], ExtHostCommands);
const IExtHostCommands = createDecorator("IExtHostCommands");
class CommandsConverter {
  // --- conversion between internal and api commands
  constructor(_commands, _lookupApiCommand, _logService) {
    this._commands = _commands;
    this._lookupApiCommand = _lookupApiCommand;
    this._logService = _logService;
    this.delegatingCommandId = `__vsc${generateUuid()}`;
    this._cache = /* @__PURE__ */ new Map();
    this._cachIdPool = 0;
    this._commands.registerCommand(true, this.delegatingCommandId, this._executeConvertedCommand, this);
  }
  toInternal(command, disposables) {
    if (!command) {
      return void 0;
    }
    const result = {
      $ident: void 0,
      id: command.command,
      title: command.title,
      tooltip: command.tooltip
    };
    if (!command.command) {
      return result;
    }
    const apiCommand = this._lookupApiCommand(command.command);
    if (apiCommand) {
      result.id = apiCommand.internalId;
      result.arguments = apiCommand.args.map((arg, i) => arg.convert(command.arguments && command.arguments[i]));
    } else if (isNonEmptyArray(command.arguments)) {
      const id = `${command.command} /${++this._cachIdPool}`;
      this._cache.set(id, command);
      disposables.add(toDisposable(() => {
        this._cache.delete(id);
        this._logService.trace("CommandsConverter#DISPOSE", id);
      }));
      result.$ident = id;
      result.id = this.delegatingCommandId;
      result.arguments = [id];
      this._logService.trace("CommandsConverter#CREATE", command.command, id);
    }
    return result;
  }
  fromInternal(command) {
    if (typeof command.$ident === "string") {
      return this._cache.get(command.$ident);
    } else {
      return {
        command: command.id,
        title: command.title,
        arguments: command.arguments
      };
    }
  }
  getActualCommand(...args) {
    return this._cache.get(args[0]);
  }
  _executeConvertedCommand(...args) {
    const actualCmd = this.getActualCommand(...args);
    this._logService.trace("CommandsConverter#EXECUTE", args[0], actualCmd ? actualCmd.command : "MISSING");
    if (!actualCmd) {
      return Promise.reject(`Actual command not found, wanted to execute ${args[0]}`);
    }
    return this._commands.executeCommand(actualCmd.command, ...actualCmd.arguments || []);
  }
}
class ApiCommandArgument {
  constructor(name, description, validate, convert) {
    this.name = name;
    this.description = description;
    this.validate = validate;
    this.convert = convert;
  }
  static {
    this.Uri = new ApiCommandArgument("uri", "Uri of a text document", (v) => URI.isUri(v), (v) => v);
  }
  static {
    this.Position = new ApiCommandArgument("position", "A position in a text document", (v) => extHostTypes.Position.isPosition(v), extHostTypeConverter.Position.from);
  }
  static {
    this.Range = new ApiCommandArgument("range", "A range in a text document", (v) => extHostTypes.Range.isRange(v), extHostTypeConverter.Range.from);
  }
  static {
    this.Selection = new ApiCommandArgument("selection", "A selection in a text document", (v) => extHostTypes.Selection.isSelection(v), extHostTypeConverter.Selection.from);
  }
  static {
    this.Number = new ApiCommandArgument("number", "", (v) => typeof v === "number", (v) => v);
  }
  static {
    this.String = new ApiCommandArgument("string", "", (v) => typeof v === "string", (v) => v);
  }
  static Arr(element) {
    return new ApiCommandArgument(
      `${element.name}_array`,
      `Array of ${element.name}, ${element.description}`,
      (v) => Array.isArray(v) && v.every((e) => element.validate(e)),
      (v) => v.map((e) => element.convert(e))
    );
  }
  static {
    this.CallHierarchyItem = new ApiCommandArgument("item", "A call hierarchy item", (v) => v instanceof extHostTypes.CallHierarchyItem, extHostTypeConverter.CallHierarchyItem.from);
  }
  static {
    this.TypeHierarchyItem = new ApiCommandArgument("item", "A type hierarchy item", (v) => v instanceof extHostTypes.TypeHierarchyItem, extHostTypeConverter.TypeHierarchyItem.from);
  }
  static {
    this.TestItem = new ApiCommandArgument("testItem", "A VS Code TestItem", (v) => v instanceof TestItemImpl, extHostTypeConverter.TestItem.from);
  }
  static {
    this.TestProfile = new ApiCommandArgument("testProfile", "A VS Code test profile", (v) => v instanceof extHostTypes.TestRunProfileBase, extHostTypeConverter.TestRunProfile.from);
  }
  optional() {
    return new ApiCommandArgument(
      this.name,
      `(optional) ${this.description}`,
      (value) => value === void 0 || value === null || this.validate(value),
      (value) => value === void 0 ? void 0 : value === null ? null : this.convert(value)
    );
  }
  with(name, description) {
    return new ApiCommandArgument(name ?? this.name, description ?? this.description, this.validate, this.convert);
  }
}
class ApiCommandResult {
  constructor(description, convert) {
    this.description = description;
    this.convert = convert;
  }
  static {
    this.Void = new ApiCommandResult("no result", (v) => v);
  }
}
class ApiCommand {
  constructor(id, internalId, description, args, result) {
    this.id = id;
    this.internalId = internalId;
    this.description = description;
    this.args = args;
    this.result = result;
  }
}
export {
  ApiCommand,
  ApiCommandArgument,
  ApiCommandResult,
  CommandsConverter,
  ExtHostCommands,
  IExtHostCommands
};
