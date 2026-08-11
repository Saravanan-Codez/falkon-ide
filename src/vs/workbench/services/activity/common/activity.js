import { Codicon } from "../../../../base/common/codicons.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { activityErrorBadgeBackground, activityErrorBadgeForeground, activityWarningBadgeBackground, activityWarningBadgeForeground } from "../../../../platform/theme/common/colors/miscColors.js";
const IActivityService = createDecorator("activityService");
class BaseBadge {
  constructor(descriptorFn, stylesFn) {
    this.descriptorFn = descriptorFn;
    this.stylesFn = stylesFn;
  }
  getDescription() {
    return this.descriptorFn(null);
  }
  getColors(theme) {
    return this.stylesFn?.(theme);
  }
}
class NumberBadge extends BaseBadge {
  constructor(number, descriptorFn) {
    super(descriptorFn, void 0);
    this.number = number;
    this.number = number;
  }
  getDescription() {
    return this.descriptorFn(this.number);
  }
}
class IconBadge extends BaseBadge {
  constructor(icon, descriptorFn, stylesFn) {
    super(descriptorFn, stylesFn);
    this.icon = icon;
  }
}
class ProgressBadge extends BaseBadge {
  constructor(descriptorFn) {
    super(descriptorFn, void 0);
  }
}
class WarningBadge extends IconBadge {
  constructor(descriptorFn) {
    super(Codicon.warning, descriptorFn, (theme) => ({
      badgeBackground: theme.getColor(activityWarningBadgeBackground),
      badgeForeground: theme.getColor(activityWarningBadgeForeground),
      badgeBorder: void 0
    }));
  }
}
class ErrorBadge extends IconBadge {
  constructor(descriptorFn) {
    super(Codicon.error, descriptorFn, (theme) => ({
      badgeBackground: theme.getColor(activityErrorBadgeBackground),
      badgeForeground: theme.getColor(activityErrorBadgeForeground),
      badgeBorder: void 0
    }));
  }
}
export {
  ErrorBadge,
  IActivityService,
  IconBadge,
  NumberBadge,
  ProgressBadge,
  WarningBadge
};
