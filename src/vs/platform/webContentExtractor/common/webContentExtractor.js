import { createDecorator } from "../../instantiation/common/instantiation.js";
const IWebContentExtractorService = createDecorator("IWebContentExtractorService");
const ISharedWebContentExtractorService = createDecorator("ISharedWebContentExtractorService");
class NullWebContentExtractorService {
  extract(_uri) {
    throw new Error("Not implemented");
  }
}
class NullSharedWebContentExtractorService {
  readImage(_uri, _token) {
    throw new Error("Not implemented");
  }
}
export {
  ISharedWebContentExtractorService,
  IWebContentExtractorService,
  NullSharedWebContentExtractorService,
  NullWebContentExtractorService
};
