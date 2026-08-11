var ChangesetStatus = /* @__PURE__ */ ((ChangesetStatus2) => {
  ChangesetStatus2["Computing"] = "computing";
  ChangesetStatus2["Ready"] = "ready";
  ChangesetStatus2["Error"] = "error";
  return ChangesetStatus2;
})(ChangesetStatus || {});
var ChangesetOperationStatus = /* @__PURE__ */ ((ChangesetOperationStatus2) => {
  ChangesetOperationStatus2["Idle"] = "idle";
  ChangesetOperationStatus2["Running"] = "running";
  ChangesetOperationStatus2["Error"] = "error";
  ChangesetOperationStatus2["Disabled"] = "disabled";
  return ChangesetOperationStatus2;
})(ChangesetOperationStatus || {});
var ChangesetOperationScope = /* @__PURE__ */ ((ChangesetOperationScope2) => {
  ChangesetOperationScope2["Changeset"] = "changeset";
  ChangesetOperationScope2["Resource"] = "resource";
  ChangesetOperationScope2["Range"] = "range";
  return ChangesetOperationScope2;
})(ChangesetOperationScope || {});
export {
  ChangesetOperationScope,
  ChangesetOperationStatus,
  ChangesetStatus
};
