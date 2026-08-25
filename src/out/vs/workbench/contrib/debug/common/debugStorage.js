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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../base/common/observable.js";
import { URI } from "../../../../base/common/uri.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { Breakpoint, DataBreakpoint, ExceptionBreakpoint, Expression, FunctionBreakpoint } from "./debugModel.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { mapValues } from "../../../../base/common/objects.js";
const DEBUG_BREAKPOINTS_KEY = "debug.breakpoint";
const DEBUG_FUNCTION_BREAKPOINTS_KEY = "debug.functionbreakpoint";
const DEBUG_DATA_BREAKPOINTS_KEY = "debug.databreakpoint";
const DEBUG_EXCEPTION_BREAKPOINTS_KEY = "debug.exceptionbreakpoint";
const DEBUG_WATCH_EXPRESSIONS_KEY = "debug.watchexpressions";
const DEBUG_CHOSEN_ENVIRONMENTS_KEY = "debug.chosenenvironment";
const DEBUG_UX_STATE_KEY = "debug.uxstate";
let DebugStorage = class extends Disposable {
  constructor(storageService, textFileService, uriIdentityService, logService) {
    super();
    this.storageService = storageService;
    this.textFileService = textFileService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this.breakpoints = observableValue(this, this.loadBreakpoints());
    this.functionBreakpoints = observableValue(this, this.loadFunctionBreakpoints());
    this.exceptionBreakpoints = observableValue(this, this.loadExceptionBreakpoints());
    this.dataBreakpoints = observableValue(this, this.loadDataBreakpoints());
    this.watchExpressions = observableValue(this, this.loadWatchExpressions());
    this._register(storageService.onDidChangeValue(StorageScope.WORKSPACE, void 0, this._store)((e) => {
      if (e.external) {
        switch (e.key) {
          case DEBUG_BREAKPOINTS_KEY:
            return this.breakpoints.set(this.loadBreakpoints(), void 0);
          case DEBUG_FUNCTION_BREAKPOINTS_KEY:
            return this.functionBreakpoints.set(this.loadFunctionBreakpoints(), void 0);
          case DEBUG_EXCEPTION_BREAKPOINTS_KEY:
            return this.exceptionBreakpoints.set(this.loadExceptionBreakpoints(), void 0);
          case DEBUG_DATA_BREAKPOINTS_KEY:
            return this.dataBreakpoints.set(this.loadDataBreakpoints(), void 0);
          case DEBUG_WATCH_EXPRESSIONS_KEY:
            return this.watchExpressions.set(this.loadWatchExpressions(), void 0);
        }
      }
    }));
  }
  loadDebugUxState() {
    return this.storageService.get(DEBUG_UX_STATE_KEY, StorageScope.WORKSPACE, "default");
  }
  storeDebugUxState(value) {
    this.storageService.store(DEBUG_UX_STATE_KEY, value, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  loadBreakpoints() {
    let result;
    try {
      result = JSON.parse(this.storageService.get(DEBUG_BREAKPOINTS_KEY, StorageScope.WORKSPACE, "[]")).map((breakpoint) => {
        breakpoint.uri = URI.revive(breakpoint.uri);
        return new Breakpoint(breakpoint, this.textFileService, this.uriIdentityService, this.logService, breakpoint.id);
      });
    } catch (e) {
      this.logService.error("Failed to load breakpoints from storage", e);
    }
    return result || [];
  }
  loadFunctionBreakpoints() {
    let result;
    try {
      result = JSON.parse(this.storageService.get(DEBUG_FUNCTION_BREAKPOINTS_KEY, StorageScope.WORKSPACE, "[]")).map((fb) => {
        return new FunctionBreakpoint(fb, fb.id);
      });
    } catch (e) {
      this.logService.error("Failed to load function breakpoints from storage", e);
    }
    return result || [];
  }
  loadExceptionBreakpoints() {
    let result;
    try {
      result = JSON.parse(this.storageService.get(DEBUG_EXCEPTION_BREAKPOINTS_KEY, StorageScope.WORKSPACE, "[]")).map((exBreakpoint) => {
        return new ExceptionBreakpoint(exBreakpoint, exBreakpoint.id);
      });
    } catch (e) {
      this.logService.error("Failed to load exception breakpoints from storage", e);
    }
    return result || [];
  }
  loadDataBreakpoints() {
    let result;
    try {
      result = JSON.parse(this.storageService.get(DEBUG_DATA_BREAKPOINTS_KEY, StorageScope.WORKSPACE, "[]")).map((dbp) => {
        return new DataBreakpoint(dbp, dbp.id);
      });
    } catch (e) {
      this.logService.error("Failed to load data breakpoints from storage", e);
    }
    return result || [];
  }
  loadWatchExpressions() {
    let result;
    try {
      result = JSON.parse(this.storageService.get(DEBUG_WATCH_EXPRESSIONS_KEY, StorageScope.WORKSPACE, "[]")).map((watchStoredData) => {
        return new Expression(watchStoredData.name, watchStoredData.id);
      });
    } catch (e) {
      this.logService.error("Failed to load watch expressions from storage", e);
    }
    return result || [];
  }
  loadChosenEnvironments() {
    const obj = JSON.parse(this.storageService.get(DEBUG_CHOSEN_ENVIRONMENTS_KEY, StorageScope.WORKSPACE, "{}"));
    return mapValues(obj, (value) => typeof value === "string" ? { type: value } : value);
  }
  storeChosenEnvironments(environments) {
    this.storageService.store(DEBUG_CHOSEN_ENVIRONMENTS_KEY, JSON.stringify(environments), StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  storeWatchExpressions(watchExpressions) {
    if (watchExpressions.length) {
      this.storageService.store(DEBUG_WATCH_EXPRESSIONS_KEY, JSON.stringify(watchExpressions.map((we) => ({ name: we.name, id: we.getId() }))), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_WATCH_EXPRESSIONS_KEY, StorageScope.WORKSPACE);
    }
  }
  storeBreakpoints(debugModel) {
    const breakpoints = debugModel.getBreakpoints();
    if (breakpoints.length) {
      this.storageService.store(DEBUG_BREAKPOINTS_KEY, JSON.stringify(breakpoints), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_BREAKPOINTS_KEY, StorageScope.WORKSPACE);
    }
    const functionBreakpoints = debugModel.getFunctionBreakpoints();
    if (functionBreakpoints.length) {
      this.storageService.store(DEBUG_FUNCTION_BREAKPOINTS_KEY, JSON.stringify(functionBreakpoints), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_FUNCTION_BREAKPOINTS_KEY, StorageScope.WORKSPACE);
    }
    const dataBreakpoints = debugModel.getDataBreakpoints().filter((dbp) => dbp.canPersist);
    if (dataBreakpoints.length) {
      this.storageService.store(DEBUG_DATA_BREAKPOINTS_KEY, JSON.stringify(dataBreakpoints), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_DATA_BREAKPOINTS_KEY, StorageScope.WORKSPACE);
    }
    const exceptionBreakpoints = debugModel.getExceptionBreakpoints();
    if (exceptionBreakpoints.length) {
      this.storageService.store(DEBUG_EXCEPTION_BREAKPOINTS_KEY, JSON.stringify(exceptionBreakpoints), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_EXCEPTION_BREAKPOINTS_KEY, StorageScope.WORKSPACE);
    }
  }
};
DebugStorage = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, ILogService)
], DebugStorage);
export {
  DebugStorage
};
