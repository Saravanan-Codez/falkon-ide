import { ActionType } from "../common/actions.js";
import { SessionLifecycle, SessionStatus, SessionInputRequestKind, CustomizationType, McpServerStatus } from "./state.js";
import { softAssertNever } from "../common/reducer-helpers.js";
const STATUS_ACTIVITY_MASK = (1 << 5) - 1;
function withStatusFlag(status, flag, set) {
  return set ? status | flag : status & ~flag;
}
function awaitsUser(request) {
  return request.kind !== SessionInputRequestKind.ToolClientExecution;
}
function withInputNeededStatus(status, inputNeeded) {
  if (inputNeeded.some(awaitsUser)) {
    return status & ~STATUS_ACTIVITY_MASK | SessionStatus.InputNeeded;
  }
  return status & ~(SessionStatus.InputNeeded & ~SessionStatus.InProgress);
}
function updateMcpServerCustomization(state, id, update) {
  const list = state.customizations;
  if (!list) {
    return state;
  }
  const topIdx = list.findIndex((c) => c.id === id);
  if (topIdx >= 0) {
    const entry = list[topIdx];
    if (entry.type !== CustomizationType.McpServer) {
      return state;
    }
    const updated2 = list.slice();
    updated2[topIdx] = update(entry);
    return { ...state, customizations: updated2 };
  }
  let changed = false;
  const updated = list.map((container) => {
    if (container.type === CustomizationType.McpServer) {
      return container;
    }
    const children = container.children;
    if (!children) {
      return container;
    }
    const childIdx = children.findIndex((c) => c.id === id);
    if (childIdx < 0) {
      return container;
    }
    const child = children[childIdx];
    if (child.type !== CustomizationType.McpServer) {
      return container;
    }
    changed = true;
    const newChildren = children.slice();
    newChildren[childIdx] = update(child);
    return { ...container, children: newChildren };
  });
  if (!changed) {
    return state;
  }
  return { ...state, customizations: updated };
}
function sessionReducer(state, action, log) {
  switch (action.type) {
    // ── Lifecycle ──────────────────────────────────────────────────────────
    case ActionType.SessionReady:
      return { ...state, lifecycle: SessionLifecycle.Ready };
    case ActionType.SessionCreationFailed:
      return {
        ...state,
        lifecycle: SessionLifecycle.CreationFailed,
        creationError: action.error
      };
    case ActionType.SessionChatAdded: {
      const list = state.chats;
      const idx = list.findIndex((c) => c.resource === action.summary.resource);
      if (idx < 0) {
        return { ...state, chats: [...list, action.summary] };
      }
      const updated = list.slice();
      updated[idx] = action.summary;
      return { ...state, chats: updated };
    }
    case ActionType.SessionChatRemoved: {
      const list = state.chats;
      const idx = list.findIndex((c) => c.resource === action.chat);
      if (idx < 0) {
        return state;
      }
      const updated = list.slice();
      updated.splice(idx, 1);
      const next = { ...state, chats: updated };
      if (state.defaultChat === action.chat) {
        delete next.defaultChat;
      }
      return next;
    }
    case ActionType.SessionChatUpdated: {
      const list = state.chats;
      const idx = list.findIndex((c) => c.resource === action.chat);
      if (idx < 0) {
        return state;
      }
      const { resource: _ignored, ...changes } = action.changes;
      const updated = list.slice();
      updated[idx] = { ...list[idx], ...changes };
      return { ...state, chats: updated };
    }
    case ActionType.SessionDefaultChatChanged:
      return { ...state, defaultChat: action.defaultChat };
    // ── Metadata ──────────────────────────────────────────────────────────
    case ActionType.SessionTitleChanged:
      return { ...state, title: action.title };
    case ActionType.SessionIsReadChanged:
      return {
        ...state,
        status: withStatusFlag(state.status, SessionStatus.IsRead, action.isRead)
      };
    case ActionType.SessionIsArchivedChanged:
      return {
        ...state,
        status: withStatusFlag(state.status, SessionStatus.IsArchived, action.isArchived)
      };
    case ActionType.SessionActivityChanged:
      return { ...state, activity: action.activity };
    case ActionType.SessionChangesetsChanged: {
      const { changesets: _omit, ...stateWithoutChangesets } = state;
      return action.changesets ? { ...stateWithoutChangesets, changesets: action.changesets } : stateWithoutChangesets;
    }
    case ActionType.SessionConfigChanged:
      if (!state.config) {
        return state;
      }
      return {
        ...state,
        config: {
          ...state.config,
          values: action.replace ? { ...action.config } : { ...state.config.values, ...action.config }
        }
      };
    case ActionType.SessionMetaChanged:
      return { ...state, _meta: action._meta };
    case ActionType.SessionServerToolsChanged:
      return { ...state, serverTools: action.tools };
    case ActionType.SessionActiveClientSet: {
      const list = state.activeClients;
      const idx = list.findIndex((c) => c.clientId === action.activeClient.clientId);
      if (idx < 0) {
        return { ...state, activeClients: [...list, action.activeClient] };
      }
      const updated = list.slice();
      updated[idx] = action.activeClient;
      return { ...state, activeClients: updated };
    }
    case ActionType.SessionActiveClientRemoved: {
      const list = state.activeClients;
      const idx = list.findIndex((c) => c.clientId === action.clientId);
      if (idx < 0) {
        return state;
      }
      const updated = list.slice();
      updated.splice(idx, 1);
      return { ...state, activeClients: updated };
    }
    // ── Working Directories ─────────────────────────────────────────────
    case ActionType.SessionWorkingDirectorySet: {
      const list = state.workingDirectories ?? [];
      if (list.includes(action.directory)) {
        return state;
      }
      return { ...state, workingDirectories: [...list, action.directory] };
    }
    case ActionType.SessionWorkingDirectoryRemoved: {
      const list = state.workingDirectories;
      if (!list) {
        return state;
      }
      const idx = list.indexOf(action.directory);
      if (idx < 0) {
        return state;
      }
      const updated = list.slice();
      updated.splice(idx, 1);
      return { ...state, workingDirectories: updated };
    }
    // ── Input Needed ────────────────────────────────────────────────────
    case ActionType.SessionInputNeededSet: {
      const list = state.inputNeeded ?? [];
      const idx = list.findIndex((r) => r.id === action.request.id);
      const inputNeeded = idx < 0 ? [...list, action.request] : list.slice();
      if (idx >= 0) {
        inputNeeded[idx] = action.request;
      }
      return { ...state, inputNeeded, status: withInputNeededStatus(state.status, inputNeeded) };
    }
    case ActionType.SessionInputNeededRemoved: {
      const list = state.inputNeeded;
      if (!list) {
        return state;
      }
      const idx = list.findIndex((r) => r.id === action.id);
      if (idx < 0) {
        return state;
      }
      const remaining = list.slice();
      remaining.splice(idx, 1);
      const next = { ...state, status: withInputNeededStatus(state.status, remaining) };
      if (remaining.length > 0) {
        next.inputNeeded = remaining;
      } else {
        delete next.inputNeeded;
      }
      return next;
    }
    // ── Customizations ──────────────────────────────────────────────────
    case ActionType.SessionCustomizationsChanged:
      return { ...state, customizations: action.customizations };
    case ActionType.SessionCustomizationToggled: {
      const list = state.customizations;
      if (!list) {
        return state;
      }
      const topIdx = list.findIndex((c) => c.id === action.id);
      if (topIdx >= 0) {
        const updated = list.slice();
        updated[topIdx] = { ...list[topIdx], enabled: action.enabled };
        return { ...state, customizations: updated };
      }
      for (let i = 0; i < list.length; i++) {
        const container = list[i];
        if (container.type === CustomizationType.McpServer) {
          continue;
        }
        const children = container.children;
        if (!children) {
          continue;
        }
        const childIdx = children.findIndex((c) => c.id === action.id);
        if (childIdx < 0) {
          continue;
        }
        const newChildren = children.slice();
        newChildren[childIdx] = { ...children[childIdx], enabled: action.enabled };
        const updated = list.slice();
        updated[i] = { ...container, children: newChildren };
        return { ...state, customizations: updated };
      }
      return state;
    }
    case ActionType.SessionCustomizationUpdated: {
      const list = state.customizations ?? [];
      const idx = list.findIndex((c) => c.id === action.customization.id);
      if (idx < 0) {
        return { ...state, customizations: [...list, action.customization] };
      }
      const updated = [...list];
      updated[idx] = action.customization;
      return { ...state, customizations: updated };
    }
    case ActionType.SessionCustomizationRemoved: {
      const list = state.customizations;
      if (!list) {
        return state;
      }
      const topIdx = list.findIndex((c) => c.id === action.id);
      if (topIdx >= 0) {
        const updated2 = list.slice();
        updated2.splice(topIdx, 1);
        return { ...state, customizations: updated2 };
      }
      let changed = false;
      const updated = list.map((container) => {
        if (container.type === CustomizationType.McpServer) {
          return container;
        }
        const children = container.children;
        if (!children) {
          return container;
        }
        const childIdx = children.findIndex((c) => c.id === action.id);
        if (childIdx < 0) {
          return container;
        }
        changed = true;
        const newChildren = children.slice();
        newChildren.splice(childIdx, 1);
        return { ...container, children: newChildren };
      });
      if (!changed) {
        return state;
      }
      return { ...state, customizations: updated };
    }
    case ActionType.SessionMcpServerStateChanged: {
      return updateMcpServerCustomization(state, action.id, (entry) => ({
        ...entry,
        state: action.state,
        channel: action.channel
      }));
    }
    case ActionType.SessionMcpServerStartRequested: {
      return updateMcpServerCustomization(state, action.id, (entry) => ({
        ...entry,
        state: { kind: McpServerStatus.Starting },
        channel: void 0
      }));
    }
    case ActionType.SessionMcpServerStopRequested: {
      return updateMcpServerCustomization(state, action.id, (entry) => ({
        ...entry,
        state: { kind: McpServerStatus.Stopped },
        channel: void 0
      }));
    }
    default:
      softAssertNever(action, log);
      return state;
  }
}
export {
  sessionReducer
};
