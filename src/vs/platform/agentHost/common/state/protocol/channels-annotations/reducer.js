import { ActionType } from "../common/actions.js";
import { softAssertNever } from "../common/reducer-helpers.js";
function annotationsReducer(state, action, log) {
  switch (action.type) {
    case ActionType.AnnotationsSet: {
      const idx = state.annotations.findIndex((t) => t.id === action.annotation.id);
      if (idx < 0) {
        return { ...state, annotations: [...state.annotations, action.annotation] };
      }
      const next = [...state.annotations];
      next[idx] = action.annotation;
      return { ...state, annotations: next };
    }
    case ActionType.AnnotationsUpdated: {
      const idx = state.annotations.findIndex((t) => t.id === action.annotationId);
      if (idx < 0) {
        return state;
      }
      const annotation = state.annotations[idx];
      const updated = { ...annotation };
      if (action.turnId !== void 0) {
        updated.turnId = action.turnId;
      }
      if (action.resource !== void 0) {
        updated.resource = action.resource;
      }
      if (action.range !== void 0) {
        updated.range = action.range;
      }
      if (action.resolved !== void 0) {
        updated.resolved = action.resolved;
      }
      const next = [...state.annotations];
      next[idx] = updated;
      return { ...state, annotations: next };
    }
    case ActionType.AnnotationsRemoved: {
      const idx = state.annotations.findIndex((t) => t.id === action.annotationId);
      if (idx < 0) {
        return state;
      }
      const next = [...state.annotations];
      next.splice(idx, 1);
      return { ...state, annotations: next };
    }
    case ActionType.AnnotationsEntrySet: {
      const tIdx = state.annotations.findIndex((t) => t.id === action.annotationId);
      if (tIdx < 0) {
        return state;
      }
      const annotation = state.annotations[tIdx];
      const cIdx = annotation.entries.findIndex((c) => c.id === action.entry.id);
      let nextEntries;
      if (cIdx < 0) {
        nextEntries = [...annotation.entries, action.entry];
      } else {
        nextEntries = [...annotation.entries];
        nextEntries[cIdx] = action.entry;
      }
      const nextAnnotations = [...state.annotations];
      nextAnnotations[tIdx] = { ...annotation, entries: nextEntries };
      return { ...state, annotations: nextAnnotations };
    }
    case ActionType.AnnotationsEntryRemoved: {
      const tIdx = state.annotations.findIndex((t) => t.id === action.annotationId);
      if (tIdx < 0) {
        return state;
      }
      const annotation = state.annotations[tIdx];
      const cIdx = annotation.entries.findIndex((c) => c.id === action.entryId);
      if (cIdx < 0) {
        return state;
      }
      const nextEntries = [...annotation.entries];
      nextEntries.splice(cIdx, 1);
      const nextAnnotations = [...state.annotations];
      nextAnnotations[tIdx] = { ...annotation, entries: nextEntries };
      return { ...state, annotations: nextAnnotations };
    }
    default:
      softAssertNever(action, log);
      return state;
  }
}
export {
  annotationsReducer
};
