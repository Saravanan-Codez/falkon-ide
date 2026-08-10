import { basename, isAbsolute, join } from "../../../base/common/path.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
const IV8InspectProfilingService = createDecorator("IV8InspectProfilingService");
var Utils;
((Utils2) => {
  function isValidProfile(profile) {
    return Boolean(profile.samples && profile.timeDeltas);
  }
  Utils2.isValidProfile = isValidProfile;
  function rewriteAbsolutePaths(profile, replace = "noAbsolutePaths") {
    for (const node of profile.nodes) {
      if (node.callFrame && node.callFrame.url) {
        if (isAbsolute(node.callFrame.url) || /^\w[\w\d+.-]*:\/\/\/?/.test(node.callFrame.url)) {
          node.callFrame.url = join(replace, basename(node.callFrame.url));
        }
      }
    }
    return profile;
  }
  Utils2.rewriteAbsolutePaths = rewriteAbsolutePaths;
})(Utils || (Utils = {}));
export {
  IV8InspectProfilingService,
  Utils
};
