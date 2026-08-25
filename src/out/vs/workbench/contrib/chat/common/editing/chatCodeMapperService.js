import { createDecorator } from "../../../../../platform/instantiation/common/instantiation.js";
const ICodeMapperService = createDecorator("codeMapperService");
class CodeMapperService {
  constructor() {
    this.providers = [];
  }
  registerCodeMapperProvider(handle, provider) {
    this.providers.push(provider);
    return {
      dispose: () => {
        const index = this.providers.indexOf(provider);
        if (index >= 0) {
          this.providers.splice(index, 1);
        }
      }
    };
  }
  async mapCode(request, response, token) {
    for (const provider of this.providers) {
      const result = await provider.mapCode(request, response, token);
      if (token.isCancellationRequested) {
        return void 0;
      }
      return result;
    }
    return void 0;
  }
}
export {
  CodeMapperService,
  ICodeMapperService
};
