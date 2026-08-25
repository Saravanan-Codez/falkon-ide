import { isLinuxSnap, platform, Platform, PlatformToString } from "../../../base/common/platform.js";
import { env, platform as nodePlatform } from "../../../base/common/process.js";
import { generateUuid } from "../../../base/common/uuid.js";
function getPlatformDetail(hostname) {
  if (platform === Platform.Linux && /^penguin(\.|$)/i.test(hostname)) {
    return "chromebook";
  }
  return void 0;
}
function resolveCommonProperties(release, hostname, arch, commit, version, machineId, sqmId, devDeviceId, isInternalTelemetry, releaseDate, product) {
  const result = /* @__PURE__ */ Object.create(null);
  result["common.machineId"] = machineId;
  result["common.sqmId"] = sqmId;
  result["common.devDeviceId"] = devDeviceId;
  result["sessionID"] = generateUuid() + Date.now();
  result["commitHash"] = commit;
  result["version"] = version;
  result["common.releaseDate"] = releaseDate;
  result["common.platformVersion"] = (release || "").replace(/^(\d+)(\.\d+)?(\.\d+)?(.*)/, "$1$2$3");
  result["common.platform"] = PlatformToString(platform);
  result["common.nodePlatform"] = nodePlatform;
  result["common.nodeArch"] = arch;
  result["common.product"] = product || "desktop";
  if (isInternalTelemetry) {
    result["common.msftInternal"] = isInternalTelemetry;
  }
  let seq = 0;
  const startTime = Date.now();
  Object.defineProperties(result, {
    // __GDPR__COMMON__ "timestamp" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    "timestamp": {
      get: () => /* @__PURE__ */ new Date(),
      enumerable: true
    },
    // __GDPR__COMMON__ "common.timesincesessionstart" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
    "common.timesincesessionstart": {
      get: () => Date.now() - startTime,
      enumerable: true
    },
    // __GDPR__COMMON__ "common.sequence" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
    "common.sequence": {
      get: () => seq++,
      enumerable: true
    }
  });
  if (isLinuxSnap) {
    result["common.snap"] = "true";
  }
  const platformDetail = getPlatformDetail(hostname);
  if (platformDetail) {
    result["common.platformDetail"] = platformDetail;
  }
  return result;
}
function verifyMicrosoftInternalDomain(domainList) {
  const userDnsDomain = env["USERDNSDOMAIN"];
  if (!userDnsDomain) {
    return false;
  }
  const domain = userDnsDomain.toLowerCase();
  return domainList.some((msftDomain) => domain === msftDomain);
}
export {
  resolveCommonProperties,
  verifyMicrosoftInternalDomain
};
