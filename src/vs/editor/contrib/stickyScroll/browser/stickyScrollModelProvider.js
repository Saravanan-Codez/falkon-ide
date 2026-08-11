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
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { ILanguageFeaturesService } from "../../../common/services/languageFeatures.js";
import { OutlineElement, OutlineGroup, OutlineModel } from "../../documentSymbols/browser/outlineModel.js";
import { createCancelablePromise, Delayer } from "../../../../base/common/async.js";
import { FoldingController, RangesLimitReporter } from "../../folding/browser/folding.js";
import { SyntaxRangeProvider } from "../../folding/browser/syntaxRangeProvider.js";
import { IndentRangeProvider } from "../../folding/browser/indentRangeProvider.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { StickyElement, StickyModel, StickyRange } from "./stickyScrollElement.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
var ModelProvider = /* @__PURE__ */ ((ModelProvider2) => {
  ModelProvider2["OUTLINE_MODEL"] = "outlineModel";
  ModelProvider2["FOLDING_PROVIDER_MODEL"] = "foldingProviderModel";
  ModelProvider2["INDENTATION_MODEL"] = "indentationModel";
  return ModelProvider2;
})(ModelProvider || {});
var Status = /* @__PURE__ */ ((Status2) => {
  Status2[Status2["VALID"] = 0] = "VALID";
  Status2[Status2["INVALID"] = 1] = "INVALID";
  Status2[Status2["CANCELED"] = 2] = "CANCELED";
  return Status2;
})(Status || {});
let StickyModelProvider = class extends Disposable {
  constructor(_editor, onProviderUpdate, _languageConfigurationService, _languageFeaturesService) {
    super();
    this._editor = _editor;
    this._modelProviders = [];
    this._modelPromise = null;
    this._updateScheduler = this._register(new Delayer(300));
    this._updateOperation = this._register(new DisposableStore());
    switch (this._editor.getOption(EditorOption.stickyScroll).defaultModel) {
      case "outlineModel" /* OUTLINE_MODEL */:
        this._modelProviders.push(new StickyModelFromCandidateOutlineProvider(this._editor, _languageFeaturesService));
      // fall through
      case "foldingProviderModel" /* FOLDING_PROVIDER_MODEL */:
        this._modelProviders.push(new StickyModelFromCandidateSyntaxFoldingProvider(this._editor, onProviderUpdate, _languageFeaturesService));
      // fall through
      case "indentationModel" /* INDENTATION_MODEL */:
        this._modelProviders.push(new StickyModelFromCandidateIndentationFoldingProvider(this._editor, _languageConfigurationService));
        break;
    }
  }
  dispose() {
    this._modelProviders.forEach((provider) => provider.dispose());
    this._updateOperation.clear();
    this._cancelModelPromise();
    super.dispose();
  }
  _cancelModelPromise() {
    if (this._modelPromise) {
      this._modelPromise.cancel();
      this._modelPromise = null;
    }
  }
  async update(token) {
    this._updateOperation.clear();
    this._updateOperation.add({
      dispose: () => {
        this._cancelModelPromise();
        this._updateScheduler.cancel();
      }
    });
    this._cancelModelPromise();
    return await this._updateScheduler.trigger(async () => {
      for (const modelProvider of this._modelProviders) {
        const { statusPromise, modelPromise } = modelProvider.computeStickyModel(token);
        this._modelPromise = modelPromise;
        const status = await statusPromise;
        if (this._modelPromise !== modelPromise) {
          return null;
        }
        switch (status) {
          case 2 /* CANCELED */:
            this._updateOperation.clear();
            return null;
          case 0 /* VALID */:
            return modelProvider.stickyModel;
        }
      }
      return null;
    }).catch((error) => {
      onUnexpectedError(error);
      return null;
    });
  }
};
StickyModelProvider = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ILanguageFeaturesService)
], StickyModelProvider);
class StickyModelCandidateProvider extends Disposable {
  constructor(_editor) {
    super();
    this._editor = _editor;
    this._stickyModel = null;
  }
  get stickyModel() {
    return this._stickyModel;
  }
  _invalid() {
    this._stickyModel = null;
    return 1 /* INVALID */;
  }
  computeStickyModel(token) {
    if (token.isCancellationRequested || !this.isProviderValid()) {
      return { statusPromise: this._invalid(), modelPromise: null };
    }
    const providerModelPromise = createCancelablePromise((token2) => this.createModelFromProvider(token2));
    return {
      statusPromise: providerModelPromise.then((providerModel) => {
        if (!this.isModelValid(providerModel)) {
          return this._invalid();
        }
        if (token.isCancellationRequested) {
          return 2 /* CANCELED */;
        }
        this._stickyModel = this.createStickyModel(token, providerModel);
        return 0 /* VALID */;
      }).then(void 0, (err) => {
        onUnexpectedError(err);
        return 2 /* CANCELED */;
      }),
      modelPromise: providerModelPromise
    };
  }
  /**
   * Method which checks whether the model returned by the provider is valid and can be used to compute a sticky model.
   * This method by default returns true.
   * @param model model returned by the provider
   * @returns boolean indicating whether the model is valid
   */
  isModelValid(model) {
    return true;
  }
  /**
   * Method which checks whether the provider is valid before applying it to find the provider model.
   * This method by default returns true.
   * @returns boolean indicating whether the provider is valid
   */
  isProviderValid() {
    return true;
  }
}
let StickyModelFromCandidateOutlineProvider = class extends StickyModelCandidateProvider {
  constructor(_editor, _languageFeaturesService) {
    super(_editor);
    this._languageFeaturesService = _languageFeaturesService;
  }
  createModelFromProvider(token) {
    return OutlineModel.create(this._languageFeaturesService.documentSymbolProvider, this._editor.getModel(), token);
  }
  createStickyModel(token, model) {
    const { stickyOutlineElement, providerID } = this._stickyModelFromOutlineModel(model, this._stickyModel?.outlineProviderId);
    const textModel = this._editor.getModel();
    return new StickyModel(textModel.uri, textModel.getVersionId(), stickyOutlineElement, providerID);
  }
  isModelValid(model) {
    return model && model.children.size > 0;
  }
  _stickyModelFromOutlineModel(outlineModel, preferredProvider) {
    let outlineElements;
    if (Iterable.first(outlineModel.children.values()) instanceof OutlineGroup) {
      const provider = Iterable.find(outlineModel.children.values(), (outlineGroupOfModel) => outlineGroupOfModel.id === preferredProvider);
      if (provider) {
        outlineElements = provider.children;
      } else {
        let tempID = "";
        let maxTotalSumOfRanges = -1;
        let optimalOutlineGroup = void 0;
        for (const [_key, outlineGroup] of outlineModel.children.entries()) {
          const totalSumRanges = this._findSumOfRangesOfGroup(outlineGroup);
          if (totalSumRanges > maxTotalSumOfRanges) {
            optimalOutlineGroup = outlineGroup;
            maxTotalSumOfRanges = totalSumRanges;
            tempID = outlineGroup.id;
          }
        }
        preferredProvider = tempID;
        outlineElements = optimalOutlineGroup.children;
      }
    } else {
      outlineElements = outlineModel.children;
    }
    const stickyChildren = [];
    const outlineElementsArray = Array.from(outlineElements.values()).sort((element1, element2) => {
      const range1 = new StickyRange(element1.symbol.range.startLineNumber, element1.symbol.range.endLineNumber);
      const range2 = new StickyRange(element2.symbol.range.startLineNumber, element2.symbol.range.endLineNumber);
      return this._comparator(range1, range2);
    });
    for (const outlineElement of outlineElementsArray) {
      stickyChildren.push(this._stickyModelFromOutlineElement(outlineElement, outlineElement.symbol.selectionRange.startLineNumber));
    }
    const stickyOutlineElement = new StickyElement(void 0, stickyChildren, void 0);
    return {
      stickyOutlineElement,
      providerID: preferredProvider
    };
  }
  _stickyModelFromOutlineElement(outlineElement, previousStartLine) {
    const children = [];
    for (const child of outlineElement.children.values()) {
      if (child.symbol.selectionRange.startLineNumber !== child.symbol.range.endLineNumber) {
        if (child.symbol.selectionRange.startLineNumber !== previousStartLine) {
          children.push(this._stickyModelFromOutlineElement(child, child.symbol.selectionRange.startLineNumber));
        } else {
          for (const subchild of child.children.values()) {
            children.push(this._stickyModelFromOutlineElement(subchild, child.symbol.selectionRange.startLineNumber));
          }
        }
      }
    }
    children.sort((child1, child2) => this._comparator(child1.range, child2.range));
    const range = new StickyRange(outlineElement.symbol.selectionRange.startLineNumber, outlineElement.symbol.range.endLineNumber);
    return new StickyElement(range, children, void 0);
  }
  _comparator(range1, range2) {
    if (range1.startLineNumber !== range2.startLineNumber) {
      return range1.startLineNumber - range2.startLineNumber;
    } else {
      return range2.endLineNumber - range1.endLineNumber;
    }
  }
  _findSumOfRangesOfGroup(outline) {
    let res = 0;
    for (const child of outline.children.values()) {
      res += this._findSumOfRangesOfGroup(child);
    }
    if (outline instanceof OutlineElement) {
      return res + outline.symbol.range.endLineNumber - outline.symbol.selectionRange.startLineNumber;
    } else {
      return res;
    }
  }
};
StickyModelFromCandidateOutlineProvider = __decorateClass([
  __decorateParam(1, ILanguageFeaturesService)
], StickyModelFromCandidateOutlineProvider);
class StickyModelFromCandidateFoldingProvider extends StickyModelCandidateProvider {
  constructor(editor) {
    super(editor);
    this._foldingLimitReporter = this._register(new RangesLimitReporter(editor));
  }
  createStickyModel(token, model) {
    const foldingElement = this._fromFoldingRegions(model);
    const textModel = this._editor.getModel();
    return new StickyModel(textModel.uri, textModel.getVersionId(), foldingElement, void 0);
  }
  isModelValid(model) {
    return model !== null;
  }
  _fromFoldingRegions(foldingRegions) {
    const length = foldingRegions.length;
    const orderedStickyElements = [];
    const stickyOutlineElement = new StickyElement(
      void 0,
      [],
      void 0
    );
    for (let i = 0; i < length; i++) {
      const parentIndex = foldingRegions.getParentIndex(i);
      let parentNode;
      if (parentIndex !== -1) {
        parentNode = orderedStickyElements[parentIndex];
      } else {
        parentNode = stickyOutlineElement;
      }
      const child = new StickyElement(
        new StickyRange(foldingRegions.getStartLineNumber(i), foldingRegions.getEndLineNumber(i) + 1),
        [],
        parentNode
      );
      parentNode.children.push(child);
      orderedStickyElements.push(child);
    }
    return stickyOutlineElement;
  }
}
let StickyModelFromCandidateIndentationFoldingProvider = class extends StickyModelFromCandidateFoldingProvider {
  constructor(editor, _languageConfigurationService) {
    super(editor);
    this._languageConfigurationService = _languageConfigurationService;
    this.provider = this._register(new IndentRangeProvider(editor.getModel(), this._languageConfigurationService, this._foldingLimitReporter));
  }
  async createModelFromProvider(token) {
    return this.provider.compute(token);
  }
};
StickyModelFromCandidateIndentationFoldingProvider = __decorateClass([
  __decorateParam(1, ILanguageConfigurationService)
], StickyModelFromCandidateIndentationFoldingProvider);
let StickyModelFromCandidateSyntaxFoldingProvider = class extends StickyModelFromCandidateFoldingProvider {
  constructor(editor, onProviderUpdate, _languageFeaturesService) {
    super(editor);
    this._languageFeaturesService = _languageFeaturesService;
    this.provider = this._register(new MutableDisposable());
    this._register(this._languageFeaturesService.foldingRangeProvider.onDidChange(() => {
      this._updateProvider(editor, onProviderUpdate);
    }));
    this._updateProvider(editor, onProviderUpdate);
  }
  _updateProvider(editor, onProviderUpdate) {
    const selectedProviders = FoldingController.getFoldingRangeProviders(this._languageFeaturesService, editor.getModel());
    if (selectedProviders.length === 0) {
      return;
    }
    this.provider.value = new SyntaxRangeProvider(editor.getModel(), selectedProviders, onProviderUpdate, this._foldingLimitReporter, void 0);
  }
  isProviderValid() {
    return this.provider !== void 0;
  }
  async createModelFromProvider(token) {
    return this.provider.value?.compute(token) ?? null;
  }
};
StickyModelFromCandidateSyntaxFoldingProvider = __decorateClass([
  __decorateParam(2, ILanguageFeaturesService)
], StickyModelFromCandidateSyntaxFoldingProvider);
export {
  StickyModelProvider
};
