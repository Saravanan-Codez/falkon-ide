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
import { Dimension, getActiveDocument } from "../../../../base/browser/dom.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { codiconsLibrary } from "../../../../base/common/codiconsLibrary.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { getIconRegistry } from "../../../../platform/theme/common/iconRegistry.js";
import { WorkbenchIconSelectBox } from "../../../services/userDataProfile/browser/iconSelectBox.js";
const icons = new Lazy(() => {
  const iconDefinitions = getIconRegistry().getIcons();
  const includedChars = /* @__PURE__ */ new Set();
  const dedupedIcons = iconDefinitions.filter((e) => {
    if (e.id === codiconsLibrary.blank.id) {
      return false;
    }
    if (ThemeIcon.isThemeIcon(e.defaults)) {
      return false;
    }
    if (includedChars.has(e.defaults.fontCharacter)) {
      return false;
    }
    includedChars.add(e.defaults.fontCharacter);
    return true;
  });
  return dedupedIcons;
});
let TerminalIconPicker = class extends Disposable {
  constructor(instantiationService, _hoverService, _layoutService) {
    super();
    this._hoverService = _hoverService;
    this._layoutService = _layoutService;
    this._iconSelectBox = instantiationService.createInstance(WorkbenchIconSelectBox, {
      icons: icons.value,
      inputBoxStyles: defaultInputBoxStyles
    });
  }
  async pickIcons() {
    const dimension = new Dimension(486, 260);
    return new Promise((resolve) => {
      this._register(this._iconSelectBox.onDidSelect((e) => {
        resolve(e);
        this._iconSelectBox.dispose();
      }));
      this._iconSelectBox.clearInput();
      const body = getActiveDocument().body;
      const bodyRect = body.getBoundingClientRect();
      const hoverWidget = this._hoverService.showInstantHover({
        content: this._iconSelectBox.domNode,
        target: {
          targetElements: [body],
          x: bodyRect.left + (bodyRect.width - dimension.width) / 2,
          y: bodyRect.top + this._layoutService.activeContainerOffset.top
        },
        position: {
          hoverPosition: HoverPosition.BELOW
        },
        persistence: {
          sticky: true
        }
      }, true);
      if (hoverWidget) {
        this._register(hoverWidget);
      }
      this._iconSelectBox.layout(dimension);
      this._iconSelectBox.focus();
    });
  }
};
TerminalIconPicker = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IHoverService),
  __decorateParam(2, ILayoutService)
], TerminalIconPicker);
export {
  TerminalIconPicker
};
