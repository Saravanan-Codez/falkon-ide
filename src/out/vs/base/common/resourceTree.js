var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
import { memoize } from "./decorators.js";
import { PathIterator } from "./ternarySearchTree.js";
import * as paths from "./path.js";
import { extUri as defaultExtUri } from "./resources.js";
import { URI } from "./uri.js";
class Node {
  constructor(uri, relativePath, context, element = void 0, parent = void 0) {
    this.uri = uri;
    this.relativePath = relativePath;
    this.context = context;
    this.element = element;
    this.parent = parent;
    this._children = /* @__PURE__ */ new Map();
  }
  get childrenCount() {
    return this._children.size;
  }
  get children() {
    return this._children.values();
  }
  get name() {
    return paths.posix.basename(this.relativePath);
  }
  get(path) {
    return this._children.get(path);
  }
  set(path, child) {
    this._children.set(path, child);
  }
  delete(path) {
    this._children.delete(path);
  }
  clear() {
    this._children.clear();
  }
}
__decorateClass([
  memoize
], Node.prototype, "name", 1);
function collect(node, result) {
  if (typeof node.element !== "undefined") {
    result.push(node.element);
  }
  for (const child of node.children) {
    collect(child, result);
  }
  return result;
}
class ResourceTree {
  constructor(context, rootURI = URI.file("/"), extUri = defaultExtUri) {
    this.extUri = extUri;
    this.root = new Node(rootURI, "", context);
  }
  static getRoot(node) {
    while (node.parent) {
      node = node.parent;
    }
    return node;
  }
  static collect(node) {
    return collect(node, []);
  }
  static isResourceNode(obj) {
    return obj instanceof Node;
  }
  add(uri, element) {
    const key = this.extUri.relativePath(this.root.uri, uri) || uri.path;
    const iterator = new PathIterator(false).reset(key);
    let node = this.root;
    let path = "";
    while (true) {
      const name = iterator.value();
      path = path + "/" + name;
      let child = node.get(name);
      if (!child) {
        child = new Node(
          this.extUri.joinPath(this.root.uri, path),
          path,
          this.root.context,
          iterator.hasNext() ? void 0 : element,
          node
        );
        node.set(name, child);
      } else if (!iterator.hasNext()) {
        child.element = element;
      }
      node = child;
      if (!iterator.hasNext()) {
        return;
      }
      iterator.next();
    }
  }
  delete(uri) {
    const key = this.extUri.relativePath(this.root.uri, uri) || uri.path;
    const iterator = new PathIterator(false).reset(key);
    return this._delete(this.root, iterator);
  }
  _delete(node, iterator) {
    const name = iterator.value();
    const child = node.get(name);
    if (!child) {
      return void 0;
    }
    if (iterator.hasNext()) {
      const result = this._delete(child, iterator.next());
      if (typeof result !== "undefined" && child.childrenCount === 0) {
        node.delete(name);
      }
      return result;
    }
    node.delete(name);
    return child.element;
  }
  clear() {
    this.root.clear();
  }
  getNode(uri) {
    const key = this.extUri.relativePath(this.root.uri, uri) || uri.path;
    const iterator = new PathIterator(false).reset(key);
    let node = this.root;
    while (true) {
      const name = iterator.value();
      const child = node.get(name);
      if (!child || !iterator.hasNext()) {
        return child;
      }
      node = child;
      iterator.next();
    }
  }
}
export {
  ResourceTree
};
