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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { CodeBlockPart, CodeCompareBlockPart } from "./codeBlockPart.js";
import { ResourcePool, KeyedResourcePool } from "./chatCollections.js";
import { createSingleCallFunction } from "../../../../../../base/common/functional.js";
let EditorPool = class extends Disposable {
  constructor(options, delegate, overflowWidgetsDomNode, isSimpleWidget = false, instantiationService) {
    super();
    this.isSimpleWidget = isSimpleWidget;
    this._pool = this._register(new KeyedResourcePool(() => {
      return instantiationService.createInstance(CodeBlockPart, options, MenuId.ChatCodeBlock, delegate, overflowWidgetsDomNode, this.isSimpleWidget);
    }, { maxIdleSize: 2 }));
  }
  inUse() {
    return this._pool.inUse;
  }
  get(key) {
    const codeBlock = this._pool.get(key);
    let stale = false;
    return {
      object: codeBlock,
      isStale: () => stale,
      dispose: createSingleCallFunction(() => {
        codeBlock.reset();
        stale = true;
        this._pool.release(codeBlock, key);
      })
    };
  }
  clear() {
    this._pool.clear();
  }
};
EditorPool = __decorateClass([
  __decorateParam(4, IInstantiationService)
], EditorPool);
let DiffEditorPool = class extends Disposable {
  constructor(options, delegate, overflowWidgetsDomNode, isSimpleWidget = false, instantiationService) {
    super();
    this.isSimpleWidget = isSimpleWidget;
    this._pool = this._register(new ResourcePool(() => {
      return instantiationService.createInstance(CodeCompareBlockPart, options, MenuId.ChatCompareBlock, delegate, overflowWidgetsDomNode, this.isSimpleWidget);
    }));
  }
  inUse() {
    return this._pool.inUse;
  }
  get() {
    const codeBlock = this._pool.get();
    let stale = false;
    return {
      object: codeBlock,
      isStale: () => stale,
      dispose: createSingleCallFunction(() => {
        codeBlock.reset();
        stale = true;
        this._pool.release(codeBlock);
      })
    };
  }
  clear() {
    this._pool.clear();
  }
};
DiffEditorPool = __decorateClass([
  __decorateParam(4, IInstantiationService)
], DiffEditorPool);
export {
  DiffEditorPool,
  EditorPool
};
