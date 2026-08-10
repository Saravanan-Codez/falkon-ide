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
import * as dom from "../../../../../base/browser/dom.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, constObservable } from "../../../../../base/common/observable.js";
import { MouseTargetType } from "../../../../browser/editorBrowser.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { Range } from "../../../../common/core/range.js";
import { HoverAnchorType, HoverForeignElementAnchor, RenderedHoverParts } from "../../../hover/browser/hoverTypes.js";
import { InlineCompletionsController } from "../controller/inlineCompletionsController.js";
import { InlineSuggestionHintsContentWidget } from "./inlineCompletionsHintsWidget.js";
import { IMarkdownRendererService } from "../../../../../platform/markdown/browser/markdownRenderer.js";
import * as nls from "../../../../../nls.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { GhostTextView } from "../view/ghostText/ghostTextView.js";
class InlineCompletionsHover {
  constructor(owner, range, controller) {
    this.owner = owner;
    this.range = range;
    this.controller = controller;
  }
  isValidForHoverAnchor(anchor) {
    return anchor.type === HoverAnchorType.Range && this.range.startColumn <= anchor.range.startColumn && this.range.endColumn >= anchor.range.endColumn;
  }
}
let InlineCompletionsHoverParticipant = class {
  constructor(_editor, accessibilityService, _instantiationService, _telemetryService, _markdownRendererService) {
    this._editor = _editor;
    this.accessibilityService = accessibilityService;
    this._instantiationService = _instantiationService;
    this._telemetryService = _telemetryService;
    this._markdownRendererService = _markdownRendererService;
    this.hoverOrdinal = 4;
    this.hideCopyButton = true;
  }
  suggestHoverAnchor(mouseEvent) {
    const controller = InlineCompletionsController.get(this._editor);
    if (!controller) {
      return null;
    }
    const target = mouseEvent.target;
    if (target.type === MouseTargetType.CONTENT_VIEW_ZONE) {
      const viewZoneData = target.detail;
      if (controller.shouldShowHoverAtViewZone(viewZoneData.viewZoneId)) {
        return new HoverForeignElementAnchor(1e3, this, Range.fromPositions(this._editor.getModel().validatePosition(viewZoneData.positionBefore || viewZoneData.position)), mouseEvent.event.posx, mouseEvent.event.posy, false);
      }
    }
    if (target.type === MouseTargetType.CONTENT_EMPTY) {
      if (controller.shouldShowHoverAt(target.range)) {
        return new HoverForeignElementAnchor(1e3, this, target.range, mouseEvent.event.posx, mouseEvent.event.posy, false);
      }
    }
    if (target.type === MouseTargetType.CONTENT_TEXT) {
      const mightBeForeignElement = target.detail.mightBeForeignElement;
      if (mightBeForeignElement && controller.shouldShowHoverAt(target.range)) {
        return new HoverForeignElementAnchor(1e3, this, target.range, mouseEvent.event.posx, mouseEvent.event.posy, false);
      }
    }
    if (target.type === MouseTargetType.CONTENT_WIDGET && target.element) {
      const ctx = GhostTextView.getWarningWidgetContext(target.element);
      if (ctx && controller.shouldShowHoverAt(ctx.range)) {
        return new HoverForeignElementAnchor(1e3, this, ctx.range, mouseEvent.event.posx, mouseEvent.event.posy, false);
      }
    }
    return null;
  }
  computeSync(anchor, lineDecorations) {
    if (this._editor.getOption(EditorOption.inlineSuggest).showToolbar !== "onHover") {
      return [];
    }
    const controller = InlineCompletionsController.get(this._editor);
    if (controller && controller.shouldShowHoverAt(anchor.range)) {
      return [new InlineCompletionsHover(this, anchor.range, controller)];
    }
    return [];
  }
  renderHoverParts(context, hoverParts) {
    const disposables = new DisposableStore();
    const part = hoverParts[0];
    this._telemetryService.publicLog2("inlineCompletionHover.shown");
    if (this.accessibilityService.isScreenReaderOptimized() && !this._editor.getOption(EditorOption.screenReaderAnnounceInlineSuggestion)) {
      disposables.add(this.renderScreenReaderText(context, part));
    }
    const model = part.controller.model.get();
    const widgetNode = document.createElement("div");
    context.fragment.appendChild(widgetNode);
    disposables.add(autorunWithStore((reader, store) => {
      const w = store.add(this._instantiationService.createInstance(
        InlineSuggestionHintsContentWidget.hot.read(reader),
        this._editor,
        false,
        constObservable(null),
        model.selectedInlineCompletionIndex,
        model.inlineCompletionsCount,
        model.activeCommands,
        model.warning,
        () => {
          context.onContentsChanged();
        }
      ));
      widgetNode.replaceChildren(w.getDomNode());
    }));
    model.triggerExplicitly();
    const renderedHoverPart = {
      hoverPart: part,
      hoverElement: widgetNode,
      dispose() {
        disposables.dispose();
      }
    };
    return new RenderedHoverParts([renderedHoverPart]);
  }
  getAccessibleContent(hoverPart) {
    return nls.localize("hoverAccessibilityStatusBar", "There are inline completions here");
  }
  renderScreenReaderText(context, part) {
    const disposables = new DisposableStore();
    const $ = dom.$;
    const markdownHoverElement = $("div.hover-row.markdown-hover");
    const hoverContentsElement = dom.append(markdownHoverElement, $("div.hover-contents", { ["aria-live"]: "assertive" }));
    const render = (code) => {
      const inlineSuggestionAvailable = nls.localize("inlineSuggestionFollows", "Suggestion:");
      const renderedContents = disposables.add(this._markdownRendererService.render(new MarkdownString().appendText(inlineSuggestionAvailable).appendCodeblock("text", code), {
        context: this._editor,
        asyncRenderCallback: () => {
          hoverContentsElement.className = "hover-contents code-hover-contents";
          context.onContentsChanged();
        }
      }));
      hoverContentsElement.replaceChildren(renderedContents.element);
    };
    disposables.add(autorun((reader) => {
      const ghostText = part.controller.model.read(reader)?.primaryGhostText.read(reader);
      if (ghostText) {
        const lineText = this._editor.getModel().getLineContent(ghostText.lineNumber);
        render(ghostText.renderForScreenReader(lineText));
      } else {
        dom.reset(hoverContentsElement);
      }
    }));
    context.fragment.appendChild(markdownHoverElement);
    return disposables;
  }
};
InlineCompletionsHoverParticipant = __decorateClass([
  __decorateParam(1, IAccessibilityService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IMarkdownRendererService)
], InlineCompletionsHoverParticipant);
export {
  InlineCompletionsHover,
  InlineCompletionsHoverParticipant
};
