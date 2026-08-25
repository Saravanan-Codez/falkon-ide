import { ShiftCommand } from "../commands/shiftCommand.js";
import { CompositionSurroundSelectionCommand } from "../commands/surroundSelectionCommand.js";
import { EditOperationResult, EditOperationType, isQuote } from "../cursorCommon.js";
import { AutoClosingOpenCharTypeOperation, AutoClosingOvertypeOperation, AutoClosingOvertypeWithInterceptorsOperation, AutoIndentOperation, CompositionOperation, CompositionEndOvertypeOperation, EnterOperation, InterceptorElectricCharOperation, PasteOperation, shiftIndent, shouldSurroundChar, SimpleCharacterTypeOperation, SurroundSelectionOperation, TabOperation, TypeWithoutInterceptorsOperation, unshiftIndent } from "./cursorTypeEditOperations.js";
class TypeOperations {
  static indent(config, model, selections) {
    if (model === null || selections === null) {
      return [];
    }
    const commands = [];
    for (let i = 0, len = selections.length; i < len; i++) {
      commands[i] = new ShiftCommand(selections[i], {
        isUnshift: false,
        tabSize: config.tabSize,
        indentSize: config.indentSize,
        insertSpaces: config.insertSpaces,
        useTabStops: config.useTabStops,
        autoIndent: config.autoIndent
      }, config.languageConfigurationService);
    }
    return commands;
  }
  static outdent(config, model, selections) {
    const commands = [];
    for (let i = 0, len = selections.length; i < len; i++) {
      commands[i] = new ShiftCommand(selections[i], {
        isUnshift: true,
        tabSize: config.tabSize,
        indentSize: config.indentSize,
        insertSpaces: config.insertSpaces,
        useTabStops: config.useTabStops,
        autoIndent: config.autoIndent
      }, config.languageConfigurationService);
    }
    return commands;
  }
  static shiftIndent(config, indentation, count) {
    return shiftIndent(config, indentation, count);
  }
  static unshiftIndent(config, indentation, count) {
    return unshiftIndent(config, indentation, count);
  }
  static paste(config, model, selections, text, pasteOnNewLine, multicursorText) {
    return PasteOperation.getEdits(config, model, selections, text, pasteOnNewLine, multicursorText);
  }
  static tab(config, model, selections) {
    return TabOperation.getCommands(config, model, selections);
  }
  static compositionType(prevEditOperationType, config, model, selections, text, replacePrevCharCnt, replaceNextCharCnt, positionDelta) {
    return CompositionOperation.getEdits(prevEditOperationType, config, model, selections, text, replacePrevCharCnt, replaceNextCharCnt, positionDelta);
  }
  /**
   * This is very similar with typing, but the character is already in the text buffer!
   */
  static compositionEndWithInterceptors(prevEditOperationType, config, model, compositions, selections, autoClosedCharacters) {
    if (!compositions) {
      return null;
    }
    let insertedText = null;
    for (const composition of compositions) {
      if (insertedText === null) {
        insertedText = composition.insertedText;
      } else if (insertedText !== composition.insertedText) {
        return null;
      }
    }
    if (!insertedText || insertedText.length !== 1) {
      return CompositionEndOvertypeOperation.getEdits(config, compositions);
    }
    const ch = insertedText;
    let hasDeletion = false;
    for (const composition of compositions) {
      if (composition.deletedText.length !== 0) {
        hasDeletion = true;
        break;
      }
    }
    if (hasDeletion) {
      if (!shouldSurroundChar(config, ch) || !config.surroundingPairs.hasOwnProperty(ch)) {
        return null;
      }
      const isTypingAQuoteCharacter = isQuote(ch);
      for (const composition of compositions) {
        if (composition.deletedSelectionStart !== 0 || composition.deletedSelectionEnd !== composition.deletedText.length) {
          return null;
        }
        if (/^[ \t]+$/.test(composition.deletedText)) {
          return null;
        }
        if (isTypingAQuoteCharacter && isQuote(composition.deletedText)) {
          return null;
        }
      }
      const positions = [];
      for (const selection of selections) {
        if (!selection.isEmpty()) {
          return null;
        }
        positions.push(selection.getPosition());
      }
      if (positions.length !== compositions.length) {
        return null;
      }
      const commands = [];
      for (let i = 0, len = positions.length; i < len; i++) {
        commands.push(new CompositionSurroundSelectionCommand(positions[i], compositions[i].deletedText, config.surroundingPairs[ch]));
      }
      return new EditOperationResult(EditOperationType.TypingOther, commands, {
        shouldPushStackElementBefore: true,
        shouldPushStackElementAfter: false
      });
    }
    const autoClosingOvertypeEdits = AutoClosingOvertypeWithInterceptorsOperation.getEdits(config, model, selections, autoClosedCharacters, ch);
    if (autoClosingOvertypeEdits !== void 0) {
      return autoClosingOvertypeEdits;
    }
    const autoClosingOpenCharEdits = AutoClosingOpenCharTypeOperation.getEdits(config, model, selections, ch, true, false);
    if (autoClosingOpenCharEdits !== void 0) {
      return autoClosingOpenCharEdits;
    }
    return CompositionEndOvertypeOperation.getEdits(config, compositions);
  }
  static typeWithInterceptors(isDoingComposition, prevEditOperationType, config, model, selections, autoClosedCharacters, ch) {
    const enterEdits = EnterOperation.getEdits(config, model, selections, ch, isDoingComposition);
    if (enterEdits !== void 0) {
      return enterEdits;
    }
    const autoIndentEdits = AutoIndentOperation.getEdits(config, model, selections, ch, isDoingComposition);
    if (autoIndentEdits !== void 0) {
      return autoIndentEdits;
    }
    const autoClosingOverTypeEdits = AutoClosingOvertypeOperation.getEdits(prevEditOperationType, config, model, selections, autoClosedCharacters, ch);
    if (autoClosingOverTypeEdits !== void 0) {
      return autoClosingOverTypeEdits;
    }
    const autoClosingOpenCharEdits = AutoClosingOpenCharTypeOperation.getEdits(config, model, selections, ch, false, isDoingComposition);
    if (autoClosingOpenCharEdits !== void 0) {
      return autoClosingOpenCharEdits;
    }
    const surroundSelectionEdits = SurroundSelectionOperation.getEdits(config, model, selections, ch, isDoingComposition);
    if (surroundSelectionEdits !== void 0) {
      return surroundSelectionEdits;
    }
    const interceptorElectricCharOperation = InterceptorElectricCharOperation.getEdits(prevEditOperationType, config, model, selections, ch, isDoingComposition);
    if (interceptorElectricCharOperation !== void 0) {
      return interceptorElectricCharOperation;
    }
    return SimpleCharacterTypeOperation.getEdits(config, prevEditOperationType, selections, ch, isDoingComposition);
  }
  static typeWithoutInterceptors(prevEditOperationType, config, model, selections, str) {
    return TypeWithoutInterceptorsOperation.getEdits(prevEditOperationType, selections, str);
  }
}
class CompositionOutcome {
  constructor(deletedText, deletedSelectionStart, deletedSelectionEnd, insertedText, insertedSelectionStart, insertedSelectionEnd, insertedTextRange) {
    this.deletedText = deletedText;
    this.deletedSelectionStart = deletedSelectionStart;
    this.deletedSelectionEnd = deletedSelectionEnd;
    this.insertedText = insertedText;
    this.insertedSelectionStart = insertedSelectionStart;
    this.insertedSelectionEnd = insertedSelectionEnd;
    this.insertedTextRange = insertedTextRange;
  }
}
export {
  CompositionOutcome,
  TypeOperations
};
