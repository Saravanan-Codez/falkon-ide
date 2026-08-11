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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { autorun, observableFromEvent } from "../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { canLog, ILoggerService, LogLevel } from "../../../../../platform/log/common/log.js";
import { CodeEditorWidget } from "../../../../browser/widget/codeEditor/codeEditorWidget.js";
import { StructuredLogger } from "../structuredLogger.js";
let TextModelChangeRecorder = class extends Disposable {
  constructor(_editor, _instantiationService, _loggerService) {
    super();
    this._editor = _editor;
    this._instantiationService = _instantiationService;
    this._loggerService = _loggerService;
    this._structuredLogger = this._register(this._instantiationService.createInstance(
      StructuredLogger.cast(),
      "editor.inlineSuggest.logChangeReason.commandId"
    ));
    const logger = this._loggerService?.createLogger("textModelChanges", { hidden: false, name: "Text Model Changes Reason" });
    const loggingLevel = observableFromEvent(this, logger.onDidChangeLogLevel, () => logger.getLevel());
    this._register(autorun((reader) => {
      if (!canLog(loggingLevel.read(reader), LogLevel.Trace)) {
        return;
      }
      reader.store.add(this._editor.onDidChangeModelContent((e) => {
        if (this._editor.getModel()?.uri.scheme === "output") {
          return;
        }
        logger.trace("onDidChangeModelContent: " + e.detailedReasons.map((r) => r.toKey(Number.MAX_VALUE)).join(", "));
      }));
    }));
    this._register(autorun((reader) => {
      if (!(this._editor instanceof CodeEditorWidget)) {
        return;
      }
      if (!this._structuredLogger.isEnabled.read(reader)) {
        return;
      }
      reader.store.add(this._editor.onDidChangeModelContent((e) => {
        const tm = this._editor.getModel();
        if (!tm) {
          return;
        }
        const reason = e.detailedReasons[0];
        const data = {
          ...reason.metadata,
          sourceId: "TextModel.setChangeReason",
          source: reason.metadata.source,
          time: Date.now(),
          modelUri: tm.uri,
          modelVersion: tm.getVersionId()
        };
        setTimeout(() => {
          this._structuredLogger.log(data);
        }, 0);
      }));
    }));
  }
};
TextModelChangeRecorder = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ILoggerService)
], TextModelChangeRecorder);
export {
  TextModelChangeRecorder
};
