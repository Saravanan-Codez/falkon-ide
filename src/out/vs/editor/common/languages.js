import { Codicon } from "../../base/common/codicons.js";
import { URI } from "../../base/common/uri.js";
import { EditOperation } from "./core/editOperation.js";
import { Range } from "./core/range.js";
import { TokenizationRegistry as TokenizationRegistryImpl } from "./tokenizationRegistry.js";
import { localize } from "../../nls.js";
class Token {
  constructor(offset, type, language) {
    this.offset = offset;
    this.type = type;
    this.language = language;
    this._tokenBrand = void 0;
  }
  toString() {
    return "(" + this.offset + ", " + this.type + ")";
  }
}
class TokenizationResult {
  constructor(tokens, endState) {
    this.tokens = tokens;
    this.endState = endState;
    this._tokenizationResultBrand = void 0;
  }
}
class EncodedTokenizationResult {
  constructor(tokens, fontInfo, endState) {
    this.tokens = tokens;
    this.fontInfo = fontInfo;
    this.endState = endState;
    this._encodedTokenizationResultBrand = void 0;
  }
}
var HoverVerbosityAction = /* @__PURE__ */ ((HoverVerbosityAction2) => {
  HoverVerbosityAction2[HoverVerbosityAction2["Increase"] = 0] = "Increase";
  HoverVerbosityAction2[HoverVerbosityAction2["Decrease"] = 1] = "Decrease";
  return HoverVerbosityAction2;
})(HoverVerbosityAction || {});
var CompletionItemKind = /* @__PURE__ */ ((CompletionItemKind2) => {
  CompletionItemKind2[CompletionItemKind2["Method"] = 0] = "Method";
  CompletionItemKind2[CompletionItemKind2["Function"] = 1] = "Function";
  CompletionItemKind2[CompletionItemKind2["Constructor"] = 2] = "Constructor";
  CompletionItemKind2[CompletionItemKind2["Field"] = 3] = "Field";
  CompletionItemKind2[CompletionItemKind2["Variable"] = 4] = "Variable";
  CompletionItemKind2[CompletionItemKind2["Class"] = 5] = "Class";
  CompletionItemKind2[CompletionItemKind2["Struct"] = 6] = "Struct";
  CompletionItemKind2[CompletionItemKind2["Interface"] = 7] = "Interface";
  CompletionItemKind2[CompletionItemKind2["Module"] = 8] = "Module";
  CompletionItemKind2[CompletionItemKind2["Property"] = 9] = "Property";
  CompletionItemKind2[CompletionItemKind2["Event"] = 10] = "Event";
  CompletionItemKind2[CompletionItemKind2["Operator"] = 11] = "Operator";
  CompletionItemKind2[CompletionItemKind2["Unit"] = 12] = "Unit";
  CompletionItemKind2[CompletionItemKind2["Value"] = 13] = "Value";
  CompletionItemKind2[CompletionItemKind2["Constant"] = 14] = "Constant";
  CompletionItemKind2[CompletionItemKind2["Enum"] = 15] = "Enum";
  CompletionItemKind2[CompletionItemKind2["EnumMember"] = 16] = "EnumMember";
  CompletionItemKind2[CompletionItemKind2["Keyword"] = 17] = "Keyword";
  CompletionItemKind2[CompletionItemKind2["Text"] = 18] = "Text";
  CompletionItemKind2[CompletionItemKind2["Color"] = 19] = "Color";
  CompletionItemKind2[CompletionItemKind2["File"] = 20] = "File";
  CompletionItemKind2[CompletionItemKind2["Reference"] = 21] = "Reference";
  CompletionItemKind2[CompletionItemKind2["Customcolor"] = 22] = "Customcolor";
  CompletionItemKind2[CompletionItemKind2["Folder"] = 23] = "Folder";
  CompletionItemKind2[CompletionItemKind2["TypeParameter"] = 24] = "TypeParameter";
  CompletionItemKind2[CompletionItemKind2["User"] = 25] = "User";
  CompletionItemKind2[CompletionItemKind2["Issue"] = 26] = "Issue";
  CompletionItemKind2[CompletionItemKind2["Tool"] = 27] = "Tool";
  CompletionItemKind2[CompletionItemKind2["Snippet"] = 28] = "Snippet";
  return CompletionItemKind2;
})(CompletionItemKind || {});
var CompletionItemKinds;
((CompletionItemKinds2) => {
  const byKind = /* @__PURE__ */ new Map();
  byKind.set(0 /* Method */, Codicon.symbolMethod);
  byKind.set(1 /* Function */, Codicon.symbolFunction);
  byKind.set(2 /* Constructor */, Codicon.symbolConstructor);
  byKind.set(3 /* Field */, Codicon.symbolField);
  byKind.set(4 /* Variable */, Codicon.symbolVariable);
  byKind.set(5 /* Class */, Codicon.symbolClass);
  byKind.set(6 /* Struct */, Codicon.symbolStruct);
  byKind.set(7 /* Interface */, Codicon.symbolInterface);
  byKind.set(8 /* Module */, Codicon.symbolModule);
  byKind.set(9 /* Property */, Codicon.symbolProperty);
  byKind.set(10 /* Event */, Codicon.symbolEvent);
  byKind.set(11 /* Operator */, Codicon.symbolOperator);
  byKind.set(12 /* Unit */, Codicon.symbolUnit);
  byKind.set(13 /* Value */, Codicon.symbolValue);
  byKind.set(15 /* Enum */, Codicon.symbolEnum);
  byKind.set(14 /* Constant */, Codicon.symbolConstant);
  byKind.set(16 /* EnumMember */, Codicon.symbolEnumMember);
  byKind.set(17 /* Keyword */, Codicon.symbolKeyword);
  byKind.set(28 /* Snippet */, Codicon.symbolSnippet);
  byKind.set(18 /* Text */, Codicon.symbolText);
  byKind.set(19 /* Color */, Codicon.symbolColor);
  byKind.set(20 /* File */, Codicon.symbolFile);
  byKind.set(21 /* Reference */, Codicon.symbolReference);
  byKind.set(22 /* Customcolor */, Codicon.symbolCustomColor);
  byKind.set(23 /* Folder */, Codicon.symbolFolder);
  byKind.set(24 /* TypeParameter */, Codicon.symbolTypeParameter);
  byKind.set(25 /* User */, Codicon.account);
  byKind.set(26 /* Issue */, Codicon.issues);
  byKind.set(27 /* Tool */, Codicon.tools);
  function toIcon(kind) {
    let codicon = byKind.get(kind);
    if (!codicon) {
      console.info("No codicon found for CompletionItemKind " + kind);
      codicon = Codicon.symbolProperty;
    }
    return codicon;
  }
  CompletionItemKinds2.toIcon = toIcon;
  function toLabel(kind) {
    switch (kind) {
      case 0 /* Method */:
        return localize("suggestWidget.kind.method", "Method");
      case 1 /* Function */:
        return localize("suggestWidget.kind.function", "Function");
      case 2 /* Constructor */:
        return localize("suggestWidget.kind.constructor", "Constructor");
      case 3 /* Field */:
        return localize("suggestWidget.kind.field", "Field");
      case 4 /* Variable */:
        return localize("suggestWidget.kind.variable", "Variable");
      case 5 /* Class */:
        return localize("suggestWidget.kind.class", "Class");
      case 6 /* Struct */:
        return localize("suggestWidget.kind.struct", "Struct");
      case 7 /* Interface */:
        return localize("suggestWidget.kind.interface", "Interface");
      case 8 /* Module */:
        return localize("suggestWidget.kind.module", "Module");
      case 9 /* Property */:
        return localize("suggestWidget.kind.property", "Property");
      case 10 /* Event */:
        return localize("suggestWidget.kind.event", "Event");
      case 11 /* Operator */:
        return localize("suggestWidget.kind.operator", "Operator");
      case 12 /* Unit */:
        return localize("suggestWidget.kind.unit", "Unit");
      case 13 /* Value */:
        return localize("suggestWidget.kind.value", "Value");
      case 14 /* Constant */:
        return localize("suggestWidget.kind.constant", "Constant");
      case 15 /* Enum */:
        return localize("suggestWidget.kind.enum", "Enum");
      case 16 /* EnumMember */:
        return localize("suggestWidget.kind.enumMember", "Enum Member");
      case 17 /* Keyword */:
        return localize("suggestWidget.kind.keyword", "Keyword");
      case 18 /* Text */:
        return localize("suggestWidget.kind.text", "Text");
      case 19 /* Color */:
        return localize("suggestWidget.kind.color", "Color");
      case 20 /* File */:
        return localize("suggestWidget.kind.file", "File");
      case 21 /* Reference */:
        return localize("suggestWidget.kind.reference", "Reference");
      case 22 /* Customcolor */:
        return localize("suggestWidget.kind.customcolor", "Custom Color");
      case 23 /* Folder */:
        return localize("suggestWidget.kind.folder", "Folder");
      case 24 /* TypeParameter */:
        return localize("suggestWidget.kind.typeParameter", "Type Parameter");
      case 25 /* User */:
        return localize("suggestWidget.kind.user", "User");
      case 26 /* Issue */:
        return localize("suggestWidget.kind.issue", "Issue");
      case 27 /* Tool */:
        return localize("suggestWidget.kind.tool", "Tool");
      case 28 /* Snippet */:
        return localize("suggestWidget.kind.snippet", "Snippet");
      default:
        return "";
    }
  }
  CompletionItemKinds2.toLabel = toLabel;
  const data = /* @__PURE__ */ new Map();
  data.set("method", 0 /* Method */);
  data.set("function", 1 /* Function */);
  data.set("constructor", 2 /* Constructor */);
  data.set("field", 3 /* Field */);
  data.set("variable", 4 /* Variable */);
  data.set("class", 5 /* Class */);
  data.set("struct", 6 /* Struct */);
  data.set("interface", 7 /* Interface */);
  data.set("module", 8 /* Module */);
  data.set("property", 9 /* Property */);
  data.set("event", 10 /* Event */);
  data.set("operator", 11 /* Operator */);
  data.set("unit", 12 /* Unit */);
  data.set("value", 13 /* Value */);
  data.set("constant", 14 /* Constant */);
  data.set("enum", 15 /* Enum */);
  data.set("enum-member", 16 /* EnumMember */);
  data.set("enumMember", 16 /* EnumMember */);
  data.set("keyword", 17 /* Keyword */);
  data.set("snippet", 28 /* Snippet */);
  data.set("text", 18 /* Text */);
  data.set("color", 19 /* Color */);
  data.set("file", 20 /* File */);
  data.set("reference", 21 /* Reference */);
  data.set("customcolor", 22 /* Customcolor */);
  data.set("folder", 23 /* Folder */);
  data.set("type-parameter", 24 /* TypeParameter */);
  data.set("typeParameter", 24 /* TypeParameter */);
  data.set("account", 25 /* User */);
  data.set("issue", 26 /* Issue */);
  data.set("tool", 27 /* Tool */);
  function fromString(value, strict) {
    let res = data.get(value);
    if (typeof res === "undefined" && !strict) {
      res = 9 /* Property */;
    }
    return res;
  }
  CompletionItemKinds2.fromString = fromString;
})(CompletionItemKinds || (CompletionItemKinds = {}));
var CompletionItemTag = /* @__PURE__ */ ((CompletionItemTag2) => {
  CompletionItemTag2[CompletionItemTag2["Deprecated"] = 1] = "Deprecated";
  return CompletionItemTag2;
})(CompletionItemTag || {});
var CompletionItemInsertTextRule = /* @__PURE__ */ ((CompletionItemInsertTextRule2) => {
  CompletionItemInsertTextRule2[CompletionItemInsertTextRule2["None"] = 0] = "None";
  CompletionItemInsertTextRule2[CompletionItemInsertTextRule2["KeepWhitespace"] = 1] = "KeepWhitespace";
  CompletionItemInsertTextRule2[CompletionItemInsertTextRule2["InsertAsSnippet"] = 4] = "InsertAsSnippet";
  return CompletionItemInsertTextRule2;
})(CompletionItemInsertTextRule || {});
var PartialAcceptTriggerKind = /* @__PURE__ */ ((PartialAcceptTriggerKind2) => {
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Word"] = 0] = "Word";
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Line"] = 1] = "Line";
  PartialAcceptTriggerKind2[PartialAcceptTriggerKind2["Suggest"] = 2] = "Suggest";
  return PartialAcceptTriggerKind2;
})(PartialAcceptTriggerKind || {});
var CompletionTriggerKind = /* @__PURE__ */ ((CompletionTriggerKind2) => {
  CompletionTriggerKind2[CompletionTriggerKind2["Invoke"] = 0] = "Invoke";
  CompletionTriggerKind2[CompletionTriggerKind2["TriggerCharacter"] = 1] = "TriggerCharacter";
  CompletionTriggerKind2[CompletionTriggerKind2["TriggerForIncompleteCompletions"] = 2] = "TriggerForIncompleteCompletions";
  return CompletionTriggerKind2;
})(CompletionTriggerKind || {});
var InlineCompletionTriggerKind = /* @__PURE__ */ ((InlineCompletionTriggerKind2) => {
  InlineCompletionTriggerKind2[InlineCompletionTriggerKind2["Automatic"] = 0] = "Automatic";
  InlineCompletionTriggerKind2[InlineCompletionTriggerKind2["Explicit"] = 1] = "Explicit";
  return InlineCompletionTriggerKind2;
})(InlineCompletionTriggerKind || {});
class SelectedSuggestionInfo {
  constructor(range, text, completionKind, isSnippetText) {
    this.range = range;
    this.text = text;
    this.completionKind = completionKind;
    this.isSnippetText = isSnippetText;
  }
  equals(other) {
    return Range.lift(this.range).equalsRange(other.range) && this.text === other.text && this.completionKind === other.completionKind && this.isSnippetText === other.isSnippetText;
  }
}
var InlineCompletionHintStyle = /* @__PURE__ */ ((InlineCompletionHintStyle2) => {
  InlineCompletionHintStyle2[InlineCompletionHintStyle2["Code"] = 1] = "Code";
  InlineCompletionHintStyle2[InlineCompletionHintStyle2["Label"] = 2] = "Label";
  return InlineCompletionHintStyle2;
})(InlineCompletionHintStyle || {});
class ProviderId {
  constructor(extensionId, extensionVersion, providerId) {
    this.extensionId = extensionId;
    this.extensionVersion = extensionVersion;
    this.providerId = providerId;
  }
  static fromExtensionId(extensionId) {
    return new ProviderId(extensionId, void 0, void 0);
  }
  toString() {
    let result = "";
    if (this.extensionId) {
      result += this.extensionId;
    }
    if (this.extensionVersion) {
      result += `@${this.extensionVersion}`;
    }
    if (this.providerId) {
      result += `:${this.providerId}`;
    }
    if (result.length === 0) {
      result = "unknown";
    }
    return result;
  }
  toStringWithoutVersion() {
    let result = "";
    if (this.extensionId) {
      result += this.extensionId;
    }
    if (this.providerId) {
      result += `:${this.providerId}`;
    }
    return result;
  }
}
class VersionedExtensionId {
  constructor(extensionId, version) {
    this.extensionId = extensionId;
    this.version = version;
  }
  static tryCreate(extensionId, version) {
    if (!extensionId || !version) {
      return void 0;
    }
    return new VersionedExtensionId(extensionId, version);
  }
  toString() {
    return `${this.extensionId}@${this.version}`;
  }
}
var InlineCompletionEndOfLifeReasonKind = /* @__PURE__ */ ((InlineCompletionEndOfLifeReasonKind2) => {
  InlineCompletionEndOfLifeReasonKind2[InlineCompletionEndOfLifeReasonKind2["Accepted"] = 0] = "Accepted";
  InlineCompletionEndOfLifeReasonKind2[InlineCompletionEndOfLifeReasonKind2["Rejected"] = 1] = "Rejected";
  InlineCompletionEndOfLifeReasonKind2[InlineCompletionEndOfLifeReasonKind2["Ignored"] = 2] = "Ignored";
  return InlineCompletionEndOfLifeReasonKind2;
})(InlineCompletionEndOfLifeReasonKind || {});
var CodeActionTriggerType = /* @__PURE__ */ ((CodeActionTriggerType2) => {
  CodeActionTriggerType2[CodeActionTriggerType2["Invoke"] = 1] = "Invoke";
  CodeActionTriggerType2[CodeActionTriggerType2["Auto"] = 2] = "Auto";
  return CodeActionTriggerType2;
})(CodeActionTriggerType || {});
var DocumentPasteTriggerKind = /* @__PURE__ */ ((DocumentPasteTriggerKind2) => {
  DocumentPasteTriggerKind2[DocumentPasteTriggerKind2["Automatic"] = 0] = "Automatic";
  DocumentPasteTriggerKind2[DocumentPasteTriggerKind2["PasteAs"] = 1] = "PasteAs";
  return DocumentPasteTriggerKind2;
})(DocumentPasteTriggerKind || {});
var SignatureHelpTriggerKind = /* @__PURE__ */ ((SignatureHelpTriggerKind2) => {
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["Invoke"] = 1] = "Invoke";
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["TriggerCharacter"] = 2] = "TriggerCharacter";
  SignatureHelpTriggerKind2[SignatureHelpTriggerKind2["ContentChange"] = 3] = "ContentChange";
  return SignatureHelpTriggerKind2;
})(SignatureHelpTriggerKind || {});
var DocumentHighlightKind = /* @__PURE__ */ ((DocumentHighlightKind2) => {
  DocumentHighlightKind2[DocumentHighlightKind2["Text"] = 0] = "Text";
  DocumentHighlightKind2[DocumentHighlightKind2["Read"] = 1] = "Read";
  DocumentHighlightKind2[DocumentHighlightKind2["Write"] = 2] = "Write";
  return DocumentHighlightKind2;
})(DocumentHighlightKind || {});
function isLocationLink(thing) {
  return !!thing && URI.isUri(thing.uri) && Range.isIRange(thing.range) && (Range.isIRange(thing.originSelectionRange) || Range.isIRange(thing.targetSelectionRange));
}
function isLocation(thing) {
  return !!thing && URI.isUri(thing.uri) && Range.isIRange(thing.range);
}
var SymbolKind = /* @__PURE__ */ ((SymbolKind2) => {
  SymbolKind2[SymbolKind2["File"] = 0] = "File";
  SymbolKind2[SymbolKind2["Module"] = 1] = "Module";
  SymbolKind2[SymbolKind2["Namespace"] = 2] = "Namespace";
  SymbolKind2[SymbolKind2["Package"] = 3] = "Package";
  SymbolKind2[SymbolKind2["Class"] = 4] = "Class";
  SymbolKind2[SymbolKind2["Method"] = 5] = "Method";
  SymbolKind2[SymbolKind2["Property"] = 6] = "Property";
  SymbolKind2[SymbolKind2["Field"] = 7] = "Field";
  SymbolKind2[SymbolKind2["Constructor"] = 8] = "Constructor";
  SymbolKind2[SymbolKind2["Enum"] = 9] = "Enum";
  SymbolKind2[SymbolKind2["Interface"] = 10] = "Interface";
  SymbolKind2[SymbolKind2["Function"] = 11] = "Function";
  SymbolKind2[SymbolKind2["Variable"] = 12] = "Variable";
  SymbolKind2[SymbolKind2["Constant"] = 13] = "Constant";
  SymbolKind2[SymbolKind2["String"] = 14] = "String";
  SymbolKind2[SymbolKind2["Number"] = 15] = "Number";
  SymbolKind2[SymbolKind2["Boolean"] = 16] = "Boolean";
  SymbolKind2[SymbolKind2["Array"] = 17] = "Array";
  SymbolKind2[SymbolKind2["Object"] = 18] = "Object";
  SymbolKind2[SymbolKind2["Key"] = 19] = "Key";
  SymbolKind2[SymbolKind2["Null"] = 20] = "Null";
  SymbolKind2[SymbolKind2["EnumMember"] = 21] = "EnumMember";
  SymbolKind2[SymbolKind2["Struct"] = 22] = "Struct";
  SymbolKind2[SymbolKind2["Event"] = 23] = "Event";
  SymbolKind2[SymbolKind2["Operator"] = 24] = "Operator";
  SymbolKind2[SymbolKind2["TypeParameter"] = 25] = "TypeParameter";
  return SymbolKind2;
})(SymbolKind || {});
const symbolKindNames = {
  [17 /* Array */]: localize("Array", "array"),
  [16 /* Boolean */]: localize("Boolean", "boolean"),
  [4 /* Class */]: localize("Class", "class"),
  [13 /* Constant */]: localize("Constant", "constant"),
  [8 /* Constructor */]: localize("Constructor", "constructor"),
  [9 /* Enum */]: localize("Enum", "enumeration"),
  [21 /* EnumMember */]: localize("EnumMember", "enumeration member"),
  [23 /* Event */]: localize("Event", "event"),
  [7 /* Field */]: localize("Field", "field"),
  [0 /* File */]: localize("File", "file"),
  [11 /* Function */]: localize("Function", "function"),
  [10 /* Interface */]: localize("Interface", "interface"),
  [19 /* Key */]: localize("Key", "key"),
  [5 /* Method */]: localize("Method", "method"),
  [1 /* Module */]: localize("Module", "module"),
  [2 /* Namespace */]: localize("Namespace", "namespace"),
  [20 /* Null */]: localize("Null", "null"),
  [15 /* Number */]: localize("Number", "number"),
  [18 /* Object */]: localize("Object", "object"),
  [24 /* Operator */]: localize("Operator", "operator"),
  [3 /* Package */]: localize("Package", "package"),
  [6 /* Property */]: localize("Property", "property"),
  [14 /* String */]: localize("String", "string"),
  [22 /* Struct */]: localize("Struct", "struct"),
  [25 /* TypeParameter */]: localize("TypeParameter", "type parameter"),
  [12 /* Variable */]: localize("Variable", "variable")
};
function getAriaLabelForSymbol(symbolName, kind) {
  return localize("symbolAriaLabel", "{0} ({1})", symbolName, symbolKindNames[kind]);
}
var SymbolTag = /* @__PURE__ */ ((SymbolTag2) => {
  SymbolTag2[SymbolTag2["Deprecated"] = 1] = "Deprecated";
  return SymbolTag2;
})(SymbolTag || {});
var SymbolKinds;
((SymbolKinds2) => {
  const byKind = /* @__PURE__ */ new Map();
  byKind.set(0 /* File */, Codicon.symbolFile);
  byKind.set(1 /* Module */, Codicon.symbolModule);
  byKind.set(2 /* Namespace */, Codicon.symbolNamespace);
  byKind.set(3 /* Package */, Codicon.symbolPackage);
  byKind.set(4 /* Class */, Codicon.symbolClass);
  byKind.set(5 /* Method */, Codicon.symbolMethod);
  byKind.set(6 /* Property */, Codicon.symbolProperty);
  byKind.set(7 /* Field */, Codicon.symbolField);
  byKind.set(8 /* Constructor */, Codicon.symbolConstructor);
  byKind.set(9 /* Enum */, Codicon.symbolEnum);
  byKind.set(10 /* Interface */, Codicon.symbolInterface);
  byKind.set(11 /* Function */, Codicon.symbolFunction);
  byKind.set(12 /* Variable */, Codicon.symbolVariable);
  byKind.set(13 /* Constant */, Codicon.symbolConstant);
  byKind.set(14 /* String */, Codicon.symbolString);
  byKind.set(15 /* Number */, Codicon.symbolNumber);
  byKind.set(16 /* Boolean */, Codicon.symbolBoolean);
  byKind.set(17 /* Array */, Codicon.symbolArray);
  byKind.set(18 /* Object */, Codicon.symbolObject);
  byKind.set(19 /* Key */, Codicon.symbolKey);
  byKind.set(20 /* Null */, Codicon.symbolNull);
  byKind.set(21 /* EnumMember */, Codicon.symbolEnumMember);
  byKind.set(22 /* Struct */, Codicon.symbolStruct);
  byKind.set(23 /* Event */, Codicon.symbolEvent);
  byKind.set(24 /* Operator */, Codicon.symbolOperator);
  byKind.set(25 /* TypeParameter */, Codicon.symbolTypeParameter);
  function toIcon(kind) {
    let icon = byKind.get(kind);
    if (!icon) {
      console.info("No codicon found for SymbolKind " + kind);
      icon = Codicon.symbolProperty;
    }
    return icon;
  }
  SymbolKinds2.toIcon = toIcon;
  const byCompletionKind = /* @__PURE__ */ new Map();
  byCompletionKind.set(0 /* File */, 20 /* File */);
  byCompletionKind.set(1 /* Module */, 8 /* Module */);
  byCompletionKind.set(2 /* Namespace */, 8 /* Module */);
  byCompletionKind.set(3 /* Package */, 8 /* Module */);
  byCompletionKind.set(4 /* Class */, 5 /* Class */);
  byCompletionKind.set(5 /* Method */, 0 /* Method */);
  byCompletionKind.set(6 /* Property */, 9 /* Property */);
  byCompletionKind.set(7 /* Field */, 3 /* Field */);
  byCompletionKind.set(8 /* Constructor */, 2 /* Constructor */);
  byCompletionKind.set(9 /* Enum */, 15 /* Enum */);
  byCompletionKind.set(10 /* Interface */, 7 /* Interface */);
  byCompletionKind.set(11 /* Function */, 1 /* Function */);
  byCompletionKind.set(12 /* Variable */, 4 /* Variable */);
  byCompletionKind.set(13 /* Constant */, 14 /* Constant */);
  byCompletionKind.set(14 /* String */, 18 /* Text */);
  byCompletionKind.set(15 /* Number */, 13 /* Value */);
  byCompletionKind.set(16 /* Boolean */, 13 /* Value */);
  byCompletionKind.set(17 /* Array */, 13 /* Value */);
  byCompletionKind.set(18 /* Object */, 13 /* Value */);
  byCompletionKind.set(19 /* Key */, 17 /* Keyword */);
  byCompletionKind.set(20 /* Null */, 13 /* Value */);
  byCompletionKind.set(21 /* EnumMember */, 16 /* EnumMember */);
  byCompletionKind.set(22 /* Struct */, 6 /* Struct */);
  byCompletionKind.set(23 /* Event */, 10 /* Event */);
  byCompletionKind.set(24 /* Operator */, 11 /* Operator */);
  byCompletionKind.set(25 /* TypeParameter */, 24 /* TypeParameter */);
  function toCompletionKind(kind) {
    let completionKind = byCompletionKind.get(kind);
    if (completionKind === void 0) {
      console.info("No completion kind found for SymbolKind " + kind);
      completionKind = 20 /* File */;
    }
    return completionKind;
  }
  SymbolKinds2.toCompletionKind = toCompletionKind;
})(SymbolKinds || (SymbolKinds = {}));
class TextEdit {
  static asEditOperation(edit) {
    const range = Range.lift(edit.range);
    return range.isEmpty() ? EditOperation.insert(range.getStartPosition(), edit.text) : EditOperation.replace(range, edit.text);
  }
  static isTextEdit(thing) {
    const possibleTextEdit = thing;
    return typeof possibleTextEdit.text === "string" && Range.isIRange(possibleTextEdit.range);
  }
}
class FoldingRangeKind {
  /**
   * Creates a new {@link FoldingRangeKind}.
   *
   * @param value of the kind.
   */
  constructor(value) {
    this.value = value;
  }
  static {
    /**
     * Kind for folding range representing a comment. The value of the kind is 'comment'.
     */
    this.Comment = new FoldingRangeKind("comment");
  }
  static {
    /**
     * Kind for folding range representing a import. The value of the kind is 'imports'.
     */
    this.Imports = new FoldingRangeKind("imports");
  }
  static {
    /**
     * Kind for folding range representing regions (for example marked by `#region`, `#endregion`).
     * The value of the kind is 'region'.
     */
    this.Region = new FoldingRangeKind("region");
  }
  /**
   * Returns a {@link FoldingRangeKind} for the given value.
   *
   * @param value of the kind.
   */
  static fromValue(value) {
    switch (value) {
      case "comment":
        return FoldingRangeKind.Comment;
      case "imports":
        return FoldingRangeKind.Imports;
      case "region":
        return FoldingRangeKind.Region;
    }
    return new FoldingRangeKind(value);
  }
}
var NewSymbolNameTag = /* @__PURE__ */ ((NewSymbolNameTag2) => {
  NewSymbolNameTag2[NewSymbolNameTag2["AIGenerated"] = 1] = "AIGenerated";
  return NewSymbolNameTag2;
})(NewSymbolNameTag || {});
var NewSymbolNameTriggerKind = /* @__PURE__ */ ((NewSymbolNameTriggerKind2) => {
  NewSymbolNameTriggerKind2[NewSymbolNameTriggerKind2["Invoke"] = 0] = "Invoke";
  NewSymbolNameTriggerKind2[NewSymbolNameTriggerKind2["Automatic"] = 1] = "Automatic";
  return NewSymbolNameTriggerKind2;
})(NewSymbolNameTriggerKind || {});
var Command;
((Command2) => {
  function is(obj) {
    if (!obj || typeof obj !== "object") {
      return false;
    }
    return typeof obj.id === "string" && typeof obj.title === "string";
  }
  Command2.is = is;
})(Command || (Command = {}));
var CommentThreadCollapsibleState = /* @__PURE__ */ ((CommentThreadCollapsibleState2) => {
  CommentThreadCollapsibleState2[CommentThreadCollapsibleState2["Collapsed"] = 0] = "Collapsed";
  CommentThreadCollapsibleState2[CommentThreadCollapsibleState2["Expanded"] = 1] = "Expanded";
  return CommentThreadCollapsibleState2;
})(CommentThreadCollapsibleState || {});
var CommentThreadState = /* @__PURE__ */ ((CommentThreadState2) => {
  CommentThreadState2[CommentThreadState2["Unresolved"] = 0] = "Unresolved";
  CommentThreadState2[CommentThreadState2["Resolved"] = 1] = "Resolved";
  return CommentThreadState2;
})(CommentThreadState || {});
var CommentThreadApplicability = /* @__PURE__ */ ((CommentThreadApplicability2) => {
  CommentThreadApplicability2[CommentThreadApplicability2["Current"] = 0] = "Current";
  CommentThreadApplicability2[CommentThreadApplicability2["Outdated"] = 1] = "Outdated";
  return CommentThreadApplicability2;
})(CommentThreadApplicability || {});
var CommentMode = /* @__PURE__ */ ((CommentMode2) => {
  CommentMode2[CommentMode2["Editing"] = 0] = "Editing";
  CommentMode2[CommentMode2["Preview"] = 1] = "Preview";
  return CommentMode2;
})(CommentMode || {});
var CommentState = /* @__PURE__ */ ((CommentState2) => {
  CommentState2[CommentState2["Published"] = 0] = "Published";
  CommentState2[CommentState2["Draft"] = 1] = "Draft";
  return CommentState2;
})(CommentState || {});
var InlayHintKind = /* @__PURE__ */ ((InlayHintKind2) => {
  InlayHintKind2[InlayHintKind2["Type"] = 1] = "Type";
  InlayHintKind2[InlayHintKind2["Parameter"] = 2] = "Parameter";
  return InlayHintKind2;
})(InlayHintKind || {});
class LazyTokenizationSupport {
  constructor(createSupport) {
    this.createSupport = createSupport;
    this._tokenizationSupport = null;
  }
  dispose() {
    if (this._tokenizationSupport) {
      this._tokenizationSupport.then((support) => {
        if (support) {
          support.dispose();
        }
      });
    }
  }
  get tokenizationSupport() {
    if (!this._tokenizationSupport) {
      this._tokenizationSupport = this.createSupport();
    }
    return this._tokenizationSupport;
  }
}
const TokenizationRegistry = new TokenizationRegistryImpl();
var ExternalUriOpenerPriority = /* @__PURE__ */ ((ExternalUriOpenerPriority2) => {
  ExternalUriOpenerPriority2[ExternalUriOpenerPriority2["None"] = 0] = "None";
  ExternalUriOpenerPriority2[ExternalUriOpenerPriority2["Option"] = 1] = "Option";
  ExternalUriOpenerPriority2[ExternalUriOpenerPriority2["Default"] = 2] = "Default";
  ExternalUriOpenerPriority2[ExternalUriOpenerPriority2["Preferred"] = 3] = "Preferred";
  return ExternalUriOpenerPriority2;
})(ExternalUriOpenerPriority || {});
export {
  CodeActionTriggerType,
  Command,
  CommentMode,
  CommentState,
  CommentThreadApplicability,
  CommentThreadCollapsibleState,
  CommentThreadState,
  CompletionItemInsertTextRule,
  CompletionItemKind,
  CompletionItemKinds,
  CompletionItemTag,
  CompletionTriggerKind,
  DocumentHighlightKind,
  DocumentPasteTriggerKind,
  EncodedTokenizationResult,
  ExternalUriOpenerPriority,
  FoldingRangeKind,
  HoverVerbosityAction,
  InlayHintKind,
  InlineCompletionEndOfLifeReasonKind,
  InlineCompletionHintStyle,
  InlineCompletionTriggerKind,
  LazyTokenizationSupport,
  NewSymbolNameTag,
  NewSymbolNameTriggerKind,
  PartialAcceptTriggerKind,
  ProviderId,
  SelectedSuggestionInfo,
  SignatureHelpTriggerKind,
  SymbolKind,
  SymbolKinds,
  SymbolTag,
  TextEdit,
  Token,
  TokenizationRegistry,
  TokenizationResult,
  VersionedExtensionId,
  getAriaLabelForSymbol,
  isLocation,
  isLocationLink,
  symbolKindNames
};
