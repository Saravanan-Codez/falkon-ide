import { Codicon } from "../../../base/common/codicons.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import * as platform from "../../registry/common/platform.js";
import { ColorScheme, ThemeTypeSelector } from "./theme.js";
const IThemeService = createDecorator("themeService");
function themeColorFromId(id) {
  return { id };
}
const FileThemeIcon = Codicon.file;
const FolderThemeIcon = Codicon.folder;
function getThemeTypeSelector(type) {
  switch (type) {
    case ColorScheme.DARK:
      return ThemeTypeSelector.VS_DARK;
    case ColorScheme.HIGH_CONTRAST_DARK:
      return ThemeTypeSelector.HC_BLACK;
    case ColorScheme.HIGH_CONTRAST_LIGHT:
      return ThemeTypeSelector.HC_LIGHT;
    default:
      return ThemeTypeSelector.VS;
  }
}
class IFontTokenOptions {
}
const Extensions = {
  ThemingContribution: "base.contributions.theming"
};
class ThemingRegistry extends Disposable {
  constructor() {
    super();
    this.themingParticipants = [];
    this.themingParticipants = [];
    this.onThemingParticipantAddedEmitter = this._register(new Emitter());
  }
  onColorThemeChange(participant) {
    this.themingParticipants.push(participant);
    this.onThemingParticipantAddedEmitter.fire(participant);
    return toDisposable(() => {
      const idx = this.themingParticipants.indexOf(participant);
      this.themingParticipants.splice(idx, 1);
    });
  }
  get onThemingParticipantAdded() {
    return this.onThemingParticipantAddedEmitter.event;
  }
  getThemingParticipants() {
    return this.themingParticipants;
  }
}
const themingRegistry = new ThemingRegistry();
platform.Registry.add(Extensions.ThemingContribution, themingRegistry);
function registerThemingParticipant(participant) {
  return themingRegistry.onColorThemeChange(participant);
}
class Themable extends Disposable {
  constructor(themeService) {
    super();
    this.themeService = themeService;
    this.theme = themeService.getColorTheme();
    this._register(this.themeService.onDidColorThemeChange((theme) => this.onThemeChange(theme)));
  }
  onThemeChange(theme) {
    this.theme = theme;
    this.updateStyles();
  }
  updateStyles() {
  }
  getColor(id, modify) {
    let color = this.theme.getColor(id);
    if (color && modify) {
      color = modify(color, this.theme);
    }
    return color ? color.toString() : null;
  }
}
export {
  Extensions,
  FileThemeIcon,
  FolderThemeIcon,
  IFontTokenOptions,
  IThemeService,
  Themable,
  getThemeTypeSelector,
  registerThemingParticipant,
  themeColorFromId
};
