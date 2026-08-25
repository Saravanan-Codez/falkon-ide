import { ActionType } from "../common/actions.js";
import { ChangesetStatus, ChangesetOperationStatus } from "./state.js";
import { softAssertNever } from "../common/reducer-helpers.js";
function changesetReducer(state, action, log) {
  switch (action.type) {
    case ActionType.ChangesetStatusChanged: {
      if (action.status === ChangesetStatus.Error) {
        return { ...state, status: action.status, error: action.error };
      }
      const { error: _ignored, ...rest } = state;
      return { ...rest, status: action.status };
    }
    case ActionType.ChangesetFileSet: {
      const idx = state.files.findIndex((f) => f.id === action.file.id);
      if (idx < 0) {
        return { ...state, files: [...state.files, action.file] };
      }
      const next = [...state.files];
      next[idx] = action.file;
      return { ...state, files: next };
    }
    case ActionType.ChangesetFileRemoved: {
      const idx = state.files.findIndex((f) => f.id === action.fileId);
      if (idx < 0) {
        return state;
      }
      const next = [...state.files];
      next.splice(idx, 1);
      return { ...state, files: next };
    }
    case ActionType.ChangesetFilesReviewChanged: {
      let changed = false;
      const ids = new Set(action.files);
      const next = state.files.map((f) => {
        if (!ids.has(f.id) || f.reviewed === action.reviewed) {
          return f;
        }
        changed = true;
        return { ...f, reviewed: action.reviewed };
      });
      return changed ? { ...state, files: next } : state;
    }
    case ActionType.ChangesetContentChanged: {
      const next = action.operations === void 0 ? { ...state, files: action.files } : { ...state, files: action.files, operations: action.operations };
      if (action.error === void 0) {
        const { error: _ignored, ...rest } = next;
        return rest;
      }
      return { ...next, error: action.error };
    }
    case ActionType.ChangesetOperationsChanged: {
      if (action.operations === void 0) {
        const { operations: _ignored, ...rest } = state;
        return rest;
      }
      return { ...state, operations: action.operations };
    }
    case ActionType.ChangesetOperationStatusChanged: {
      if (state.operations === void 0) {
        return state;
      }
      const idx = state.operations.findIndex((o) => o.id === action.operationId);
      if (idx < 0) {
        return state;
      }
      const current = state.operations[idx];
      let nextOp;
      if (action.status === ChangesetOperationStatus.Error) {
        nextOp = { ...current, status: action.status, error: action.error };
      } else {
        const { error: _ignored, ...rest } = current;
        nextOp = { ...rest, status: action.status };
      }
      const next = [...state.operations];
      next[idx] = nextOp;
      return { ...state, operations: next };
    }
    case ActionType.ChangesetCleared:
      if (state.files.length === 0) {
        return state;
      }
      return { ...state, files: [] };
    default:
      softAssertNever(action, log);
      return state;
  }
}
export {
  changesetReducer
};
