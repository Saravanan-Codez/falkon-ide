import { matchesFuzzy, matchesFuzzy2 } from "../../../../base/common/filters.js";
import { splitGlobAware, getEmptyExpression, parse } from "../../../../base/common/glob.js";
import * as strings from "../../../../base/common/strings.js";
import { relativePath } from "../../../../base/common/resources.js";
import { TernarySearchTree } from "../../../../base/common/ternarySearchTree.js";
const SOURCE_FILTER_REGEX = /(!)?@source:("[^"]*"|[^\s,]+)(\s*)/i;
class ResourceGlobMatcher {
  constructor(globalExpression, rootExpressions, uriIdentityService) {
    this.globalExpression = parse(globalExpression);
    this.expressionsByRoot = TernarySearchTree.forUris((uri) => uriIdentityService.extUri.ignorePathCasing(uri));
    for (const expression of rootExpressions) {
      this.expressionsByRoot.set(expression.root, { root: expression.root, expression: parse(expression.expression) });
    }
  }
  matches(resource) {
    const rootExpression = this.expressionsByRoot.findSubstr(resource);
    if (rootExpression) {
      const path = relativePath(rootExpression.root, resource);
      if (path && !!rootExpression.expression(path)) {
        return true;
      }
    }
    return !!this.globalExpression(resource.path);
  }
}
class FilterOptions {
  constructor(filter, filesExclude, showWarnings, showErrors, showInfos, uriIdentityService) {
    this.filter = filter;
    this.showWarnings = false;
    this.showErrors = false;
    this.showInfos = false;
    filter = filter.trim();
    this.showWarnings = showWarnings;
    this.showErrors = showErrors;
    this.showInfos = showInfos;
    const filesExcludeByRoot = Array.isArray(filesExclude) ? filesExclude : [];
    const excludesExpression = Array.isArray(filesExclude) ? getEmptyExpression() : filesExclude;
    for (const { expression } of filesExcludeByRoot) {
      for (const pattern of Object.keys(expression)) {
        if (!pattern.endsWith("/**")) {
          expression[`${strings.rtrim(pattern, "/")}/**`] = expression[pattern];
        }
      }
    }
    const includeSourceFilters = [];
    const excludeSourceFilters = [];
    let sourceMatch;
    while ((sourceMatch = SOURCE_FILTER_REGEX.exec(filter)) !== null) {
      const negate2 = !!sourceMatch[1];
      let source = sourceMatch[2];
      if (source.startsWith('"') && source.endsWith('"')) {
        source = source.slice(1, -1);
      }
      if (negate2) {
        excludeSourceFilters.push(source.toLowerCase());
      } else {
        includeSourceFilters.push(source.toLowerCase());
      }
      filter = (filter.substring(0, sourceMatch.index) + filter.substring(sourceMatch.index + sourceMatch[0].length)).trim();
    }
    this.includeSourceFilters = includeSourceFilters;
    this.excludeSourceFilters = excludeSourceFilters;
    const negate = filter.startsWith("!");
    this.textFilter = { text: (negate ? strings.ltrim(filter, "!") : filter).trim(), negate };
    const includeExpression = getEmptyExpression();
    if (filter) {
      const filters = splitGlobAware(filter, ",").map((s) => s.trim()).filter((s) => !!s.length);
      for (const f of filters) {
        if (f.startsWith("!")) {
          const filterText = strings.ltrim(f, "!");
          if (filterText) {
            this.setPattern(excludesExpression, filterText);
          }
        } else {
          this.setPattern(includeExpression, f);
        }
      }
    }
    this.excludesMatcher = new ResourceGlobMatcher(excludesExpression, filesExcludeByRoot, uriIdentityService);
    this.includesMatcher = new ResourceGlobMatcher(includeExpression, [], uriIdentityService);
  }
  static {
    this._filter = matchesFuzzy2;
  }
  static {
    this._messageFilter = matchesFuzzy;
  }
  static EMPTY(uriIdentityService) {
    return new FilterOptions("", [], false, false, false, uriIdentityService);
  }
  matchesSourceFilters(markerSource) {
    if (this.includeSourceFilters.length === 0 && this.excludeSourceFilters.length === 0) {
      return true;
    }
    const source = markerSource?.toLowerCase();
    if (source && this.excludeSourceFilters.includes(source)) {
      return false;
    }
    if (this.includeSourceFilters.length > 0) {
      return source ? this.includeSourceFilters.includes(source) : false;
    }
    return true;
  }
  setPattern(expression, pattern) {
    if (pattern[0] === ".") {
      pattern = "*" + pattern;
    }
    expression[`**/${pattern}/**`] = true;
    expression[`**/${pattern}`] = true;
  }
}
export {
  FilterOptions,
  ResourceGlobMatcher
};
