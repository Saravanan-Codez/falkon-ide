import * as arrays from "../../base/common/arrays.js";
import * as strings from "../../base/common/strings.js";
class Viewport {
  constructor(top, left, width, height) {
    this._viewportBrand = void 0;
    this.top = top | 0;
    this.left = left | 0;
    this.width = width | 0;
    this.height = height | 0;
  }
}
class MinimapLinesRenderingData {
  constructor(tabSize, data) {
    this.tabSize = tabSize;
    this.data = data;
  }
}
class ViewLineData {
  constructor(content, continuesWithWrappedLine, minColumn, maxColumn, startVisibleColumn, tokens, inlineDecorations) {
    this._viewLineDataBrand = void 0;
    this.content = content;
    this.continuesWithWrappedLine = continuesWithWrappedLine;
    this.minColumn = minColumn;
    this.maxColumn = maxColumn;
    this.startVisibleColumn = startVisibleColumn;
    this.tokens = tokens;
    this.inlineDecorations = inlineDecorations;
  }
}
class ViewLineRenderingData {
  constructor(minColumn, maxColumn, content, continuesWithWrappedLine, mightContainRTL, mightContainNonBasicASCII, tokens, inlineDecorations, tabSize, startVisibleColumn, textDirection, hasVariableFonts) {
    this.minColumn = minColumn;
    this.maxColumn = maxColumn;
    this.content = content;
    this.continuesWithWrappedLine = continuesWithWrappedLine;
    this.isBasicASCII = ViewLineRenderingData.isBasicASCII(content, mightContainNonBasicASCII);
    this.containsRTL = ViewLineRenderingData.containsRTL(content, this.isBasicASCII, mightContainRTL);
    this.tokens = tokens;
    this.inlineDecorations = inlineDecorations;
    this.tabSize = tabSize;
    this.startVisibleColumn = startVisibleColumn;
    this.textDirection = textDirection;
    this.hasVariableFonts = hasVariableFonts;
  }
  static isBasicASCII(lineContent, mightContainNonBasicASCII) {
    if (mightContainNonBasicASCII) {
      return strings.isBasicASCII(lineContent);
    }
    return true;
  }
  static containsRTL(lineContent, isBasicASCII, mightContainRTL) {
    if (!isBasicASCII && mightContainRTL) {
      return strings.containsRTL(lineContent);
    }
    return false;
  }
}
class ViewModelDecoration {
  constructor(range, options) {
    this._viewModelDecorationBrand = void 0;
    this.range = range;
    this.options = options;
  }
}
class OverviewRulerDecorationsGroup {
  constructor(color, zIndex, data) {
    this.color = color;
    this.zIndex = zIndex;
    this.data = data;
  }
  static compareByRenderingProps(a, b) {
    if (a.zIndex === b.zIndex) {
      if (a.color < b.color) {
        return -1;
      }
      if (a.color > b.color) {
        return 1;
      }
      return 0;
    }
    return a.zIndex - b.zIndex;
  }
  static equals(a, b) {
    return a.color === b.color && a.zIndex === b.zIndex && arrays.equals(a.data, b.data);
  }
  static equalsArr(a, b) {
    return arrays.equals(a, b, OverviewRulerDecorationsGroup.equals);
  }
}
export {
  MinimapLinesRenderingData,
  OverviewRulerDecorationsGroup,
  ViewLineData,
  ViewLineRenderingData,
  ViewModelDecoration,
  Viewport
};
