import * as dom from "../../dom.js";
import { Toggle } from "../toggle/toggle.js";
import { Codicon } from "../../../common/codicons.js";
import { KeyCode } from "../../../common/keyCodes.js";
import * as nls from "../../../../nls.js";
function navigateToggles(event, domNode, getToggleDomNodes, focusInput) {
  if (event.equals(KeyCode.LeftArrow) || event.equals(KeyCode.RightArrow) || event.equals(KeyCode.Escape)) {
    const indexes = getToggleDomNodes();
    const index = indexes.indexOf(domNode.ownerDocument.activeElement);
    if (index >= 0) {
      let newIndex = -1;
      if (event.equals(KeyCode.RightArrow)) {
        newIndex = (index + 1) % indexes.length;
      } else if (event.equals(KeyCode.LeftArrow)) {
        if (index === 0) {
          newIndex = indexes.length - 1;
        } else {
          newIndex = index - 1;
        }
      }
      if (event.equals(KeyCode.Escape)) {
        indexes[index].blur();
        focusInput();
      } else if (newIndex >= 0) {
        indexes[newIndex].focus();
      }
      dom.EventHelper.stop(event, true);
    }
  }
}
const NLS_CASE_SENSITIVE_TOGGLE_LABEL = nls.localize("caseDescription", "Match Case");
const NLS_WHOLE_WORD_TOGGLE_LABEL = nls.localize("wordsDescription", "Match Whole Word");
const NLS_REGEX_TOGGLE_LABEL = nls.localize("regexDescription", "Use Regular Expression");
class CaseSensitiveToggle extends Toggle {
  constructor(opts) {
    super({
      icon: Codicon.caseSensitive,
      title: NLS_CASE_SENSITIVE_TOGGLE_LABEL + opts.appendTitle,
      isChecked: opts.isChecked,
      hoverLifecycleOptions: opts.hoverLifecycleOptions,
      inputActiveOptionBorder: opts.inputActiveOptionBorder,
      inputActiveOptionForeground: opts.inputActiveOptionForeground,
      inputActiveOptionBackground: opts.inputActiveOptionBackground
    });
  }
}
class WholeWordsToggle extends Toggle {
  constructor(opts) {
    super({
      icon: Codicon.wholeWord,
      title: NLS_WHOLE_WORD_TOGGLE_LABEL + opts.appendTitle,
      isChecked: opts.isChecked,
      hoverLifecycleOptions: opts.hoverLifecycleOptions,
      inputActiveOptionBorder: opts.inputActiveOptionBorder,
      inputActiveOptionForeground: opts.inputActiveOptionForeground,
      inputActiveOptionBackground: opts.inputActiveOptionBackground
    });
  }
}
class RegexToggle extends Toggle {
  constructor(opts) {
    super({
      icon: Codicon.regex,
      title: NLS_REGEX_TOGGLE_LABEL + opts.appendTitle,
      isChecked: opts.isChecked,
      hoverLifecycleOptions: opts.hoverLifecycleOptions,
      inputActiveOptionBorder: opts.inputActiveOptionBorder,
      inputActiveOptionForeground: opts.inputActiveOptionForeground,
      inputActiveOptionBackground: opts.inputActiveOptionBackground
    });
  }
}
export {
  CaseSensitiveToggle,
  RegexToggle,
  WholeWordsToggle,
  navigateToggles
};
