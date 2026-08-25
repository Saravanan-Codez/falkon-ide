import { AbstractSignService } from "../common/abstractSignService.js";
class SignService extends AbstractSignService {
  getValidator() {
    return this.vsda().then((vsda) => new vsda.validator());
  }
  signValue(arg) {
    return this.vsda().then((vsda) => new vsda.signer().sign(arg));
  }
  async vsda() {
    const mod = "vsda";
    const { default: vsda } = await import(mod);
    return vsda;
  }
}
export {
  SignService
};
