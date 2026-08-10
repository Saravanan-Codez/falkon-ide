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
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { first } from "../../../base/common/async.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { IProductService } from "../../product/common/productService.js";
class AbstractURLService extends Disposable {
  constructor() {
    super(...arguments);
    this.handlers = /* @__PURE__ */ new Set();
  }
  open(uri, options) {
    const handlers = [...this.handlers.values()];
    return first(handlers.map((h) => () => h.handleURL(uri, options)), void 0, false).then((val) => val || false);
  }
  registerHandler(handler) {
    this.handlers.add(handler);
    return toDisposable(() => this.handlers.delete(handler));
  }
}
let NativeURLService = class extends AbstractURLService {
  constructor(productService) {
    super();
    this.productService = productService;
  }
  create(options) {
    let { authority, path, query, fragment } = options ? options : { authority: void 0, path: void 0, query: void 0, fragment: void 0 };
    if (authority && path && path.indexOf("/") !== 0) {
      path = `/${path}`;
    }
    return URI.from({ scheme: this.productService.urlProtocol, authority, path, query, fragment });
  }
};
NativeURLService = __decorateClass([
  __decorateParam(0, IProductService)
], NativeURLService);
export {
  AbstractURLService,
  NativeURLService
};
