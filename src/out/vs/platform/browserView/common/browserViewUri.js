import { Schemas } from "../../../base/common/network.js";
import { URI } from "../../../base/common/uri.js";
var BrowserViewUri;
((BrowserViewUri2) => {
  BrowserViewUri2.scheme = Schemas.vscodeBrowser;
  function forId(id) {
    return URI.from({ scheme: BrowserViewUri2.scheme, path: `/${id}` });
  }
  BrowserViewUri2.forId = forId;
  function parse(resource) {
    if (resource.scheme !== BrowserViewUri2.scheme) {
      return void 0;
    }
    const id = resource.path.startsWith("/") ? resource.path.substring(1) : resource.path;
    if (!id) {
      return void 0;
    }
    return { id };
  }
  BrowserViewUri2.parse = parse;
  function getId(resource) {
    return parse(resource)?.id;
  }
  BrowserViewUri2.getId = getId;
})(BrowserViewUri || (BrowserViewUri = {}));
export {
  BrowserViewUri
};
