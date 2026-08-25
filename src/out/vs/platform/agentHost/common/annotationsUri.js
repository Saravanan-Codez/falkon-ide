const ANNOTATIONS_PATH_SEGMENT = "/annotations";
function buildAnnotationsUri(sessionUri) {
  return `${sessionUri}${ANNOTATIONS_PATH_SEGMENT}`;
}
function parseAnnotationsUri(uri) {
  if (!uri.endsWith(ANNOTATIONS_PATH_SEGMENT)) {
    return void 0;
  }
  const sessionUri = uri.slice(0, uri.length - ANNOTATIONS_PATH_SEGMENT.length);
  if (!sessionUri) {
    return void 0;
  }
  return { sessionUri };
}
function isAnnotationsUri(uri) {
  return parseAnnotationsUri(uri) !== void 0;
}
export {
  buildAnnotationsUri,
  isAnnotationsUri,
  parseAnnotationsUri
};
