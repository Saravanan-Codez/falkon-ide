import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { RipgrepTextSearchEngine } from "./ripgrepTextSearchEngine.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { Schemas } from "../../../../base/common/network.js";
class RipgrepSearchProvider {
  constructor(outputChannel, getNumThreads) {
    this.outputChannel = outputChannel;
    this.getNumThreads = getNumThreads;
    this.inProgress = /* @__PURE__ */ new Set();
    process.once("exit", () => this.dispose());
  }
  async provideTextSearchResults(query, options, progress, token) {
    const numThreads = await this.getNumThreads();
    const engine = new RipgrepTextSearchEngine(this.outputChannel, numThreads);
    return Promise.all(options.folderOptions.map((folderOption) => {
      const extendedOptions = {
        folderOptions: folderOption,
        numThreads,
        maxResults: options.maxResults,
        previewOptions: options.previewOptions,
        maxFileSize: options.maxFileSize,
        surroundingContext: options.surroundingContext
      };
      if (folderOption.folder.scheme === Schemas.vscodeUserData) {
        const translatedOptions = { ...extendedOptions, folder: folderOption.folder.with({ scheme: Schemas.file }) };
        const progressTranslator = new Progress((data) => progress.report({ ...data, uri: data.uri.with({ scheme: folderOption.folder.scheme }) }));
        return this.withToken(token, (token2) => engine.provideTextSearchResultsWithRgOptions(query, translatedOptions, progressTranslator, token2));
      } else {
        return this.withToken(token, (token2) => engine.provideTextSearchResultsWithRgOptions(query, extendedOptions, progress, token2));
      }
    })).then(((e) => {
      const complete = {
        // todo: get this to actually check
        limitHit: e.some((complete2) => !!complete2 && complete2.limitHit)
      };
      return complete;
    }));
  }
  async withToken(token, fn) {
    const merged = mergedTokenSource(token);
    this.inProgress.add(merged);
    const result = await fn(merged.token);
    this.inProgress.delete(merged);
    return result;
  }
  dispose() {
    this.inProgress.forEach((engine) => engine.cancel());
  }
}
function mergedTokenSource(token) {
  const tokenSource = new CancellationTokenSource();
  token.onCancellationRequested(() => tokenSource.cancel());
  return tokenSource;
}
export {
  RipgrepSearchProvider
};
