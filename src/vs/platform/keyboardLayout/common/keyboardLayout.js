import { ScanCode, ScanCodeUtils } from "../../../base/common/keyCodes.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IKeyboardLayoutService = createDecorator("keyboardLayoutService");
function areKeyboardLayoutsEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  if (a.name && b.name && a.name === b.name) {
    return true;
  }
  if (a.id && b.id && a.id === b.id) {
    return true;
  }
  if (a.model && b.model && a.model === b.model && a.layout === b.layout) {
    return true;
  }
  return false;
}
function parseKeyboardLayoutDescription(layout) {
  if (!layout) {
    return { label: "", description: "" };
  }
  if (layout.name) {
    const windowsLayout = layout;
    return {
      label: windowsLayout.text,
      description: ""
    };
  }
  if (layout.id) {
    const macLayout = layout;
    if (macLayout.localizedName) {
      return {
        label: macLayout.localizedName,
        description: ""
      };
    }
    if (/^com\.apple\.keylayout\./.test(macLayout.id)) {
      return {
        label: macLayout.id.replace(/^com\.apple\.keylayout\./, "").replace(/-/g, " "),
        description: ""
      };
    }
    if (/^.*inputmethod\./.test(macLayout.id)) {
      return {
        label: macLayout.id.replace(/^.*inputmethod\./, "").replace(/[-\.]/g, " "),
        description: `Input Method (${macLayout.lang})`
      };
    }
    return {
      label: macLayout.lang,
      description: ""
    };
  }
  const linuxLayout = layout;
  return {
    label: linuxLayout.layout,
    description: ""
  };
}
function getKeyboardLayoutId(layout) {
  if (layout.name) {
    return layout.name;
  }
  if (layout.id) {
    return layout.id;
  }
  return layout.layout;
}
function windowsKeyMappingEquals(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.vkey === b.vkey && a.value === b.value && a.withShift === b.withShift && a.withAltGr === b.withAltGr && a.withShiftAltGr === b.withShiftAltGr;
}
function windowsKeyboardMappingEquals(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  for (let scanCode = 0; scanCode < ScanCode.MAX_VALUE; scanCode++) {
    const strScanCode = ScanCodeUtils.toString(scanCode);
    const aEntry = a[strScanCode];
    const bEntry = b[strScanCode];
    if (!windowsKeyMappingEquals(aEntry, bEntry)) {
      return false;
    }
  }
  return true;
}
function macLinuxKeyMappingEquals(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.value === b.value && a.withShift === b.withShift && a.withAltGr === b.withAltGr && a.withShiftAltGr === b.withShiftAltGr;
}
function macLinuxKeyboardMappingEquals(a, b) {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  for (let scanCode = 0; scanCode < ScanCode.MAX_VALUE; scanCode++) {
    const strScanCode = ScanCodeUtils.toString(scanCode);
    const aEntry = a[strScanCode];
    const bEntry = b[strScanCode];
    if (!macLinuxKeyMappingEquals(aEntry, bEntry)) {
      return false;
    }
  }
  return true;
}
export {
  IKeyboardLayoutService,
  areKeyboardLayoutsEqual,
  getKeyboardLayoutId,
  macLinuxKeyboardMappingEquals,
  parseKeyboardLayoutDescription,
  windowsKeyboardMappingEquals
};
