import { localize } from "../../../../nls.js";
import * as Objects from "../../../../base/common/objects.js";
import * as Strings from "../../../../base/common/strings.js";
import * as Assert from "../../../../base/common/assert.js";
import { join, normalize } from "../../../../base/common/path.js";
import * as Types from "../../../../base/common/types.js";
import * as UUID from "../../../../base/common/uuid.js";
import * as Platform from "../../../../base/common/platform.js";
import Severity from "../../../../base/common/severity.js";
import { URI } from "../../../../base/common/uri.js";
import { ValidationStatus, ValidationState, Parser } from "../../../../base/common/parsers.js";
import { asArray } from "../../../../base/common/arrays.js";
import { Schemas as NetworkSchemas } from "../../../../base/common/network.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { Emitter } from "../../../../base/common/event.js";
import { FileType } from "../../../../platform/files/common/files.js";
var FileLocationKind = /* @__PURE__ */ ((FileLocationKind2) => {
  FileLocationKind2[FileLocationKind2["Default"] = 0] = "Default";
  FileLocationKind2[FileLocationKind2["Relative"] = 1] = "Relative";
  FileLocationKind2[FileLocationKind2["Absolute"] = 2] = "Absolute";
  FileLocationKind2[FileLocationKind2["AutoDetect"] = 3] = "AutoDetect";
  FileLocationKind2[FileLocationKind2["Search"] = 4] = "Search";
  return FileLocationKind2;
})(FileLocationKind || {});
((FileLocationKind2) => {
  function fromString(value) {
    value = value.toLowerCase();
    if (value === "absolute") {
      return 2 /* Absolute */;
    } else if (value === "relative") {
      return 1 /* Relative */;
    } else if (value === "autodetect") {
      return 3 /* AutoDetect */;
    } else if (value === "search") {
      return 4 /* Search */;
    } else {
      return void 0;
    }
  }
  FileLocationKind2.fromString = fromString;
})(FileLocationKind || (FileLocationKind = {}));
var ProblemLocationKind = /* @__PURE__ */ ((ProblemLocationKind2) => {
  ProblemLocationKind2[ProblemLocationKind2["File"] = 0] = "File";
  ProblemLocationKind2[ProblemLocationKind2["Location"] = 1] = "Location";
  return ProblemLocationKind2;
})(ProblemLocationKind || {});
((ProblemLocationKind2) => {
  function fromString(value) {
    value = value.toLowerCase();
    if (value === "file") {
      return 0 /* File */;
    } else if (value === "location") {
      return 1 /* Location */;
    } else {
      return void 0;
    }
  }
  ProblemLocationKind2.fromString = fromString;
})(ProblemLocationKind || (ProblemLocationKind = {}));
var ApplyToKind = /* @__PURE__ */ ((ApplyToKind2) => {
  ApplyToKind2[ApplyToKind2["allDocuments"] = 0] = "allDocuments";
  ApplyToKind2[ApplyToKind2["openDocuments"] = 1] = "openDocuments";
  ApplyToKind2[ApplyToKind2["closedDocuments"] = 2] = "closedDocuments";
  return ApplyToKind2;
})(ApplyToKind || {});
((ApplyToKind2) => {
  function fromString(value) {
    value = value.toLowerCase();
    if (value === "alldocuments") {
      return 0 /* allDocuments */;
    } else if (value === "opendocuments") {
      return 1 /* openDocuments */;
    } else if (value === "closeddocuments") {
      return 2 /* closedDocuments */;
    } else {
      return void 0;
    }
  }
  ApplyToKind2.fromString = fromString;
})(ApplyToKind || (ApplyToKind = {}));
function isNamedProblemMatcher(value) {
  return value && Types.isString(value.name) ? true : false;
}
async function getResource(filename, matcher, fileService) {
  const kind = matcher.fileLocation;
  let fullPath;
  if (kind === 2 /* Absolute */) {
    fullPath = filename;
  } else if (kind === 1 /* Relative */ && matcher.filePrefix && Types.isString(matcher.filePrefix)) {
    fullPath = join(matcher.filePrefix, filename);
  } else if (kind === 3 /* AutoDetect */) {
    const matcherClone = Objects.deepClone(matcher);
    matcherClone.fileLocation = 1 /* Relative */;
    if (fileService) {
      const relative = await getResource(filename, matcherClone);
      let stat = void 0;
      try {
        stat = await fileService.stat(relative);
      } catch (ex) {
      }
      if (stat) {
        return relative;
      }
    }
    matcherClone.fileLocation = 2 /* Absolute */;
    return getResource(filename, matcherClone);
  } else if (kind === 4 /* Search */ && fileService) {
    const fsProvider = fileService.getProvider(NetworkSchemas.file);
    if (fsProvider) {
      const uri = await searchForFileLocation(filename, fsProvider, matcher.filePrefix);
      fullPath = uri?.path;
    }
    if (!fullPath) {
      const absoluteMatcher = Objects.deepClone(matcher);
      absoluteMatcher.fileLocation = 2 /* Absolute */;
      return getResource(filename, absoluteMatcher);
    }
  }
  if (fullPath === void 0) {
    throw new Error("FileLocationKind is not actionable. Does the matcher have a filePrefix? This should never happen.");
  }
  fullPath = normalize(fullPath);
  fullPath = fullPath.replace(/\\/g, "/");
  if (fullPath[0] !== "/") {
    fullPath = "/" + fullPath;
  }
  if (matcher.uriProvider !== void 0) {
    return matcher.uriProvider(fullPath);
  } else {
    return URI.file(fullPath);
  }
}
async function searchForFileLocation(filename, fsProvider, args) {
  const exclusions = new Set(asArray(args.exclude || []).map((x) => URI.file(x).path));
  async function search(dir) {
    if (exclusions.has(dir.path)) {
      return void 0;
    }
    const entries = await fsProvider.readdir(dir);
    const subdirs = [];
    for (const [name, fileType] of entries) {
      if (fileType === FileType.Directory) {
        subdirs.push(URI.joinPath(dir, name));
        continue;
      }
      if (fileType === FileType.File) {
        const fullUri = URI.joinPath(dir, name);
        if (fullUri.path.endsWith(filename)) {
          return fullUri;
        }
      }
    }
    for (const subdir of subdirs) {
      const result = await search(subdir);
      if (result) {
        return result;
      }
    }
    return void 0;
  }
  for (const dir of asArray(args.include || [])) {
    const hit = await search(URI.file(dir));
    if (hit) {
      return hit;
    }
  }
  return void 0;
}
function createLineMatcher(matcher, fileService, logService) {
  const pattern = matcher.pattern;
  if (Array.isArray(pattern)) {
    return new MultiLineMatcher(matcher, fileService, logService);
  } else {
    return new SingleLineMatcher(matcher, fileService, logService);
  }
}
const endOfLine = Platform.OS === Platform.OperatingSystem.Windows ? "\r\n" : "\n";
class AbstractLineMatcher {
  constructor(matcher, fileService, logService) {
    this.matcher = matcher;
    this.fileService = fileService;
    this.logService = logService;
  }
  handle(lines, start = 0) {
    return { match: null, continue: false };
  }
  next(line) {
    return null;
  }
  regexpExec(regexp, line) {
    const start = Date.now();
    const result = regexp.exec(line);
    const elapsed = Date.now() - start;
    if (elapsed > 5) {
      this.logService?.trace(`ProblemMatcher: slow regexp took ${elapsed}ms to execute`, regexp.source);
    }
    return result;
  }
  fillProblemData(data, pattern, matches) {
    if (data) {
      this.fillProperty(data, "file", pattern, matches, true);
      this.appendProperty(data, "message", pattern, matches, true);
      this.fillProperty(data, "code", pattern, matches, true);
      this.fillProperty(data, "severity", pattern, matches, true);
      this.fillProperty(data, "location", pattern, matches, true);
      this.fillProperty(data, "line", pattern, matches);
      this.fillProperty(data, "character", pattern, matches);
      this.fillProperty(data, "endLine", pattern, matches);
      this.fillProperty(data, "endCharacter", pattern, matches);
      return true;
    } else {
      return false;
    }
  }
  appendProperty(data, property, pattern, matches, trim = false) {
    const patternProperty = pattern[property];
    if (Types.isUndefined(data[property])) {
      this.fillProperty(data, property, pattern, matches, trim);
    } else if (!Types.isUndefined(patternProperty) && patternProperty < matches.length) {
      let value = matches[patternProperty];
      if (trim) {
        value = Strings.trim(value);
      }
      data[property] = data[property] + endOfLine + value;
    }
  }
  fillProperty(data, property, pattern, matches, trim = false) {
    const patternAtProperty = pattern[property];
    if (Types.isUndefined(data[property]) && !Types.isUndefined(patternAtProperty) && patternAtProperty < matches.length) {
      let value = matches[patternAtProperty];
      if (value !== void 0) {
        if (trim) {
          value = Strings.trim(value);
        }
        data[property] = value;
      }
    }
  }
  getMarkerMatch(data) {
    try {
      const location = this.getLocation(data);
      if (data.file && location && data.message) {
        const marker = {
          severity: this.getSeverity(data),
          startLineNumber: location.startLineNumber,
          startColumn: location.startCharacter,
          endLineNumber: location.endLineNumber,
          endColumn: location.endCharacter,
          message: data.message
        };
        if (data.code !== void 0) {
          marker.code = data.code;
        }
        if (this.matcher.source !== void 0) {
          marker.source = this.matcher.source;
        }
        return {
          description: this.matcher,
          resource: this.getResource(data.file),
          marker
        };
      }
    } catch (err) {
      console.error(`Failed to convert problem data into match: ${JSON.stringify(data)}`);
    }
    return void 0;
  }
  getResource(filename) {
    return getResource(filename, this.matcher, this.fileService);
  }
  getLocation(data) {
    if (data.kind === 0 /* File */) {
      return this.createLocation(0, 0, 0, 0);
    }
    if (data.location) {
      return this.parseLocationInfo(data.location);
    }
    if (!data.line) {
      return null;
    }
    const startLine = parseInt(data.line);
    const startColumn = data.character ? parseInt(data.character) : void 0;
    const endLine = data.endLine ? parseInt(data.endLine) : void 0;
    const endColumn = data.endCharacter ? parseInt(data.endCharacter) : void 0;
    return this.createLocation(startLine, startColumn, endLine, endColumn);
  }
  parseLocationInfo(value) {
    if (!value || !value.match(/(\d+|\d+,\d+|\d+,\d+,\d+,\d+)/)) {
      return null;
    }
    const parts = value.split(",");
    const startLine = parseInt(parts[0]);
    const startColumn = parts.length > 1 ? parseInt(parts[1]) : void 0;
    if (parts.length > 3) {
      return this.createLocation(startLine, startColumn, parseInt(parts[2]), parseInt(parts[3]));
    } else {
      return this.createLocation(startLine, startColumn, void 0, void 0);
    }
  }
  createLocation(startLine, startColumn, endLine, endColumn) {
    if (startColumn !== void 0 && endColumn !== void 0) {
      return { startLineNumber: startLine, startCharacter: startColumn, endLineNumber: endLine || startLine, endCharacter: endColumn };
    }
    if (startColumn !== void 0) {
      return { startLineNumber: startLine, startCharacter: startColumn, endLineNumber: startLine, endCharacter: startColumn };
    }
    return { startLineNumber: startLine, startCharacter: 1, endLineNumber: startLine, endCharacter: 2 ** 31 - 1 };
  }
  getSeverity(data) {
    let result = null;
    if (data.severity) {
      const value = data.severity;
      if (value) {
        result = Severity.fromValue(value);
        if (result === Severity.Ignore) {
          if (value === "E") {
            result = Severity.Error;
          } else if (value === "W") {
            result = Severity.Warning;
          } else if (value === "I") {
            result = Severity.Info;
          } else if (Strings.equalsIgnoreCase(value, "hint")) {
            result = Severity.Info;
          } else if (Strings.equalsIgnoreCase(value, "note")) {
            result = Severity.Info;
          }
        }
      }
    }
    if (result === null || result === Severity.Ignore) {
      result = this.matcher.severity || Severity.Error;
    }
    return MarkerSeverity.fromSeverity(result);
  }
}
class SingleLineMatcher extends AbstractLineMatcher {
  constructor(matcher, fileService, logService) {
    super(matcher, fileService, logService);
    this.pattern = matcher.pattern;
  }
  get matchLength() {
    return 1;
  }
  handle(lines, start = 0) {
    Assert.ok(lines.length - start === 1);
    const data = /* @__PURE__ */ Object.create(null);
    if (this.pattern.kind !== void 0) {
      data.kind = this.pattern.kind;
    }
    const matches = this.regexpExec(this.pattern.regexp, lines[start]);
    if (matches) {
      this.fillProblemData(data, this.pattern, matches);
      if (data.kind === 1 /* Location */ && !data.location && !data.line && data.file) {
        data.kind = 0 /* File */;
      }
      const match = this.getMarkerMatch(data);
      if (match) {
        return { match, continue: false };
      }
    }
    return { match: null, continue: false };
  }
  next(line) {
    return null;
  }
}
class MultiLineMatcher extends AbstractLineMatcher {
  constructor(matcher, fileService, logService) {
    super(matcher, fileService, logService);
    this.patterns = matcher.pattern;
  }
  get matchLength() {
    return this.patterns.length;
  }
  handle(lines, start = 0) {
    Assert.ok(lines.length - start === this.patterns.length);
    this.data = /* @__PURE__ */ Object.create(null);
    let data = this.data;
    data.kind = this.patterns[0].kind;
    for (let i = 0; i < this.patterns.length; i++) {
      const pattern = this.patterns[i];
      const matches = this.regexpExec(pattern.regexp, lines[i + start]);
      if (!matches) {
        return { match: null, continue: false };
      } else {
        if (pattern.loop && i === this.patterns.length - 1) {
          data = Objects.deepClone(data);
        }
        this.fillProblemData(data, pattern, matches);
      }
    }
    const loop = !!this.patterns[this.patterns.length - 1].loop;
    if (!loop) {
      this.data = void 0;
    }
    const markerMatch = data ? this.getMarkerMatch(data) : null;
    return { match: markerMatch ? markerMatch : null, continue: loop };
  }
  next(line) {
    const pattern = this.patterns[this.patterns.length - 1];
    Assert.ok(pattern.loop === true && this.data !== null);
    const matches = this.regexpExec(pattern.regexp, line);
    if (!matches) {
      this.data = void 0;
      return null;
    }
    const data = Objects.deepClone(this.data);
    let problemMatch;
    if (this.fillProblemData(data, pattern, matches)) {
      problemMatch = this.getMarkerMatch(data);
    }
    return problemMatch ? problemMatch : null;
  }
}
var Config;
((Config2) => {
  let CheckedProblemPattern;
  ((CheckedProblemPattern2) => {
    function is(value) {
      const candidate = value;
      return candidate && Types.isString(candidate.regexp);
    }
    CheckedProblemPattern2.is = is;
  })(CheckedProblemPattern = Config2.CheckedProblemPattern || (Config2.CheckedProblemPattern = {}));
  let NamedProblemPattern;
  ((NamedProblemPattern2) => {
    function is(value) {
      const candidate = value;
      return candidate && Types.isString(candidate.name);
    }
    NamedProblemPattern2.is = is;
  })(NamedProblemPattern = Config2.NamedProblemPattern || (Config2.NamedProblemPattern = {}));
  let NamedCheckedProblemPattern;
  ((NamedCheckedProblemPattern2) => {
    function is(value) {
      const candidate = value;
      return candidate && NamedProblemPattern.is(candidate) && Types.isString(candidate.regexp);
    }
    NamedCheckedProblemPattern2.is = is;
  })(NamedCheckedProblemPattern = Config2.NamedCheckedProblemPattern || (Config2.NamedCheckedProblemPattern = {}));
  let MultiLineProblemPattern;
  ((MultiLineProblemPattern2) => {
    function is(value) {
      return Array.isArray(value);
    }
    MultiLineProblemPattern2.is = is;
  })(MultiLineProblemPattern = Config2.MultiLineProblemPattern || (Config2.MultiLineProblemPattern = {}));
  let MultiLineCheckedProblemPattern;
  ((MultiLineCheckedProblemPattern2) => {
    function is(value) {
      if (!MultiLineProblemPattern.is(value)) {
        return false;
      }
      for (const element of value) {
        if (!Config2.CheckedProblemPattern.is(element)) {
          return false;
        }
      }
      return true;
    }
    MultiLineCheckedProblemPattern2.is = is;
  })(MultiLineCheckedProblemPattern = Config2.MultiLineCheckedProblemPattern || (Config2.MultiLineCheckedProblemPattern = {}));
  let NamedMultiLineCheckedProblemPattern;
  ((NamedMultiLineCheckedProblemPattern2) => {
    function is(value) {
      const candidate = value;
      return candidate && Types.isString(candidate.name) && Array.isArray(candidate.patterns) && MultiLineCheckedProblemPattern.is(candidate.patterns);
    }
    NamedMultiLineCheckedProblemPattern2.is = is;
  })(NamedMultiLineCheckedProblemPattern = Config2.NamedMultiLineCheckedProblemPattern || (Config2.NamedMultiLineCheckedProblemPattern = {}));
  function isNamedProblemMatcher2(value) {
    return Types.isString(value.name);
  }
  Config2.isNamedProblemMatcher = isNamedProblemMatcher2;
})(Config || (Config = {}));
class ProblemPatternParser extends Parser {
  constructor(logger) {
    super(logger);
  }
  parse(value) {
    if (Config.NamedMultiLineCheckedProblemPattern.is(value)) {
      return this.createNamedMultiLineProblemPattern(value);
    } else if (Config.MultiLineCheckedProblemPattern.is(value)) {
      return this.createMultiLineProblemPattern(value);
    } else if (Config.NamedCheckedProblemPattern.is(value)) {
      const result = this.createSingleProblemPattern(value);
      result.name = value.name;
      return result;
    } else if (Config.CheckedProblemPattern.is(value)) {
      return this.createSingleProblemPattern(value);
    } else {
      this.error(localize("ProblemPatternParser.problemPattern.missingRegExp", "The problem pattern is missing a regular expression."));
      return null;
    }
  }
  createSingleProblemPattern(value) {
    const result = this.doCreateSingleProblemPattern(value, true);
    if (result === void 0) {
      return null;
    } else if (result.kind === void 0) {
      result.kind = 1 /* Location */;
    }
    return this.validateProblemPattern([result]) ? result : null;
  }
  createNamedMultiLineProblemPattern(value) {
    const validPatterns = this.createMultiLineProblemPattern(value.patterns);
    if (!validPatterns) {
      return null;
    }
    const result = {
      name: value.name,
      label: value.label ? value.label : value.name,
      patterns: validPatterns
    };
    return result;
  }
  createMultiLineProblemPattern(values) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
      const pattern = this.doCreateSingleProblemPattern(values[i], false);
      if (pattern === void 0) {
        return null;
      }
      if (i < values.length - 1) {
        if (!Types.isUndefined(pattern.loop) && pattern.loop) {
          pattern.loop = false;
          this.error(localize("ProblemPatternParser.loopProperty.notLast", "The loop property is only supported on the last line matcher."));
        }
      }
      result.push(pattern);
    }
    if (!result || result.length === 0) {
      this.error(localize("ProblemPatternParser.problemPattern.emptyPattern", "The problem pattern is invalid. It must contain at least one pattern."));
      return null;
    }
    if (result[0].kind === void 0) {
      result[0].kind = 1 /* Location */;
    }
    return this.validateProblemPattern(result) ? result : null;
  }
  doCreateSingleProblemPattern(value, setDefaults) {
    const regexp = this.createRegularExpression(value.regexp);
    if (regexp === void 0) {
      return void 0;
    }
    let result = { regexp };
    if (value.kind) {
      result.kind = ProblemLocationKind.fromString(value.kind);
    }
    function copyProperty(result2, source, resultKey, sourceKey) {
      const value2 = source[sourceKey];
      if (typeof value2 === "number") {
        result2[resultKey] = value2;
      }
    }
    copyProperty(result, value, "file", "file");
    copyProperty(result, value, "location", "location");
    copyProperty(result, value, "line", "line");
    copyProperty(result, value, "character", "column");
    copyProperty(result, value, "endLine", "endLine");
    copyProperty(result, value, "endCharacter", "endColumn");
    copyProperty(result, value, "severity", "severity");
    copyProperty(result, value, "code", "code");
    copyProperty(result, value, "message", "message");
    if (value.loop === true || value.loop === false) {
      result.loop = value.loop;
    }
    if (setDefaults) {
      if (result.location || result.kind === 0 /* File */) {
        const defaultValue = {
          file: 1,
          message: 0
        };
        result = Objects.mixin(result, defaultValue, false);
      } else {
        const defaultValue = {
          file: 1,
          line: 2,
          character: 3,
          message: 0
        };
        result = Objects.mixin(result, defaultValue, false);
      }
    }
    return result;
  }
  validateProblemPattern(values) {
    if (!values || values.length === 0) {
      this.error(localize("ProblemPatternParser.problemPattern.emptyPattern", "The problem pattern is invalid. It must contain at least one pattern."));
      return false;
    }
    let file = false, message = false, location = false, line = false;
    const locationKind = values[0].kind === void 0 ? 1 /* Location */ : values[0].kind;
    values.forEach((pattern, i) => {
      if (i !== 0 && pattern.kind) {
        this.error(localize("ProblemPatternParser.problemPattern.kindProperty.notFirst", "The problem pattern is invalid. The kind property must be provided only in the first element"));
      }
      file = file || !Types.isUndefined(pattern.file);
      message = message || !Types.isUndefined(pattern.message);
      location = location || !Types.isUndefined(pattern.location);
      line = line || !Types.isUndefined(pattern.line);
    });
    if (!(file && message)) {
      this.error(localize("ProblemPatternParser.problemPattern.missingProperty", "The problem pattern is invalid. It must have at least have a file and a message."));
      return false;
    }
    if (locationKind === 1 /* Location */ && !(location || line)) {
      this.error(localize("ProblemPatternParser.problemPattern.missingLocation", 'The problem pattern is invalid. It must either have kind: "file" or have a line or location match group.'));
      return false;
    }
    return true;
  }
  createRegularExpression(value) {
    let result;
    try {
      result = new RegExp(value);
    } catch (err) {
      this.error(localize("ProblemPatternParser.invalidRegexp", "Error: The string {0} is not a valid regular expression.\n", value));
    }
    return result;
  }
}
class ExtensionRegistryReporter {
  constructor(_collector, _validationStatus = new ValidationStatus()) {
    this._collector = _collector;
    this._validationStatus = _validationStatus;
  }
  info(message) {
    this._validationStatus.state = ValidationState.Info;
    this._collector.info(message);
  }
  warn(message) {
    this._validationStatus.state = ValidationState.Warning;
    this._collector.warn(message);
  }
  error(message) {
    this._validationStatus.state = ValidationState.Error;
    this._collector.error(message);
  }
  fatal(message) {
    this._validationStatus.state = ValidationState.Fatal;
    this._collector.error(message);
  }
  get status() {
    return this._validationStatus;
  }
}
var Schemas;
((Schemas2) => {
  Schemas2.ProblemPattern = {
    default: {
      regexp: "^([^\\\\s].*)\\\\((\\\\d+,\\\\d+)\\\\):\\\\s*(.*)$",
      file: 1,
      location: 2,
      message: 3
    },
    type: "object",
    additionalProperties: false,
    properties: {
      regexp: {
        type: "string",
        description: localize("ProblemPatternSchema.regexp", "The regular expression to find an error, warning or info in the output.")
      },
      kind: {
        type: "string",
        description: localize("ProblemPatternSchema.kind", "whether the pattern matches a location (file and line) or only a file.")
      },
      file: {
        type: "integer",
        description: localize("ProblemPatternSchema.file", "The match group index of the filename. If omitted 1 is used.")
      },
      location: {
        type: "integer",
        description: localize("ProblemPatternSchema.location", "The match group index of the problem's location. Valid location patterns are: (line), (line,column) and (startLine,startColumn,endLine,endColumn). If omitted (line,column) is assumed.")
      },
      line: {
        type: "integer",
        description: localize("ProblemPatternSchema.line", "The match group index of the problem's line. Defaults to 2")
      },
      column: {
        type: "integer",
        description: localize("ProblemPatternSchema.column", "The match group index of the problem's line character. Defaults to 3")
      },
      endLine: {
        type: "integer",
        description: localize("ProblemPatternSchema.endLine", "The match group index of the problem's end line. Defaults to undefined")
      },
      endColumn: {
        type: "integer",
        description: localize("ProblemPatternSchema.endColumn", "The match group index of the problem's end line character. Defaults to undefined")
      },
      severity: {
        type: "integer",
        description: localize("ProblemPatternSchema.severity", "The match group index of the problem's severity. Defaults to undefined")
      },
      code: {
        type: "integer",
        description: localize("ProblemPatternSchema.code", "The match group index of the problem's code. Defaults to undefined")
      },
      message: {
        type: "integer",
        description: localize("ProblemPatternSchema.message", "The match group index of the message. If omitted it defaults to 4 if location is specified. Otherwise it defaults to 5.")
      },
      loop: {
        type: "boolean",
        description: localize("ProblemPatternSchema.loop", "In a multi line matcher loop indicated whether this pattern is executed in a loop as long as it matches. Can only specified on a last pattern in a multi line pattern.")
      }
    }
  };
  Schemas2.NamedProblemPattern = Objects.deepClone(Schemas2.ProblemPattern);
  Schemas2.NamedProblemPattern.properties = Objects.deepClone(Schemas2.NamedProblemPattern.properties) || {};
  Schemas2.NamedProblemPattern.properties["name"] = {
    type: "string",
    description: localize("NamedProblemPatternSchema.name", "The name of the problem pattern.")
  };
  Schemas2.MultiLineProblemPattern = {
    type: "array",
    items: Schemas2.ProblemPattern
  };
  Schemas2.NamedMultiLineProblemPattern = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: {
        type: "string",
        description: localize("NamedMultiLineProblemPatternSchema.name", "The name of the problem multi line problem pattern.")
      },
      patterns: {
        type: "array",
        description: localize("NamedMultiLineProblemPatternSchema.patterns", "The actual patterns."),
        items: Schemas2.ProblemPattern
      }
    }
  };
  Schemas2.WatchingPattern = {
    type: "object",
    additionalProperties: false,
    properties: {
      regexp: {
        type: "string",
        description: localize("WatchingPatternSchema.regexp", "The regular expression to detect the begin or end of a background task.")
      },
      file: {
        type: "integer",
        description: localize("WatchingPatternSchema.file", "The match group index of the filename. Can be omitted.")
      }
    }
  };
  Schemas2.PatternType = {
    anyOf: [
      {
        type: "string",
        description: localize("PatternTypeSchema.name", "The name of a contributed or predefined pattern")
      },
      Schemas2.ProblemPattern,
      Schemas2.MultiLineProblemPattern
    ],
    description: localize("PatternTypeSchema.description", "A problem pattern or the name of a contributed or predefined problem pattern. Can be omitted if base is specified.")
  };
  Schemas2.ProblemMatcher = {
    type: "object",
    additionalProperties: false,
    properties: {
      base: {
        type: "string",
        description: localize("ProblemMatcherSchema.base", "The name of a base problem matcher to use.")
      },
      owner: {
        type: "string",
        description: localize("ProblemMatcherSchema.owner", "The owner of the problem inside Code. Can be omitted if base is specified. Defaults to 'external' if omitted and base is not specified.")
      },
      source: {
        type: "string",
        description: localize("ProblemMatcherSchema.source", "A human-readable string describing the source of this diagnostic, e.g. 'typescript' or 'super lint'.")
      },
      severity: {
        type: "string",
        enum: ["error", "warning", "info"],
        description: localize("ProblemMatcherSchema.severity", "The default severity for captures problems. Is used if the pattern doesn't define a match group for severity.")
      },
      applyTo: {
        type: "string",
        enum: ["allDocuments", "openDocuments", "closedDocuments"],
        description: localize("ProblemMatcherSchema.applyTo", "Controls if a problem reported on a text document is applied only to open, closed or all documents.")
      },
      pattern: Schemas2.PatternType,
      fileLocation: {
        oneOf: [
          {
            type: "string",
            enum: ["absolute", "relative", "autoDetect", "search"]
          },
          {
            type: "array",
            prefixItems: [
              {
                type: "string",
                enum: ["absolute", "relative", "autoDetect", "search"]
              }
            ],
            minItems: 1,
            maxItems: 1,
            additionalItems: false
          },
          {
            type: "array",
            prefixItems: [
              { type: "string", enum: ["relative", "autoDetect"] },
              { type: "string" }
            ],
            minItems: 2,
            maxItems: 2,
            additionalItems: false,
            examples: [
              ["relative", "${workspaceFolder}"],
              ["autoDetect", "${workspaceFolder}"]
            ]
          },
          {
            type: "array",
            prefixItems: [
              { type: "string", enum: ["search"] },
              {
                type: "object",
                properties: {
                  "include": {
                    oneOf: [
                      { type: "string" },
                      { type: "array", items: { type: "string" } }
                    ]
                  },
                  "exclude": {
                    oneOf: [
                      { type: "string" },
                      { type: "array", items: { type: "string" } }
                    ]
                  }
                },
                required: ["include"]
              }
            ],
            minItems: 2,
            maxItems: 2,
            additionalItems: false,
            examples: [
              ["search", { "include": ["${workspaceFolder}"] }],
              ["search", { "include": ["${workspaceFolder}"], "exclude": [] }]
            ]
          }
        ],
        description: localize("ProblemMatcherSchema.fileLocation", "Defines how file names reported in a problem pattern should be interpreted. A relative fileLocation may be an array, where the second element of the array is the path of the relative file location. The search fileLocation mode, performs a deep (and, possibly, heavy) file system search within the directories specified by the include/exclude properties of the second element (or the current workspace directory if not specified).")
      },
      background: {
        type: "object",
        additionalProperties: false,
        description: localize("ProblemMatcherSchema.background", "Patterns to track the begin and end of a matcher active on a background task."),
        properties: {
          activeOnStart: {
            type: "boolean",
            description: localize("ProblemMatcherSchema.background.activeOnStart", "If set to true the background monitor starts in active mode. This is the same as outputting a line that matches beginsPattern when the task starts.")
          },
          beginsPattern: {
            oneOf: [
              {
                type: "string"
              },
              Schemas2.WatchingPattern
            ],
            description: localize("ProblemMatcherSchema.background.beginsPattern", "If matched in the output the start of a background task is signaled.")
          },
          endsPattern: {
            oneOf: [
              {
                type: "string"
              },
              Schemas2.WatchingPattern
            ],
            description: localize("ProblemMatcherSchema.background.endsPattern", "If matched in the output the end of a background task is signaled.")
          }
        }
      },
      watching: {
        type: "object",
        additionalProperties: false,
        deprecationMessage: localize("ProblemMatcherSchema.watching.deprecated", "The watching property is deprecated. Use background instead."),
        description: localize("ProblemMatcherSchema.watching", "Patterns to track the begin and end of a watching matcher."),
        properties: {
          activeOnStart: {
            type: "boolean",
            description: localize("ProblemMatcherSchema.watching.activeOnStart", "If set to true the watcher starts in active mode. This is the same as outputting a line that matches beginsPattern when the task starts.")
          },
          beginsPattern: {
            oneOf: [
              {
                type: "string"
              },
              Schemas2.WatchingPattern
            ],
            description: localize("ProblemMatcherSchema.watching.beginsPattern", "If matched in the output the start of a watching task is signaled.")
          },
          endsPattern: {
            oneOf: [
              {
                type: "string"
              },
              Schemas2.WatchingPattern
            ],
            description: localize("ProblemMatcherSchema.watching.endsPattern", "If matched in the output the end of a watching task is signaled.")
          }
        }
      }
    }
  };
  Schemas2.LegacyProblemMatcher = Objects.deepClone(Schemas2.ProblemMatcher);
  Schemas2.LegacyProblemMatcher.properties = Objects.deepClone(Schemas2.LegacyProblemMatcher.properties) || {};
  Schemas2.LegacyProblemMatcher.properties["watchedTaskBeginsRegExp"] = {
    type: "string",
    deprecationMessage: localize("LegacyProblemMatcherSchema.watchedBegin.deprecated", "This property is deprecated. Use the watching property instead."),
    description: localize("LegacyProblemMatcherSchema.watchedBegin", "A regular expression signaling that a watched tasks begins executing triggered through file watching.")
  };
  Schemas2.LegacyProblemMatcher.properties["watchedTaskEndsRegExp"] = {
    type: "string",
    deprecationMessage: localize("LegacyProblemMatcherSchema.watchedEnd.deprecated", "This property is deprecated. Use the watching property instead."),
    description: localize("LegacyProblemMatcherSchema.watchedEnd", "A regular expression signaling that a watched tasks ends executing.")
  };
  Schemas2.NamedProblemMatcher = Objects.deepClone(Schemas2.ProblemMatcher);
  Schemas2.NamedProblemMatcher.properties = Objects.deepClone(Schemas2.NamedProblemMatcher.properties) || {};
  Schemas2.NamedProblemMatcher.properties.name = {
    type: "string",
    description: localize("NamedProblemMatcherSchema.name", "The name of the problem matcher used to refer to it.")
  };
  Schemas2.NamedProblemMatcher.properties.label = {
    type: "string",
    description: localize("NamedProblemMatcherSchema.label", "A human readable label of the problem matcher.")
  };
})(Schemas || (Schemas = {}));
const problemPatternExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "problemPatterns",
  jsonSchema: {
    description: localize("ProblemPatternExtPoint", "Contributes problem patterns"),
    type: "array",
    items: {
      anyOf: [
        Schemas.NamedProblemPattern,
        Schemas.NamedMultiLineProblemPattern
      ]
    }
  }
});
class ProblemPatternRegistryImpl {
  constructor() {
    this.patterns = /* @__PURE__ */ Object.create(null);
    this.fillDefaults();
    this.readyPromise = new Promise((resolve, reject) => {
      problemPatternExtPoint.setHandler((extensions, delta) => {
        try {
          delta.removed.forEach((extension) => {
            const problemPatterns = extension.value;
            for (const pattern of problemPatterns) {
              if (this.patterns[pattern.name]) {
                delete this.patterns[pattern.name];
              }
            }
          });
          delta.added.forEach((extension) => {
            const problemPatterns = extension.value;
            const parser = new ProblemPatternParser(new ExtensionRegistryReporter(extension.collector));
            for (const pattern of problemPatterns) {
              if (Config.NamedMultiLineCheckedProblemPattern.is(pattern)) {
                const result = parser.parse(pattern);
                if (parser.problemReporter.status.state < ValidationState.Error) {
                  this.add(result.name, result.patterns);
                } else {
                  extension.collector.error(localize("ProblemPatternRegistry.error", "Invalid problem pattern. The pattern will be ignored."));
                  extension.collector.error(JSON.stringify(pattern, void 0, 4));
                }
              } else if (Config.NamedProblemPattern.is(pattern)) {
                const result = parser.parse(pattern);
                if (parser.problemReporter.status.state < ValidationState.Error) {
                  this.add(pattern.name, result);
                } else {
                  extension.collector.error(localize("ProblemPatternRegistry.error", "Invalid problem pattern. The pattern will be ignored."));
                  extension.collector.error(JSON.stringify(pattern, void 0, 4));
                }
              }
              parser.reset();
            }
          });
        } catch (error) {
        }
        resolve(void 0);
      });
    });
  }
  onReady() {
    return this.readyPromise;
  }
  add(key, value) {
    this.patterns[key] = value;
  }
  get(key) {
    return this.patterns[key];
  }
  fillDefaults() {
    this.add("msCompile", {
      regexp: /^\s*(?:\s*\d+>)?(\S.*?)(?:\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\))?\s*:\s+(?:(\S+)\s+)?((?:fatal +)?error|warning|info)\s+(\w+\d+)?\s*:\s*(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      severity: 4,
      code: 5,
      message: 6
    });
    this.add("gulp-tsc", {
      regexp: /^([^\s].*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(\d+)\s+(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      code: 3,
      message: 4
    });
    this.add("cpp", {
      regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(C\d+)\s*:\s*(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5
    });
    this.add("csc", {
      regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(CS\d+)\s*:\s*(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5
    });
    this.add("vb", {
      regexp: /^(\S.*)\((\d+|\d+,\d+|\d+,\d+,\d+,\d+)\):\s+(error|warning|info)\s+(BC\d+)\s*:\s*(.*)$/,
      kind: 1 /* Location */,
      file: 1,
      location: 2,
      severity: 3,
      code: 4,
      message: 5
    });
    this.add("lessCompile", {
      regexp: /^\s*(.*) in file (.*) line no. (\d+)$/,
      kind: 1 /* Location */,
      message: 1,
      file: 2,
      line: 3
    });
    this.add("jshint", {
      regexp: /^(.*):\s+line\s+(\d+),\s+col\s+(\d+),\s(.+?)(?:\s+\((\w)(\d+)\))?$/,
      kind: 1 /* Location */,
      file: 1,
      line: 2,
      character: 3,
      message: 4,
      severity: 5,
      code: 6
    });
    this.add("jshint-stylish", [
      {
        regexp: /^(.+)$/,
        kind: 1 /* Location */,
        file: 1
      },
      {
        regexp: /^\s+line\s+(\d+)\s+col\s+(\d+)\s+(.+?)(?:\s+\((\w)(\d+)\))?$/,
        line: 1,
        character: 2,
        message: 3,
        severity: 4,
        code: 5,
        loop: true
      }
    ]);
    this.add("eslint-compact", {
      regexp: /^(.+):\sline\s(\d+),\scol\s(\d+),\s(Error|Warning|Info)\s-\s(.+)\s\((.+)\)$/,
      file: 1,
      kind: 1 /* Location */,
      line: 2,
      character: 3,
      severity: 4,
      message: 5,
      code: 6
    });
    this.add("eslint-stylish", [
      {
        regexp: /^((?:[a-zA-Z]:)*[./\\]+.*?)$/,
        kind: 1 /* Location */,
        file: 1
      },
      {
        regexp: /^\s+(\d+):(\d+)\s+(error|warning|info)\s+(.+?)(?:\s\s+(.*))?$/,
        line: 1,
        character: 2,
        severity: 3,
        message: 4,
        code: 5,
        loop: true
      }
    ]);
    this.add("go", {
      regexp: /^([^:]*: )?((.:)?[^:]*):(\d+)(:(\d+))?: (.*)$/,
      kind: 1 /* Location */,
      file: 2,
      line: 4,
      character: 6,
      message: 7
    });
  }
}
const ProblemPatternRegistry = new ProblemPatternRegistryImpl();
class ProblemMatcherParser extends Parser {
  constructor(logger) {
    super(logger);
  }
  parse(json) {
    const result = this.createProblemMatcher(json);
    if (!this.checkProblemMatcherValid(json, result)) {
      return void 0;
    }
    this.addWatchingMatcher(json, result);
    return result;
  }
  checkProblemMatcherValid(externalProblemMatcher, problemMatcher) {
    if (!problemMatcher) {
      this.error(localize("ProblemMatcherParser.noProblemMatcher", "Error: the description can't be converted into a problem matcher:\n{0}\n", JSON.stringify(externalProblemMatcher, null, 4)));
      return false;
    }
    if (!problemMatcher.pattern) {
      this.error(localize("ProblemMatcherParser.noProblemPattern", "Error: the description doesn't define a valid problem pattern:\n{0}\n", JSON.stringify(externalProblemMatcher, null, 4)));
      return false;
    }
    if (!problemMatcher.owner) {
      this.error(localize("ProblemMatcherParser.noOwner", "Error: the description doesn't define an owner:\n{0}\n", JSON.stringify(externalProblemMatcher, null, 4)));
      return false;
    }
    if (Types.isUndefined(problemMatcher.fileLocation)) {
      this.error(localize("ProblemMatcherParser.noFileLocation", "Error: the description doesn't define a file location:\n{0}\n", JSON.stringify(externalProblemMatcher, null, 4)));
      return false;
    }
    return true;
  }
  createProblemMatcher(description) {
    let result = null;
    const owner = Types.isString(description.owner) ? description.owner : UUID.generateUuid();
    const source = Types.isString(description.source) ? description.source : void 0;
    let applyTo = Types.isString(description.applyTo) ? ApplyToKind.fromString(description.applyTo) : 0 /* allDocuments */;
    if (!applyTo) {
      applyTo = 0 /* allDocuments */;
    }
    let fileLocation = void 0;
    let filePrefix = void 0;
    let kind;
    if (Types.isUndefined(description.fileLocation)) {
      fileLocation = 1 /* Relative */;
      filePrefix = "${workspaceFolder}";
    } else if (Types.isString(description.fileLocation)) {
      kind = FileLocationKind.fromString(description.fileLocation);
      if (kind) {
        fileLocation = kind;
        if (kind === 1 /* Relative */ || kind === 3 /* AutoDetect */) {
          filePrefix = "${workspaceFolder}";
        } else if (kind === 4 /* Search */) {
          filePrefix = { include: ["${workspaceFolder}"] };
        }
      }
    } else if (Types.isStringArray(description.fileLocation)) {
      const values = description.fileLocation;
      if (values.length > 0) {
        kind = FileLocationKind.fromString(values[0]);
        if (values.length === 1 && kind === 2 /* Absolute */) {
          fileLocation = kind;
        } else if (values.length === 2 && (kind === 1 /* Relative */ || kind === 3 /* AutoDetect */) && values[1]) {
          fileLocation = kind;
          filePrefix = values[1];
        }
      }
    } else if (Array.isArray(description.fileLocation)) {
      const kind2 = FileLocationKind.fromString(description.fileLocation[0]);
      if (kind2 === 4 /* Search */) {
        fileLocation = 4 /* Search */;
        filePrefix = description.fileLocation[1] ?? { include: ["${workspaceFolder}"] };
      }
    }
    const pattern = description.pattern ? this.createProblemPattern(description.pattern) : void 0;
    let severity = description.severity ? Severity.fromValue(description.severity) : void 0;
    if (severity === Severity.Ignore) {
      this.info(localize("ProblemMatcherParser.unknownSeverity", "Info: unknown severity {0}. Valid values are error, warning and info.\n", description.severity));
      severity = Severity.Error;
    }
    if (Types.isString(description.base)) {
      const variableName = description.base;
      if (variableName.length > 1 && variableName[0] === "$") {
        const base = ProblemMatcherRegistry.get(variableName.substring(1));
        if (base) {
          result = Objects.deepClone(base);
          if (description.owner !== void 0 && owner !== void 0) {
            result.owner = owner;
          }
          if (description.source !== void 0 && source !== void 0) {
            result.source = source;
          }
          if (description.fileLocation !== void 0 && fileLocation !== void 0) {
            result.fileLocation = fileLocation;
            result.filePrefix = filePrefix;
          }
          if (description.pattern !== void 0 && pattern !== void 0 && pattern !== null) {
            result.pattern = pattern;
          }
          if (description.severity !== void 0 && severity !== void 0) {
            result.severity = severity;
          }
          if (description.applyTo !== void 0 && applyTo !== void 0) {
            result.applyTo = applyTo;
          }
        }
      }
    } else if (fileLocation && pattern) {
      result = {
        owner,
        applyTo,
        fileLocation,
        pattern
      };
      if (source) {
        result.source = source;
      }
      if (filePrefix) {
        result.filePrefix = filePrefix;
      }
      if (severity) {
        result.severity = severity;
      }
    }
    if (Config.isNamedProblemMatcher(description)) {
      result.name = description.name;
      result.label = Types.isString(description.label) ? description.label : description.name;
    }
    return result;
  }
  createProblemPattern(value) {
    if (Types.isString(value)) {
      const variableName = value;
      if (variableName.length > 1 && variableName[0] === "$") {
        const result = ProblemPatternRegistry.get(variableName.substring(1));
        if (!result) {
          this.error(localize("ProblemMatcherParser.noDefinedPatter", "Error: the pattern with the identifier {0} doesn't exist.", variableName));
        }
        return result;
      } else {
        if (variableName.length === 0) {
          this.error(localize("ProblemMatcherParser.noIdentifier", "Error: the pattern property refers to an empty identifier."));
        } else {
          this.error(localize("ProblemMatcherParser.noValidIdentifier", "Error: the pattern property {0} is not a valid pattern variable name.", variableName));
        }
      }
    } else if (value) {
      const problemPatternParser = new ProblemPatternParser(this.problemReporter);
      if (Array.isArray(value)) {
        return problemPatternParser.parse(value);
      } else {
        return problemPatternParser.parse(value);
      }
    }
    return null;
  }
  addWatchingMatcher(external, internal) {
    const oldBegins = this.createRegularExpression(external.watchedTaskBeginsRegExp);
    const oldEnds = this.createRegularExpression(external.watchedTaskEndsRegExp);
    if (oldBegins && oldEnds) {
      internal.watching = {
        activeOnStart: false,
        beginsPattern: { regexp: oldBegins },
        endsPattern: { regexp: oldEnds }
      };
      return;
    }
    const backgroundMonitor = external.background || external.watching;
    if (Types.isUndefinedOrNull(backgroundMonitor)) {
      return;
    }
    const begins = this.createWatchingPattern(backgroundMonitor.beginsPattern);
    const ends = this.createWatchingPattern(backgroundMonitor.endsPattern);
    if (begins && ends) {
      internal.watching = {
        activeOnStart: Types.isBoolean(backgroundMonitor.activeOnStart) ? backgroundMonitor.activeOnStart : false,
        beginsPattern: begins,
        endsPattern: ends
      };
      return;
    }
    if (begins || ends) {
      this.error(localize("ProblemMatcherParser.problemPattern.watchingMatcher", "A problem matcher must define both a begin pattern and an end pattern for watching."));
    }
  }
  createWatchingPattern(external) {
    if (Types.isUndefinedOrNull(external)) {
      return null;
    }
    let regexp;
    let file;
    if (Types.isString(external)) {
      regexp = this.createRegularExpression(external);
    } else {
      regexp = this.createRegularExpression(external.regexp);
      if (Types.isNumber(external.file)) {
        file = external.file;
      }
    }
    if (!regexp) {
      return null;
    }
    return file ? { regexp, file } : { regexp, file: 1 };
  }
  createRegularExpression(value) {
    let result = null;
    if (!value) {
      return result;
    }
    try {
      result = new RegExp(value);
    } catch (err) {
      this.error(localize("ProblemMatcherParser.invalidRegexp", "Error: The string {0} is not a valid regular expression.\n", value));
    }
    return result;
  }
}
const problemMatchersExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "problemMatchers",
  deps: [problemPatternExtPoint],
  jsonSchema: {
    description: localize("ProblemMatcherExtPoint", "Contributes problem matchers"),
    type: "array",
    items: Schemas.NamedProblemMatcher
  }
});
class ProblemMatcherRegistryImpl {
  constructor() {
    this._onMatchersChanged = new Emitter();
    this.onMatcherChanged = this._onMatchersChanged.event;
    this.matchers = /* @__PURE__ */ Object.create(null);
    this.fillDefaults();
    this.readyPromise = new Promise((resolve, reject) => {
      problemMatchersExtPoint.setHandler((extensions, delta) => {
        try {
          delta.removed.forEach((extension) => {
            const problemMatchers = extension.value;
            for (const matcher2 of problemMatchers) {
              if (this.matchers[matcher2.name]) {
                delete this.matchers[matcher2.name];
              }
            }
          });
          delta.added.forEach((extension) => {
            const problemMatchers = extension.value;
            const parser = new ProblemMatcherParser(new ExtensionRegistryReporter(extension.collector));
            for (const matcher2 of problemMatchers) {
              const result = parser.parse(matcher2);
              if (result && isNamedProblemMatcher(result)) {
                this.add(result);
              }
            }
          });
          if (delta.removed.length > 0 || delta.added.length > 0) {
            this._onMatchersChanged.fire();
          }
        } catch (error) {
        }
        const matcher = this.get("tsc-watch");
        if (matcher) {
          matcher.tscWatch = true;
        }
        resolve(void 0);
      });
    });
  }
  onReady() {
    ProblemPatternRegistry.onReady();
    return this.readyPromise;
  }
  add(matcher) {
    this.matchers[matcher.name] = matcher;
  }
  get(name) {
    return this.matchers[name];
  }
  keys() {
    return Object.keys(this.matchers);
  }
  fillDefaults() {
    this.add({
      name: "msCompile",
      label: localize("msCompile", "Microsoft compiler problems"),
      owner: "msCompile",
      source: "cpp",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("msCompile")
    });
    this.add({
      name: "lessCompile",
      label: localize("lessCompile", "Less problems"),
      deprecated: true,
      owner: "lessCompile",
      source: "less",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("lessCompile"),
      severity: Severity.Error
    });
    this.add({
      name: "gulp-tsc",
      label: localize("gulp-tsc", "Gulp TSC Problems"),
      owner: "typescript",
      source: "ts",
      applyTo: 2 /* closedDocuments */,
      fileLocation: 1 /* Relative */,
      filePrefix: "${workspaceFolder}",
      pattern: ProblemPatternRegistry.get("gulp-tsc")
    });
    this.add({
      name: "jshint",
      label: localize("jshint", "JSHint problems"),
      owner: "jshint",
      source: "jshint",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("jshint")
    });
    this.add({
      name: "jshint-stylish",
      label: localize("jshint-stylish", "JSHint stylish problems"),
      owner: "jshint",
      source: "jshint",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("jshint-stylish")
    });
    this.add({
      name: "eslint-compact",
      label: localize("eslint-compact", "ESLint compact problems"),
      owner: "eslint",
      source: "eslint",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      filePrefix: "${workspaceFolder}",
      pattern: ProblemPatternRegistry.get("eslint-compact")
    });
    this.add({
      name: "eslint-stylish",
      label: localize("eslint-stylish", "ESLint stylish problems"),
      owner: "eslint",
      source: "eslint",
      applyTo: 0 /* allDocuments */,
      fileLocation: 2 /* Absolute */,
      pattern: ProblemPatternRegistry.get("eslint-stylish")
    });
    this.add({
      name: "go",
      label: localize("go", "Go problems"),
      owner: "go",
      source: "go",
      applyTo: 0 /* allDocuments */,
      fileLocation: 1 /* Relative */,
      filePrefix: "${workspaceFolder}",
      pattern: ProblemPatternRegistry.get("go")
    });
  }
}
const ProblemMatcherRegistry = new ProblemMatcherRegistryImpl();
export {
  ApplyToKind,
  Config,
  ExtensionRegistryReporter,
  FileLocationKind,
  ProblemLocationKind,
  ProblemMatcherParser,
  ProblemMatcherRegistry,
  ProblemPatternParser,
  ProblemPatternRegistry,
  Schemas,
  createLineMatcher,
  getResource,
  isNamedProblemMatcher
};
