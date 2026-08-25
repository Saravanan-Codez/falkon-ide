function readChangesetFileMeta(source) {
  const meta = source._meta;
  if (!meta) {
    return void 0;
  }
  const result = {};
  if (typeof meta["reviewed"] === "boolean") {
    result.reviewed = meta["reviewed"];
  }
  return result;
}
export {
  readChangesetFileMeta
};
