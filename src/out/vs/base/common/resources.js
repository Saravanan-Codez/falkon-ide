import { CharCode } from "./charCode.js";
import * as extpath from "./extpath.js";
import { Schemas } from "./network.js";
import * as paths from "./path.js";
import { isLinux, isWindows } from "./platform.js";
import { compare as strCompare, equalsIgnoreCase } from "./strings.js";
import { URI, uriToFsPath } from "./uri.js";
function originalFSPath(uri) {
  return uriToFsPath(uri, true);
}
class ExtUri {
  constructor(_ignorePathCasing) {
    this._ignorePathCasing = _ignorePathCasing;
  }
  compare(uri1, uri2, ignoreFragment = false) {
    if (uri1 === uri2) {
      return 0;
    }
    return strCompare(this.getComparisonKey(uri1, ignoreFragment), this.getComparisonKey(uri2, ignoreFragment));
  }
  isEqual(uri1, uri2, ignoreFragment = false) {
    if (uri1 === uri2) {
      return true;
    }
    if (!uri1 || !uri2) {
      return false;
    }
    return this.getComparisonKey(uri1, ignoreFragment) === this.getComparisonKey(uri2, ignoreFragment);
  }
  getComparisonKey(uri, ignoreFragment = false) {
    return uri.with({
      path: this._ignorePathCasing(uri) ? uri.path.toLowerCase() : void 0,
      fragment: ignoreFragment ? null : void 0
    }).toString();
  }
  ignorePathCasing(uri) {
    return this._ignorePathCasing(uri);
  }
  isEqualOrParent(base, parentCandidate, ignoreFragment = false) {
    if (base.scheme === parentCandidate.scheme) {
      if (base.scheme === Schemas.file) {
        return extpath.isEqualOrParent(originalFSPath(base), originalFSPath(parentCandidate), this._ignorePathCasing(base)) && base.query === parentCandidate.query && (ignoreFragment || base.fragment === parentCandidate.fragment);
      }
      if (isEqualAuthority(base.authority, parentCandidate.authority)) {
        return extpath.isEqualOrParent(base.path, parentCandidate.path, this._ignorePathCasing(base), true) && base.query === parentCandidate.query && (ignoreFragment || base.fragment === parentCandidate.fragment);
      }
    }
    return false;
  }
  // --- path math
  joinPath(resource, ...pathFragment) {
    return URI.joinPath(resource, ...pathFragment);
  }
  basenameOrAuthority(resource) {
    return basename(resource) || resource.authority;
  }
  basename(resource, suffix) {
    return paths.posix.basename(resource.path, suffix);
  }
  extname(resource) {
    return paths.posix.extname(resource.path);
  }
  dirname(resource) {
    if (resource.path.length === 0) {
      return resource;
    }
    let dirname2;
    if (resource.scheme === Schemas.file) {
      dirname2 = URI.file(paths.dirname(originalFSPath(resource))).path;
    } else {
      dirname2 = paths.posix.dirname(resource.path);
      if (resource.authority && dirname2.length && dirname2.charCodeAt(0) !== CharCode.Slash) {
        console.error(`dirname("${resource.toString})) resulted in a relative path`);
        dirname2 = "/";
      }
    }
    return resource.with({
      path: dirname2
    });
  }
  normalizePath(resource) {
    if (!resource.path.length) {
      return resource;
    }
    let normalizedPath;
    if (resource.scheme === Schemas.file) {
      normalizedPath = URI.file(paths.normalize(originalFSPath(resource))).path;
    } else {
      normalizedPath = paths.posix.normalize(resource.path);
    }
    return resource.with({
      path: normalizedPath
    });
  }
  relativePath(from, to) {
    if (from.scheme !== to.scheme || !isEqualAuthority(from.authority, to.authority)) {
      return void 0;
    }
    if (from.scheme === Schemas.file) {
      const relativePath2 = paths.relative(originalFSPath(from), originalFSPath(to));
      return isWindows ? extpath.toSlashes(relativePath2) : relativePath2;
    }
    let fromPath = from.path || "/";
    const toPath = to.path || "/";
    if (this._ignorePathCasing(from)) {
      let i = 0;
      for (const len = Math.min(fromPath.length, toPath.length); i < len; i++) {
        if (fromPath.charCodeAt(i) !== toPath.charCodeAt(i)) {
          if (fromPath.charAt(i).toLowerCase() !== toPath.charAt(i).toLowerCase()) {
            break;
          }
        }
      }
      fromPath = toPath.substr(0, i) + fromPath.substr(i);
    }
    return paths.posix.relative(fromPath, toPath);
  }
  resolvePath(base, path) {
    if (base.scheme === Schemas.file) {
      const newURI = URI.file(paths.resolve(originalFSPath(base), path));
      return base.with({
        authority: newURI.authority,
        path: newURI.path
      });
    }
    path = extpath.toPosixPath(path);
    return base.with({
      path: paths.posix.resolve(base.path, path)
    });
  }
  // --- misc
  isAbsolutePath(resource) {
    return !!resource.path && resource.path[0] === "/";
  }
  isEqualAuthority(a1, a2) {
    return a1 === a2 || a1 !== void 0 && a2 !== void 0 && equalsIgnoreCase(a1, a2);
  }
  hasTrailingPathSeparator(resource, sep = paths.sep) {
    if (resource.scheme === Schemas.file) {
      const fsp = originalFSPath(resource);
      return fsp.length > extpath.getRoot(fsp).length && fsp[fsp.length - 1] === sep;
    } else {
      const p = resource.path;
      return p.length > 1 && p.charCodeAt(p.length - 1) === CharCode.Slash && !/^[a-zA-Z]:(\/$|\\$)/.test(resource.fsPath);
    }
  }
  removeTrailingPathSeparator(resource, sep = paths.sep) {
    if (hasTrailingPathSeparator(resource, sep)) {
      return resource.with({ path: resource.path.substr(0, resource.path.length - 1) });
    }
    return resource;
  }
  addTrailingPathSeparator(resource, sep = paths.sep) {
    let isRootSep = false;
    if (resource.scheme === Schemas.file) {
      const fsp = originalFSPath(resource);
      isRootSep = fsp !== void 0 && fsp.length === extpath.getRoot(fsp).length && fsp[fsp.length - 1] === sep;
    } else {
      sep = "/";
      const p = resource.path;
      isRootSep = p.length === 1 && p.charCodeAt(p.length - 1) === CharCode.Slash;
    }
    if (!isRootSep && !hasTrailingPathSeparator(resource, sep)) {
      return resource.with({ path: resource.path + "/" });
    }
    return resource;
  }
}
const extUri = new ExtUri(() => false);
const extUriBiasedIgnorePathCase = new ExtUri((uri) => {
  return uri.scheme === Schemas.file ? !isLinux : true;
});
const extUriIgnorePathCase = new ExtUri((_) => true);
const isEqual = extUri.isEqual.bind(extUri);
const isEqualOrParent = extUri.isEqualOrParent.bind(extUri);
const getComparisonKey = extUri.getComparisonKey.bind(extUri);
const basenameOrAuthority = extUri.basenameOrAuthority.bind(extUri);
const basename = extUri.basename.bind(extUri);
const extname = extUri.extname.bind(extUri);
const dirname = extUri.dirname.bind(extUri);
const joinPath = extUri.joinPath.bind(extUri);
const normalizePath = extUri.normalizePath.bind(extUri);
const relativePath = extUri.relativePath.bind(extUri);
const resolvePath = extUri.resolvePath.bind(extUri);
const isAbsolutePath = extUri.isAbsolutePath.bind(extUri);
const isEqualAuthority = extUri.isEqualAuthority.bind(extUri);
const hasTrailingPathSeparator = extUri.hasTrailingPathSeparator.bind(extUri);
const removeTrailingPathSeparator = extUri.removeTrailingPathSeparator.bind(extUri);
const addTrailingPathSeparator = extUri.addTrailingPathSeparator.bind(extUri);
function distinctParents(items, resourceAccessor) {
  const distinctParents2 = [];
  for (let i = 0; i < items.length; i++) {
    const candidateResource = resourceAccessor(items[i]);
    if (items.some((otherItem, index) => {
      if (index === i) {
        return false;
      }
      return isEqualOrParent(candidateResource, resourceAccessor(otherItem));
    })) {
      continue;
    }
    distinctParents2.push(items[i]);
  }
  return distinctParents2;
}
var DataUri;
((DataUri2) => {
  DataUri2.META_DATA_LABEL = "label";
  DataUri2.META_DATA_DESCRIPTION = "description";
  DataUri2.META_DATA_SIZE = "size";
  DataUri2.META_DATA_MIME = "mime";
  function parseMetaData(dataUri) {
    const metadata = /* @__PURE__ */ new Map();
    const meta = dataUri.path.substring(dataUri.path.indexOf(";") + 1, dataUri.path.lastIndexOf(";"));
    meta.split(";").forEach((property) => {
      const [key, value] = property.split(":");
      if (key && value) {
        metadata.set(key, value);
      }
    });
    const mime = dataUri.path.substring(0, dataUri.path.indexOf(";"));
    if (mime) {
      metadata.set(DataUri2.META_DATA_MIME, mime);
    }
    return metadata;
  }
  DataUri2.parseMetaData = parseMetaData;
})(DataUri || (DataUri = {}));
function toLocalResource(resource, authority, localScheme) {
  if (authority) {
    let path = resource.path;
    if (path && path[0] !== paths.posix.sep) {
      path = paths.posix.sep + path;
    }
    return resource.with({ scheme: localScheme, authority, path });
  }
  return resource.with({ scheme: localScheme });
}
export {
  DataUri,
  ExtUri,
  addTrailingPathSeparator,
  basename,
  basenameOrAuthority,
  dirname,
  distinctParents,
  extUri,
  extUriBiasedIgnorePathCase,
  extUriIgnorePathCase,
  extname,
  getComparisonKey,
  hasTrailingPathSeparator,
  isAbsolutePath,
  isEqual,
  isEqualAuthority,
  isEqualOrParent,
  joinPath,
  normalizePath,
  originalFSPath,
  relativePath,
  removeTrailingPathSeparator,
  resolvePath,
  toLocalResource
};
