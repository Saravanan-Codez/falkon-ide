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
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../../base/common/map.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../../../common/contributions.js";
import { CHANGE_CELL_LANGUAGE, DETECT_CELL_LANGUAGE } from "../../notebookBrowser.js";
import { INotebookCellStatusBarService } from "../../../common/notebookCellStatusBarService.js";
import { CellKind, CellStatusbarAlignment } from "../../../common/notebookCommon.js";
import { INotebookKernelService } from "../../../common/notebookKernelService.js";
import { INotebookService } from "../../../common/notebookService.js";
import { ILanguageDetectionService } from "../../../../../services/languageDetection/common/languageDetectionWorkerService.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
let CellStatusBarLanguagePickerProvider = class {
  constructor(_notebookService, _languageService) {
    this._notebookService = _notebookService;
    this._languageService = _languageService;
    this.viewType = "*";
  }
  async provideCellStatusBarItems(uri, index, _token) {
    const doc = this._notebookService.getNotebookTextModel(uri);
    const cell = doc?.cells[index];
    if (!cell) {
      return;
    }
    const statusBarItems = [];
    let displayLanguage = cell.language;
    if (cell.cellKind === CellKind.Markup) {
      displayLanguage = "markdown";
    } else {
      const registeredId = this._languageService.getLanguageIdByLanguageName(cell.language);
      if (registeredId) {
        displayLanguage = this._languageService.getLanguageName(displayLanguage) ?? displayLanguage;
      } else {
        const searchTooltip = localize("notebook.cell.status.searchLanguageExtensions", "Unknown cell language. Click to search for '{0}' extensions", cell.language);
        statusBarItems.push({
          text: `$(dialog-warning)`,
          command: { id: "workbench.extensions.search", arguments: [`@tag:${cell.language}`], title: "Search Extensions" },
          tooltip: searchTooltip,
          alignment: CellStatusbarAlignment.Right,
          priority: -Number.MAX_SAFE_INTEGER + 1
        });
      }
    }
    statusBarItems.push({
      text: displayLanguage,
      command: CHANGE_CELL_LANGUAGE,
      tooltip: localize("notebook.cell.status.language", "Select Cell Language Mode"),
      alignment: CellStatusbarAlignment.Right,
      priority: -Number.MAX_SAFE_INTEGER
    });
    return {
      items: statusBarItems
    };
  }
};
CellStatusBarLanguagePickerProvider = __decorateClass([
  __decorateParam(0, INotebookService),
  __decorateParam(1, ILanguageService)
], CellStatusBarLanguagePickerProvider);
let CellStatusBarLanguageDetectionProvider = class {
  constructor(_notebookService, _notebookKernelService, _languageService, _configurationService, _languageDetectionService, _keybindingService) {
    this._notebookService = _notebookService;
    this._notebookKernelService = _notebookKernelService;
    this._languageService = _languageService;
    this._configurationService = _configurationService;
    this._languageDetectionService = _languageDetectionService;
    this._keybindingService = _keybindingService;
    this.viewType = "*";
    this.cache = new ResourceMap();
  }
  async provideCellStatusBarItems(uri, index, token) {
    const doc = this._notebookService.getNotebookTextModel(uri);
    const cell = doc?.cells[index];
    if (!cell) {
      return;
    }
    const enablementConfig = this._configurationService.getValue("workbench.editor.languageDetectionHints");
    const enabled = typeof enablementConfig === "object" && enablementConfig?.notebookEditors;
    if (!enabled) {
      return;
    }
    const cellUri = cell.uri;
    const contentVersion = cell.textModel?.getVersionId();
    if (!contentVersion) {
      return;
    }
    const currentLanguageId = cell.cellKind === CellKind.Markup ? "markdown" : this._languageService.getLanguageIdByLanguageName(cell.language) || cell.language;
    if (!this.cache.has(cellUri)) {
      this.cache.set(cellUri, {
        cellLanguage: currentLanguageId,
        // force a re-compute upon a change in configured language
        updateTimestamp: 0,
        // facilitates a disposable-free debounce operation
        contentVersion: 1
        // dont run for the initial contents, only on update
      });
    }
    const cached = this.cache.get(cellUri);
    if (cached.cellLanguage !== currentLanguageId || cached.updateTimestamp < Date.now() - 1e3 && cached.contentVersion !== contentVersion) {
      cached.updateTimestamp = Date.now();
      cached.cellLanguage = currentLanguageId;
      cached.contentVersion = contentVersion;
      const kernel = this._notebookKernelService.getSelectedOrSuggestedKernel(doc);
      if (kernel) {
        const supportedLangs = [...kernel.supportedLanguages, "markdown"];
        cached.guess = await this._languageDetectionService.detectLanguage(cell.uri, supportedLangs);
      }
    }
    const items = [];
    if (cached.guess && currentLanguageId !== cached.guess) {
      const detectedName = this._languageService.getLanguageName(cached.guess) || cached.guess;
      const tooltip = this._keybindingService.appendKeybinding(
        localize("notebook.cell.status.autoDetectLanguage", "Accept Detected Language: {0}", detectedName),
        DETECT_CELL_LANGUAGE
      );
      items.push({
        text: "$(lightbulb-autofix)",
        command: DETECT_CELL_LANGUAGE,
        tooltip,
        alignment: CellStatusbarAlignment.Right,
        priority: -Number.MAX_SAFE_INTEGER + 1
      });
    }
    return { items };
  }
};
CellStatusBarLanguageDetectionProvider = __decorateClass([
  __decorateParam(0, INotebookService),
  __decorateParam(1, INotebookKernelService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, ILanguageDetectionService),
  __decorateParam(5, IKeybindingService)
], CellStatusBarLanguageDetectionProvider);
let BuiltinCellStatusBarProviders = class extends Disposable {
  constructor(instantiationService, notebookCellStatusBarService) {
    super();
    const builtinProviders = [
      CellStatusBarLanguagePickerProvider,
      CellStatusBarLanguageDetectionProvider
    ];
    builtinProviders.forEach((p) => {
      this._register(notebookCellStatusBarService.registerCellStatusBarItemProvider(instantiationService.createInstance(p)));
    });
  }
};
BuiltinCellStatusBarProviders = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, INotebookCellStatusBarService)
], BuiltinCellStatusBarProviders);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(BuiltinCellStatusBarProviders, LifecyclePhase.Restored);
