import { IIntegrityService } from "../common/integrity.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
class IntegrityService {
  async isPure() {
    return { isPure: true, proof: [] };
  }
}
registerSingleton(IIntegrityService, IntegrityService, InstantiationType.Delayed);
export {
  IntegrityService
};
