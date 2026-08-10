import { localize } from "../../../../nls.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { language } from "../../../../base/common/platform.js";
const ISpeechService = createDecorator("speechService");
const HasSpeechProvider = new RawContextKey("hasSpeechProvider", false, { type: "boolean", description: localize("hasSpeechProvider", "A speech provider is registered to the speech service.") });
const SpeechToTextInProgress = new RawContextKey("speechToTextInProgress", false, { type: "boolean", description: localize("speechToTextInProgress", "A speech-to-text session is in progress.") });
const TextToSpeechInProgress = new RawContextKey("textToSpeechInProgress", false, { type: "boolean", description: localize("textToSpeechInProgress", "A text-to-speech session is in progress.") });
var SpeechToTextStatus = /* @__PURE__ */ ((SpeechToTextStatus2) => {
  SpeechToTextStatus2[SpeechToTextStatus2["Started"] = 1] = "Started";
  SpeechToTextStatus2[SpeechToTextStatus2["Recognizing"] = 2] = "Recognizing";
  SpeechToTextStatus2[SpeechToTextStatus2["Recognized"] = 3] = "Recognized";
  SpeechToTextStatus2[SpeechToTextStatus2["Stopped"] = 4] = "Stopped";
  SpeechToTextStatus2[SpeechToTextStatus2["Error"] = 5] = "Error";
  return SpeechToTextStatus2;
})(SpeechToTextStatus || {});
var TextToSpeechStatus = /* @__PURE__ */ ((TextToSpeechStatus2) => {
  TextToSpeechStatus2[TextToSpeechStatus2["Started"] = 1] = "Started";
  TextToSpeechStatus2[TextToSpeechStatus2["Stopped"] = 2] = "Stopped";
  TextToSpeechStatus2[TextToSpeechStatus2["Error"] = 3] = "Error";
  return TextToSpeechStatus2;
})(TextToSpeechStatus || {});
var KeywordRecognitionStatus = /* @__PURE__ */ ((KeywordRecognitionStatus2) => {
  KeywordRecognitionStatus2[KeywordRecognitionStatus2["Recognized"] = 1] = "Recognized";
  KeywordRecognitionStatus2[KeywordRecognitionStatus2["Stopped"] = 2] = "Stopped";
  KeywordRecognitionStatus2[KeywordRecognitionStatus2["Canceled"] = 3] = "Canceled";
  return KeywordRecognitionStatus2;
})(KeywordRecognitionStatus || {});
var AccessibilityVoiceSettingId = /* @__PURE__ */ ((AccessibilityVoiceSettingId2) => {
  AccessibilityVoiceSettingId2["SpeechTimeout"] = "accessibility.voice.speechTimeout";
  AccessibilityVoiceSettingId2["AutoSynthesize"] = "accessibility.voice.autoSynthesize";
  AccessibilityVoiceSettingId2["SpeechLanguage"] = "accessibility.voice.speechLanguage";
  AccessibilityVoiceSettingId2["IgnoreCodeBlocks"] = "accessibility.voice.ignoreCodeBlocks";
  return AccessibilityVoiceSettingId2;
})(AccessibilityVoiceSettingId || {});
const SPEECH_LANGUAGE_CONFIG = "accessibility.voice.speechLanguage" /* SpeechLanguage */;
const SPEECH_LANGUAGES = {
  ["da-DK"]: {
    name: localize("speechLanguage.da-DK", "Danish (Denmark)")
  },
  ["de-DE"]: {
    name: localize("speechLanguage.de-DE", "German (Germany)")
  },
  ["en-AU"]: {
    name: localize("speechLanguage.en-AU", "English (Australia)")
  },
  ["en-CA"]: {
    name: localize("speechLanguage.en-CA", "English (Canada)")
  },
  ["en-GB"]: {
    name: localize("speechLanguage.en-GB", "English (United Kingdom)")
  },
  ["en-IE"]: {
    name: localize("speechLanguage.en-IE", "English (Ireland)")
  },
  ["en-IN"]: {
    name: localize("speechLanguage.en-IN", "English (India)")
  },
  ["en-NZ"]: {
    name: localize("speechLanguage.en-NZ", "English (New Zealand)")
  },
  ["en-US"]: {
    name: localize("speechLanguage.en-US", "English (United States)")
  },
  ["es-ES"]: {
    name: localize("speechLanguage.es-ES", "Spanish (Spain)")
  },
  ["es-MX"]: {
    name: localize("speechLanguage.es-MX", "Spanish (Mexico)")
  },
  ["fr-CA"]: {
    name: localize("speechLanguage.fr-CA", "French (Canada)")
  },
  ["fr-FR"]: {
    name: localize("speechLanguage.fr-FR", "French (France)")
  },
  ["hi-IN"]: {
    name: localize("speechLanguage.hi-IN", "Hindi (India)")
  },
  ["it-IT"]: {
    name: localize("speechLanguage.it-IT", "Italian (Italy)")
  },
  ["ja-JP"]: {
    name: localize("speechLanguage.ja-JP", "Japanese (Japan)")
  },
  ["ko-KR"]: {
    name: localize("speechLanguage.ko-KR", "Korean (South Korea)")
  },
  ["nl-NL"]: {
    name: localize("speechLanguage.nl-NL", "Dutch (Netherlands)")
  },
  ["pt-PT"]: {
    name: localize("speechLanguage.pt-PT", "Portuguese (Portugal)")
  },
  ["pt-BR"]: {
    name: localize("speechLanguage.pt-BR", "Portuguese (Brazil)")
  },
  ["ru-RU"]: {
    name: localize("speechLanguage.ru-RU", "Russian (Russia)")
  },
  ["sv-SE"]: {
    name: localize("speechLanguage.sv-SE", "Swedish (Sweden)")
  },
  ["tr-TR"]: {
    // allow-any-unicode-next-line
    name: localize("speechLanguage.tr-TR", "Turkish (T\xFCrkiye)")
  },
  ["zh-CN"]: {
    name: localize("speechLanguage.zh-CN", "Chinese (Simplified, China)")
  },
  ["zh-HK"]: {
    name: localize("speechLanguage.zh-HK", "Chinese (Traditional, Hong Kong)")
  },
  ["zh-TW"]: {
    name: localize("speechLanguage.zh-TW", "Chinese (Traditional, Taiwan)")
  }
};
function speechLanguageConfigToLanguage(config, lang = language) {
  if (typeof config === "string") {
    if (config === "auto") {
      if (lang !== "en") {
        const langParts = lang.split("-");
        return speechLanguageConfigToLanguage(`${langParts[0]}-${(langParts[1] ?? langParts[0]).toUpperCase()}`);
      }
    } else {
      if (SPEECH_LANGUAGES[config]) {
        return config;
      }
    }
  }
  return "en-US";
}
export {
  AccessibilityVoiceSettingId,
  HasSpeechProvider,
  ISpeechService,
  KeywordRecognitionStatus,
  SPEECH_LANGUAGES,
  SPEECH_LANGUAGE_CONFIG,
  SpeechToTextInProgress,
  SpeechToTextStatus,
  TextToSpeechInProgress,
  TextToSpeechStatus,
  speechLanguageConfigToLanguage
};
