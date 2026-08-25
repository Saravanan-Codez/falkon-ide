import { decodeKeybinding } from "../../../base/common/keybindings.js";
import { OperatingSystem, OS } from "../../../base/common/platform.js";
import { CommandsRegistry } from "../../commands/common/commands.js";
import { Registry } from "../../registry/common/platform.js";
import { combinedDisposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { LinkedList } from "../../../base/common/linkedList.js";
var KeybindingWeight = /* @__PURE__ */ ((KeybindingWeight2) => {
  KeybindingWeight2[KeybindingWeight2["EditorCore"] = 0] = "EditorCore";
  KeybindingWeight2[KeybindingWeight2["EditorContrib"] = 100] = "EditorContrib";
  KeybindingWeight2[KeybindingWeight2["WorkbenchContrib"] = 200] = "WorkbenchContrib";
  KeybindingWeight2[KeybindingWeight2["SessionsContrib"] = 250] = "SessionsContrib";
  KeybindingWeight2[KeybindingWeight2["BuiltinExtension"] = 300] = "BuiltinExtension";
  KeybindingWeight2[KeybindingWeight2["ExternalExtension"] = 400] = "ExternalExtension";
  return KeybindingWeight2;
})(KeybindingWeight || {});
class KeybindingsRegistryImpl {
  constructor() {
    this._coreKeybindings = new LinkedList();
    this._coreKeybindingRules = new LinkedList();
    this._extensionKeybindings = [];
    this._cachedMergedKeybindings = null;
  }
  static bindToPlatform(kb, os) {
    if (os === OperatingSystem.Windows) {
      if (kb && kb.win) {
        return kb.win;
      }
    } else if (os === OperatingSystem.Macintosh) {
      if (kb && kb.mac) {
        return kb.mac;
      }
    } else {
      if (kb && kb.linux) {
        return kb.linux;
      }
    }
    return kb;
  }
  /**
   * Take current platform into account and reduce to primary & secondary.
   */
  static bindToCurrentPlatform(kb) {
    return KeybindingsRegistryImpl.bindToPlatform(kb, OS);
  }
  registerKeybindingRule(rule) {
    const actualKb = KeybindingsRegistryImpl.bindToCurrentPlatform(rule);
    const result = new DisposableStore();
    if (actualKb && actualKb.primary) {
      const kk = decodeKeybinding(actualKb.primary, OS);
      if (kk) {
        result.add(this._registerDefaultKeybinding(kk, rule.id, rule.args, rule.weight, 0, rule.when));
      }
    }
    if (actualKb && Array.isArray(actualKb.secondary)) {
      for (let i = 0, len = actualKb.secondary.length; i < len; i++) {
        const k = actualKb.secondary[i];
        const kk = decodeKeybinding(k, OS);
        if (kk) {
          result.add(this._registerDefaultKeybinding(kk, rule.id, rule.args, rule.weight, -i - 1, rule.when));
        }
      }
    }
    const removeRule = this._coreKeybindingRules.push(rule);
    result.add(toDisposable(() => {
      removeRule();
    }));
    return result;
  }
  setExtensionKeybindings(rules) {
    const result = [];
    let keybindingsLen = 0;
    for (const rule of rules) {
      if (rule.keybinding) {
        result[keybindingsLen++] = {
          keybinding: rule.keybinding,
          command: rule.id,
          commandArgs: rule.args,
          when: rule.when,
          weight1: rule.weight,
          weight2: 0,
          extensionId: rule.extensionId || null,
          isBuiltinExtension: rule.isBuiltinExtension || false
        };
      }
    }
    this._extensionKeybindings = result;
    this._cachedMergedKeybindings = null;
  }
  registerCommandAndKeybindingRule(desc) {
    return combinedDisposable(
      this.registerKeybindingRule(desc),
      CommandsRegistry.registerCommand(desc)
    );
  }
  _registerDefaultKeybinding(keybinding, commandId, commandArgs, weight1, weight2, when) {
    const remove = this._coreKeybindings.push({
      keybinding,
      command: commandId,
      commandArgs,
      when,
      weight1,
      weight2,
      extensionId: null,
      isBuiltinExtension: false
    });
    this._cachedMergedKeybindings = null;
    return toDisposable(() => {
      remove();
      this._cachedMergedKeybindings = null;
    });
  }
  getDefaultKeybindings() {
    if (!this._cachedMergedKeybindings) {
      this._cachedMergedKeybindings = Array.from(this._coreKeybindings).concat(this._extensionKeybindings);
      this._cachedMergedKeybindings.sort(sorter);
    }
    return this._cachedMergedKeybindings.slice(0);
  }
  getDefaultKeybindingsForOS(os) {
    const result = [];
    for (const rule of this._coreKeybindingRules) {
      const actualKb = KeybindingsRegistryImpl.bindToPlatform(rule, os);
      if (actualKb && actualKb.primary) {
        const kk = decodeKeybinding(actualKb.primary, os);
        if (kk) {
          result.push({
            keybinding: kk,
            command: rule.id,
            commandArgs: rule.args,
            when: rule.when,
            weight1: rule.weight,
            weight2: 0,
            extensionId: null,
            isBuiltinExtension: false
          });
        }
      }
      if (actualKb && Array.isArray(actualKb.secondary)) {
        for (let i = 0, len = actualKb.secondary.length; i < len; i++) {
          const k = actualKb.secondary[i];
          const kk = decodeKeybinding(k, os);
          if (kk) {
            result.push({
              keybinding: kk,
              command: rule.id,
              commandArgs: rule.args,
              when: rule.when,
              weight1: rule.weight,
              weight2: -i - 1,
              extensionId: null,
              isBuiltinExtension: false
            });
          }
        }
      }
    }
    result.sort(sorter);
    return result;
  }
}
const KeybindingsRegistry = new KeybindingsRegistryImpl();
const Extensions = {
  EditorModes: "platform.keybindingsRegistry"
};
Registry.add(Extensions.EditorModes, KeybindingsRegistry);
function sorter(a, b) {
  if (a.weight1 !== b.weight1) {
    return a.weight1 - b.weight1;
  }
  if (a.command && b.command) {
    if (a.command < b.command) {
      return -1;
    }
    if (a.command > b.command) {
      return 1;
    }
  }
  return a.weight2 - b.weight2;
}
export {
  Extensions,
  KeybindingWeight,
  KeybindingsRegistry
};
