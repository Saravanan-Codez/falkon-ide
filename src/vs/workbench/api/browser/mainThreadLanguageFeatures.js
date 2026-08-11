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
import { createStringDataTransferItem, VSDataTransfer } from "../../../base/common/dataTransfer.js";
import { CancellationError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { HierarchicalKind } from "../../../base/common/hierarchicalKind.js";
import { combinedDisposable, Disposable, DisposableMap, toDisposable } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { revive } from "../../../base/common/marshalling.js";
import { mixin } from "../../../base/common/objects.js";
import { URI } from "../../../base/common/uri.js";
import * as languages from "../../../editor/common/languages.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { ILanguageConfigurationService } from "../../../editor/common/languages/languageConfigurationRegistry.js";
import { ILanguageFeaturesService } from "../../../editor/common/services/languageFeatures.js";
import { decodeSemanticTokensDto } from "../../../editor/common/services/semanticTokensDto.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { reviveWorkspaceEditDto } from "./mainThreadBulkEdits.js";
import * as typeConvert from "../common/extHostTypeConverters.js";
import { DataTransferFileCache } from "../common/shared/dataTransferCache.js";
import * as callh from "../../contrib/callHierarchy/common/callHierarchy.js";
import * as search from "../../contrib/search/common/search.js";
import * as typeh from "../../contrib/typeHierarchy/common/typeHierarchy.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, ISuggestDataDtoField, ISuggestResultDtoField, MainContext } from "../common/extHost.protocol.js";
import { InlineCompletionEndOfLifeReasonKind } from "../common/extHostTypes.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { DataChannelForwardingTelemetryService, forwardToChannelIf, isCopilotLikeExtension } from "../../../platform/dataChannel/browser/forwardingTelemetryService.js";
import { IAiEditTelemetryService } from "../../contrib/editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js";
import { EditDeltaInfo } from "../../../editor/common/textModelEditSource.js";
import { IInlineCompletionsUnificationService } from "../../services/inlineCompletions/common/inlineCompletionsUnification.js";
import { sendInlineCompletionsEndOfLifeTelemetry } from "../../../editor/contrib/inlineCompletions/browser/telemetry.js";
let MainThreadLanguageFeatures = class extends Disposable {
  constructor(extHostContext, _languageService, _languageConfigurationService, _languageFeaturesService, _uriIdentService, _instantiationService, _inlineCompletionsUnificationService) {
    super();
    this._languageService = _languageService;
    this._languageConfigurationService = _languageConfigurationService;
    this._languageFeaturesService = _languageFeaturesService;
    this._uriIdentService = _uriIdentService;
    this._instantiationService = _instantiationService;
    this._inlineCompletionsUnificationService = _inlineCompletionsUnificationService;
    this._registrations = this._register(new DisposableMap());
    // --- copy paste action provider
    this._pasteEditProviders = /* @__PURE__ */ new Map();
    // --- document drop Edits
    this._documentOnDropEditProviders = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostLanguageFeatures);
    if (this._languageService) {
      const updateAllWordDefinitions = () => {
        const wordDefinitionDtos = [];
        for (const languageId of _languageService.getRegisteredLanguageIds()) {
          const wordDefinition = this._languageConfigurationService.getLanguageConfiguration(languageId).getWordDefinition();
          wordDefinitionDtos.push({
            languageId,
            regexSource: wordDefinition.source,
            regexFlags: wordDefinition.flags
          });
        }
        this._proxy.$setWordDefinitions(wordDefinitionDtos);
      };
      this._register(this._languageConfigurationService.onDidChange((e) => {
        if (!e.languageId) {
          updateAllWordDefinitions();
        } else {
          const wordDefinition = this._languageConfigurationService.getLanguageConfiguration(e.languageId).getWordDefinition();
          this._proxy.$setWordDefinitions([{
            languageId: e.languageId,
            regexSource: wordDefinition.source,
            regexFlags: wordDefinition.flags
          }]);
        }
      }));
      updateAllWordDefinitions();
    }
    if (this._inlineCompletionsUnificationService) {
      this._register(this._inlineCompletionsUnificationService.onDidStateChange(() => {
        this._proxy.$acceptInlineCompletionsUnificationState(this._inlineCompletionsUnificationService.state);
      }));
      this._proxy.$acceptInlineCompletionsUnificationState(this._inlineCompletionsUnificationService.state);
    }
  }
  $unregister(handle) {
    this._registrations.deleteAndDispose(handle);
  }
  static _reviveLocationDto(data) {
    if (!data) {
      return data;
    } else if (Array.isArray(data)) {
      data.forEach((l) => MainThreadLanguageFeatures._reviveLocationDto(l));
      return data;
    } else {
      data.uri = URI.revive(data.uri);
      return data;
    }
  }
  static _reviveLocationLinkDto(data) {
    if (!data) {
      return data;
    } else if (Array.isArray(data)) {
      data.forEach((l) => MainThreadLanguageFeatures._reviveLocationLinkDto(l));
      return data;
    } else {
      data.uri = URI.revive(data.uri);
      return data;
    }
  }
  static _reviveWorkspaceSymbolDto(data) {
    if (!data) {
      return data;
    } else if (Array.isArray(data)) {
      data.forEach(MainThreadLanguageFeatures._reviveWorkspaceSymbolDto);
      return data;
    } else {
      data.location = MainThreadLanguageFeatures._reviveLocationDto(data.location);
      return data;
    }
  }
  static _reviveCodeActionDto(data, uriIdentService) {
    data?.forEach((code) => reviveWorkspaceEditDto(code.edit, uriIdentService));
    return data;
  }
  static _reviveLinkDTO(data) {
    if (data.url && typeof data.url !== "string") {
      data.url = URI.revive(data.url);
    }
    return data;
  }
  static _reviveCallHierarchyItemDto(data) {
    if (data) {
      data.uri = URI.revive(data.uri);
    }
    return data;
  }
  static _reviveTypeHierarchyItemDto(data) {
    if (data) {
      data.uri = URI.revive(data.uri);
    }
    return data;
  }
  //#endregion
  // --- outline
  $registerDocumentSymbolProvider(handle, selector, displayName) {
    this._registrations.set(handle, this._languageFeaturesService.documentSymbolProvider.register(selector, {
      displayName,
      provideDocumentSymbols: (model, token) => {
        return this._proxy.$provideDocumentSymbols(handle, model.uri, token);
      }
    }));
  }
  // --- code lens
  $registerCodeLensSupport(handle, selector, eventHandle) {
    const provider = {
      provideCodeLenses: async (model, token) => {
        const listDto = await this._proxy.$provideCodeLenses(handle, model.uri, token);
        if (!listDto) {
          return void 0;
        }
        return {
          lenses: listDto.lenses,
          dispose: () => listDto.cacheId && this._proxy.$releaseCodeLenses(handle, listDto.cacheId)
        };
      },
      resolveCodeLens: async (model, codeLens, token) => {
        const result = await this._proxy.$resolveCodeLens(handle, codeLens, token);
        if (!result || token.isCancellationRequested) {
          return void 0;
        }
        return {
          ...result,
          range: model.validateRange(result.range)
        };
      }
    };
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      provider.onDidChange = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.codeLensProvider.register(selector, provider));
  }
  $emitCodeLensEvent(eventHandle, event) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  // --- declaration
  $registerDefinitionSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.definitionProvider.register(selector, {
      provideDefinition: (model, position, token) => {
        return this._proxy.$provideDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
      }
    }));
  }
  $registerDeclarationSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.declarationProvider.register(selector, {
      provideDeclaration: (model, position, token) => {
        return this._proxy.$provideDeclaration(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
      }
    }));
  }
  $registerImplementationSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.implementationProvider.register(selector, {
      provideImplementation: (model, position, token) => {
        return this._proxy.$provideImplementation(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
      }
    }));
  }
  $registerTypeDefinitionSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.typeDefinitionProvider.register(selector, {
      provideTypeDefinition: (model, position, token) => {
        return this._proxy.$provideTypeDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
      }
    }));
  }
  // --- extra info
  $registerHoverProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.hoverProvider.register(selector, {
      provideHover: async (model, position, token, context) => {
        const serializedContext = {
          verbosityRequest: context?.verbosityRequest ? {
            verbosityDelta: context.verbosityRequest.verbosityDelta,
            previousHover: { id: context.verbosityRequest.previousHover.id }
          } : void 0
        };
        const hover = await this._proxy.$provideHover(handle, model.uri, position, serializedContext, token);
        return hover;
      }
    }));
  }
  // --- debug hover
  $registerEvaluatableExpressionProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.evaluatableExpressionProvider.register(selector, {
      provideEvaluatableExpression: (model, position, token) => {
        return this._proxy.$provideEvaluatableExpression(handle, model.uri, position, token);
      }
    }));
  }
  // --- inline values
  $registerInlineValuesProvider(handle, selector, eventHandle) {
    const provider = {
      provideInlineValues: (model, viewPort, context, token) => {
        return this._proxy.$provideInlineValues(handle, model.uri, viewPort, context, token);
      }
    };
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      provider.onDidChangeInlineValues = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.inlineValuesProvider.register(selector, provider));
  }
  $emitInlineValuesEvent(eventHandle, event) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  // --- occurrences
  $registerDocumentHighlightProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.documentHighlightProvider.register(selector, {
      provideDocumentHighlights: (model, position, token) => {
        return this._proxy.$provideDocumentHighlights(handle, model.uri, position, token);
      }
    }));
  }
  $registerMultiDocumentHighlightProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.multiDocumentHighlightProvider.register(selector, {
      selector,
      provideMultiDocumentHighlights: (model, position, otherModels, token) => {
        return this._proxy.$provideMultiDocumentHighlights(handle, model.uri, position, otherModels.map((model2) => model2.uri), token).then((dto) => {
          if (dto === void 0 || dto === null) {
            return void 0;
          }
          const result = new ResourceMap();
          dto?.forEach((value) => {
            const uri = URI.revive(value.uri);
            if (result.has(uri)) {
              result.get(uri).push(...value.highlights);
            } else {
              result.set(uri, value.highlights);
            }
          });
          return result;
        });
      }
    }));
  }
  // --- linked editing
  $registerLinkedEditingRangeProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.linkedEditingRangeProvider.register(selector, {
      provideLinkedEditingRanges: async (model, position, token) => {
        const res = await this._proxy.$provideLinkedEditingRanges(handle, model.uri, position, token);
        if (res) {
          return {
            ranges: res.ranges,
            wordPattern: res.wordPattern ? MainThreadLanguageFeatures._reviveRegExp(res.wordPattern) : void 0
          };
        }
        return void 0;
      }
    }));
  }
  // --- references
  $registerReferenceSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.referenceProvider.register(selector, {
      provideReferences: (model, position, context, token) => {
        return this._proxy.$provideReferences(handle, model.uri, position, context, token).then(MainThreadLanguageFeatures._reviveLocationDto);
      }
    }));
  }
  // --- code actions
  $registerCodeActionSupport(handle, selector, metadata, displayName, extensionId, supportsResolve) {
    const provider = {
      provideCodeActions: async (model, rangeOrSelection, context, token) => {
        const listDto = await this._proxy.$provideCodeActions(handle, model.uri, rangeOrSelection, context, token);
        if (!listDto) {
          return void 0;
        }
        return {
          actions: MainThreadLanguageFeatures._reviveCodeActionDto(listDto.actions, this._uriIdentService),
          dispose: () => {
            if (typeof listDto.cacheId === "number") {
              this._proxy.$releaseCodeActions(handle, listDto.cacheId);
            }
          }
        };
      },
      providedCodeActionKinds: metadata.providedKinds,
      documentation: metadata.documentation,
      displayName,
      extensionId
    };
    if (supportsResolve) {
      provider.resolveCodeAction = async (codeAction, token) => {
        const resolved = await this._proxy.$resolveCodeAction(handle, codeAction.cacheId, token);
        if (resolved.edit) {
          codeAction.edit = reviveWorkspaceEditDto(resolved.edit, this._uriIdentService);
        }
        if (resolved.command) {
          codeAction.command = resolved.command;
        }
        return codeAction;
      };
    }
    this._registrations.set(handle, this._languageFeaturesService.codeActionProvider.register(selector, provider));
  }
  $registerPasteEditProvider(handle, selector, metadata) {
    const provider = new MainThreadPasteEditProvider(handle, this._proxy, metadata, this._uriIdentService);
    this._pasteEditProviders.set(handle, provider);
    this._registrations.set(handle, combinedDisposable(
      this._languageFeaturesService.documentPasteEditProvider.register(selector, provider),
      toDisposable(() => this._pasteEditProviders.delete(handle))
    ));
  }
  $resolvePasteFileData(handle, requestId, dataId) {
    const provider = this._pasteEditProviders.get(handle);
    if (!provider) {
      throw new Error("Could not find provider");
    }
    return provider.resolveFileData(requestId, dataId);
  }
  // --- formatting
  $registerDocumentFormattingSupport(handle, selector, extensionId, displayName) {
    this._registrations.set(handle, this._languageFeaturesService.documentFormattingEditProvider.register(selector, {
      extensionId,
      displayName,
      provideDocumentFormattingEdits: (model, options, token) => {
        return this._proxy.$provideDocumentFormattingEdits(handle, model.uri, options, token);
      }
    }));
  }
  $registerRangeFormattingSupport(handle, selector, extensionId, displayName, supportsRanges) {
    this._registrations.set(handle, this._languageFeaturesService.documentRangeFormattingEditProvider.register(selector, {
      extensionId,
      displayName,
      provideDocumentRangeFormattingEdits: (model, range, options, token) => {
        return this._proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options, token);
      },
      provideDocumentRangesFormattingEdits: !supportsRanges ? void 0 : (model, ranges, options, token) => {
        return this._proxy.$provideDocumentRangesFormattingEdits(handle, model.uri, ranges, options, token);
      }
    }));
  }
  $registerOnTypeFormattingSupport(handle, selector, autoFormatTriggerCharacters, extensionId) {
    this._registrations.set(handle, this._languageFeaturesService.onTypeFormattingEditProvider.register(selector, {
      extensionId,
      autoFormatTriggerCharacters,
      provideOnTypeFormattingEdits: (model, position, ch, options, token) => {
        return this._proxy.$provideOnTypeFormattingEdits(handle, model.uri, position, ch, options, token);
      }
    }));
  }
  // --- navigate type
  $registerNavigateTypeSupport(handle, supportsResolve) {
    let lastResultId;
    const provider = {
      provideWorkspaceSymbols: async (search2, token) => {
        const result = await this._proxy.$provideWorkspaceSymbols(handle, search2, token);
        if (lastResultId !== void 0) {
          this._proxy.$releaseWorkspaceSymbols(handle, lastResultId);
        }
        lastResultId = result.cacheId;
        return MainThreadLanguageFeatures._reviveWorkspaceSymbolDto(result.symbols);
      }
    };
    if (supportsResolve) {
      provider.resolveWorkspaceSymbol = async (item, token) => {
        const resolvedItem = await this._proxy.$resolveWorkspaceSymbol(handle, item, token);
        return resolvedItem && MainThreadLanguageFeatures._reviveWorkspaceSymbolDto(resolvedItem);
      };
    }
    this._registrations.set(handle, search.WorkspaceSymbolProviderRegistry.register(provider));
  }
  // --- rename
  $registerRenameSupport(handle, selector, supportResolveLocation) {
    this._registrations.set(handle, this._languageFeaturesService.renameProvider.register(selector, {
      provideRenameEdits: (model, position, newName, token) => {
        return this._proxy.$provideRenameEdits(handle, model.uri, position, newName, token).then((data) => reviveWorkspaceEditDto(data, this._uriIdentService));
      },
      resolveRenameLocation: supportResolveLocation ? (model, position, token) => this._proxy.$resolveRenameLocation(handle, model.uri, position, token) : void 0
    }));
  }
  $registerNewSymbolNamesProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.newSymbolNamesProvider.register(selector, {
      supportsAutomaticNewSymbolNamesTriggerKind: this._proxy.$supportsAutomaticNewSymbolNamesTriggerKind(handle),
      provideNewSymbolNames: (model, range, triggerKind, token) => {
        return this._proxy.$provideNewSymbolNames(handle, model.uri, range, triggerKind, token);
      }
    }));
  }
  // --- semantic tokens
  $registerDocumentSemanticTokensProvider(handle, selector, legend, eventHandle) {
    let event = void 0;
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      event = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.documentSemanticTokensProvider.register(selector, new MainThreadDocumentSemanticTokensProvider(this._proxy, handle, legend, event)));
  }
  $emitDocumentSemanticTokensEvent(eventHandle) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(void 0);
    }
  }
  $emitDocumentRangeSemanticTokensEvent(eventHandle) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(void 0);
    }
  }
  $registerDocumentRangeSemanticTokensProvider(handle, selector, legend, eventHandle) {
    let event = void 0;
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      event = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.documentRangeSemanticTokensProvider.register(selector, new MainThreadDocumentRangeSemanticTokensProvider(this._proxy, handle, legend, event)));
  }
  // --- suggest
  static _inflateSuggestDto(defaultRange, data, extensionId) {
    const label = data[ISuggestDataDtoField.label];
    const commandId = data[ISuggestDataDtoField.commandId];
    const commandIdent = data[ISuggestDataDtoField.commandIdent];
    const commitChars = data[ISuggestDataDtoField.commitCharacters];
    let command;
    if (commandId) {
      command = {
        $ident: commandIdent,
        id: commandId,
        title: "",
        arguments: commandIdent ? [commandIdent] : data[ISuggestDataDtoField.commandArguments]
        // Automatically fill in ident as first argument
      };
    }
    return {
      label,
      extensionId,
      kind: data[ISuggestDataDtoField.kind] ?? languages.CompletionItemKind.Property,
      tags: data[ISuggestDataDtoField.kindModifier],
      detail: data[ISuggestDataDtoField.detail],
      documentation: data[ISuggestDataDtoField.documentation],
      sortText: data[ISuggestDataDtoField.sortText],
      filterText: data[ISuggestDataDtoField.filterText],
      preselect: data[ISuggestDataDtoField.preselect],
      insertText: data[ISuggestDataDtoField.insertText] ?? (typeof label === "string" ? label : label.label),
      range: data[ISuggestDataDtoField.range] ?? defaultRange,
      insertTextRules: data[ISuggestDataDtoField.insertTextRules],
      commitCharacters: commitChars ? Array.from(commitChars) : void 0,
      additionalTextEdits: data[ISuggestDataDtoField.additionalTextEdits],
      command,
      // not-standard
      _id: data.x
    };
  }
  $registerCompletionsProvider(handle, selector, triggerCharacters, supportsResolveDetails, extensionId) {
    const provider = {
      triggerCharacters,
      _debugDisplayName: `${extensionId.value}(${triggerCharacters.join("")})`,
      provideCompletionItems: async (model, position, context, token) => {
        const result = await this._proxy.$provideCompletionItems(handle, model.uri, position, context, token);
        if (!result) {
          return result;
        }
        return {
          suggestions: result[ISuggestResultDtoField.completions].map((d) => MainThreadLanguageFeatures._inflateSuggestDto(result[ISuggestResultDtoField.defaultRanges], d, extensionId)),
          incomplete: result[ISuggestResultDtoField.isIncomplete] || false,
          duration: result[ISuggestResultDtoField.duration],
          dispose: () => {
            if (typeof result.x === "number") {
              this._proxy.$releaseCompletionItems(handle, result.x);
            }
          }
        };
      }
    };
    if (supportsResolveDetails) {
      provider.resolveCompletionItem = (suggestion, token) => {
        return this._proxy.$resolveCompletionItem(handle, suggestion._id, token).then((result) => {
          if (!result) {
            return suggestion;
          }
          const newSuggestion = MainThreadLanguageFeatures._inflateSuggestDto(suggestion.range, result, extensionId);
          return mixin(suggestion, newSuggestion, true);
        });
      };
    }
    this._registrations.set(handle, this._languageFeaturesService.completionProvider.register(selector, provider));
  }
  $registerInlineCompletionsSupport(handle, selector, supportsHandleEvents, extensionId, extensionVersion, groupId, yieldsToExtensionIds, displayName, debounceDelayMs, excludesExtensionIds, supportsOnDidChange, supportsSetModelId, initialModelInfo, supportsOnDidChangeModelInfo, supportsSetProviderOption, initialProviderOptions, supportsOnDidChangeProviderOptions) {
    const providerId = new languages.ProviderId(extensionId, extensionVersion, groupId);
    const provider = this._instantiationService.createInstance(
      ExtensionBackedInlineCompletionsProvider,
      handle,
      groupId ?? extensionId,
      providerId,
      yieldsToExtensionIds,
      excludesExtensionIds,
      debounceDelayMs,
      displayName,
      initialModelInfo,
      supportsHandleEvents,
      supportsSetModelId,
      supportsOnDidChange,
      supportsOnDidChangeModelInfo,
      initialProviderOptions,
      supportsSetProviderOption,
      supportsOnDidChangeProviderOptions,
      selector,
      this._proxy
    );
    this._registrations.set(handle, provider);
  }
  $emitInlineCompletionsChange(handle, changeHint) {
    const obj = this._registrations.get(handle);
    if (obj instanceof ExtensionBackedInlineCompletionsProvider) {
      obj._emitDidChange(changeHint);
    }
  }
  $emitInlineCompletionModelInfoChange(handle, data) {
    const obj = this._registrations.get(handle);
    if (obj instanceof ExtensionBackedInlineCompletionsProvider) {
      obj._setModelInfo(data);
    }
  }
  $emitInlineCompletionProviderOptionsChange(handle, data) {
    const obj = this._registrations.get(handle);
    if (obj instanceof ExtensionBackedInlineCompletionsProvider) {
      obj._setProviderOptions(data);
    }
  }
  // --- parameter hints
  $registerSignatureHelpProvider(handle, selector, metadata) {
    this._registrations.set(handle, this._languageFeaturesService.signatureHelpProvider.register(selector, {
      signatureHelpTriggerCharacters: metadata.triggerCharacters,
      signatureHelpRetriggerCharacters: metadata.retriggerCharacters,
      provideSignatureHelp: async (model, position, token, context) => {
        const result = await this._proxy.$provideSignatureHelp(handle, model.uri, position, context, token);
        if (!result) {
          return void 0;
        }
        return {
          value: result,
          dispose: () => {
            this._proxy.$releaseSignatureHelp(handle, result.id);
          }
        };
      }
    }));
  }
  // --- inline hints
  $registerInlayHintsProvider(handle, selector, supportsResolve, eventHandle, displayName) {
    const provider = {
      displayName,
      provideInlayHints: async (model, range, token) => {
        const result = await this._proxy.$provideInlayHints(handle, model.uri, range, token);
        if (!result) {
          return;
        }
        return {
          hints: revive(result.hints),
          dispose: () => {
            if (result.cacheId) {
              this._proxy.$releaseInlayHints(handle, result.cacheId);
            }
          }
        };
      }
    };
    if (supportsResolve) {
      provider.resolveInlayHint = async (hint, token) => {
        const dto = hint;
        if (!dto.cacheId) {
          return hint;
        }
        const result = await this._proxy.$resolveInlayHint(handle, dto.cacheId, token);
        if (token.isCancellationRequested) {
          throw new CancellationError();
        }
        if (!result) {
          return hint;
        }
        return {
          ...hint,
          tooltip: result.tooltip,
          label: revive(result.label),
          textEdits: result.textEdits
        };
      };
    }
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      provider.onDidChangeInlayHints = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.inlayHintsProvider.register(selector, provider));
  }
  $emitInlayHintsEvent(eventHandle) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(void 0);
    }
  }
  // --- links
  $registerDocumentLinkProvider(handle, selector, supportsResolve) {
    const provider = {
      provideLinks: (model, token) => {
        return this._proxy.$provideDocumentLinks(handle, model.uri, token).then((dto) => {
          if (!dto) {
            return void 0;
          }
          return {
            links: dto.links.map(MainThreadLanguageFeatures._reviveLinkDTO),
            dispose: () => {
              if (typeof dto.cacheId === "number") {
                this._proxy.$releaseDocumentLinks(handle, dto.cacheId);
              }
            }
          };
        });
      }
    };
    if (supportsResolve) {
      provider.resolveLink = (link, token) => {
        const dto = link;
        if (!dto.cacheId) {
          return link;
        }
        return this._proxy.$resolveDocumentLink(handle, dto.cacheId, token).then((obj) => {
          return obj && MainThreadLanguageFeatures._reviveLinkDTO(obj);
        });
      };
    }
    this._registrations.set(handle, this._languageFeaturesService.linkProvider.register(selector, provider));
  }
  // --- colors
  $registerDocumentColorProvider(handle, selector) {
    const proxy = this._proxy;
    this._registrations.set(handle, this._languageFeaturesService.colorProvider.register(selector, {
      provideDocumentColors: (model, token) => {
        return proxy.$provideDocumentColors(handle, model.uri, token).then((documentColors) => {
          return documentColors.map((documentColor) => {
            const [red, green, blue, alpha] = documentColor.color;
            const color = {
              red,
              green,
              blue,
              alpha
            };
            return {
              color,
              range: documentColor.range
            };
          });
        });
      },
      provideColorPresentations: (model, colorInfo, token) => {
        return proxy.$provideColorPresentations(handle, model.uri, {
          color: [colorInfo.color.red, colorInfo.color.green, colorInfo.color.blue, colorInfo.color.alpha],
          range: colorInfo.range
        }, token);
      }
    }));
  }
  // --- folding
  $registerFoldingRangeProvider(handle, selector, extensionId, eventHandle) {
    const provider = {
      id: extensionId.value,
      provideFoldingRanges: (model, context, token) => {
        return this._proxy.$provideFoldingRanges(handle, model.uri, context, token);
      }
    };
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      provider.onDidChange = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.foldingRangeProvider.register(selector, provider));
  }
  $emitFoldingRangeEvent(eventHandle, event) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  // -- smart select
  $registerSelectionRangeProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.selectionRangeProvider.register(selector, {
      provideSelectionRanges: (model, positions, token) => {
        return this._proxy.$provideSelectionRanges(handle, model.uri, positions, token);
      }
    }));
  }
  // --- call hierarchy
  $registerCallHierarchyProvider(handle, selector) {
    this._registrations.set(handle, callh.CallHierarchyProviderRegistry.register(selector, {
      prepareCallHierarchy: async (document, position, token) => {
        const items = await this._proxy.$prepareCallHierarchy(handle, document.uri, position, token);
        if (!items || items.length === 0) {
          return void 0;
        }
        return {
          dispose: () => {
            for (const item of items) {
              this._proxy.$releaseCallHierarchy(handle, item._sessionId);
            }
          },
          roots: items.map(MainThreadLanguageFeatures._reviveCallHierarchyItemDto)
        };
      },
      provideOutgoingCalls: async (item, token) => {
        const outgoing = await this._proxy.$provideCallHierarchyOutgoingCalls(handle, item._sessionId, item._itemId, token);
        if (!outgoing) {
          return outgoing;
        }
        outgoing.forEach((value) => {
          value.to = MainThreadLanguageFeatures._reviveCallHierarchyItemDto(value.to);
        });
        return outgoing;
      },
      provideIncomingCalls: async (item, token) => {
        const incoming = await this._proxy.$provideCallHierarchyIncomingCalls(handle, item._sessionId, item._itemId, token);
        if (!incoming) {
          return incoming;
        }
        incoming.forEach((value) => {
          value.from = MainThreadLanguageFeatures._reviveCallHierarchyItemDto(value.from);
        });
        return incoming;
      }
    }));
  }
  // --- configuration
  static _reviveRegExp(regExp) {
    return new RegExp(regExp.pattern, regExp.flags);
  }
  static _reviveIndentationRule(indentationRule) {
    return {
      decreaseIndentPattern: MainThreadLanguageFeatures._reviveRegExp(indentationRule.decreaseIndentPattern),
      increaseIndentPattern: MainThreadLanguageFeatures._reviveRegExp(indentationRule.increaseIndentPattern),
      indentNextLinePattern: indentationRule.indentNextLinePattern ? MainThreadLanguageFeatures._reviveRegExp(indentationRule.indentNextLinePattern) : void 0,
      unIndentedLinePattern: indentationRule.unIndentedLinePattern ? MainThreadLanguageFeatures._reviveRegExp(indentationRule.unIndentedLinePattern) : void 0
    };
  }
  static _reviveOnEnterRule(onEnterRule) {
    return {
      beforeText: MainThreadLanguageFeatures._reviveRegExp(onEnterRule.beforeText),
      afterText: onEnterRule.afterText ? MainThreadLanguageFeatures._reviveRegExp(onEnterRule.afterText) : void 0,
      previousLineText: onEnterRule.previousLineText ? MainThreadLanguageFeatures._reviveRegExp(onEnterRule.previousLineText) : void 0,
      action: onEnterRule.action
    };
  }
  static _reviveOnEnterRules(onEnterRules) {
    return onEnterRules.map(MainThreadLanguageFeatures._reviveOnEnterRule);
  }
  $setLanguageConfiguration(handle, languageId, _configuration) {
    const configuration = {
      comments: _configuration.comments,
      brackets: _configuration.brackets,
      wordPattern: _configuration.wordPattern ? MainThreadLanguageFeatures._reviveRegExp(_configuration.wordPattern) : void 0,
      indentationRules: _configuration.indentationRules ? MainThreadLanguageFeatures._reviveIndentationRule(_configuration.indentationRules) : void 0,
      onEnterRules: _configuration.onEnterRules ? MainThreadLanguageFeatures._reviveOnEnterRules(_configuration.onEnterRules) : void 0,
      autoClosingPairs: void 0,
      surroundingPairs: void 0,
      __electricCharacterSupport: void 0
    };
    if (_configuration.autoClosingPairs) {
      configuration.autoClosingPairs = _configuration.autoClosingPairs;
    } else if (_configuration.__characterPairSupport) {
      configuration.autoClosingPairs = _configuration.__characterPairSupport.autoClosingPairs;
    }
    if (_configuration.__electricCharacterSupport && _configuration.__electricCharacterSupport.docComment) {
      configuration.__electricCharacterSupport = {
        docComment: {
          open: _configuration.__electricCharacterSupport.docComment.open,
          close: _configuration.__electricCharacterSupport.docComment.close
        }
      };
    }
    if (this._languageService.isRegisteredLanguageId(languageId)) {
      this._registrations.set(handle, this._languageConfigurationService.register(languageId, configuration, 100));
    }
  }
  // --- type hierarchy
  $registerTypeHierarchyProvider(handle, selector) {
    this._registrations.set(handle, typeh.TypeHierarchyProviderRegistry.register(selector, {
      prepareTypeHierarchy: async (document, position, token) => {
        const items = await this._proxy.$prepareTypeHierarchy(handle, document.uri, position, token);
        if (!items) {
          return void 0;
        }
        return {
          dispose: () => {
            for (const item of items) {
              this._proxy.$releaseTypeHierarchy(handle, item._sessionId);
            }
          },
          roots: items.map(MainThreadLanguageFeatures._reviveTypeHierarchyItemDto)
        };
      },
      provideSupertypes: async (item, token) => {
        const supertypes = await this._proxy.$provideTypeHierarchySupertypes(handle, item._sessionId, item._itemId, token);
        if (!supertypes) {
          return supertypes;
        }
        return supertypes.map(MainThreadLanguageFeatures._reviveTypeHierarchyItemDto);
      },
      provideSubtypes: async (item, token) => {
        const subtypes = await this._proxy.$provideTypeHierarchySubtypes(handle, item._sessionId, item._itemId, token);
        if (!subtypes) {
          return subtypes;
        }
        return subtypes.map(MainThreadLanguageFeatures._reviveTypeHierarchyItemDto);
      }
    }));
  }
  $registerDocumentOnDropEditProvider(handle, selector, metadata) {
    const provider = new MainThreadDocumentOnDropEditProvider(handle, this._proxy, metadata, this._uriIdentService);
    this._documentOnDropEditProviders.set(handle, provider);
    this._registrations.set(handle, combinedDisposable(
      this._languageFeaturesService.documentDropEditProvider.register(selector, provider),
      toDisposable(() => this._documentOnDropEditProviders.delete(handle))
    ));
  }
  async $resolveDocumentOnDropFileData(handle, requestId, dataId) {
    const provider = this._documentOnDropEditProviders.get(handle);
    if (!provider) {
      throw new Error("Could not find provider");
    }
    return provider.resolveDocumentOnDropFileData(requestId, dataId);
  }
};
MainThreadLanguageFeatures = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadLanguageFeatures),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, ILanguageConfigurationService),
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IInlineCompletionsUnificationService)
], MainThreadLanguageFeatures);
let MainThreadPasteEditProvider = class {
  constructor(_handle, _proxy, metadata, _uriIdentService) {
    this._handle = _handle;
    this._proxy = _proxy;
    this._uriIdentService = _uriIdentService;
    this.dataTransfers = new DataTransferFileCache();
    this.copyMimeTypes = metadata.copyMimeTypes ?? [];
    this.pasteMimeTypes = metadata.pasteMimeTypes ?? [];
    this.providedPasteEditKinds = metadata.providedPasteEditKinds?.map((kind) => new HierarchicalKind(kind)) ?? [];
    if (metadata.supportsCopy) {
      this.prepareDocumentPaste = async (model, selections, dataTransfer, token) => {
        const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
        if (token.isCancellationRequested) {
          return void 0;
        }
        const newDataTransfer = await this._proxy.$prepareDocumentPaste(_handle, model.uri, selections, dataTransferDto, token);
        if (!newDataTransfer) {
          return void 0;
        }
        const dataTransferOut = new VSDataTransfer();
        for (const [type, item] of newDataTransfer.items) {
          dataTransferOut.replace(type, createStringDataTransferItem(item.asString, item.id));
        }
        return dataTransferOut;
      };
    }
    if (metadata.supportsPaste) {
      this.provideDocumentPasteEdits = async (model, selections, dataTransfer, context, token) => {
        const request = this.dataTransfers.add(dataTransfer);
        try {
          const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
          if (token.isCancellationRequested) {
            return;
          }
          const edits = await this._proxy.$providePasteEdits(this._handle, request.id, model.uri, selections, dataTransferDto, {
            only: context.only?.value,
            triggerKind: context.triggerKind
          }, token);
          if (!edits) {
            return;
          }
          return {
            edits: edits.map((edit) => {
              return {
                ...edit,
                kind: edit.kind ? new HierarchicalKind(edit.kind.value) : new HierarchicalKind(""),
                yieldTo: edit.yieldTo?.map((x) => ({ kind: new HierarchicalKind(x) })),
                additionalEdit: edit.additionalEdit ? reviveWorkspaceEditDto(edit.additionalEdit, this._uriIdentService, (dataId) => this.resolveFileData(request.id, dataId)) : void 0
              };
            }),
            dispose: () => {
              this._proxy.$releasePasteEdits(this._handle, request.id);
            }
          };
        } finally {
          request.dispose();
        }
      };
    }
    if (metadata.supportsResolve) {
      this.resolveDocumentPasteEdit = async (edit, token) => {
        const resolved = await this._proxy.$resolvePasteEdit(this._handle, edit._cacheId, token);
        if (typeof resolved.insertText !== "undefined") {
          edit.insertText = resolved.insertText;
        }
        if (resolved.additionalEdit) {
          edit.additionalEdit = reviveWorkspaceEditDto(resolved.additionalEdit, this._uriIdentService);
        }
        return edit;
      };
    }
  }
  resolveFileData(requestId, dataId) {
    return this.dataTransfers.resolveFileData(requestId, dataId);
  }
};
MainThreadPasteEditProvider = __decorateClass([
  __decorateParam(3, IUriIdentityService)
], MainThreadPasteEditProvider);
let MainThreadDocumentOnDropEditProvider = class {
  constructor(_handle, _proxy, metadata, _uriIdentService) {
    this._handle = _handle;
    this._proxy = _proxy;
    this._uriIdentService = _uriIdentService;
    this.dataTransfers = new DataTransferFileCache();
    this.dropMimeTypes = metadata?.dropMimeTypes ?? ["*/*"];
    this.providedDropEditKinds = metadata?.providedDropKinds?.map((kind) => new HierarchicalKind(kind));
    if (metadata?.supportsResolve) {
      this.resolveDocumentDropEdit = async (edit, token) => {
        const resolved = await this._proxy.$resolvePasteEdit(this._handle, edit._cacheId, token);
        if (resolved.additionalEdit) {
          edit.additionalEdit = reviveWorkspaceEditDto(resolved.additionalEdit, this._uriIdentService);
        }
        return edit;
      };
    }
  }
  async provideDocumentDropEdits(model, position, dataTransfer, token) {
    const request = this.dataTransfers.add(dataTransfer);
    try {
      const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
      if (token.isCancellationRequested) {
        return;
      }
      const edits = await this._proxy.$provideDocumentOnDropEdits(this._handle, request.id, model.uri, position, dataTransferDto, token);
      if (!edits) {
        return;
      }
      return {
        edits: edits.map((edit) => {
          return {
            ...edit,
            yieldTo: edit.yieldTo?.map((x) => ({ kind: new HierarchicalKind(x) })),
            kind: edit.kind ? new HierarchicalKind(edit.kind) : void 0,
            additionalEdit: reviveWorkspaceEditDto(edit.additionalEdit, this._uriIdentService, (dataId) => this.resolveDocumentOnDropFileData(request.id, dataId))
          };
        }),
        dispose: () => {
          this._proxy.$releaseDocumentOnDropEdits(this._handle, request.id);
        }
      };
    } finally {
      request.dispose();
    }
  }
  resolveDocumentOnDropFileData(requestId, dataId) {
    return this.dataTransfers.resolveFileData(requestId, dataId);
  }
};
MainThreadDocumentOnDropEditProvider = __decorateClass([
  __decorateParam(3, IUriIdentityService)
], MainThreadDocumentOnDropEditProvider);
class MainThreadDocumentSemanticTokensProvider {
  constructor(_proxy, _handle, _legend, onDidChange) {
    this._proxy = _proxy;
    this._handle = _handle;
    this._legend = _legend;
    this.onDidChange = onDidChange;
  }
  releaseDocumentSemanticTokens(resultId) {
    if (resultId) {
      this._proxy.$releaseDocumentSemanticTokens(this._handle, parseInt(resultId, 10));
    }
  }
  getLegend() {
    return this._legend;
  }
  async provideDocumentSemanticTokens(model, lastResultId, token) {
    const nLastResultId = lastResultId ? parseInt(lastResultId, 10) : 0;
    const encodedDto = await this._proxy.$provideDocumentSemanticTokens(this._handle, model.uri, nLastResultId, token);
    if (!encodedDto) {
      return null;
    }
    if (token.isCancellationRequested) {
      return null;
    }
    const dto = decodeSemanticTokensDto(encodedDto);
    if (dto.type === "full") {
      return {
        resultId: String(dto.id),
        data: dto.data
      };
    }
    return {
      resultId: String(dto.id),
      edits: dto.deltas
    };
  }
}
class MainThreadDocumentRangeSemanticTokensProvider {
  constructor(_proxy, _handle, _legend, onDidChange) {
    this._proxy = _proxy;
    this._handle = _handle;
    this._legend = _legend;
    this.onDidChange = onDidChange;
  }
  getLegend() {
    return this._legend;
  }
  async provideDocumentRangeSemanticTokens(model, range, token) {
    const encodedDto = await this._proxy.$provideDocumentRangeSemanticTokens(this._handle, model.uri, range, token);
    if (!encodedDto) {
      return null;
    }
    if (token.isCancellationRequested) {
      return null;
    }
    const dto = decodeSemanticTokensDto(encodedDto);
    if (dto.type === "full") {
      return {
        resultId: String(dto.id),
        data: dto.data
      };
    }
    throw new Error(`Unexpected`);
  }
}
let ExtensionBackedInlineCompletionsProvider = class extends Disposable {
  constructor(handle, groupId, providerId, yieldsToGroupIds, excludesGroupIds, debounceDelayMs, displayName, modelInfo, _supportsHandleEvents, _supportsSetModelId, _supportsOnDidChange, _supportsOnDidChangeModelInfo, providerOptions, _supportsSetProviderOption, _supportsOnDidChangeProviderOptions, _selector, _proxy, _languageFeaturesService, _aiEditTelemetryService, _instantiationService) {
    super();
    this.handle = handle;
    this.groupId = groupId;
    this.providerId = providerId;
    this.yieldsToGroupIds = yieldsToGroupIds;
    this.excludesGroupIds = excludesGroupIds;
    this.debounceDelayMs = debounceDelayMs;
    this.displayName = displayName;
    this.modelInfo = modelInfo;
    this._supportsHandleEvents = _supportsHandleEvents;
    this._supportsSetModelId = _supportsSetModelId;
    this._supportsOnDidChange = _supportsOnDidChange;
    this._supportsOnDidChangeModelInfo = _supportsOnDidChangeModelInfo;
    this.providerOptions = providerOptions;
    this._supportsSetProviderOption = _supportsSetProviderOption;
    this._supportsOnDidChangeProviderOptions = _supportsOnDidChangeProviderOptions;
    this._selector = _selector;
    this._proxy = _proxy;
    this._languageFeaturesService = _languageFeaturesService;
    this._aiEditTelemetryService = _aiEditTelemetryService;
    this._instantiationService = _instantiationService;
    this._onDidChangeEmitter = this._register(new Emitter());
    this._onDidChangeModelInfoEmitter = this._register(new Emitter());
    this._onDidProviderOptionsChangeEmitter = this._register(new Emitter());
    this.setModelId = this._supportsSetModelId ? async (modelId) => {
      await this._proxy.$handleInlineCompletionSetCurrentModelId(this.handle, modelId);
    } : void 0;
    this.setProviderOption = this._supportsSetProviderOption ? async (optionId, valueId) => {
      await this._proxy.$handleInlineCompletionSetProviderOption(this.handle, optionId, valueId);
    } : void 0;
    this.onDidChangeInlineCompletions = this._supportsOnDidChange ? this._onDidChangeEmitter.event : void 0;
    this.onDidChangeModelInfo = this._supportsOnDidChangeModelInfo ? this._onDidChangeModelInfoEmitter.event : void 0;
    this.onDidProviderOptionsChange = this._supportsOnDidChangeProviderOptions ? this._onDidProviderOptionsChangeEmitter.event : void 0;
    this._register(this._languageFeaturesService.inlineCompletionsProvider.register(this._selector, this));
  }
  _setModelInfo(newModelInfo) {
    this.modelInfo = newModelInfo;
    if (this._supportsOnDidChangeModelInfo) {
      this._onDidChangeModelInfoEmitter.fire();
    }
  }
  _setProviderOptions(newProviderOptions) {
    this.providerOptions = newProviderOptions;
    if (this._supportsOnDidChangeProviderOptions) {
      this._onDidProviderOptionsChangeEmitter.fire();
    }
  }
  _emitDidChange(changeHint) {
    if (this._supportsOnDidChange) {
      this._onDidChangeEmitter.fire(changeHint);
    }
  }
  async provideInlineCompletions(model, position, context, token) {
    const result = await this._proxy.$provideInlineCompletions(this.handle, model.uri, position, context, token);
    return result;
  }
  async handleItemDidShow(completions, item, updatedInsertText, editDeltaInfo) {
    if (item.suggestionId === void 0) {
      item.suggestionId = this._aiEditTelemetryService.createSuggestionId({
        applyCodeBlockSuggestionId: void 0,
        feature: "inlineSuggestion",
        source: this.providerId,
        languageId: completions.languageId,
        editDeltaInfo,
        modeId: void 0,
        modelId: void 0,
        presentation: item.isInlineEdit ? "nextEditSuggestion" : "inlineCompletion",
        sourceRequestId: void 0
      });
    }
    if (this._supportsHandleEvents) {
      await this._proxy.$handleInlineCompletionDidShow(this.handle, completions.pid, item.idx, updatedInsertText);
    }
  }
  async handlePartialAccept(completions, item, acceptedCharacters, info) {
    if (this._supportsHandleEvents) {
      await this._proxy.$handleInlineCompletionPartialAccept(this.handle, completions.pid, item.idx, acceptedCharacters, info);
    }
  }
  async handleEndOfLifetime(completions, item, reason, lifetimeSummary) {
    function mapReason(reason2, f) {
      if (reason2.kind === languages.InlineCompletionEndOfLifeReasonKind.Ignored) {
        return {
          ...reason2,
          supersededBy: reason2.supersededBy ? f(reason2.supersededBy) : void 0
        };
      }
      return reason2;
    }
    if (this._supportsHandleEvents) {
      await this._proxy.$handleInlineCompletionEndOfLifetime(this.handle, completions.pid, item.idx, mapReason(reason, (i) => ({ pid: i.pid, idx: i.idx })));
    }
    if (reason.kind === languages.InlineCompletionEndOfLifeReasonKind.Accepted) {
      if (item.suggestionId !== void 0) {
        this._aiEditTelemetryService.handleCodeAccepted({
          suggestionId: item.suggestionId,
          feature: "inlineSuggestion",
          source: this.providerId,
          languageId: completions.languageId,
          editDeltaInfo: EditDeltaInfo.tryCreate(
            lifetimeSummary.lineCountModified,
            lifetimeSummary.lineCountOriginal,
            lifetimeSummary.characterCountModified,
            lifetimeSummary.characterCountOriginal
          ),
          modeId: void 0,
          modelId: void 0,
          presentation: item.isInlineEdit ? "nextEditSuggestion" : "inlineCompletion",
          acceptanceMethod: "accept",
          applyCodeBlockSuggestionId: void 0,
          sourceRequestId: void 0
        });
      }
    } else if (reason.kind === languages.InlineCompletionEndOfLifeReasonKind.Rejected) {
      if (item.suggestionId !== void 0) {
        this._aiEditTelemetryService.handleCodeRejected({
          suggestionId: item.suggestionId,
          feature: "inlineSuggestion",
          source: this.providerId,
          languageId: completions.languageId,
          editDeltaInfo: EditDeltaInfo.tryCreate(
            lifetimeSummary.lineCountModified,
            lifetimeSummary.lineCountOriginal,
            lifetimeSummary.characterCountModified,
            lifetimeSummary.characterCountOriginal
          ),
          modeId: void 0,
          modelId: void 0,
          presentation: item.isInlineEdit ? "nextEditSuggestion" : "inlineCompletion",
          rejectionMethod: "reject",
          applyCodeBlockSuggestionId: void 0,
          sourceRequestId: void 0
        });
      }
    }
    const endOfLifeSummary = {
      opportunityId: lifetimeSummary.requestUuid,
      correlationId: lifetimeSummary.correlationId,
      shown: lifetimeSummary.shown,
      shownDuration: lifetimeSummary.shownDuration,
      shownDurationUncollapsed: lifetimeSummary.shownDurationUncollapsed,
      timeUntilShown: lifetimeSummary.timeUntilShown,
      timeUntilProviderRequest: lifetimeSummary.timeUntilProviderRequest,
      timeUntilProviderResponse: lifetimeSummary.timeUntilProviderResponse,
      editorType: lifetimeSummary.editorType,
      viewKind: lifetimeSummary.viewKind,
      preceeded: lifetimeSummary.preceeded,
      requestReason: lifetimeSummary.requestReason,
      typingInterval: lifetimeSummary.typingInterval,
      typingIntervalCharacterCount: lifetimeSummary.typingIntervalCharacterCount,
      languageId: lifetimeSummary.languageId,
      cursorColumnDistance: lifetimeSummary.cursorColumnDistance,
      cursorLineDistance: lifetimeSummary.cursorLineDistance,
      lineCountOriginal: lifetimeSummary.lineCountOriginal,
      lineCountModified: lifetimeSummary.lineCountModified,
      characterCountOriginal: lifetimeSummary.characterCountOriginal,
      characterCountModified: lifetimeSummary.characterCountModified,
      disjointReplacements: lifetimeSummary.disjointReplacements,
      sameShapeReplacements: lifetimeSummary.sameShapeReplacements,
      selectedSuggestionInfo: lifetimeSummary.selectedSuggestionInfo,
      extensionId: this.providerId.extensionId,
      extensionVersion: this.providerId.extensionVersion,
      groupId: extractEngineFromCorrelationId(lifetimeSummary.correlationId) ?? this.groupId,
      skuPlan: lifetimeSummary.skuPlan,
      skuType: lifetimeSummary.skuType,
      performanceMarkers: lifetimeSummary.performanceMarkers,
      availableProviders: lifetimeSummary.availableProviders,
      partiallyAccepted: lifetimeSummary.partiallyAccepted,
      partiallyAcceptedCountSinceOriginal: lifetimeSummary.partiallyAcceptedCountSinceOriginal,
      partiallyAcceptedRatioSinceOriginal: lifetimeSummary.partiallyAcceptedRatioSinceOriginal,
      partiallyAcceptedCharactersSinceOriginal: lifetimeSummary.partiallyAcceptedCharactersSinceOriginal,
      superseded: reason.kind === InlineCompletionEndOfLifeReasonKind.Ignored && !!reason.supersededBy,
      reason: reason.kind === InlineCompletionEndOfLifeReasonKind.Accepted ? "accepted" : reason.kind === InlineCompletionEndOfLifeReasonKind.Rejected ? "rejected" : reason.kind === InlineCompletionEndOfLifeReasonKind.Ignored ? "ignored" : void 0,
      acceptedAlternativeAction: reason.kind === InlineCompletionEndOfLifeReasonKind.Accepted && reason.alternativeAction,
      noSuggestionReason: void 0,
      notShownReason: lifetimeSummary.notShownReason,
      renameCreated: lifetimeSummary.renameCreated,
      renameDuration: lifetimeSummary.renameDuration,
      renameTimedOut: lifetimeSummary.renameTimedOut,
      renameDroppedOtherEdits: lifetimeSummary.renameDroppedOtherEdits,
      renameDroppedRenameEdits: lifetimeSummary.renameDroppedRenameEdits,
      editKind: lifetimeSummary.editKind,
      longDistanceHintVisible: lifetimeSummary.longDistanceHintVisible,
      longDistanceHintDistance: lifetimeSummary.longDistanceHintDistance,
      isForAnotherDocument: lifetimeSummary.isForAnotherDocument,
      ...forwardToChannelIf(isCopilotLikeExtension(this.providerId.extensionId))
    };
    const dataChannelForwardingTelemetryService = this._instantiationService.createInstance(DataChannelForwardingTelemetryService);
    sendInlineCompletionsEndOfLifeTelemetry(dataChannelForwardingTelemetryService, endOfLifeSummary);
  }
  disposeInlineCompletions(completions, reason) {
    this._proxy.$freeInlineCompletionsList(this.handle, completions.pid, reason);
  }
  async handleRejection(completions, item) {
    if (this._supportsHandleEvents) {
      await this._proxy.$handleInlineCompletionRejection(this.handle, completions.pid, item.idx);
    }
  }
  toString() {
    return `InlineCompletionsProvider(${this.providerId.toString()})`;
  }
};
ExtensionBackedInlineCompletionsProvider = __decorateClass([
  __decorateParam(17, ILanguageFeaturesService),
  __decorateParam(18, IAiEditTelemetryService),
  __decorateParam(19, IInstantiationService)
], ExtensionBackedInlineCompletionsProvider);
function extractEngineFromCorrelationId(correlationId) {
  if (!correlationId) {
    return void 0;
  }
  try {
    const parsed = JSON.parse(correlationId);
    if (typeof parsed === "object" && parsed !== null && typeof parsed.engine === "string") {
      return parsed.engine;
    }
    return void 0;
  } catch {
    return void 0;
  }
}
export {
  MainThreadDocumentRangeSemanticTokensProvider,
  MainThreadDocumentSemanticTokensProvider,
  MainThreadLanguageFeatures
};
