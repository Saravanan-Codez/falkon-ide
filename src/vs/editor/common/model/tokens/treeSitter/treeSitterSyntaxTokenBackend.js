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
import { Emitter } from "../../../../../base/common/event.js";
import { toDisposable } from "../../../../../base/common/lifecycle.js";
import { StandardTokenType } from "../../../encodedTokenAttributes.js";
import { BackgroundTokenizationState } from "../../../tokenizationTextModelPart.js";
import { LineTokens } from "../../../tokens/lineTokens.js";
import { AbstractSyntaxTokenBackend } from "../abstractSyntaxTokenBackend.js";
import { autorun, derived, ObservablePromise } from "../../../../../base/common/observable.js";
import { TreeSitterTree } from "./treeSitterTree.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { TreeSitterTokenizationImpl } from "./treeSitterTokenizationImpl.js";
import { ITreeSitterLibraryService } from "../../../services/treeSitter/treeSitterLibraryService.js";
let TreeSitterSyntaxTokenBackend = class extends AbstractSyntaxTokenBackend {
  constructor(_languageIdObs, languageIdCodec, textModel, visibleLineRanges, _treeSitterLibraryService, _instantiationService) {
    super(languageIdCodec, textModel);
    this._languageIdObs = _languageIdObs;
    this._treeSitterLibraryService = _treeSitterLibraryService;
    this._instantiationService = _instantiationService;
    this._backgroundTokenizationState = BackgroundTokenizationState.InProgress;
    this._onDidChangeBackgroundTokenizationState = this._register(new Emitter());
    this.onDidChangeBackgroundTokenizationState = this._onDidChangeBackgroundTokenizationState.event;
    const parserClassPromise = new ObservablePromise(this._treeSitterLibraryService.getParserClass());
    const parserClassObs = derived(this, (reader) => {
      const parser = parserClassPromise.promiseResult?.read(reader)?.getDataOrThrow();
      return parser;
    });
    this._tree = derived(this, (reader) => {
      const parserClass = parserClassObs.read(reader);
      if (!parserClass) {
        return void 0;
      }
      const currentLanguage = this._languageIdObs.read(reader);
      const treeSitterLang = this._treeSitterLibraryService.getLanguage(currentLanguage, false, reader);
      if (!treeSitterLang) {
        return void 0;
      }
      const parser = new parserClass();
      reader.store.add(toDisposable(() => {
        parser.delete();
      }));
      parser.setLanguage(treeSitterLang);
      const queries = this._treeSitterLibraryService.getInjectionQueries(currentLanguage, reader);
      if (queries === void 0) {
        return void 0;
      }
      return reader.store.add(this._instantiationService.createInstance(
        TreeSitterTree,
        currentLanguage,
        void 0,
        parser,
        parserClass,
        /*queries, */
        this._textModel
      ));
    });
    this._tokenizationImpl = derived(this, (reader) => {
      const treeModel = this._tree.read(reader);
      if (!treeModel) {
        return void 0;
      }
      const queries = this._treeSitterLibraryService.getHighlightingQueries(treeModel.languageId, reader);
      if (!queries) {
        return void 0;
      }
      return reader.store.add(this._instantiationService.createInstance(TreeSitterTokenizationImpl, treeModel, queries, this._languageIdCodec, visibleLineRanges));
    });
    this._register(autorun((reader) => {
      const tokModel = this._tokenizationImpl.read(reader);
      if (!tokModel) {
        return;
      }
      reader.store.add(tokModel.onDidChangeTokens((e) => {
        this._onDidChangeTokens.fire(e.changes);
      }));
      reader.store.add(tokModel.onDidChangeBackgroundTokenization((e) => {
        this._backgroundTokenizationState = BackgroundTokenizationState.Completed;
        this._onDidChangeBackgroundTokenizationState.fire();
      }));
    }));
  }
  get tree() {
    return this._tree;
  }
  get tokenizationImpl() {
    return this._tokenizationImpl;
  }
  getLineTokens(lineNumber) {
    const model = this._tokenizationImpl.get();
    if (!model) {
      const content = this._textModel.getLineContent(lineNumber);
      return LineTokens.createEmpty(content, this._languageIdCodec);
    }
    return model.getLineTokens(lineNumber);
  }
  todo_resetTokenization(fireTokenChangeEvent = true) {
    if (fireTokenChangeEvent) {
      this._onDidChangeTokens.fire({
        semanticTokensApplied: false,
        ranges: [
          {
            fromLineNumber: 1,
            toLineNumber: this._textModel.getLineCount()
          }
        ]
      });
    }
  }
  handleDidChangeAttached() {
  }
  handleDidChangeContent(e) {
    if (e.isFlush) {
      this.todo_resetTokenization(false);
    } else {
      const model = this._tokenizationImpl.get();
      model?.handleContentChanged(e);
    }
    const treeModel = this._tree.get();
    treeModel?.handleContentChange(e);
  }
  forceTokenization(lineNumber) {
    const model = this._tokenizationImpl.get();
    if (!model) {
      return;
    }
    if (!model.hasAccurateTokensForLine(lineNumber)) {
      model.tokenizeEncoded(lineNumber);
    }
  }
  hasAccurateTokensForLine(lineNumber) {
    const model = this._tokenizationImpl.get();
    if (!model) {
      return false;
    }
    return model.hasAccurateTokensForLine(lineNumber);
  }
  isCheapToTokenize(lineNumber) {
    return true;
  }
  getTokenTypeIfInsertingCharacter(lineNumber, column, character) {
    return StandardTokenType.Other;
  }
  tokenizeLinesAt(lineNumber, lines) {
    const model = this._tokenizationImpl.get();
    if (!model) {
      return null;
    }
    return model.tokenizeLinesAt(lineNumber, lines);
  }
  get hasTokens() {
    const model = this._tokenizationImpl.get();
    if (!model) {
      return false;
    }
    return model.hasTokens();
  }
};
TreeSitterSyntaxTokenBackend = __decorateClass([
  __decorateParam(4, ITreeSitterLibraryService),
  __decorateParam(5, IInstantiationService)
], TreeSitterSyntaxTokenBackend);
export {
  TreeSitterSyntaxTokenBackend
};
