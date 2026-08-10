import { BugIndicatingError } from "./commonFacade/deps.js";
function recordChanges(obs) {
  return {
    createChangeSummary: (_previousChangeSummary) => {
      return {
        changes: []
      };
    },
    handleChange(ctx, changeSummary) {
      for (const key in obs) {
        if (ctx.didChange(obs[key])) {
          changeSummary.changes.push({ key, change: ctx.change });
        }
      }
      return true;
    },
    beforeUpdate(reader, changeSummary) {
      for (const key in obs) {
        if (key === "changes") {
          throw new BugIndicatingError('property name "changes" is reserved for change tracking');
        }
        changeSummary[key] = obs[key].read(reader);
      }
    }
  };
}
function recordChangesLazy(getObs) {
  let obs = void 0;
  return {
    createChangeSummary: (_previousChangeSummary) => {
      return {
        changes: []
      };
    },
    handleChange(ctx, changeSummary) {
      if (!obs) {
        obs = getObs();
      }
      for (const key in obs) {
        if (ctx.didChange(obs[key])) {
          changeSummary.changes.push({ key, change: ctx.change });
        }
      }
      return true;
    },
    beforeUpdate(reader, changeSummary) {
      if (!obs) {
        obs = getObs();
      }
      for (const key in obs) {
        if (key === "changes") {
          throw new BugIndicatingError('property name "changes" is reserved for change tracking');
        }
        changeSummary[key] = obs[key].read(reader);
      }
    }
  };
}
export {
  recordChanges,
  recordChangesLazy
};
