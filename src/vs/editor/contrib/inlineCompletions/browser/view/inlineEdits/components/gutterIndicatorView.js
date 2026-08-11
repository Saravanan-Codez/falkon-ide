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
import { n } from "../../../../../../../base/browser/dom.js";
import { renderIcon } from "../../../../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Codicon } from "../../../../../../../base/common/codicons.js";
import { BugIndicatingError } from "../../../../../../../base/common/errors.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../../../base/common/lifecycle.js";
import { autorun, constObservable, debouncedObservable, derived, observableFromEvent, observableValue, runOnChange } from "../../../../../../../base/common/observable.js";
import { IAccessibilityService } from "../../../../../../../platform/accessibility/common/accessibility.js";
import { IHoverService } from "../../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../../../../platform/theme/common/themeService.js";
import { Point } from "../../../../../../common/core/2d/point.js";
import { Rect } from "../../../../../../common/core/2d/rect.js";
import { EditorOption, RenderLineNumbersType } from "../../../../../../common/config/editorOptions.js";
import { OffsetRange } from "../../../../../../common/core/ranges/offsetRange.js";
import { StickyScrollController } from "../../../../../stickyScroll/browser/stickyScrollController.js";
import { InlineEditTabAction } from "../inlineEditsViewInterface.js";
import { getEditorBlendedColor, INLINE_EDITS_BORDER_RADIUS, inlineEditIndicatorBackground, inlineEditIndicatorPrimaryBackground, inlineEditIndicatorPrimaryBorder, inlineEditIndicatorPrimaryForeground, inlineEditIndicatorSecondaryBackground, inlineEditIndicatorSecondaryBorder, inlineEditIndicatorSecondaryForeground, inlineEditIndicatorSuccessfulBackground, inlineEditIndicatorSuccessfulBorder, inlineEditIndicatorSuccessfulForeground } from "../theme.js";
import { mapOutFalsy, rectToProps } from "../utils/utils.js";
import { GutterIndicatorMenuContent } from "./gutterIndicatorMenu.js";
import { assertNever } from "../../../../../../../base/common/assert.js";
import { localize } from "../../../../../../../nls.js";
import { asCssVariable } from "../../../../../../../platform/theme/common/colorUtils.js";
import { IUserInteractionService } from "../../../../../../../platform/userInteraction/browser/userInteractionService.js";
import { Emitter } from "../../../../../../../base/common/event.js";
class InlineEditsGutterIndicatorData {
  constructor(gutterMenuData, originalRange, model, altAction, customization) {
    this.gutterMenuData = gutterMenuData;
    this.originalRange = originalRange;
    this.model = model;
    this.altAction = altAction;
    this.customization = customization;
  }
}
class InlineSuggestionGutterMenuData {
  constructor(action, displayName, extensionCommands, alternativeAction, modelInfo, setModelId, extensionCommandsOnly = false) {
    this.action = action;
    this.displayName = displayName;
    this.extensionCommands = extensionCommands;
    this.alternativeAction = alternativeAction;
    this.modelInfo = modelInfo;
    this.setModelId = setModelId;
    this.extensionCommandsOnly = extensionCommandsOnly;
  }
  static fromInlineSuggestion(suggestion) {
    const alternativeAction = suggestion.action?.kind === "edit" ? suggestion.action.alternativeAction : void 0;
    const commands = suggestion.source.inlineSuggestions.commands ?? [];
    return new InlineSuggestionGutterMenuData(
      suggestion.gutterMenuLinkAction,
      suggestion.source.provider.displayName ?? localize("inlineSuggestion", "Inline Suggestion"),
      commands.length > 0 ? [commands] : [],
      alternativeAction,
      suggestion.source.provider.modelInfo,
      suggestion.source.provider.setModelId?.bind(suggestion.source.provider)
    );
  }
}
class SimpleInlineSuggestModel {
  constructor(accept, jump) {
    this.accept = accept;
    this.jump = jump;
  }
  static fromInlineCompletionModel(model) {
    return new SimpleInlineSuggestModel(
      () => model.accept(),
      () => model.jump()
    );
  }
}
const CODICON_SIZE_PX = 16;
const CODICON_PADDING_PX = 2;
let InlineEditsGutterIndicator = class extends Disposable {
  constructor(_editorObs, _data, _tabAction, _verticalOffset, _isHoveringOverInlineEdit, _focusIsInMenu, _hoverService, _instantiationService, _accessibilityService, _themeService, _userInteractionService) {
    super();
    this._editorObs = _editorObs;
    this._data = _data;
    this._tabAction = _tabAction;
    this._verticalOffset = _verticalOffset;
    this._isHoveringOverInlineEdit = _isHoveringOverInlineEdit;
    this._focusIsInMenu = _focusIsInMenu;
    this._hoverService = _hoverService;
    this._instantiationService = _instantiationService;
    this._accessibilityService = _accessibilityService;
    this._themeService = _themeService;
    this._userInteractionService = _userInteractionService;
    this._onDidCloseWithCommand = this._register(new Emitter());
    this.onDidCloseWithCommand = this._onDidCloseWithCommand.event;
    this._modifierPressed = derived(
      this,
      (reader) => this._userInteractionService.readModifierKeyStatus(this._editorObs.editor.getDomNode(), reader).shiftKey
    );
    this._gutterIndicatorStyles = derived(this, (reader) => {
      let v = this._tabAction.read(reader);
      const altAction = this._data.read(reader)?.altAction;
      const modifiedPressed = this._modifierPressed.read(reader);
      if (altAction && modifiedPressed) {
        v = InlineEditTabAction.Inactive;
      }
      switch (v) {
        case InlineEditTabAction.Inactive:
          return {
            background: getEditorBlendedColor(inlineEditIndicatorSecondaryBackground, this._themeService).read(reader).toString(),
            foreground: getEditorBlendedColor(inlineEditIndicatorSecondaryForeground, this._themeService).read(reader).toString(),
            border: getEditorBlendedColor(inlineEditIndicatorSecondaryBorder, this._themeService).read(reader).toString()
          };
        case InlineEditTabAction.Jump:
          return {
            background: getEditorBlendedColor(inlineEditIndicatorPrimaryBackground, this._themeService).read(reader).toString(),
            foreground: getEditorBlendedColor(inlineEditIndicatorPrimaryForeground, this._themeService).read(reader).toString(),
            border: getEditorBlendedColor(inlineEditIndicatorPrimaryBorder, this._themeService).read(reader).toString()
          };
        case InlineEditTabAction.Accept:
          return {
            background: getEditorBlendedColor(inlineEditIndicatorSuccessfulBackground, this._themeService).read(reader).toString(),
            foreground: getEditorBlendedColor(inlineEditIndicatorSuccessfulForeground, this._themeService).read(reader).toString(),
            border: getEditorBlendedColor(inlineEditIndicatorSuccessfulBorder, this._themeService).read(reader).toString()
          };
        default:
          assertNever(v);
      }
    });
    this._state = derived(this, (reader) => {
      const range = this._originalRangeObs.read(reader);
      if (!range) {
        return void 0;
      }
      return {
        range,
        lineOffsetRange: this._editorObs.observeLineOffsetRange(range, reader.store)
      };
    });
    this._lineNumberToRender = derived(this, (reader) => {
      if (this._verticalOffset.read(reader) !== 0) {
        return "";
      }
      const lineNumber = this._data.read(reader)?.originalRange.startLineNumber;
      const lineNumberOptions = this._editorObs.getOption(EditorOption.lineNumbers).read(reader);
      if (lineNumber === void 0 || lineNumberOptions.renderType === RenderLineNumbersType.Off) {
        return "";
      }
      if (lineNumberOptions.renderType === RenderLineNumbersType.Interval) {
        const cursorPosition = this._editorObs.cursorPosition.read(reader);
        if (lineNumber % 10 === 0 || cursorPosition && cursorPosition.lineNumber === lineNumber) {
          return lineNumber.toString();
        }
        return "";
      }
      if (lineNumberOptions.renderType === RenderLineNumbersType.Relative) {
        const cursorPosition = this._editorObs.cursorPosition.read(reader);
        if (!cursorPosition) {
          return "";
        }
        const relativeLineNumber = Math.abs(lineNumber - cursorPosition.lineNumber);
        if (relativeLineNumber === 0) {
          return lineNumber.toString();
        }
        return relativeLineNumber.toString();
      }
      if (lineNumberOptions.renderType === RenderLineNumbersType.Custom) {
        if (lineNumberOptions.renderFn) {
          return lineNumberOptions.renderFn(lineNumber);
        }
        return "";
      }
      return lineNumber.toString();
    });
    this._availableWidthForIcon = derived(this, (reader) => {
      const textModel = this._editorObs.editor.getModel();
      const editor = this._editorObs.editor;
      const layout = this._editorObs.layoutInfo.read(reader);
      const gutterWidth = layout.decorationsLeft + layout.decorationsWidth - layout.glyphMarginLeft;
      if (!textModel || gutterWidth <= 0) {
        return () => 0;
      }
      if (layout.lineNumbersLeft === 0) {
        return () => gutterWidth;
      }
      const lineNumberOptions = this._editorObs.getOption(EditorOption.lineNumbers).read(reader);
      if (lineNumberOptions.renderType === RenderLineNumbersType.Relative || /* likely to flicker */
      lineNumberOptions.renderType === RenderLineNumbersType.Off) {
        return () => gutterWidth;
      }
      const w = editor.getOption(EditorOption.fontInfo).typicalHalfwidthCharacterWidth;
      const rightOfLineNumber = layout.lineNumbersLeft + layout.lineNumbersWidth;
      const totalLines = textModel.getLineCount();
      const totalLinesDigits = (totalLines + 1).toString().length;
      const offsetDigits = [];
      for (let digits = 1; digits <= totalLinesDigits; digits++) {
        const firstLineNumberWithDigitCount = 10 ** (digits - 1);
        const topOfLineNumber = editor.getTopForLineNumber(firstLineNumberWithDigitCount);
        const digitsWidth = digits * w;
        const usableWidthLeftOfLineNumber = Math.min(gutterWidth, Math.max(0, rightOfLineNumber - digitsWidth - layout.glyphMarginLeft));
        offsetDigits.push({ firstLineNumberWithDigitCount, topOfLineNumber, usableWidthLeftOfLineNumber });
      }
      return (topOffset) => {
        for (let i = offsetDigits.length - 1; i >= 0; i--) {
          if (topOffset >= offsetDigits[i].topOfLineNumber) {
            return offsetDigits[i].usableWidthLeftOfLineNumber;
          }
        }
        throw new BugIndicatingError("Could not find avilable width for icon");
      };
    });
    this._layout = derived(this, (reader) => {
      const s = this._state.read(reader);
      if (!s) {
        return void 0;
      }
      const layout = this._editorObs.layoutInfo.read(reader);
      const lineHeight = this._editorObs.observeLineHeightForLine(s.range.map((r) => r.startLineNumber)).read(reader);
      const gutterViewPortPaddingLeft = 1;
      const gutterViewPortPaddingTop = 2;
      const gutterWidthWithoutPadding = layout.decorationsLeft + layout.decorationsWidth - layout.glyphMarginLeft - 2 * gutterViewPortPaddingLeft;
      const gutterHeightWithoutPadding = layout.height - 2 * gutterViewPortPaddingTop;
      const gutterViewPortWithStickyScroll = Rect.fromLeftTopWidthHeight(gutterViewPortPaddingLeft, gutterViewPortPaddingTop, gutterWidthWithoutPadding, gutterHeightWithoutPadding);
      const gutterViewPortWithoutStickyScrollWithoutPaddingTop = gutterViewPortWithStickyScroll.withTop(this._stickyScrollHeight.read(reader));
      const gutterViewPortWithoutStickyScroll = gutterViewPortWithStickyScroll.withTop(gutterViewPortWithoutStickyScrollWithoutPaddingTop.top + gutterViewPortPaddingTop);
      const verticalEditRange = s.lineOffsetRange.read(reader);
      const gutterEditArea = Rect.fromRanges(OffsetRange.fromTo(gutterViewPortWithoutStickyScroll.left, gutterViewPortWithoutStickyScroll.right), verticalEditRange);
      const pillHeight = lineHeight;
      const pillOffset = this._verticalOffset.read(reader);
      const pillFullyDockedRect = gutterEditArea.withHeight(pillHeight).translateY(pillOffset);
      const pillIsFullyDocked = gutterViewPortWithoutStickyScrollWithoutPaddingTop.containsRect(pillFullyDockedRect);
      const customIcon = this._data.read(reader)?.customization?.icon;
      const iconNoneDocked = customIcon ? constObservable(customIcon) : this._tabAction.map((action) => action === InlineEditTabAction.Accept ? Codicon.keyboardTab : Codicon.arrowRight);
      const iconDocked = customIcon ? constObservable(customIcon) : derived(this, (reader2) => {
        if (this._isHoveredOverIconDebounced.read(reader2) || this._isHoveredOverInlineEditDebounced.read(reader2)) {
          return Codicon.check;
        }
        if (this._tabAction.read(reader2) === InlineEditTabAction.Accept) {
          return Codicon.keyboardTab;
        }
        const cursorLineNumber = this._editorObs.cursorLineNumber.read(reader2) ?? 0;
        const editStartLineNumber = s.range.read(reader2).startLineNumber;
        return cursorLineNumber <= editStartLineNumber ? Codicon.keyboardTabAbove : Codicon.keyboardTabBelow;
      });
      const idealIconAreaWidth = 22;
      const iconWidth = (pillRect2) => {
        const availableIconAreaWidth = this._availableWidthForIcon.read(void 0)(pillRect2.bottom + this._editorObs.editor.getScrollTop()) - gutterViewPortPaddingLeft;
        return Math.max(Math.min(availableIconAreaWidth, idealIconAreaWidth), CODICON_SIZE_PX);
      };
      if (pillIsFullyDocked) {
        const pillRect2 = pillFullyDockedRect;
        let widthUntilLineNumberEnd;
        if (layout.lineNumbersWidth === 0) {
          widthUntilLineNumberEnd = Math.max(0, Math.min(Math.max(layout.lineNumbersLeft - gutterViewPortWithStickyScroll.left, 0), pillRect2.width - idealIconAreaWidth));
        } else {
          widthUntilLineNumberEnd = Math.max(layout.lineNumbersLeft + layout.lineNumbersWidth - gutterViewPortWithStickyScroll.left, 0);
        }
        const lineNumberRect = pillRect2.withWidth(widthUntilLineNumberEnd);
        const minimalIconWidthWithPadding = CODICON_SIZE_PX + CODICON_PADDING_PX;
        const iconWidth2 = Math.min(pillRect2.width - widthUntilLineNumberEnd, idealIconAreaWidth);
        const iconRect2 = pillRect2.withWidth(Math.max(iconWidth2, minimalIconWidthWithPadding)).translateX(widthUntilLineNumberEnd);
        const iconVisible = iconWidth2 >= minimalIconWidthWithPadding;
        return {
          gutterEditArea,
          icon: iconDocked,
          iconDirection: "right",
          iconRect: iconRect2,
          iconVisible,
          pillRect: pillRect2,
          lineNumberRect
        };
      }
      const pillPartiallyDockedPossibleArea = gutterViewPortWithStickyScroll.intersect(gutterEditArea);
      const pillIsPartiallyDocked = pillPartiallyDockedPossibleArea && pillPartiallyDockedPossibleArea.height >= pillHeight;
      if (pillIsPartiallyDocked) {
        const pillRectMoved2 = pillFullyDockedRect.moveToBeContainedIn(gutterViewPortWithoutStickyScroll).moveToBeContainedIn(pillPartiallyDockedPossibleArea);
        const pillRect2 = pillRectMoved2.withWidth(iconWidth(pillRectMoved2));
        const iconRect2 = pillRect2;
        return {
          gutterEditArea,
          icon: iconDocked,
          iconDirection: "right",
          iconRect: iconRect2,
          pillRect: pillRect2,
          iconVisible: true
        };
      }
      const pillRectMoved = pillFullyDockedRect.moveToBeContainedIn(gutterViewPortWithStickyScroll);
      const pillRect = pillRectMoved.withWidth(iconWidth(pillRectMoved));
      const iconRect = pillRect;
      const iconDirection = pillRect.top < pillFullyDockedRect.top ? "top" : "bottom";
      return {
        gutterEditArea,
        icon: iconNoneDocked,
        iconDirection,
        iconRect,
        pillRect,
        iconVisible: true
      };
    });
    this._iconRef = n.ref();
    this.isVisible = this._layout.map((l) => !!l);
    this._hoverVisible = observableValue(this, false);
    this.isHoverVisible = this._hoverVisible;
    this._isHoveredOverIcon = observableValue(this, false);
    this._isHoveredOverIconDebounced = debouncedObservable(this._isHoveredOverIcon, 100);
    this.isHoveredOverIcon = this._isHoveredOverIconDebounced;
    this._indicator = n.div({
      class: "inline-edits-view-gutter-indicator",
      style: {
        position: "absolute",
        overflow: "visible"
      }
    }, mapOutFalsy(this._layout).map((layout) => !layout ? [] : [
      n.div({
        style: {
          position: "absolute",
          background: asCssVariable(inlineEditIndicatorBackground),
          borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
          ...rectToProps((reader) => layout.read(reader).gutterEditArea)
        }
      }),
      n.div({
        class: "icon",
        ref: this._iconRef,
        tabIndex: 0,
        onclick: () => {
          const layout2 = this._layout.get();
          const acceptOnClick = layout2?.icon.get() === Codicon.check;
          const data = this._data.get();
          if (!data) {
            throw new BugIndicatingError("Gutter indicator data not available");
          }
          this._editorObs.editor.focus();
          if (acceptOnClick) {
            data.model.accept();
          } else {
            data.model.jump();
          }
        },
        onmouseenter: () => {
          this._showHover();
        },
        style: {
          cursor: "pointer",
          zIndex: "20",
          position: "absolute",
          backgroundColor: this._gutterIndicatorStyles.map((v) => v.background),
          // eslint-disable-next-line local/code-no-any-casts
          ["--vscodeIconForeground"]: this._gutterIndicatorStyles.map((v) => v.foreground),
          border: this._gutterIndicatorStyles.map((v) => `1px solid ${v.border}`),
          boxSizing: "border-box",
          borderRadius: `${INLINE_EDITS_BORDER_RADIUS}px`,
          display: "flex",
          justifyContent: layout.map((l) => l.iconDirection === "bottom" ? "flex-start" : "flex-end"),
          transition: this._modifierPressed.map((m) => m ? "" : "background-color 0.2s ease-in-out, width 0.2s ease-in-out"),
          ...rectToProps((reader) => layout.read(reader).pillRect)
        }
      }, [
        n.div(
          {
            className: "line-number",
            style: {
              lineHeight: layout.map((l) => l.lineNumberRect ? l.lineNumberRect.height : 0),
              display: layout.map((l) => l.lineNumberRect ? "flex" : "none"),
              alignItems: "center",
              justifyContent: "flex-end",
              width: layout.map((l) => l.lineNumberRect ? l.lineNumberRect.width : 0),
              height: "100%",
              color: this._gutterIndicatorStyles.map((v) => v.foreground)
            }
          },
          this._lineNumberToRender
        ),
        n.div({
          style: {
            transform: layout.map((l) => `rotate(${getRotationFromDirection(l.iconDirection)}deg)`),
            transition: "rotate 0.2s ease-in-out, opacity 0.2s ease-in-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            opacity: layout.map((l) => l.iconVisible ? "1" : "0"),
            marginRight: layout.map((l) => l.pillRect.width - l.iconRect.width - (l.lineNumberRect?.width ?? 0)),
            width: layout.map((l) => l.iconRect.width),
            position: "relative",
            right: layout.map((l) => l.iconDirection === "top" ? "1px" : "0"),
            color: this._data.map((d) => d?.customization?.icon?.color ? asCssVariable(d.customization.icon.color.id) : void 0)
          }
        }, [
          layout.map((l, reader) => withStyles(renderIcon(l.icon.read(reader)), { fontSize: toPx(Math.min(l.iconRect.width - CODICON_PADDING_PX, CODICON_SIZE_PX)) }))
        ])
      ])
    ]));
    this._originalRangeObs = mapOutFalsy(this._data.map((d) => d?.originalRange));
    this._stickyScrollController = StickyScrollController.get(this._editorObs.editor);
    this._stickyScrollHeight = this._stickyScrollController ? observableFromEvent(this._stickyScrollController.onDidChangeStickyScrollHeight, () => this._stickyScrollController.stickyScrollWidgetHeight) : constObservable(0);
    this._isHoveredOverInlineEditDebounced = debouncedObservable(this._isHoveringOverInlineEdit, 100);
    const indicator = this._indicator.keepUpdated(this._store);
    this._register(this._editorObs.createOverlayWidget({
      domNode: indicator.element,
      position: constObservable(null),
      allowEditorOverflow: false,
      minContentWidthInPx: constObservable(0)
    }));
    this._register(this._editorObs.editor.onMouseMove((e) => {
      const state = this._state.get();
      if (state === void 0) {
        return;
      }
      const el = this._iconRef.element;
      const rect = el.getBoundingClientRect();
      const rectangularArea = Rect.fromLeftTopWidthHeight(rect.left, rect.top, rect.width, rect.height);
      const point = new Point(e.event.posx, e.event.posy);
      this._isHoveredOverIcon.set(rectangularArea.containsPoint(point), void 0);
    }));
    this._register(this._editorObs.editor.onDidScrollChange(() => {
      this._isHoveredOverIcon.set(false, void 0);
    }));
    this._register(runOnChange(this._isHoveredOverInlineEditDebounced, (isHovering) => {
      if (isHovering) {
        this.triggerAnimation();
      }
    }));
    this._register(autorun((reader) => {
      indicator.readEffect(reader);
      if (indicator.element) {
        this._editorObs.editor.applyFontInfo(indicator.element);
      }
    }));
  }
  triggerAnimation() {
    if (this._accessibilityService.isMotionReduced()) {
      return new Animation(null, null).finished;
    }
    const animation = this._iconRef.element.animate([
      {
        outline: `2px solid ${this._gutterIndicatorStyles.map((v) => v.border).get()}`,
        outlineOffset: "-1px",
        offset: 0
      },
      {
        outline: `2px solid transparent`,
        outlineOffset: "10px",
        offset: 1
      }
    ], { duration: 500 });
    return animation.finished;
  }
  _showHover() {
    if (this._hoverVisible.get()) {
      return;
    }
    const data = this._data.get();
    if (!data) {
      throw new BugIndicatingError("Gutter indicator data not available");
    }
    const disposableStore = new DisposableStore();
    const content = disposableStore.add(this._instantiationService.createInstance(
      GutterIndicatorMenuContent,
      this._editorObs,
      data.gutterMenuData,
      (focusEditor, commandId) => {
        if (focusEditor) {
          this._editorObs.editor.focus();
        }
        if (commandId) {
          this._onDidCloseWithCommand.fire(commandId);
        }
        h?.dispose();
      }
    ).toDisposableLiveElement());
    const isFocused = this._userInteractionService.createFocusTracker(content.element, disposableStore);
    disposableStore.add(autorun((reader) => {
      this._focusIsInMenu.set(isFocused.read(reader), void 0);
    }));
    disposableStore.add(toDisposable(() => this._focusIsInMenu.set(false, void 0)));
    const h = this._hoverService.showInstantHover({
      target: this._iconRef.element,
      content: content.element
    });
    if (h) {
      this._hoverVisible.set(true, void 0);
      disposableStore.add(this._editorObs.editor.onDidScrollChange(() => h.dispose()));
      disposableStore.add(h.onDispose(() => {
        this._hoverVisible.set(false, void 0);
        disposableStore.dispose();
      }));
    } else {
      disposableStore.dispose();
    }
  }
};
InlineEditsGutterIndicator = __decorateClass([
  __decorateParam(6, IHoverService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IAccessibilityService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, IUserInteractionService)
], InlineEditsGutterIndicator);
function getRotationFromDirection(direction) {
  switch (direction) {
    case "top":
      return 90;
    case "bottom":
      return -90;
    case "right":
      return 0;
  }
}
function withStyles(element, styles) {
  for (const key in styles) {
    element.style[key] = styles[key];
  }
  return element;
}
function toPx(n2) {
  return `${n2}px`;
}
export {
  InlineEditsGutterIndicator,
  InlineEditsGutterIndicatorData,
  InlineSuggestionGutterMenuData,
  SimpleInlineSuggestModel
};
