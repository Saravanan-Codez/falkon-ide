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
import { ILogService } from "../../../../platform/log/common/log.js";
import { SearchRange } from "../common/search.js";
import * as searchExtTypes from "../common/searchExtTypes.js";
function anchorGlob(glob) {
  return glob.startsWith("**") || glob.startsWith("/") ? glob : `/${glob}`;
}
function rangeToSearchRange(range) {
  return new SearchRange(range.start.line, range.start.character, range.end.line, range.end.character);
}
function searchRangeToRange(range) {
  return new searchExtTypes.Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
}
let OutputChannel = class {
  constructor(prefix, logService) {
    this.prefix = prefix;
    this.logService = logService;
  }
  appendLine(msg) {
    this.logService.debug(`${this.prefix}#search`, msg);
  }
};
OutputChannel = __decorateClass([
  __decorateParam(1, ILogService)
], OutputChannel);
export {
  OutputChannel,
  anchorGlob,
  rangeToSearchRange,
  searchRangeToRange
};
