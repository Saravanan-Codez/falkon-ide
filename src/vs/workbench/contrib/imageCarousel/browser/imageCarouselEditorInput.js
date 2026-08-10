import { EditorInput } from "../../../common/editor/editorInput.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { URI } from "../../../../base/common/uri.js";
import { Schemas } from "../../../../base/common/network.js";
import { localize } from "../../../../nls.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
const imageCarouselEditorIcon = registerIcon("image-carousel-editor-label-icon", Codicon.fileMedia, localize("imageCarouselEditorLabelIcon", "Icon of the image carousel editor label."));
class ImageCarouselEditorInput extends EditorInput {
  constructor(collection, startIndex = 0) {
    super();
    this.collection = collection;
    this.startIndex = startIndex;
    this._resource = URI.from({
      scheme: Schemas.vscodeImageCarousel,
      path: `/${encodeURIComponent(collection.id)}`
    });
    this._name = collection.title;
  }
  static {
    this.ID = "workbench.input.imageCarousel";
  }
  get capabilities() {
    return super.capabilities | EditorInputCapabilities.Singleton | EditorInputCapabilities.RequiresModal;
  }
  get typeId() {
    return ImageCarouselEditorInput.ID;
  }
  get resource() {
    return this._resource;
  }
  getName() {
    return this._name;
  }
  getIcon() {
    return imageCarouselEditorIcon;
  }
  setName(name) {
    if (this._name !== name) {
      this._name = name;
      this._onDidChangeLabel.fire();
    }
  }
  matches(other) {
    if (other instanceof ImageCarouselEditorInput) {
      return other.collection.id === this.collection.id;
    }
    return false;
  }
}
export {
  ImageCarouselEditorInput
};
