var ReconnectResultType = /* @__PURE__ */ ((ReconnectResultType2) => {
  ReconnectResultType2["Replay"] = "replay";
  ReconnectResultType2["Snapshot"] = "snapshot";
  return ReconnectResultType2;
})(ReconnectResultType || {});
var ContentEncoding = /* @__PURE__ */ ((ContentEncoding2) => {
  ContentEncoding2["Base64"] = "base64";
  ContentEncoding2["Utf8"] = "utf-8";
  return ContentEncoding2;
})(ContentEncoding || {});
var ResourceWriteMode = /* @__PURE__ */ ((ResourceWriteMode2) => {
  ResourceWriteMode2["Truncate"] = "truncate";
  ResourceWriteMode2["Append"] = "append";
  ResourceWriteMode2["Insert"] = "insert";
  return ResourceWriteMode2;
})(ResourceWriteMode || {});
var ResourceType = /* @__PURE__ */ ((ResourceType2) => {
  ResourceType2["File"] = "file";
  ResourceType2["Directory"] = "directory";
  ResourceType2["Symlink"] = "symlink";
  return ResourceType2;
})(ResourceType || {});
export {
  ContentEncoding,
  ReconnectResultType,
  ResourceType,
  ResourceWriteMode
};
