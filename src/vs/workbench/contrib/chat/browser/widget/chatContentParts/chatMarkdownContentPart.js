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
import * as dom from "../../../../../../base/browser/dom.js";
import { allowedMarkdownHtmlAttributes } from "../../../../../../base/browser/markdownRenderer.js";
import { status } from "../../../../../../base/browser/ui/aria/aria.js";
import { DomScrollableElement } from "../../../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { wrapTablesWithScrollable } from "./chatMarkdownTableScrolling.js";
import { coalesce } from "../../../../../../base/common/arrays.js";
import { findLast } from "../../../../../../base/common/arraysFind.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { isCancellationError } from "../../../../../../base/common/errors.js";
import { MarkdownString } from "../../../../../../base/common/htmlContent.js";
import { Lazy } from "../../../../../../base/common/lazy.js";
import { Disposable, DisposableStore, dispose, MutableDisposable } from "../../../../../../base/common/lifecycle.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { autorun, autorunSelfDisposable, derived } from "../../../../../../base/common/observable.js";
import { ScrollbarVisibility } from "../../../../../../base/common/scrollable.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { URI } from "../../../../../../base/common/uri.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { isLocation } from "../../../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../../editor/common/services/resolverService.js";
import { EditDeltaInfo } from "../../../../../../editor/common/textModelEditSource.js";
import { localize } from "../../../../../../nls.js";
import { getFlatContextMenuActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { IEditorService, SIDE_GROUP } from "../../../../../services/editor/common/editorService.js";
import { AccessibilityWorkbenchSettingId } from "../../../../accessibility/browser/accessibilityConfiguration.js";
import { IAiEditTelemetryService } from "../../../../editTelemetry/browser/telemetry/aiEditTelemetry/aiEditTelemetryService.js";
import { MarkedKatexSupport } from "../../../../markdown/browser/markedKatexSupport.js";
import { extractCodeblockUrisFromText, extractVulnerabilitiesFromText } from "../../../common/widget/annotations.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { IChatSessionsService } from "../../../common/chatSessionsService.js";
import { isRequestVM, isResponseVM } from "../../../common/model/chatViewModel.js";
import { ChatConfiguration } from "../../../common/constants.js";
import { IChatOutputRendererService } from "../../chatOutputItemRenderer.js";
import { allowedChatMarkdownHtmlTags } from "../chatContentMarkdownRenderer.js";
import { MarkdownDiffBlockPart, parseUnifiedDiff } from "./chatDiffBlockPart.js";
import { ChatMarkdownDecorationsRenderer } from "./chatMarkdownDecorationsRenderer.js";
import { CodeBlockPart } from "./codeBlockPart.js";
import "./media/chatCodeBlockPill.css";
import { ChatEditPillElement, isResourceContentEmpty } from "./chatEditPillElement.js";
import { ChatExtensionsContentPart } from "./chatExtensionsContentPart.js";
import { ChatProgressSubPart } from "./chatProgressContentPart.js";
import { IncrementalDOMMorpher } from "./chatIncrementalRendering/chatIncrementalRendering.js";
import { IChatOutputPartStateCache } from "./chatOutputPartStateCache.js";
import "./media/chatMarkdownPart.css";
const $ = dom.$;
let ChatMarkdownContentPart = class extends Disposable {
  constructor(markdown, context, editorPool, fillInIncompleteTokens = false, codeBlockStartIndex = 0, renderer, markdownRenderOptions, currentWidth, rendererOptions, contextKeyService, configurationService, instantiationService, aiEditTelemetryService, chatOutputRendererService, chatSessionsService) {
    super();
    this.markdown = markdown;
    this.editorPool = editorPool;
    this.rendererOptions = rendererOptions;
    this.instantiationService = instantiationService;
    this.aiEditTelemetryService = aiEditTelemetryService;
    this.chatOutputRendererService = chatOutputRendererService;
    this.chatSessionsService = chatSessionsService;
    this.codeblocksPartId = String(++ChatMarkdownContentPart.ID_POOL);
    // This Event exists for one specific scenario and the pattern shouldn't be copied without a good reason
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._onDidChangeDiff = this._register(new Emitter());
    /**
     * Fires when any edit pill (CollapsedCodeBlock) in this markdown part updates its diff.
     * The aggregated stats reflect the total added/removed across all edit pills.
     */
    this.onDidChangeDiff = this._onDidChangeDiff.event;
    this._onDidFinishRendering = this._register(new Emitter());
    this.onDidFinishRendering = this._onDidFinishRendering.event;
    this.allRefs = [];
    this._codeblocks = [];
    this.mathLayoutParticipants = /* @__PURE__ */ new Set();
    const element = context.element;
    const inUndoStop = findLast(context.content, (e) => e.kind === "undoStop", context.contentIndex)?.id;
    let globalCodeBlockIndexStart = codeBlockStartIndex;
    this.domNode = $("div.chat-markdown-part");
    if (this.rendererOptions.accessibilityOptions?.statusMessage) {
      this.domNode.ariaLabel = this.rendererOptions.accessibilityOptions.statusMessage;
      if (configurationService.getValue(AccessibilityWorkbenchSettingId.VerboseChatProgressUpdates)) {
        status(this.rendererOptions.accessibilityOptions.statusMessage);
      }
    }
    const enableMath = configurationService.getValue(ChatConfiguration.EnableMath);
    const incrementalRenderingEnabled = configurationService.getValue(ChatConfiguration.IncrementalRendering);
    if (incrementalRenderingEnabled && isResponseVM(element) && fillInIncompleteTokens && !element.isComplete) {
      this._incrementalMorpher = this._register(instantiationService.createInstance(IncrementalDOMMorpher, this.domNode));
      this._register(this._incrementalMorpher.onDidDrain(() => this._onDidFinishRendering.fire()));
      this._incrementalMorpher.setRenderCallback((newMd) => {
        const savedMarkdown = this.markdown;
        const content = new MarkdownString(newMd, this.markdown.content);
        content.baseUri = URI.revive(this.markdown.content.baseUri);
        content.uris = this.markdown.content.uris;
        this.markdown = { ...this.markdown, content };
        doRenderMarkdown();
        this.markdown = savedMarkdown;
        this._onDidChangeHeight.fire();
      });
    }
    const renderStore = this._register(new MutableDisposable());
    const doRenderMarkdown = () => {
      if (this._store.isDisposed) {
        return;
      }
      const previousRenderStore = renderStore.clearAndLeak();
      const reusableOutputCodeBlockRefs = /* @__PURE__ */ new Map();
      for (const ref of this.allRefs) {
        if (ref.object instanceof ChatOutputCodeBlockPart) {
          const outputRef = ref;
          previousRenderStore?.deleteAndLeak(outputRef);
          reusableOutputCodeBlockRefs.set(outputRef.object.reuseKey, outputRef);
        }
      }
      previousRenderStore?.dispose();
      const store = new DisposableStore();
      renderStore.value = store;
      dom.clearNode(this.domNode);
      this.allRefs.length = 0;
      this._codeblocks.length = 0;
      this.mathLayoutParticipants.clear();
      globalCodeBlockIndexStart = codeBlockStartIndex;
      const markedExtensions = enableMath ? coalesce([MarkedKatexSupport.getExtension(dom.getWindow(context.container), {
        throwOnError: false
      })]) : [];
      const markedOpts = {
        gfm: true,
        breaks: true
      };
      const configuredUriTransformer = markdownRenderOptions?.transformUri;
      const transformUri = isResponseVM(element) ? (href, kind) => this.chatSessionsService.resolveChatResponseUri(element.sessionResource, configuredUriTransformer?.(href, kind) ?? href, kind) : configuredUriTransformer;
      const result = store.add(renderer.render(this.markdown.content, {
        sanitizerConfig: MarkedKatexSupport.getSanitizerOptions({
          allowedTags: allowedChatMarkdownHtmlTags,
          allowedAttributes: allowedMarkdownHtmlAttributes
        }),
        fillInIncompleteTokens,
        codeBlockRendererSync: (languageId, text, raw) => {
          const isCodeBlockComplete = !isResponseVM(context.element) || context.element.isComplete || !raw || codeblockHasClosingBackticks(raw);
          const hasChatOutputRenderer = !!languageId && this.chatOutputRendererService.hasCodeBlockRenderer(languageId);
          if ((!text || text.startsWith("<vscode_codeblock_uri") && !text.includes("\n")) && !isCodeBlockComplete && !hasChatOutputRenderer) {
            const hideEmptyCodeblock = $("div");
            hideEmptyCodeblock.style.display = "none";
            return hideEmptyCodeblock;
          }
          if (languageId === "diff" && raw && this.rendererOptions.allowInlineDiffs) {
            const match = raw.match(/^```diff:(\w+)/);
            if (match && isResponseVM(context.element)) {
              const actualLanguageId = match[1];
              const codeBlockUri = extractCodeblockUrisFromText(text);
              const { before, after } = parseUnifiedDiff(codeBlockUri?.textWithoutResult ?? text);
              const diffData = {
                element: context.element,
                codeBlockIndex: globalCodeBlockIndexStart++,
                languageId: actualLanguageId,
                beforeContent: before,
                afterContent: after,
                codeBlockResource: codeBlockUri?.uri,
                isReadOnly: true,
                horizontalPadding: this.rendererOptions.horizontalPadding
              };
              const diffPart = this.instantiationService.createInstance(MarkdownDiffBlockPart, diffData, context.diffEditorPool, context.currentWidth.get());
              const ref2 = {
                object: diffPart,
                isStale: () => false,
                dispose: () => diffPart.dispose()
              };
              this.allRefs.push(ref2);
              store.add(ref2);
              return diffPart.element;
            }
          }
          if (languageId === "vscode-extensions") {
            const chatExtensions = store.add(instantiationService.createInstance(ChatExtensionsContentPart, { kind: "extensions", extensions: text.split(",") }));
            return chatExtensions.domNode;
          }
          const globalIndex = globalCodeBlockIndexStart++;
          let codeBlockText = text;
          const extractedVulns = extractVulnerabilitiesFromText(text);
          codeBlockText = fixCodeText(extractedVulns.newText, languageId);
          const vulns = extractedVulns.vulnerabilities;
          let codemapperUri;
          let isEdit;
          const codeblockUri = extractCodeblockUrisFromText(codeBlockText);
          if (codeblockUri) {
            codemapperUri = codeblockUri.uri;
            isEdit = codeblockUri.isEdit;
            codeBlockText = codeblockUri.textWithoutResult;
          }
          const hideToolbar = isResponseVM(element) && element.errorDetails?.responseIsFiltered;
          const renderOptions = {
            ...this.rendererOptions.codeBlockRenderOptions
          };
          if (hideToolbar !== void 0) {
            renderOptions.hideToolbar = hideToolbar;
          }
          const codeBlockInfo = { languageId, text: codeBlockText, codeBlockIndex: globalIndex, element, parentContextKeyService: contextKeyService, vulns, codemapperUri, renderOptions, chatSessionResource: element.sessionResource };
          const baseCodeBlockInfo = {
            ownerMarkdownPartId: this.codeblocksPartId,
            codeBlockIndex: globalIndex,
            elementId: element.id,
            chatSessionResource: element.sessionResource,
            languageId,
            editDeltaInfo: EditDeltaInfo.fromText(text)
          };
          if (element.isCompleteAddedRequest || !codemapperUri || !isEdit) {
            if (hasChatOutputRenderer) {
              const ref3 = this.renderChatOutputCodeBlock(languageId, codeBlockText, globalIndex, context, isCodeBlockComplete, reusableOutputCodeBlockRefs);
              this._codeblocks.push({
                ...baseCodeBlockInfo,
                codemapperUri: codeBlockInfo.codemapperUri,
                isStreamingEdit: false,
                get uri() {
                  return void 0;
                },
                focus() {
                  ref3.object.focus();
                }
              });
              store.add(ref3);
              return ref3.object.element;
            }
            const ref2 = this.renderCodeBlock(codeBlockInfo, currentWidth);
            this._codeblocks.push({
              ...baseCodeBlockInfo,
              codemapperUri: codeBlockInfo.codemapperUri,
              isStreamingEdit: false,
              get uri() {
                return ref2.object.uri;
              },
              focus() {
                ref2.object.focus();
              }
            });
            store.add(ref2);
            return ref2.object.element;
          }
          const requestId = isRequestVM(element) ? element.id : element.requestId;
          const ref = this.renderCodeBlockPill(element.sessionResource, requestId, inUndoStop, codemapperUri);
          this._codeblocks.push({
            ...baseCodeBlockInfo,
            codemapperUri,
            isStreamingEdit: !isCodeBlockComplete,
            get uri() {
              return void 0;
            },
            focus() {
              return ref.object.element.focus();
            }
          });
          store.add(ref);
          return ref.object.element;
        },
        markedOptions: markedOpts,
        markedExtensions,
        ...markdownRenderOptions,
        transformUri
      }, this.domNode));
      if (isResponseVM(element) && !element.model.codeBlockInfos && element.model.isComplete) {
        element.model.initializeCodeBlockInfos(this._codeblocks.map((info) => {
          return {
            suggestionId: this.aiEditTelemetryService.createSuggestionId({
              presentation: "codeBlock",
              feature: "sideBarChat",
              editDeltaInfo: info.editDeltaInfo,
              languageId: info.languageId,
              modeId: element.model.request?.modeInfo?.telemetryModeId,
              modelId: element.model.request?.modelId,
              applyCodeBlockSuggestionId: void 0,
              source: void 0,
              sourceRequestId: void 0
            })
          };
        }));
      }
      const markdownDecorationsRenderer = instantiationService.createInstance(ChatMarkdownDecorationsRenderer);
      store.add(markdownDecorationsRenderer.walkTreeAndAnnotateReferenceLinks(this.markdown, result.element));
      const layoutParticipants = new Lazy(() => {
        const observer = store.add(new dom.DisposableResizeObserver("ChatMarkdownContentPart.mathLayout", () => this.mathLayoutParticipants.forEach((layout) => layout())));
        store.add(observer.observe(this.domNode));
        return this.mathLayoutParticipants;
      });
      for (const katexBlock of this.domNode.querySelectorAll(".katex-display")) {
        if (!dom.isHTMLElement(katexBlock)) {
          continue;
        }
        const scrollable = new DomScrollableElement(katexBlock.cloneNode(true), {
          vertical: ScrollbarVisibility.Hidden,
          horizontal: ScrollbarVisibility.Auto
        });
        store.add(scrollable);
        katexBlock.replaceWith(scrollable.getDomNode());
        layoutParticipants.value.add(() => {
          scrollable.scanDomNode();
        });
        scrollable.scanDomNode();
      }
      store.add(wrapTablesWithScrollable(this.domNode, layoutParticipants));
      dispose(reusableOutputCodeBlockRefs.values());
    };
    doRenderMarkdown();
    this._incrementalMorpher?.seed(
      markdown.content.value,
      /* animateInitial */
      true
    );
    if (enableMath && !MarkedKatexSupport.getExtension(dom.getWindow(context.container))) {
      MarkedKatexSupport.loadExtension(dom.getWindow(context.container)).then(() => {
        doRenderMarkdown();
      }).catch((e) => {
        console.error("Failed to load MarkedKatexSupport extension:", e);
      });
    }
  }
  static {
    this.ID_POOL = 0;
  }
  get codeblocks() {
    return this._codeblocks;
  }
  dispose() {
    super.dispose();
    dispose(this.allRefs);
    this.allRefs.length = 0;
  }
  renderCodeBlockPill(sessionResource, requestId, inUndoStop, codemapperUri) {
    const codeBlock = this.instantiationService.createInstance(CollapsedCodeBlock, sessionResource, requestId, inUndoStop);
    const diffListenerStore = new DisposableStore();
    const ref = {
      object: codeBlock,
      isStale: () => false,
      dispose: () => {
        codeBlock.dispose();
        diffListenerStore.dispose();
      }
    };
    this.allRefs.push(ref);
    diffListenerStore.add(codeBlock.onDidChangeDiff(() => this.fireAggregatedDiff()));
    codeBlock.render(codemapperUri);
    return ref;
  }
  renderChatOutputCodeBlock(identifier, text, codeBlockIndex, context, isComplete, reusableOutputCodeBlockRefs) {
    const reuseKey = ChatOutputCodeBlockPart.reuseKey(context.element.id, codeBlockIndex, identifier);
    const reusableRef = reusableOutputCodeBlockRefs.get(reuseKey);
    if (reusableRef?.object.hasSameContent(identifier, text, isComplete)) {
      reusableOutputCodeBlockRefs.delete(reuseKey);
      this.allRefs.push(reusableRef);
      return reusableRef;
    }
    const codeBlock = this.instantiationService.createInstance(
      ChatOutputCodeBlockPart,
      identifier,
      text,
      codeBlockIndex,
      context,
      isComplete,
      () => this._onDidChangeHeight.fire()
    );
    const ref = {
      object: codeBlock,
      isStale: () => false,
      dispose: () => codeBlock.dispose()
    };
    this.allRefs.push(ref);
    return ref;
  }
  fireAggregatedDiff() {
    let totalAdded = 0;
    let totalRemoved = 0;
    for (const ref of this.allRefs) {
      if (ref.object instanceof CollapsedCodeBlock && ref.object.diff) {
        totalAdded += ref.object.diff.added;
        totalRemoved += ref.object.diff.removed;
      }
    }
    this._onDidChangeDiff.fire({ added: totalAdded, removed: totalRemoved });
  }
  renderCodeBlock(data, currentWidth) {
    const key = CodeBlockPart.poolKey(data.element.id, data.codeBlockIndex);
    const ref = this.editorPool.get(key);
    this.allRefs.push(ref);
    ref.object.render(data, currentWidth);
    if (!this._store.isDisposed && isRequestVM(data.element)) {
      this._onDidChangeHeight.fire();
    }
    return ref;
  }
  hasSameContent(other) {
    if (other.kind !== "markdownContent") {
      return false;
    }
    if (other.content.value === this.markdown.content.value && equalsInlineReferences(other.inlineReferences, this.markdown.inlineReferences)) {
      return true;
    }
    const lastCodeblock = this._codeblocks.at(-1);
    if (lastCodeblock && lastCodeblock.codemapperUri !== void 0 && lastCodeblock.isStreamingEdit) {
      return other.content.value.lastIndexOf("```") === this.markdown.content.value.lastIndexOf("```");
    }
    return false;
  }
  get isRenderComplete() {
    return this._incrementalMorpher?.isDrained ?? true;
  }
  /**
   * Attempts an incremental DOM update for smooth streaming instead of
   * tearing down and rebuilding the entire markdown part.
   *
   * The morpher checks that the new content is a pure append, then
   * schedules a rAF-batched re-render through the full markdown
   * pipeline. Code blocks, tables, and all markdown features are
   * rendered correctly because the update goes through the standard
   * `doRenderMarkdown()` path.
   *
   * @param newMarkdown The new (appended) markdown content.
   * @returns `true` if the incremental update succeeded and the caller
   *          should treat this part as unchanged. `false` if a full
   *          re-render is needed.
   */
  tryIncrementalUpdate(newMarkdown) {
    if (!this._incrementalMorpher) {
      return false;
    }
    if (!equalsInlineReferences(newMarkdown.inlineReferences, this.markdown.inlineReferences)) {
      return false;
    }
    const success = this._incrementalMorpher.tryMorph(newMarkdown.content.value);
    if (success) {
      this.markdown = newMarkdown;
    }
    return success;
  }
  /**
   * Forward the stream's word-rate estimate to the morpher's buffer.
   */
  updateStreamRate(rate, isComplete) {
    this._incrementalMorpher?.updateStreamRate(rate, isComplete);
  }
  layout(width) {
    this.allRefs.forEach((ref, index) => {
      if (ref.object instanceof CodeBlockPart) {
        ref.object.layout(width);
      } else if (ref.object instanceof ChatOutputCodeBlockPart) {
        ref.object.layout(width);
      } else if (ref.object instanceof MarkdownDiffBlockPart) {
        ref.object.layout(width);
      } else if (ref.object instanceof CollapsedCodeBlock) {
        const codeblockModel = this._codeblocks[index];
        if (codeblockModel.codemapperUri && !isEqual(ref.object.uri, codeblockModel.codemapperUri)) {
          ref.object.render(codeblockModel.codemapperUri);
        }
      }
    });
    this.mathLayoutParticipants.forEach((layout) => layout());
  }
  onDidRemount() {
    for (const ref of this.allRefs) {
      if (ref.object instanceof CodeBlockPart || ref.object instanceof ChatOutputCodeBlockPart) {
        ref.object.onDidRemount();
      }
    }
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatMarkdownContentPart = __decorateClass([
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, IAiEditTelemetryService),
  __decorateParam(13, IChatOutputRendererService),
  __decorateParam(14, IChatSessionsService)
], ChatMarkdownContentPart);
function equalsInlineReferences(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return !a && !b;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => equalsInlineReference(a[key], b[key]));
}
function equalsInlineReference(a, b) {
  if (!a || !b) {
    return !a && !b;
  }
  return a.resolveId === b.resolveId && a.name === b.name && equalsInlineReferenceValue(a.inlineReference, b.inlineReference);
}
const workspaceSymbolComparers = {
  name: (a, b) => a.name === b.name,
  containerName: (a, b) => a.containerName === b.containerName,
  kind: (a, b) => a.kind === b.kind,
  tags: (a, b) => equalsSymbolTags(a.tags, b.tags),
  location: (a, b) => isEqual(a.location.uri, b.location.uri) && Range.equalsRange(a.location.range, b.location.range)
};
const workspaceSymbolComparerKeys = Object.keys(workspaceSymbolComparers);
function equalsInlineReferenceValue(a, b) {
  if (URI.isUri(a) || URI.isUri(b)) {
    return URI.isUri(a) && URI.isUri(b) && isEqual(a, b);
  }
  if (isLocation(a) || isLocation(b)) {
    return isLocation(a) && isLocation(b) && isEqual(a.uri, b.uri) && Range.equalsRange(a.range, b.range);
  }
  return equalsWorkspaceSymbol(a, b);
}
function equalsWorkspaceSymbol(a, b) {
  return workspaceSymbolComparerKeys.every((key) => workspaceSymbolComparers[key](a, b));
}
function equalsSymbolTags(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  return a.every((tag, index) => tag === b[index]);
}
function codeblockHasClosingBackticks(str) {
  str = str.trim();
  return !!str.match(/\n```+$/);
}
let ChatOutputCodeBlockPart = class extends Disposable {
  constructor(identifier, text, codeBlockIndex, context, isComplete, onDidChangeHeight, instantiationService, chatOutputRendererService, stateCache) {
    super();
    this.identifier = identifier;
    this.text = text;
    this.context = context;
    this.isComplete = isComplete;
    this.onDidChangeHeight = onDidChangeHeight;
    this.instantiationService = instantiationService;
    this.chatOutputRendererService = chatOutputRendererService;
    this.stateCache = stateCache;
    this._disposeCts = this._register(new CancellationTokenSource());
    this._renderedOutputPart = this._register(new MutableDisposable());
    this.reuseKey = ChatOutputCodeBlockPart.reuseKey(context.element.id, codeBlockIndex, identifier);
    const title = localize("chat.renderedCodeBlockLabel", "Rendered code block {0}", codeBlockIndex + 1);
    this.element = $(".interactive-result-code-block.chat-output-code-block.tool-output-part");
    this.element.tabIndex = -1;
    this.element.ariaLabel = title;
    const parent = $(".webview-output");
    parent.style.maxHeight = "80vh";
    parent.style.minHeight = "38px";
    this.element.appendChild(parent);
    const stateCacheKey = `codeBlock/${context.element.sessionResource.toString()}/${context.element.id}/${codeBlockIndex}/${identifier.toLowerCase()}`;
    const partState = this.stateCache.get(stateCacheKey) ?? { height: 0 };
    this.stateCache.set(stateCacheKey, partState);
    if (partState.height) {
      parent.style.height = `${partState.height}px`;
    }
    const progressMessage = $("span");
    progressMessage.textContent = localize("chat.codeBlockOutputRendering", "Rendering code block...");
    const progressPart = this._register(this.instantiationService.createInstance(ChatProgressSubPart, progressMessage, ThemeIcon.modify(Codicon.loading, "spin"), void 0));
    parent.appendChild(progressPart.domNode);
    if (!isComplete) {
      this.onDidChangeHeight();
      return;
    }
    this.chatOutputRendererService.renderCodeBlock(identifier, new TextEncoder().encode(text), parent, {
      webviewState: partState.webviewState,
      title,
      chatSessionResource: this.context.element.sessionResource
    }, this._disposeCts.token).then((renderedItem) => {
      if (this._disposeCts.token.isCancellationRequested) {
        renderedItem.dispose();
        return;
      }
      this._renderedOutputPart.value = renderedItem;
      progressPart.domNode.remove();
      parent.style.minHeight = "";
      this.onDidChangeHeight();
      this._register(renderedItem.webview.onDidUpdateState((e) => {
        partState.webviewState = e;
      }));
      this._register(renderedItem.onDidChangeHeight((newHeight) => {
        partState.height = newHeight;
        this.onDidChangeHeight();
      }));
      this._register(this.context.onDidChangeVisibility((visible) => {
        if (visible) {
          renderedItem.reinitialize();
        }
      }));
    }, (error) => {
      if (isCancellationError(error)) {
        return;
      }
      console.error("Error rendering chat code block:", error);
      progressPart.domNode.replaceWith(this.renderError(error));
      parent.style.minHeight = "";
      this.onDidChangeHeight();
    });
  }
  static reuseKey(elementId, codeBlockIndex, identifier) {
    return `${elementId}/${codeBlockIndex}/${identifier.toLowerCase()}`;
  }
  hasSameContent(identifier, text, isComplete) {
    return identifier.toLowerCase() === this.identifier.toLowerCase() && text === this.text && isComplete === this.isComplete;
  }
  dispose() {
    this._disposeCts.dispose(true);
    super.dispose();
  }
  layout(width) {
    this.element.style.maxWidth = `${width}px`;
  }
  onDidRemount() {
    this._renderedOutputPart.value?.reinitialize();
  }
  focus() {
    const webview = this._renderedOutputPart.value?.webview;
    if (webview) {
      webview.focus();
    } else {
      this.element.focus();
    }
  }
  renderError(error) {
    const errorNode = $(".output-error");
    const errorHeaderNode = $(".output-error-header");
    dom.append(errorNode, errorHeaderNode);
    const iconElement = $("div");
    iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.error));
    errorHeaderNode.append(iconElement);
    const errorTitleNode = $(".output-error-title");
    errorTitleNode.textContent = localize("chat.codeBlockOutputError", "Error rendering the code block");
    errorHeaderNode.append(errorTitleNode);
    const errorMessageNode = $(".output-error-details");
    errorMessageNode.textContent = error?.message || String(error);
    errorNode.append(errorMessageNode);
    return errorNode;
  }
};
ChatOutputCodeBlockPart = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IChatOutputRendererService),
  __decorateParam(8, IChatOutputPartStateCache)
], ChatOutputCodeBlockPart);
let CollapsedCodeBlock = class extends ChatEditPillElement {
  constructor(sessionResource, requestId, inUndoStop, labelService, editorService, modelService, languageService, contextMenuService, contextKeyService, menuService, hoverService, chatService, configurationService, textModelService) {
    super(labelService, modelService, languageService, hoverService);
    this.sessionResource = sessionResource;
    this.requestId = requestId;
    this.inUndoStop = inUndoStop;
    this.editorService = editorService;
    this.contextMenuService = contextMenuService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this.chatService = chatService;
    this.configurationService = configurationService;
    this.textModelService = textModelService;
    this._onDidChangeDiff = this._register(new Emitter());
    this.onDidChangeDiff = this._onDidChangeDiff.event;
    this.progressStore = this._store.add(new DisposableStore());
    this._register(this.onDidClick((e) => this.showDiff(e)));
    this._register(this.onDidContextMenu((event) => {
      this.contextMenuService.showContextMenu({
        contextKeyService: this.contextKeyService,
        getAnchor: () => event,
        getActions: () => {
          if (!this.uri) {
            return [];
          }
          const menu = this.menuService.getMenuActions(MenuId.ChatEditingCodeBlockContext, this.contextKeyService, {
            arg: {
              sessionResource: this.sessionResource,
              requestId: this.requestId,
              uri: this.uri,
              stopId: this.inUndoStop
            }
          });
          return getFlatContextMenuActions(menu);
        }
      });
    }));
  }
  get diff() {
    return this.currentDiff;
  }
  async showDiff({ editorOptions: options, openToSide }) {
    const group = openToSide ? SIDE_GROUP : void 0;
    if (this.currentDiff) {
      if (this.currentDiff.removed === 0 && await isResourceContentEmpty(this.textModelService, this.currentDiff.originalURI) && this.uri) {
        this.editorService.openEditor({ resource: this.uri, options }, group);
        return;
      }
      this.editorService.openEditor({
        original: { resource: this.currentDiff.originalURI },
        modified: { resource: this.currentDiff.modifiedURI },
        options
      }, group);
    } else if (this.uri) {
      this.editorService.openEditor({ resource: this.uri, options }, group);
    }
  }
  /**
   * @param uri URI of the file on-disk being changed
   */
  render(uri) {
    this.progressStore.clear();
    this.setUri(uri);
    this.setStatus(void 0, "");
    this.setLabelDetail("");
    this.setProgressFill(void 0);
    const session = this.chatService.getSession(this.sessionResource);
    const editSession = session?.editingSession;
    if (!editSession) {
      return;
    }
    const diffObservable = derived((reader) => {
      const entry = editSession.readEntry(uri, reader);
      return entry && editSession.getEntryDiffBetweenStops(entry.modifiedURI, this.requestId, this.inUndoStop);
    }).map((d, r) => d?.read(r));
    const isStreaming = derived((r) => {
      const entry = editSession.readEntry(uri, r);
      const currentlyModified = entry?.isCurrentlyBeingModifiedBy.read(r);
      return !!currentlyModified && currentlyModified.responseModel.requestId === this.requestId && currentlyModified.undoStopId === this.inUndoStop;
    });
    const iconText = this.labelService.getUriBasenameLabel(uri);
    this.progressStore.add(autorun((r) => {
      if (isStreaming.read(r)) {
        const codicon = ThemeIcon.modify(Codicon.loading, "spin");
        this.setStatus(codicon, localize("chat.codeblock.applyingEdits", "Applying edits"));
        const entry = editSession.readEntry(uri, r);
        const rwRatio = Math.floor((entry?.rewriteRatio.read(r) || 0) * 100);
        const showAnimation = this.configurationService.getValue(ChatConfiguration.ShowCodeBlockProgressAnimation);
        if (showAnimation) {
          this.setProgressFill(rwRatio);
          this.setLabelDetail("");
        } else {
          this.setProgressFill(void 0);
          this.setLabelDetail(rwRatio === 0 || !rwRatio ? localize("chat.codeblock.generating", "Generating edits...") : localize("chat.codeblock.applyingPercentage", "({0}%)...", rwRatio));
        }
      } else {
        this.setStatus(Codicon.check, localize("chat.codeblock.edited", "Edited"));
        this.setProgressFill(void 0);
        this.setLabelDetail("");
      }
    }));
    this.progressStore.add(autorunSelfDisposable((r) => {
      const changes = diffObservable.read(r);
      if (changes === void 0) {
        return;
      }
      if (changes && !changes?.identical && !changes?.quitEarly) {
        this.currentDiff = changes;
        this._onDidChangeDiff.fire(changes);
        this.setDiff({ added: changes.added, removed: changes.removed });
        const insertionsFragment = changes.added === 1 ? localize("chat.codeblock.insertions.one", "1 insertion") : localize("chat.codeblock.insertions", "{0} insertions", changes.added);
        const deletionsFragment = changes.removed === 1 ? localize("chat.codeblock.deletions.one", "1 deletion") : localize("chat.codeblock.deletions", "{0} deletions", changes.removed);
        this.setAriaLabel(localize("summary", "Edited {0}, {1}, {2}", iconText, insertionsFragment, deletionsFragment));
        if (changes.isFinal) {
          r.dispose();
        }
      }
    }));
  }
};
CollapsedCodeBlock = __decorateClass([
  __decorateParam(3, ILabelService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IModelService),
  __decorateParam(6, ILanguageService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IMenuService),
  __decorateParam(10, IHoverService),
  __decorateParam(11, IChatService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, ITextModelService)
], CollapsedCodeBlock);
function fixCodeText(text, languageId) {
  if (languageId === "php") {
    if (!text.trim().startsWith("<?")) {
      return `<?php
${text}`;
    }
  }
  return text;
}
export {
  ChatMarkdownContentPart,
  CollapsedCodeBlock,
  codeblockHasClosingBackticks
};
