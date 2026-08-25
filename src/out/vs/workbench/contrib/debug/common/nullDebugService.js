import { Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { State } from "./debug.js";
const nullViewModel = {
  getId() {
    return "root";
  },
  focusedSession: void 0,
  focusedThread: void 0,
  focusedStackFrame: void 0,
  setVisualizedExpression() {
  },
  getVisualizedExpression() {
    return void 0;
  },
  getSelectedExpression() {
    return void 0;
  },
  setSelectedExpression() {
  },
  updateViews() {
  },
  isMultiSessionView() {
    return false;
  },
  onDidFocusSession: Event.None,
  onDidFocusThread: Event.None,
  onDidFocusStackFrame: Event.None,
  onDidSelectExpression: Event.None,
  onDidEvaluateLazyExpression: Event.None,
  onDidChangeVisualization: Event.None,
  onWillUpdateViews: Event.None,
  evaluateLazyExpression(_expression) {
  }
};
const nullDebugModel = {
  getId() {
    return "root";
  },
  getSession() {
    return void 0;
  },
  getSessions() {
    return [];
  },
  getBreakpoints() {
    return [];
  },
  areBreakpointsActivated() {
    return false;
  },
  getFunctionBreakpoints() {
    return [];
  },
  getDataBreakpoints() {
    return [];
  },
  getExceptionBreakpoints() {
    return [];
  },
  getExceptionBreakpointsForSession() {
    return [];
  },
  getInstructionBreakpoints() {
    return [];
  },
  getWatchExpressions() {
    return [];
  },
  registerBreakpointModes() {
  },
  getBreakpointModes() {
    return [];
  },
  onDidChangeBreakpoints: Event.None,
  onDidChangeCallStack: Event.None,
  onDidChangeWatchExpressions: Event.None,
  onDidChangeWatchExpressionValue: Event.None,
  async fetchCallstack() {
  }
};
const nullConfigurationManager = {
  selectedConfiguration: {
    launch: void 0,
    getConfig: () => Promise.resolve(void 0),
    name: void 0,
    type: void 0
  },
  async selectConfiguration() {
  },
  getLaunches() {
    return [];
  },
  getLaunch() {
    return void 0;
  },
  getAllConfigurations() {
    return [];
  },
  removeRecentDynamicConfigurations() {
  },
  getRecentDynamicConfigurations() {
    return [];
  },
  onDidSelectConfiguration: Event.None,
  onDidChangeConfigurationProviders: Event.None,
  hasDebugConfigurationProvider() {
    return false;
  },
  async getDynamicProviders() {
    return [];
  },
  async getDynamicConfigurationsByType() {
    return [];
  },
  registerDebugConfigurationProvider() {
    return Disposable.None;
  },
  unregisterDebugConfigurationProvider() {
  },
  async resolveConfigurationByProviders() {
    return void 0;
  }
};
const nullAdapterManager = {
  onDidRegisterDebugger: Event.None,
  hasEnabledDebuggers() {
    return false;
  },
  async getDebugAdapterDescriptor() {
    return void 0;
  },
  getDebuggerLabel() {
    return void 0;
  },
  someDebuggerInterestedInLanguage() {
    return false;
  },
  getDebugger() {
    return void 0;
  },
  async activateDebuggers() {
  },
  registerDebugAdapterFactory() {
    return Disposable.None;
  },
  createDebugAdapter() {
    return void 0;
  },
  registerDebugAdapterDescriptorFactory() {
    return Disposable.None;
  },
  unregisterDebugAdapterDescriptorFactory() {
  },
  async substituteVariables(_debugType, _folder, config) {
    return config;
  },
  async runInTerminal() {
    return void 0;
  },
  getEnabledDebugger() {
    return void 0;
  },
  async guessDebugger() {
    return void 0;
  },
  get onDidDebuggersExtPointRead() {
    return Event.None;
  }
};
class NullDebugService {
  constructor() {
    this.state = State.Inactive;
    this.initializingOptions = void 0;
    this.onDidChangeState = Event.None;
    this.onWillNewSession = Event.None;
    this.onDidNewSession = Event.None;
    this.onDidEndSession = Event.None;
  }
  getConfigurationManager() {
    return nullConfigurationManager;
  }
  getAdapterManager() {
    return nullAdapterManager;
  }
  getModel() {
    return nullDebugModel;
  }
  getViewModel() {
    return nullViewModel;
  }
  async focusStackFrame(_focusedStackFrame, _thread, _session, _options) {
  }
  canSetBreakpointsIn() {
    return false;
  }
  async addBreakpoints() {
    return [];
  }
  async updateBreakpoints() {
  }
  async enableOrDisableBreakpoints(_enable, _breakpoint) {
  }
  async setBreakpointsActivated(_activated) {
  }
  async removeBreakpoints(_id) {
  }
  addFunctionBreakpoint(_opts, _id) {
  }
  async updateFunctionBreakpoint(_id, _update) {
  }
  async removeFunctionBreakpoints(_id) {
  }
  async addDataBreakpoint(_opts) {
  }
  async updateDataBreakpoint(_id, _update) {
  }
  async removeDataBreakpoints(_id) {
  }
  async addInstructionBreakpoint(_opts) {
  }
  async removeInstructionBreakpoints(_instructionReference, _offset, _address) {
  }
  async setExceptionBreakpointCondition(_breakpoint, _condition) {
  }
  setExceptionBreakpointsForSession(_session, _filters) {
  }
  async sendAllBreakpoints(_session) {
  }
  async sendBreakpoints(_modelUri, _sourceModified, _session) {
  }
  addWatchExpression(_name) {
  }
  renameWatchExpression(_id, _newName) {
  }
  moveWatchExpression(_id, _position) {
  }
  removeWatchExpressions(_id) {
  }
  async startDebugging(_launch, _configOrName, _options, _saveBeforeStart) {
    return false;
  }
  async restartSession(_session, _restartData) {
  }
  async stopSession(_session, _disconnect, _suspend) {
  }
  sourceIsNotAvailable() {
  }
  async runTo() {
  }
}
class NullDebugVisualizerService {
  async getApplicableFor() {
    return { object: [], dispose() {
    } };
  }
  register() {
    return Disposable.None;
  }
  registerTree() {
    return Disposable.None;
  }
  async getVisualizedNodeFor() {
    return void 0;
  }
  async getVisualizedChildren() {
    return [];
  }
  async editTreeItem() {
  }
}
export {
  NullDebugService,
  NullDebugVisualizerService
};
