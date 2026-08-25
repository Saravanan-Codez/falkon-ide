import { localize } from "../../../../../nls.js";
import { Extensions as ConfigurationExtensions } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
var TerminalSuggestSettingId = /* @__PURE__ */ ((TerminalSuggestSettingId2) => {
  TerminalSuggestSettingId2["Enabled"] = "terminal.integrated.suggest.enabled";
  TerminalSuggestSettingId2["QuickSuggestions"] = "terminal.integrated.suggest.quickSuggestions";
  TerminalSuggestSettingId2["SuggestOnTriggerCharacters"] = "terminal.integrated.suggest.suggestOnTriggerCharacters";
  TerminalSuggestSettingId2["RunOnEnter"] = "terminal.integrated.suggest.runOnEnter";
  TerminalSuggestSettingId2["WindowsExecutableExtensions"] = "terminal.integrated.suggest.windowsExecutableExtensions";
  TerminalSuggestSettingId2["Providers"] = "terminal.integrated.suggest.providers";
  TerminalSuggestSettingId2["ShowStatusBar"] = "terminal.integrated.suggest.showStatusBar";
  TerminalSuggestSettingId2["CdPath"] = "terminal.integrated.suggest.cdPath";
  TerminalSuggestSettingId2["InlineSuggestion"] = "terminal.integrated.suggest.inlineSuggestion";
  TerminalSuggestSettingId2["UpArrowNavigatesHistory"] = "terminal.integrated.suggest.upArrowNavigatesHistory";
  TerminalSuggestSettingId2["SelectionMode"] = "terminal.integrated.suggest.selectionMode";
  TerminalSuggestSettingId2["InsertTrailingSpace"] = "terminal.integrated.suggest.insertTrailingSpace";
  return TerminalSuggestSettingId2;
})(TerminalSuggestSettingId || {});
const windowsDefaultExecutableExtensions = [
  "exe",
  // Executable file
  "bat",
  // Batch file
  "cmd",
  // Command script
  "com",
  // Command file
  "msi",
  // Windows Installer package
  "ps1",
  // PowerShell script
  "vbs",
  // VBScript file
  "js",
  // JScript file
  "jar",
  // Java Archive (requires Java runtime)
  "py",
  // Python script (requires Python interpreter)
  "rb",
  // Ruby script (requires Ruby interpreter)
  "pl",
  // Perl script (requires Perl interpreter)
  "sh"
  // Shell script (via WSL or third-party tools)
];
const terminalSuggestConfigSection = "terminal.integrated.suggest";
function normalizeQuickSuggestionsConfig(config) {
  if (typeof config === "boolean") {
    return config ? { commands: "on", arguments: "on", unknown: "off" } : { commands: "off", arguments: "off", unknown: "off" };
  }
  return config;
}
const terminalSuggestConfiguration = {
  ["terminal.integrated.suggest.enabled" /* Enabled */]: {
    restricted: true,
    markdownDescription: localize("suggest.enabled", "Enables terminal IntelliSense suggestions (also known as autocomplete) for supported shells ({0}). This requires {1} to be enabled and working or [manually installed](https://code.visualstudio.com/docs/terminal/shell-integration#_manual-installation-install).", "Windows PowerShell, PowerShell v7+, zsh, bash, fish", `\`#${TerminalSettingId.ShellIntegrationEnabled}#\``),
    type: "boolean",
    default: true
  },
  ["terminal.integrated.suggest.providers" /* Providers */]: {
    restricted: true,
    markdownDescription: localize("suggest.providers", "Providers are enabled by default. Omit them by setting the id of the provider to `false`."),
    type: "object",
    properties: {}
  },
  ["terminal.integrated.suggest.quickSuggestions" /* QuickSuggestions */]: {
    restricted: true,
    markdownDescription: localize("suggest.quickSuggestions", "Controls whether suggestions should automatically show up while typing. Also be aware of the {0}-setting which controls if suggestions are triggered by special characters.", `\`#${"terminal.integrated.suggest.suggestOnTriggerCharacters" /* SuggestOnTriggerCharacters */}#\``),
    type: "object",
    properties: {
      commands: {
        description: localize("suggest.quickSuggestions.commands", "Enable quick suggestions for commands, the first word in a command line input."),
        type: "string",
        enum: ["on", "off"]
      },
      arguments: {
        description: localize("suggest.quickSuggestions.arguments", "Enable quick suggestions for arguments, anything after the first word in a command line input."),
        type: "string",
        enum: ["on", "off"]
      },
      unknown: {
        description: localize("suggest.quickSuggestions.unknown", "Enable quick suggestions when it's unclear what the best suggestion is, if this is on files and folders will be suggested as a fallback."),
        type: "string",
        enum: ["on", "off"]
      }
    },
    additionalProperties: false,
    default: {
      commands: "off",
      arguments: "off",
      unknown: "off"
    }
  },
  ["terminal.integrated.suggest.suggestOnTriggerCharacters" /* SuggestOnTriggerCharacters */]: {
    restricted: true,
    markdownDescription: localize("suggest.suggestOnTriggerCharacters", "Controls whether suggestions should automatically show up when typing trigger characters."),
    type: "boolean",
    default: false
  },
  ["terminal.integrated.suggest.runOnEnter" /* RunOnEnter */]: {
    restricted: true,
    markdownDescription: localize("suggest.runOnEnter", "Controls whether suggestions should run immediately when `Enter` (not `Tab`) is used to accept the result."),
    enum: ["never", "exactMatch", "exactMatchIgnoreExtension", "always"],
    markdownEnumDescriptions: [
      localize("runOnEnter.never", "Never run on `Enter`."),
      localize("runOnEnter.exactMatch", "Run on `Enter` when the suggestion is typed in its entirety."),
      localize("runOnEnter.exactMatchIgnoreExtension", "Run on `Enter` when the suggestion is typed in its entirety or when a file is typed without its extension included."),
      localize("runOnEnter.always", "Always run on `Enter`.")
    ],
    default: "never"
  },
  ["terminal.integrated.suggest.selectionMode" /* SelectionMode */]: {
    markdownDescription: localize("terminal.integrated.selectionMode", "Controls how suggestion selection works in the integrated terminal."),
    type: "string",
    enum: ["partial", "always", "never"],
    markdownEnumDescriptions: [
      localize("terminal.integrated.selectionMode.partial", "Partially select a suggestion when automatically triggering IntelliSense. `Tab` can be used to accept the first suggestion, only after navigating the suggestions via `Down` will `Enter` also accept the active suggestion."),
      localize("terminal.integrated.selectionMode.always", "Always select a suggestion when automatically triggering IntelliSense. `Enter` or `Tab` can be used to accept the first suggestion."),
      localize("terminal.integrated.selectionMode.never", "Never select a suggestion when automatically triggering IntelliSense. The list must be navigated via `Down` before `Enter` or `Tab` can be used to accept the active suggestion.")
    ],
    default: "partial"
  },
  ["terminal.integrated.suggest.windowsExecutableExtensions" /* WindowsExecutableExtensions */]: {
    restricted: true,
    markdownDescription: localize(
      "terminalWindowsExecutableSuggestionSetting",
      "A set of windows command executable extensions that will be included as suggestions in the terminal.\n\nMany executables are included by default, listed below:\n\n{0}.\n\nTo exclude an extension, set it to `false`\n\n. To include one not in the list, add it and set it to `true`.",
      windowsDefaultExecutableExtensions.sort().map((extension) => `- ${extension}`).join("\n")
    ),
    type: "object",
    default: {}
  },
  ["terminal.integrated.suggest.showStatusBar" /* ShowStatusBar */]: {
    restricted: true,
    markdownDescription: localize("suggest.showStatusBar", "Controls whether the terminal suggestions status bar should be shown."),
    type: "boolean",
    default: true
  },
  ["terminal.integrated.suggest.cdPath" /* CdPath */]: {
    restricted: true,
    markdownDescription: localize("suggest.cdPath", "Controls whether to enable $CDPATH support which exposes children of the folders in the $CDPATH variable regardless of the current working directory. $CDPATH is expected to be semi colon-separated on Windows and colon-separated on other platforms."),
    type: "string",
    enum: ["off", "relative", "absolute"],
    markdownEnumDescriptions: [
      localize("suggest.cdPath.off", "Disable the feature."),
      localize("suggest.cdPath.relative", "Enable the feature and use relative paths."),
      localize("suggest.cdPath.absolute", "Enable the feature and use absolute paths. This is useful when the shell doesn't natively support `$CDPATH`.")
    ],
    default: "absolute"
  },
  ["terminal.integrated.suggest.inlineSuggestion" /* InlineSuggestion */]: {
    restricted: true,
    markdownDescription: localize("suggest.inlineSuggestion", "Controls whether the shell's inline suggestion should be detected and how it is scored."),
    type: "string",
    enum: ["off", "alwaysOnTopExceptExactMatch", "alwaysOnTop"],
    markdownEnumDescriptions: [
      localize("suggest.inlineSuggestion.off", "Disable the feature."),
      localize("suggest.inlineSuggestion.alwaysOnTopExceptExactMatch", "Enable the feature and sort the inline suggestion without forcing it to be on top. This means that exact matches will be above the inline suggestion."),
      localize("suggest.inlineSuggestion.alwaysOnTop", "Enable the feature and always put the inline suggestion on top.")
    ],
    default: "alwaysOnTop"
  },
  ["terminal.integrated.suggest.upArrowNavigatesHistory" /* UpArrowNavigatesHistory */]: {
    restricted: true,
    markdownDescription: localize("suggest.upArrowNavigatesHistory", "Determines whether the up arrow key navigates the command history when focus is on the first suggestion and navigation has not yet occurred. When set to false, the up arrow will move focus to the last suggestion instead."),
    type: "boolean",
    default: true
  },
  ["terminal.integrated.suggest.insertTrailingSpace" /* InsertTrailingSpace */]: {
    restricted: true,
    markdownDescription: localize("suggest.insertTrailingSpace", "Controls whether a space is automatically inserted after accepting a suggestion and re-trigger suggestions. Folders and symbolic link folders will never have a trailing space added."),
    type: "boolean",
    default: false
  }
};
let terminalSuggestProvidersConfiguration;
function registerTerminalSuggestProvidersConfiguration(providers) {
  const oldProvidersConfiguration = terminalSuggestProvidersConfiguration;
  providers ??= /* @__PURE__ */ new Map();
  if (!providers.has("lsp")) {
    providers.set("lsp", {
      id: "lsp",
      description: localize("suggest.provider.lsp.description", "Show suggestions from language servers.")
    });
  }
  const providersProperties = {};
  for (const id of Array.from(providers.keys()).sort()) {
    providersProperties[id] = {
      type: "boolean",
      default: id === "lsp" ? false : true,
      description: providers.get(id)?.description ?? localize("suggest.provider.title", "Show suggestions from {0}.", id)
    };
  }
  const defaultValue = {};
  for (const key in providersProperties) {
    defaultValue[key] = providersProperties[key].default;
  }
  terminalSuggestProvidersConfiguration = {
    id: "terminalSuggestProviders",
    order: 100,
    title: localize("terminalSuggestProvidersConfigurationTitle", "Terminal Suggest Providers"),
    type: "object",
    properties: {
      ["terminal.integrated.suggest.providers" /* Providers */]: {
        restricted: true,
        markdownDescription: localize("suggest.providersEnabledByDefault", "Controls which suggestions automatically show up while typing. Suggestion providers are enabled by default."),
        type: "object",
        properties: providersProperties,
        default: defaultValue,
        tags: ["preview"],
        additionalProperties: false
      }
    }
  };
  const registry = Registry.as(ConfigurationExtensions.Configuration);
  registry.updateConfigurations({
    add: [terminalSuggestProvidersConfiguration],
    remove: oldProvidersConfiguration ? [oldProvidersConfiguration] : []
  });
}
registerTerminalSuggestProvidersConfiguration();
export {
  TerminalSuggestSettingId,
  normalizeQuickSuggestionsConfig,
  registerTerminalSuggestProvidersConfiguration,
  terminalSuggestConfigSection,
  terminalSuggestConfiguration,
  windowsDefaultExecutableExtensions
};
