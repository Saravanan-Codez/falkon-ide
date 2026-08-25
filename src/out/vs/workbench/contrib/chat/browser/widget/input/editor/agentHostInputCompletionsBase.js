import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { Range } from "../../../../../../../editor/common/core/range.js";
import { CompletionItemKind } from "../../../../../../../editor/common/languages.js";
import { isAtTriggerCharacterToken } from "./chatInputCompletionUtils.js";
class AgentHostInputCompletionsBase extends Disposable {
  constructor(_languageFeaturesService, _chatSessionsService) {
    super();
    this._languageFeaturesService = _languageFeaturesService;
    this._chatSessionsService = _chatSessionsService;
  }
  /**
   * Register a Monaco completion provider that delegates to this
   * instance. Subclasses call this once their lifecycle decides a
   * registration should exist (e.g. once a content provider becomes
   * available, or once the active session changes to an AHP-backed
   * one). The opaque {@link regData} is forwarded to
   * {@link _resolveContext} so the subclass can identify which
   * registration is firing (e.g. its scheme) and ignore models that
   * don't belong to it.
   */
  _registerProvider(filter, debugName, triggerCharacters, regData) {
    return this._languageFeaturesService.completionProvider.register(filter, {
      _debugDisplayName: debugName,
      triggerCharacters: [...triggerCharacters],
      provideCompletionItems: (model, position, _context, token) => this._provide(model, position, token, triggerCharacters, regData)
    });
  }
  async _provide(model, position, token, triggerCharacters, regData) {
    if (!isAtTriggerCharacterToken(model, position, triggerCharacters)) {
      return null;
    }
    const ctx = this._resolveContext(model, regData);
    if (!ctx) {
      return null;
    }
    const text = model.getValue();
    const offset = model.getOffsetAt(position);
    const result = await this._chatSessionsService.provideChatInputCompletions(ctx.sessionResource, { text, offset }, token);
    if (token.isCancellationRequested || !result) {
      return null;
    }
    const suggestions = [];
    for (const item of result.items) {
      const built = this._buildItem(position, item, ctx.context);
      if (built) {
        if (item.start && (built.kind === CompletionItemKind.File || built.kind === CompletionItemKind.Folder)) {
          built.filterText = model.getValueInRange(Range.fromPositions(item.start, position));
        }
        built.sortText ??= suggestions.length.toString().padStart(6, "0");
        suggestions.push(built);
      }
    }
    return { suggestions, incomplete: true };
  }
  /**
   * Compute the insert/replace ranges for an item. Positions returned
   * by the host are already 1-based Monaco positions, so they can be
   * used directly. When omitted, the ranges default to a zero-length
   * span at the cursor (Monaco then inserts without replacing).
   */
  static computeRange(position, item) {
    const start = item.start ?? position;
    const end = item.end ?? position;
    const replace = new Range(start.lineNumber, start.column, end.lineNumber, end.column);
    const insert = new Range(start.lineNumber, start.column, position.lineNumber, position.column);
    return { insert, replace };
  }
}
export {
  AgentHostInputCompletionsBase
};
