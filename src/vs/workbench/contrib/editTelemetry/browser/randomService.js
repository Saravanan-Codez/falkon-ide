import { generateUuid } from "../../../../base/common/uuid.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const IRandomService = createDecorator("randomService");
class RandomService {
  generateUuid() {
    return generateUuid();
  }
  /** Namespace should be 3 letter. */
  generatePrefixedUuid(namespace) {
    return `${namespace}-${this.generateUuid()}`;
  }
}
export {
  IRandomService,
  RandomService
};
