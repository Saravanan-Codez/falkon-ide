var WebFileSystemAccess;
((WebFileSystemAccess2) => {
  function supported(obj) {
    if (typeof obj?.showDirectoryPicker === "function") {
      return true;
    }
    return false;
  }
  WebFileSystemAccess2.supported = supported;
  function isFileSystemHandle(handle) {
    const candidate = handle;
    if (!candidate) {
      return false;
    }
    return typeof candidate.kind === "string" && typeof candidate.queryPermission === "function" && typeof candidate.requestPermission === "function";
  }
  WebFileSystemAccess2.isFileSystemHandle = isFileSystemHandle;
  function isFileSystemFileHandle(handle) {
    return handle.kind === "file";
  }
  WebFileSystemAccess2.isFileSystemFileHandle = isFileSystemFileHandle;
  function isFileSystemDirectoryHandle(handle) {
    return handle.kind === "directory";
  }
  WebFileSystemAccess2.isFileSystemDirectoryHandle = isFileSystemDirectoryHandle;
})(WebFileSystemAccess || (WebFileSystemAccess = {}));
var WebFileSystemObserver;
((WebFileSystemObserver2) => {
  function supported(obj) {
    return typeof obj?.FileSystemObserver === "function";
  }
  WebFileSystemObserver2.supported = supported;
})(WebFileSystemObserver || (WebFileSystemObserver = {}));
export {
  WebFileSystemAccess,
  WebFileSystemObserver
};
