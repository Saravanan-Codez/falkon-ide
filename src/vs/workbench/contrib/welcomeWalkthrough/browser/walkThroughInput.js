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
import * as marked from "../../../../base/common/marked/marked.js";
import { Schemas } from "../../../../base/common/network.js";
import { isEqual } from "../../../../base/common/resources.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { EditorModel } from "../../../common/editor/editorModel.js";
import { markedGfmHeadingIdPlugin } from "../../markdown/browser/markedGfmHeadingIdPlugin.js";
import { moduleToContent } from "../common/walkThroughContentProvider.js";
class WalkThroughModel extends EditorModel {
  constructor(mainRef, snippetRefs) {
    super();
    this.mainRef = mainRef;
    this.snippetRefs = snippetRefs;
  }
  get main() {
    return this.mainRef;
  }
  get snippets() {
    return this.snippetRefs.map((snippet) => snippet.object);
  }
  dispose() {
    this.snippetRefs.forEach((ref) => ref.dispose());
    super.dispose();
  }
}
let WalkThroughInput = class extends EditorInput {
  constructor(options, instantiationService, textModelResolverService) {
    super();
    this.options = options;
    this.instantiationService = instantiationService;
    this.textModelResolverService = textModelResolverService;
    this.promise = null;
    this.maxTopScroll = 0;
    this.maxBottomScroll = 0;
  }
  get capabilities() {
    return EditorInputCapabilities.Singleton | super.capabilities;
  }
  get resource() {
    return this.options.resource;
  }
  get typeId() {
    return this.options.typeId;
  }
  getName() {
    return this.options.name;
  }
  getDescription() {
    return this.options.description || "";
  }
  getTelemetryFrom() {
    return this.options.telemetryFrom;
  }
  getTelemetryDescriptor() {
    const descriptor = super.getTelemetryDescriptor();
    descriptor["target"] = this.getTelemetryFrom();
    return descriptor;
  }
  get onReady() {
    return this.options.onReady;
  }
  get layout() {
    return this.options.layout;
  }
  resolve() {
    if (!this.promise) {
      this.promise = moduleToContent(this.instantiationService, this.options.resource).then((content) => {
        if (this.resource.path.endsWith(".html")) {
          return new WalkThroughModel(content, []);
        }
        const snippets = [];
        let i = 0;
        const renderer = new marked.marked.Renderer();
        renderer.code = ({ lang }) => {
          i++;
          const resource = this.options.resource.with({ scheme: Schemas.walkThroughSnippet, fragment: `${i}.${lang}` });
          snippets.push(this.textModelResolverService.createModelReference(resource));
          return `<div id="snippet-${resource.fragment}" class="walkThroughEditorContainer" ></div>`;
        };
        const m = new marked.Marked({ renderer }, markedGfmHeadingIdPlugin());
        content = m.parse(content, { async: false });
        return Promise.all(snippets).then((refs) => new WalkThroughModel(content, refs));
      });
    }
    return this.promise;
  }
  matches(otherInput) {
    if (super.matches(otherInput)) {
      return true;
    }
    if (otherInput instanceof WalkThroughInput) {
      return isEqual(otherInput.options.resource, this.options.resource);
    }
    return false;
  }
  dispose() {
    if (this.promise) {
      this.promise.then((model) => model.dispose());
      this.promise = null;
    }
    super.dispose();
  }
  relativeScrollPosition(topScroll, bottomScroll) {
    this.maxTopScroll = Math.max(this.maxTopScroll, topScroll);
    this.maxBottomScroll = Math.max(this.maxBottomScroll, bottomScroll);
  }
};
WalkThroughInput = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextModelService)
], WalkThroughInput);
export {
  WalkThroughInput
};
