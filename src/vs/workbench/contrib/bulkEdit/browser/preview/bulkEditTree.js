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
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { createMatches } from "../../../../../base/common/filters.js";
import { HighlightedLabel } from "../../../../../base/browser/ui/highlightedlabel/highlightedLabel.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { Checkbox } from "../../../../../base/browser/ui/toggle/toggle.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { TextModel } from "../../../../../editor/common/model/textModel.js";
import { BulkFileOperations, BulkFileOperationType } from "./bulkEditPreview.js";
import { FileKind } from "../../../../../platform/files/common/files.js";
import { localize } from "../../../../../nls.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IconLabel } from "../../../../../base/browser/ui/iconLabel/iconLabel.js";
import { basename } from "../../../../../base/common/resources.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { compare } from "../../../../../base/common/strings.js";
import { URI } from "../../../../../base/common/uri.js";
import { ResourceFileEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { SnippetParser } from "../../../../../editor/contrib/snippet/browser/snippetParser.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import * as css from "../../../../../base/browser/cssValue.js";
import { defaultCheckboxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
class CategoryElement {
  constructor(parent, category) {
    this.parent = parent;
    this.category = category;
  }
  isChecked() {
    const model = this.parent;
    let checked = true;
    for (const file of this.category.fileOperations) {
      for (const edit of file.originalEdits.values()) {
        checked = checked && model.checked.isChecked(edit);
      }
    }
    return checked;
  }
  setChecked(value) {
    const model = this.parent;
    for (const file of this.category.fileOperations) {
      for (const edit of file.originalEdits.values()) {
        model.checked.updateChecked(edit, value);
      }
    }
  }
}
class FileElement {
  constructor(parent, edit) {
    this.parent = parent;
    this.edit = edit;
  }
  isChecked() {
    const model = this.parent instanceof CategoryElement ? this.parent.parent : this.parent;
    let checked = true;
    if (this.edit.type === BulkFileOperationType.TextEdit) {
      checked = !this.edit.textEdits.every((edit) => !model.checked.isChecked(edit.textEdit));
    }
    for (const edit of this.edit.originalEdits.values()) {
      if (edit instanceof ResourceFileEdit) {
        checked = checked && model.checked.isChecked(edit);
      }
    }
    if (this.parent instanceof CategoryElement && this.edit.type === BulkFileOperationType.TextEdit) {
      for (const category of model.categories) {
        for (const file of category.fileOperations) {
          if (file.uri.toString() === this.edit.uri.toString()) {
            for (const edit of file.originalEdits.values()) {
              if (edit instanceof ResourceFileEdit) {
                checked = checked && model.checked.isChecked(edit);
              }
            }
          }
        }
      }
    }
    return checked;
  }
  setChecked(value) {
    const model = this.parent instanceof CategoryElement ? this.parent.parent : this.parent;
    for (const edit of this.edit.originalEdits.values()) {
      model.checked.updateChecked(edit, value);
    }
    if (this.parent instanceof CategoryElement && this.edit.type !== BulkFileOperationType.TextEdit) {
      for (const category of model.categories) {
        for (const file of category.fileOperations) {
          if (file.uri.toString() === this.edit.uri.toString()) {
            for (const edit of file.originalEdits.values()) {
              model.checked.updateChecked(edit, value);
            }
          }
        }
      }
    }
  }
  isDisabled() {
    if (this.parent instanceof CategoryElement && this.edit.type === BulkFileOperationType.TextEdit) {
      const model = this.parent.parent;
      let checked = true;
      for (const category of model.categories) {
        for (const file of category.fileOperations) {
          if (file.uri.toString() === this.edit.uri.toString()) {
            for (const edit of file.originalEdits.values()) {
              if (edit instanceof ResourceFileEdit) {
                checked = checked && model.checked.isChecked(edit);
              }
            }
          }
        }
      }
      return !checked;
    }
    return false;
  }
}
class TextEditElement {
  constructor(parent, idx, edit, prefix, selecting, inserting, suffix) {
    this.parent = parent;
    this.idx = idx;
    this.edit = edit;
    this.prefix = prefix;
    this.selecting = selecting;
    this.inserting = inserting;
    this.suffix = suffix;
  }
  isChecked() {
    let model = this.parent.parent;
    if (model instanceof CategoryElement) {
      model = model.parent;
    }
    return model.checked.isChecked(this.edit.textEdit);
  }
  setChecked(value) {
    let model = this.parent.parent;
    if (model instanceof CategoryElement) {
      model = model.parent;
    }
    model.checked.updateChecked(this.edit.textEdit, value);
    if (value) {
      for (const edit of this.parent.edit.originalEdits.values()) {
        if (edit instanceof ResourceFileEdit) {
          model.checked.updateChecked(edit, value);
        }
      }
    }
  }
  isDisabled() {
    return this.parent.isDisabled();
  }
}
let BulkEditDataSource = class {
  constructor(_textModelService, _instantiationService) {
    this._textModelService = _textModelService;
    this._instantiationService = _instantiationService;
    this.groupByFile = true;
  }
  hasChildren(element) {
    if (element instanceof FileElement) {
      return element.edit.textEdits.length > 0;
    }
    if (element instanceof TextEditElement) {
      return false;
    }
    return true;
  }
  async getChildren(element) {
    if (element instanceof BulkFileOperations) {
      return this.groupByFile ? element.fileOperations.map((op) => new FileElement(element, op)) : element.categories.map((cat) => new CategoryElement(element, cat));
    }
    if (element instanceof CategoryElement) {
      return Array.from(element.category.fileOperations, (op) => new FileElement(element, op));
    }
    if (element instanceof FileElement && element.edit.textEdits.length > 0) {
      let textModel;
      let textModelDisposable;
      try {
        const ref = await this._textModelService.createModelReference(element.edit.uri);
        textModel = ref.object.textEditorModel;
        textModelDisposable = ref;
      } catch {
        textModel = this._instantiationService.createInstance(TextModel, "", PLAINTEXT_LANGUAGE_ID, TextModel.DEFAULT_CREATION_OPTIONS, null);
        textModelDisposable = textModel;
      }
      const result = element.edit.textEdits.map((edit, idx) => {
        const range = textModel.validateRange(edit.textEdit.textEdit.range);
        const startTokens = textModel.tokenization.getLineTokens(range.startLineNumber);
        let prefixLen = 23;
        for (let idx2 = startTokens.findTokenIndexAtOffset(range.startColumn - 1) - 1; prefixLen < 50 && idx2 >= 0; idx2--) {
          prefixLen = range.startColumn - startTokens.getStartOffset(idx2);
        }
        const endTokens = textModel.tokenization.getLineTokens(range.endLineNumber);
        let suffixLen = 0;
        for (let idx2 = endTokens.findTokenIndexAtOffset(range.endColumn - 1); suffixLen < 50 && idx2 < endTokens.getCount(); idx2++) {
          suffixLen += endTokens.getEndOffset(idx2) - endTokens.getStartOffset(idx2);
        }
        return new TextEditElement(
          element,
          idx,
          edit,
          textModel.getValueInRange(new Range(range.startLineNumber, range.startColumn - prefixLen, range.startLineNumber, range.startColumn)),
          textModel.getValueInRange(range),
          !edit.textEdit.textEdit.insertAsSnippet ? edit.textEdit.textEdit.text : SnippetParser.asInsertText(edit.textEdit.textEdit.text),
          textModel.getValueInRange(new Range(range.endLineNumber, range.endColumn, range.endLineNumber, range.endColumn + suffixLen))
        );
      });
      textModelDisposable.dispose();
      return result;
    }
    return [];
  }
};
BulkEditDataSource = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IInstantiationService)
], BulkEditDataSource);
class BulkEditSorter {
  compare(a, b) {
    if (a instanceof FileElement && b instanceof FileElement) {
      return compareBulkFileOperations(a.edit, b.edit);
    }
    if (a instanceof TextEditElement && b instanceof TextEditElement) {
      return Range.compareRangesUsingStarts(a.edit.textEdit.textEdit.range, b.edit.textEdit.textEdit.range);
    }
    return 0;
  }
}
function compareBulkFileOperations(a, b) {
  return compare(a.uri.toString(), b.uri.toString());
}
let BulkEditAccessibilityProvider = class {
  constructor(_labelService) {
    this._labelService = _labelService;
  }
  getWidgetAriaLabel() {
    return localize("bulkEdit", "Bulk Edit");
  }
  getRole(_element) {
    return "checkbox";
  }
  getAriaLabel(element) {
    if (element instanceof FileElement) {
      if (element.edit.textEdits.length > 0) {
        if (element.edit.type & BulkFileOperationType.Rename && element.edit.newUri) {
          return localize(
            "aria.renameAndEdit",
            "Renaming {0} to {1}, also making text edits",
            this._labelService.getUriLabel(element.edit.uri, { relative: true }),
            this._labelService.getUriLabel(element.edit.newUri, { relative: true })
          );
        } else if (element.edit.type & BulkFileOperationType.Create) {
          return localize(
            "aria.createAndEdit",
            "Creating {0}, also making text edits",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        } else if (element.edit.type & BulkFileOperationType.Delete) {
          return localize(
            "aria.deleteAndEdit",
            "Deleting {0}, also making text edits",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        } else {
          return localize(
            "aria.editOnly",
            "{0}, making text edits",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        }
      } else {
        if (element.edit.type & BulkFileOperationType.Rename && element.edit.newUri) {
          return localize(
            "aria.rename",
            "Renaming {0} to {1}",
            this._labelService.getUriLabel(element.edit.uri, { relative: true }),
            this._labelService.getUriLabel(element.edit.newUri, { relative: true })
          );
        } else if (element.edit.type & BulkFileOperationType.Create) {
          return localize(
            "aria.create",
            "Creating {0}",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        } else if (element.edit.type & BulkFileOperationType.Delete) {
          return localize(
            "aria.delete",
            "Deleting {0}",
            this._labelService.getUriLabel(element.edit.uri, { relative: true })
          );
        }
      }
    }
    if (element instanceof TextEditElement) {
      if (element.selecting.length > 0 && element.inserting.length > 0) {
        return localize("aria.replace", "line {0}, replacing {1} with {2}", element.edit.textEdit.textEdit.range.startLineNumber, element.selecting, element.inserting);
      } else if (element.selecting.length > 0 && element.inserting.length === 0) {
        return localize("aria.del", "line {0}, removing {1}", element.edit.textEdit.textEdit.range.startLineNumber, element.selecting);
      } else if (element.selecting.length === 0 && element.inserting.length > 0) {
        return localize("aria.insert", "line {0}, inserting {1}", element.edit.textEdit.textEdit.range.startLineNumber, element.selecting);
      }
    }
    return null;
  }
};
BulkEditAccessibilityProvider = __decorateClass([
  __decorateParam(0, ILabelService)
], BulkEditAccessibilityProvider);
class BulkEditIdentityProvider {
  getId(element) {
    if (element instanceof FileElement) {
      return element.edit.uri + (element.parent instanceof CategoryElement ? JSON.stringify(element.parent.category.metadata) : "");
    } else if (element instanceof TextEditElement) {
      return element.parent.edit.uri.toString() + element.idx;
    } else {
      return JSON.stringify(element.category.metadata);
    }
  }
}
class CategoryElementTemplate {
  constructor(container) {
    container.classList.add("category");
    this.icon = document.createElement("div");
    container.appendChild(this.icon);
    this.label = new IconLabel(container);
  }
}
let CategoryElementRenderer = class {
  constructor(_themeService) {
    this._themeService = _themeService;
    this.templateId = CategoryElementRenderer.id;
  }
  static {
    this.id = "CategoryElementRenderer";
  }
  renderTemplate(container) {
    return new CategoryElementTemplate(container);
  }
  renderElement(node, _index, template) {
    template.icon.style.setProperty("--background-dark", null);
    template.icon.style.setProperty("--background-light", null);
    template.icon.style.color = "";
    const { metadata } = node.element.category;
    if (ThemeIcon.isThemeIcon(metadata.iconPath)) {
      const className = ThemeIcon.asClassName(metadata.iconPath);
      template.icon.className = className ? `theme-icon ${className}` : "";
      template.icon.style.color = metadata.iconPath.color ? this._themeService.getColorTheme().getColor(metadata.iconPath.color.id)?.toString() ?? "" : "";
    } else if (URI.isUri(metadata.iconPath)) {
      template.icon.className = "uri-icon";
      template.icon.style.setProperty("--background-dark", css.asCSSUrl(metadata.iconPath));
      template.icon.style.setProperty("--background-light", css.asCSSUrl(metadata.iconPath));
    } else if (metadata.iconPath) {
      template.icon.className = "uri-icon";
      template.icon.style.setProperty("--background-dark", css.asCSSUrl(metadata.iconPath.dark));
      template.icon.style.setProperty("--background-light", css.asCSSUrl(metadata.iconPath.light));
    }
    template.label.setLabel(metadata.label, metadata.description, {
      descriptionMatches: createMatches(node.filterData)
    });
  }
  disposeTemplate(template) {
    template.label.dispose();
  }
};
CategoryElementRenderer = __decorateClass([
  __decorateParam(0, IThemeService)
], CategoryElementRenderer);
let FileElementTemplate = class {
  constructor(container, resourceLabels, _labelService) {
    this._labelService = _labelService;
    this._disposables = new DisposableStore();
    this._localDisposables = new DisposableStore();
    this._checkbox = this._disposables.add(new Checkbox("", false, defaultCheckboxStyles));
    this._checkbox.domNode.classList.add("edit-checkbox");
    this._checkbox.domNode.tabIndex = -1;
    container.appendChild(this._checkbox.domNode);
    this._label = resourceLabels.create(container, { supportHighlights: true });
    this._details = document.createElement("span");
    this._details.className = "details";
    container.appendChild(this._details);
  }
  dispose() {
    this._localDisposables.dispose();
    this._disposables.dispose();
    this._label.dispose();
  }
  set(element, score) {
    this._localDisposables.clear();
    this._checkbox.checked = element.isChecked();
    if (element.isDisabled()) {
      this._checkbox.disable();
    } else {
      this._checkbox.enable();
    }
    this._checkbox.domNode.tabIndex = -1;
    this._localDisposables.add(this._checkbox.onChange(() => {
      element.setChecked(this._checkbox.checked);
    }));
    if (element.edit.type & BulkFileOperationType.Rename && element.edit.newUri) {
      this._label.setResource({
        resource: element.edit.uri,
        name: localize("rename.label", "{0} \u2192 {1}", this._labelService.getUriLabel(element.edit.uri, { relative: true }), this._labelService.getUriLabel(element.edit.newUri, { relative: true }))
      }, {
        fileDecorations: { colors: true, badges: false }
      });
      this._details.innerText = localize("detail.rename", "(renaming)");
    } else {
      const options = {
        matches: createMatches(score),
        fileKind: FileKind.FILE,
        fileDecorations: { colors: true, badges: false },
        extraClasses: []
      };
      if (element.edit.type & BulkFileOperationType.Create) {
        this._details.innerText = localize("detail.create", "(creating)");
      } else if (element.edit.type & BulkFileOperationType.Delete) {
        this._details.innerText = localize("detail.del", "(deleting)");
        options.extraClasses.push("delete");
      } else {
        this._details.innerText = "";
      }
      this._label.setFile(element.edit.uri, options);
    }
  }
};
FileElementTemplate = __decorateClass([
  __decorateParam(2, ILabelService)
], FileElementTemplate);
let FileElementRenderer = class {
  constructor(_resourceLabels, _labelService) {
    this._resourceLabels = _resourceLabels;
    this._labelService = _labelService;
    this.templateId = FileElementRenderer.id;
  }
  static {
    this.id = "FileElementRenderer";
  }
  renderTemplate(container) {
    return new FileElementTemplate(container, this._resourceLabels, this._labelService);
  }
  renderElement(node, _index, template) {
    template.set(node.element, node.filterData);
  }
  disposeTemplate(template) {
    template.dispose();
  }
};
FileElementRenderer = __decorateClass([
  __decorateParam(1, ILabelService)
], FileElementRenderer);
let TextEditElementTemplate = class {
  constructor(container, _themeService) {
    this._themeService = _themeService;
    this._disposables = new DisposableStore();
    this._localDisposables = new DisposableStore();
    container.classList.add("textedit");
    this._checkbox = this._disposables.add(new Checkbox("", false, defaultCheckboxStyles));
    this._checkbox.domNode.classList.add("edit-checkbox");
    this._checkbox.domNode.tabIndex = -1;
    container.appendChild(this._checkbox.domNode);
    this._icon = document.createElement("div");
    container.appendChild(this._icon);
    this._label = this._disposables.add(new HighlightedLabel(container));
  }
  dispose() {
    this._localDisposables.dispose();
    this._disposables.dispose();
  }
  set(element) {
    this._localDisposables.clear();
    this._localDisposables.add(this._checkbox.onChange(() => {
      element.setChecked(this._checkbox.checked);
    }));
    this._checkbox.checked = element.isChecked();
    if (element.isDisabled()) {
      this._checkbox.disable();
    } else {
      this._checkbox.enable();
    }
    this._checkbox.domNode.tabIndex = -1;
    let value = "";
    value += element.prefix;
    value += element.selecting;
    value += element.inserting;
    value += element.suffix;
    const selectHighlight = { start: element.prefix.length, end: element.prefix.length + element.selecting.length, extraClasses: ["remove"] };
    const insertHighlight = { start: selectHighlight.end, end: selectHighlight.end + element.inserting.length, extraClasses: ["insert"] };
    let title;
    const { metadata } = element.edit.textEdit;
    if (metadata && metadata.description) {
      title = localize("title", "{0} - {1}", metadata.label, metadata.description);
    } else if (metadata) {
      title = metadata.label;
    }
    const iconPath = metadata?.iconPath;
    if (!iconPath) {
      this._icon.style.display = "none";
    } else {
      this._icon.style.display = "block";
      this._icon.style.setProperty("--background-dark", null);
      this._icon.style.setProperty("--background-light", null);
      if (ThemeIcon.isThemeIcon(iconPath)) {
        const className = ThemeIcon.asClassName(iconPath);
        this._icon.className = className ? `theme-icon ${className}` : "";
        this._icon.style.color = iconPath.color ? this._themeService.getColorTheme().getColor(iconPath.color.id)?.toString() ?? "" : "";
      } else if (URI.isUri(iconPath)) {
        this._icon.className = "uri-icon";
        this._icon.style.setProperty("--background-dark", css.asCSSUrl(iconPath));
        this._icon.style.setProperty("--background-light", css.asCSSUrl(iconPath));
      } else {
        this._icon.className = "uri-icon";
        this._icon.style.setProperty("--background-dark", css.asCSSUrl(iconPath.dark));
        this._icon.style.setProperty("--background-light", css.asCSSUrl(iconPath.light));
      }
    }
    this._label.set(value, [selectHighlight, insertHighlight], title, true);
    this._icon.title = title || "";
  }
};
TextEditElementTemplate = __decorateClass([
  __decorateParam(1, IThemeService)
], TextEditElementTemplate);
let TextEditElementRenderer = class {
  constructor(_themeService) {
    this._themeService = _themeService;
    this.templateId = TextEditElementRenderer.id;
  }
  static {
    this.id = "TextEditElementRenderer";
  }
  renderTemplate(container) {
    return new TextEditElementTemplate(container, this._themeService);
  }
  renderElement({ element }, _index, template) {
    template.set(element);
  }
  disposeTemplate(template) {
    template.dispose();
  }
};
TextEditElementRenderer = __decorateClass([
  __decorateParam(0, IThemeService)
], TextEditElementRenderer);
class BulkEditDelegate {
  getHeight() {
    return 23;
  }
  getTemplateId(element) {
    if (element instanceof FileElement) {
      return FileElementRenderer.id;
    } else if (element instanceof TextEditElement) {
      return TextEditElementRenderer.id;
    } else {
      return CategoryElementRenderer.id;
    }
  }
}
class BulkEditNaviLabelProvider {
  getKeyboardNavigationLabel(element) {
    if (element instanceof FileElement) {
      return basename(element.edit.uri);
    } else if (element instanceof CategoryElement) {
      return element.category.metadata.label;
    }
    return void 0;
  }
}
export {
  BulkEditAccessibilityProvider,
  BulkEditDataSource,
  BulkEditDelegate,
  BulkEditIdentityProvider,
  BulkEditNaviLabelProvider,
  BulkEditSorter,
  CategoryElement,
  CategoryElementRenderer,
  FileElement,
  FileElementRenderer,
  TextEditElement,
  TextEditElementRenderer,
  compareBulkFileOperations
};
