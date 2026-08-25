import { join } from "../common/path.js";
import { promises } from "fs";
import { mark } from "../common/performance.js";
import { Promises } from "./pfs.js";
async function resolveNLSConfiguration({ userLocale, osLocale, userDataPath, commit, nlsMetadataPath }) {
  mark("code/willGenerateNls");
  if (process.env["VSCODE_DEV"] || userLocale === "pseudo" || userLocale.startsWith("en") || !commit || !userDataPath) {
    return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
  }
  try {
    const languagePacks = await getLanguagePackConfigurations(userDataPath);
    if (!languagePacks) {
      return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
    }
    const resolvedLanguage = resolveLanguagePackLanguage(languagePacks, userLocale);
    if (!resolvedLanguage) {
      return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
    }
    const languagePack = languagePacks[resolvedLanguage];
    const mainLanguagePackPath = languagePack?.translations?.["vscode"];
    if (!languagePack || typeof languagePack.hash !== "string" || !languagePack.translations || typeof mainLanguagePackPath !== "string" || !await Promises.exists(mainLanguagePackPath)) {
      return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
    }
    const languagePackId = `${languagePack.hash}.${resolvedLanguage}`;
    const globalLanguagePackCachePath = join(userDataPath, "clp", languagePackId);
    const commitLanguagePackCachePath = join(globalLanguagePackCachePath, commit);
    const languagePackMessagesFile = join(commitLanguagePackCachePath, "nls.messages.json");
    const translationsConfigFile = join(globalLanguagePackCachePath, "tcf.json");
    const languagePackCorruptMarkerFile = join(globalLanguagePackCachePath, "corrupted.info");
    if (await Promises.exists(languagePackCorruptMarkerFile)) {
      await promises.rm(globalLanguagePackCachePath, { recursive: true, force: true, maxRetries: 3 });
    }
    const result = {
      userLocale,
      osLocale,
      resolvedLanguage,
      defaultMessagesFile: join(nlsMetadataPath, "nls.messages.json"),
      languagePack: {
        translationsConfigFile,
        messagesFile: languagePackMessagesFile,
        corruptMarkerFile: languagePackCorruptMarkerFile
      },
      // NLS: below properties are a relic from old times only used by vscode-nls and deprecated
      locale: userLocale,
      availableLanguages: { "*": resolvedLanguage },
      _languagePackId: languagePackId,
      _languagePackSupport: true,
      _translationsConfigFile: translationsConfigFile,
      _cacheRoot: globalLanguagePackCachePath,
      _resolvedLanguagePackCoreLocation: commitLanguagePackCachePath,
      _corruptedFile: languagePackCorruptMarkerFile
    };
    if (await Promises.exists(languagePackMessagesFile)) {
      touch(commitLanguagePackCachePath).catch(() => {
      });
      mark("code/didGenerateNls");
      return result;
    }
    const [
      nlsDefaultKeys,
      nlsDefaultMessages,
      nlsPackdata
    ] = await Promise.all([
      promises.readFile(join(nlsMetadataPath, "nls.keys.json"), "utf-8").then((content) => JSON.parse(content)),
      promises.readFile(join(nlsMetadataPath, "nls.messages.json"), "utf-8").then((content) => JSON.parse(content)),
      promises.readFile(mainLanguagePackPath, "utf-8").then((content) => JSON.parse(content))
    ]);
    const nlsResult = [];
    let nlsIndex = 0;
    for (const [moduleId, nlsKeys] of nlsDefaultKeys) {
      const moduleTranslations = nlsPackdata.contents[moduleId];
      for (const nlsKey of nlsKeys) {
        nlsResult.push(moduleTranslations?.[nlsKey] || nlsDefaultMessages[nlsIndex]);
        nlsIndex++;
      }
    }
    await promises.mkdir(commitLanguagePackCachePath, { recursive: true });
    await Promise.all([
      promises.writeFile(languagePackMessagesFile, JSON.stringify(nlsResult), "utf-8"),
      promises.writeFile(translationsConfigFile, JSON.stringify(languagePack.translations), "utf-8")
    ]);
    mark("code/didGenerateNls");
    return result;
  } catch (error) {
    console.error("Generating translation files failed.", error);
  }
  return defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath);
}
async function getLanguagePackConfigurations(userDataPath) {
  const configFile = join(userDataPath, "languagepacks.json");
  try {
    return JSON.parse(await promises.readFile(configFile, "utf-8"));
  } catch (err) {
    return void 0;
  }
}
function resolveLanguagePackLanguage(languagePacks, locale) {
  try {
    while (locale) {
      if (languagePacks[locale]) {
        return locale;
      }
      const index = locale.lastIndexOf("-");
      if (index > 0) {
        locale = locale.substring(0, index);
      } else {
        return void 0;
      }
    }
  } catch (error) {
    console.error("Resolving language pack configuration failed.", error);
  }
  return void 0;
}
function defaultNLSConfiguration(userLocale, osLocale, nlsMetadataPath) {
  mark("code/didGenerateNls");
  return {
    userLocale,
    osLocale,
    resolvedLanguage: "en",
    defaultMessagesFile: join(nlsMetadataPath, "nls.messages.json"),
    // NLS: below 2 are a relic from old times only used by vscode-nls and deprecated
    locale: userLocale,
    availableLanguages: {}
  };
}
function touch(path) {
  const date = /* @__PURE__ */ new Date();
  return promises.utimes(path, date, date);
}
export {
  resolveNLSConfiguration
};
