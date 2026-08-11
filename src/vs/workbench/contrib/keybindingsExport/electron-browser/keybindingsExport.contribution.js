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
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { URI } from "../../../../base/common/uri.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { join } from "../../../../base/common/path.js";
import { OperatingSystem } from "../../../../base/common/platform.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { KeybindingWeight, KeybindingsRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeybindingResolver } from "../../../../platform/keybinding/common/keybindingResolver.js";
import { ResolvedKeybindingItem } from "../../../../platform/keybinding/common/resolvedKeybindingItem.js";
import { KeybindingParser } from "../../../../base/common/keybindingParser.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { MacLinuxKeyboardMapper } from "../../../services/keybinding/common/macLinuxKeyboardMapper.js";
import { WindowsKeyboardMapper } from "../../../services/keybinding/common/windowsKeyboardMapper.js";
import { KeymapInfo } from "../../../services/keybinding/common/keymapInfo.js";
import { EN_US_WIN_LAYOUT } from "../../../services/keybinding/browser/keyboardLayouts/en.win.js";
import { EN_US_DARWIN_LAYOUT } from "../../../services/keybinding/browser/keyboardLayouts/en.darwin.js";
import { EN_US_LINUX_LAYOUT } from "../../../services/keybinding/browser/keyboardLayouts/en.linux.js";
import { KeybindingIO, OutputBuilder } from "../../../services/keybinding/common/keybindingIO.js";
import { getAllUnboundCommands } from "../../../services/keybinding/browser/unboundCommands.js";
let KeybindingsExportContribution = class extends Disposable {
  constructor(nativeEnvironmentService, fileService, nativeHostService, productService, extensionService, logService) {
    super();
    this.nativeEnvironmentService = nativeEnvironmentService;
    this.fileService = fileService;
    this.nativeHostService = nativeHostService;
    this.productService = productService;
    this.extensionService = extensionService;
    this.logService = logService;
    if (this.productService.quality === "stable") {
      return;
    }
    const outputPath = this.nativeEnvironmentService.exportDefaultKeybindings;
    if (outputPath !== void 0) {
      const defaultPath = join(this.nativeEnvironmentService.appRoot, "doc");
      void this.extensionService.whenInstalledExtensionsRegistered().then(() => {
        return this.exportDefaultKeybindingsAndQuit(outputPath || defaultPath);
      }).catch(async (error) => {
        this.logService.error(`[${KeybindingsExportContribution.ID}] Failed to register installed extensions before exporting default keybindings`, error);
        await this.nativeHostService.closeWindow();
      });
    }
  }
  static {
    this.ID = "workbench.contrib.keybindingsExport";
  }
  async exportDefaultKeybindingsAndQuit(outputPath) {
    try {
      await this.fileService.createFolder(URI.file(outputPath));
      const platforms = [
        { os: OperatingSystem.Windows, filename: "doc.keybindings.win.json" },
        { os: OperatingSystem.Macintosh, filename: "doc.keybindings.osx.json" },
        { os: OperatingSystem.Linux, filename: "doc.keybindings.linux.json" }
      ];
      const extensions = this.extensionService.extensions;
      for (const { os, filename } of platforms) {
        const content = KeybindingsExportContribution._getDefaultKeybindingsContentForOS(os, extensions);
        const filePath = join(outputPath, filename);
        await this.fileService.writeFile(URI.file(filePath), VSBuffer.fromString(content));
        this.logService.info(`[${KeybindingsExportContribution.ID}] Wrote ${filePath}`);
      }
      await this.nativeHostService.closeWindow();
    } catch (error) {
      this.logService.error(`[${KeybindingsExportContribution.ID}] Failed to generate default keybindings`, error);
      await this.nativeHostService.closeWindow();
    }
  }
  static _getDefaultKeybindingsContentForOS(os, extensions) {
    const coreItems = KeybindingsRegistry.getDefaultKeybindingsForOS(os);
    const extensionItems = KeybindingsExportContribution._getExtensionKeybindingsForOS(extensions, os);
    const items = coreItems.concat(extensionItems);
    const mapper = KeybindingsExportContribution._createKeyboardMapperForOS(os);
    const resolved = KeybindingsExportContribution._resolveKeybindingItemsWithMapper(items, mapper);
    const resolver = new KeybindingResolver(resolved, [], () => {
    });
    const defaultKeybindings = resolver.getDefaultKeybindings();
    const boundCommands = resolver.getDefaultBoundCommands();
    return KeybindingsExportContribution._formatDefaultKeybindings(defaultKeybindings) + "\n\n" + KeybindingsExportContribution._formatAllCommandsAsComment(boundCommands);
  }
  static _getExtensionKeybindingsForOS(extensions, os) {
    const result = [];
    for (const ext of extensions) {
      if (!ext.isBuiltin) {
        continue;
      }
      const keybindings = ext.contributes?.keybindings;
      if (!keybindings) {
        continue;
      }
      const bindings = Array.isArray(keybindings) ? keybindings : [keybindings];
      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i];
        const keyStr = KeybindingsExportContribution._bindToOS(binding.key, binding.mac, binding.linux, binding.win, os);
        if (!keyStr) {
          continue;
        }
        const keybinding = KeybindingParser.parseKeybinding(keyStr);
        if (!keybinding) {
          continue;
        }
        const commandAction = MenuRegistry.getCommand(binding.command);
        const precondition = commandAction?.precondition;
        let when = binding.when ? ContextKeyExpr.deserialize(binding.when) : void 0;
        if (when && precondition) {
          when = ContextKeyExpr.and(precondition, when) ?? void 0;
        } else if (precondition) {
          when = precondition;
        }
        result.push({
          keybinding,
          command: binding.command,
          commandArgs: void 0,
          when: when ?? null,
          weight1: KeybindingWeight.BuiltinExtension + i,
          weight2: 0,
          extensionId: ext.identifier.value,
          isBuiltinExtension: true
        });
      }
    }
    return result;
  }
  static _bindToOS(key, mac, linux, win, os) {
    if (os === OperatingSystem.Windows && win) {
      return win;
    }
    if (os === OperatingSystem.Macintosh && mac) {
      return mac;
    }
    if (os === OperatingSystem.Linux && linux) {
      return linux;
    }
    return key;
  }
  static _createKeyboardMapperForOS(os) {
    const layoutMap = {
      [OperatingSystem.Windows]: EN_US_WIN_LAYOUT,
      [OperatingSystem.Macintosh]: EN_US_DARWIN_LAYOUT,
      [OperatingSystem.Linux]: EN_US_LINUX_LAYOUT
    };
    const layout = layoutMap[os];
    const keymapInfo = new KeymapInfo(layout.layout, layout.secondaryLayouts, layout.mapping);
    switch (os) {
      case OperatingSystem.Windows:
        return new WindowsKeyboardMapper(true, keymapInfo.mapping, false);
      case OperatingSystem.Macintosh:
        return new MacLinuxKeyboardMapper(true, keymapInfo.mapping, false, OperatingSystem.Macintosh);
      case OperatingSystem.Linux:
        return new MacLinuxKeyboardMapper(true, keymapInfo.mapping, false, OperatingSystem.Linux);
    }
  }
  static _resolveKeybindingItemsWithMapper(items, mapper) {
    const result = [];
    for (const item of items) {
      const when = item.when || void 0;
      const keybinding = item.keybinding;
      if (!keybinding) {
        result.push(new ResolvedKeybindingItem(void 0, item.command, item.commandArgs, when, true, item.extensionId, item.isBuiltinExtension));
      } else {
        const resolvedKeybindings = mapper.resolveKeybinding(keybinding);
        for (let i = resolvedKeybindings.length - 1; i >= 0; i--) {
          result.push(new ResolvedKeybindingItem(resolvedKeybindings[i], item.command, item.commandArgs, when, true, item.extensionId, item.isBuiltinExtension));
        }
      }
    }
    return result;
  }
  static _formatDefaultKeybindings(defaultKeybindings) {
    const out = new OutputBuilder();
    out.writeLine("[");
    const lastIndex = defaultKeybindings.length - 1;
    defaultKeybindings.forEach((k, index) => {
      KeybindingIO.writeKeybindingItem(out, k);
      if (index !== lastIndex) {
        out.writeLine(",");
      } else {
        out.writeLine();
      }
    });
    out.writeLine("]");
    return out.toString();
  }
  static _formatAllCommandsAsComment(boundCommands) {
    const unboundCommands = getAllUnboundCommands(boundCommands);
    const pretty = unboundCommands.sort().join("\n// - ");
    return "// Here are other available commands: \n// - " + pretty;
  }
};
KeybindingsExportContribution = __decorateClass([
  __decorateParam(0, INativeEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, INativeHostService),
  __decorateParam(3, IProductService),
  __decorateParam(4, IExtensionService),
  __decorateParam(5, ILogService)
], KeybindingsExportContribution);
registerWorkbenchContribution2(
  KeybindingsExportContribution.ID,
  KeybindingsExportContribution,
  WorkbenchPhase.Eventually
);
export {
  KeybindingsExportContribution
};
