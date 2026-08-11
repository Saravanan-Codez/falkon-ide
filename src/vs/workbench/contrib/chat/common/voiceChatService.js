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
import { localize } from "../../../../nls.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { rtrim } from "../../../../base/common/strings.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IChatAgentService } from "./participants/chatAgents.js";
import { chatAgentLeader, chatSubcommandLeader } from "./requestParser/chatParserTypes.js";
import { ISpeechService, SpeechToTextStatus } from "../../speech/common/speechService.js";
const IVoiceChatService = createDecorator("voiceChatService");
var PhraseTextType = /* @__PURE__ */ ((PhraseTextType2) => {
  PhraseTextType2[PhraseTextType2["AGENT"] = 1] = "AGENT";
  PhraseTextType2[PhraseTextType2["COMMAND"] = 2] = "COMMAND";
  PhraseTextType2[PhraseTextType2["AGENT_AND_COMMAND"] = 3] = "AGENT_AND_COMMAND";
  return PhraseTextType2;
})(PhraseTextType || {});
const VoiceChatInProgress = new RawContextKey("voiceChatInProgress", false, { type: "boolean", description: localize("voiceChatInProgress", "A speech-to-text session is in progress for chat.") });
let VoiceChatService = class extends Disposable {
  constructor(speechService, chatAgentService, contextKeyService) {
    super();
    this.speechService = speechService;
    this.chatAgentService = chatAgentService;
    this.activeVoiceChatSessions = 0;
    this.voiceChatInProgress = VoiceChatInProgress.bindTo(contextKeyService);
  }
  static {
    this.AGENT_PREFIX = chatAgentLeader;
  }
  static {
    this.COMMAND_PREFIX = chatSubcommandLeader;
  }
  static {
    this.PHRASES_LOWER = {
      [this.AGENT_PREFIX]: "at",
      [this.COMMAND_PREFIX]: "slash"
    };
  }
  static {
    this.PHRASES_UPPER = {
      [this.AGENT_PREFIX]: "At",
      [this.COMMAND_PREFIX]: "Slash"
    };
  }
  static {
    this.CHAT_AGENT_ALIAS = /* @__PURE__ */ new Map([["vscode", "code"]]);
  }
  createPhrases(model) {
    const phrases = /* @__PURE__ */ new Map();
    for (const agent of this.chatAgentService.getActivatedAgents()) {
      const agentPhrase = `${VoiceChatService.PHRASES_LOWER[VoiceChatService.AGENT_PREFIX]} ${VoiceChatService.CHAT_AGENT_ALIAS.get(agent.name) ?? agent.name}`.toLowerCase();
      phrases.set(agentPhrase, { agent: agent.name });
      for (const slashCommand of agent.slashCommands) {
        const slashCommandPhrase = `${VoiceChatService.PHRASES_LOWER[VoiceChatService.COMMAND_PREFIX]} ${slashCommand.name}`.toLowerCase();
        phrases.set(slashCommandPhrase, { agent: agent.name, command: slashCommand.name });
        const agentSlashCommandPhrase = `${agentPhrase} ${slashCommandPhrase}`.toLowerCase();
        phrases.set(agentSlashCommandPhrase, { agent: agent.name, command: slashCommand.name });
      }
    }
    return phrases;
  }
  toText(value, type) {
    switch (type) {
      case 1 /* AGENT */:
        return `${VoiceChatService.AGENT_PREFIX}${value.agent}`;
      case 2 /* COMMAND */:
        return `${VoiceChatService.COMMAND_PREFIX}${value.command}`;
      case 3 /* AGENT_AND_COMMAND */:
        return `${VoiceChatService.AGENT_PREFIX}${value.agent} ${VoiceChatService.COMMAND_PREFIX}${value.command}`;
    }
  }
  async createVoiceChatSession(token, options) {
    const disposables = new DisposableStore();
    const onSessionStoppedOrCanceled = (dispose) => {
      this.activeVoiceChatSessions = Math.max(0, this.activeVoiceChatSessions - 1);
      if (this.activeVoiceChatSessions === 0) {
        this.voiceChatInProgress.reset();
      }
      if (dispose) {
        disposables.dispose();
      }
    };
    disposables.add(token.onCancellationRequested(() => onSessionStoppedOrCanceled(true)));
    let detectedAgent = false;
    let detectedSlashCommand = false;
    const emitter = disposables.add(new Emitter());
    const session = await this.speechService.createSpeechToTextSession(token, "chat");
    if (token.isCancellationRequested) {
      onSessionStoppedOrCanceled(true);
    }
    const phrases = this.createPhrases(options.model);
    disposables.add(session.onDidChange((e) => {
      switch (e.status) {
        case SpeechToTextStatus.Recognizing:
        case SpeechToTextStatus.Recognized: {
          let massagedEvent = e;
          if (e.text) {
            const startsWithAgent = e.text.startsWith(VoiceChatService.PHRASES_UPPER[VoiceChatService.AGENT_PREFIX]) || e.text.startsWith(VoiceChatService.PHRASES_LOWER[VoiceChatService.AGENT_PREFIX]);
            const startsWithSlashCommand = e.text.startsWith(VoiceChatService.PHRASES_UPPER[VoiceChatService.COMMAND_PREFIX]) || e.text.startsWith(VoiceChatService.PHRASES_LOWER[VoiceChatService.COMMAND_PREFIX]);
            if (startsWithAgent || startsWithSlashCommand) {
              const originalWords = e.text.split(" ");
              let transformedWords;
              let waitingForInput = false;
              if (options.usesAgents && startsWithAgent && !detectedAgent && !detectedSlashCommand && originalWords.length >= 4) {
                const phrase = phrases.get(originalWords.slice(0, 4).map((word) => this.normalizeWord(word)).join(" "));
                if (phrase) {
                  transformedWords = [this.toText(phrase, 3 /* AGENT_AND_COMMAND */), ...originalWords.slice(4)];
                  waitingForInput = originalWords.length === 4;
                  if (e.status === SpeechToTextStatus.Recognized) {
                    detectedAgent = true;
                    detectedSlashCommand = true;
                  }
                }
              }
              if (options.usesAgents && startsWithAgent && !detectedAgent && !transformedWords && originalWords.length >= 2) {
                const phrase = phrases.get(originalWords.slice(0, 2).map((word) => this.normalizeWord(word)).join(" "));
                if (phrase) {
                  transformedWords = [this.toText(phrase, 1 /* AGENT */), ...originalWords.slice(2)];
                  waitingForInput = originalWords.length === 2;
                  if (e.status === SpeechToTextStatus.Recognized) {
                    detectedAgent = true;
                  }
                }
              }
              if (startsWithSlashCommand && !detectedSlashCommand && !transformedWords && originalWords.length >= 2) {
                const phrase = phrases.get(originalWords.slice(0, 2).map((word) => this.normalizeWord(word)).join(" "));
                if (phrase) {
                  transformedWords = [this.toText(
                    phrase,
                    options.usesAgents && !detectedAgent ? 3 /* AGENT_AND_COMMAND */ : (
                      // rewrite `/fix` to `@workspace /foo` in this case
                      2 /* COMMAND */
                    )
                    // when we have not yet detected an agent before
                  ), ...originalWords.slice(2)];
                  waitingForInput = originalWords.length === 2;
                  if (e.status === SpeechToTextStatus.Recognized) {
                    detectedSlashCommand = true;
                  }
                }
              }
              massagedEvent = {
                status: e.status,
                text: (transformedWords ?? originalWords).join(" "),
                waitingForInput
              };
            }
          }
          emitter.fire(massagedEvent);
          break;
        }
        case SpeechToTextStatus.Started:
          this.activeVoiceChatSessions++;
          this.voiceChatInProgress.set(true);
          emitter.fire(e);
          break;
        case SpeechToTextStatus.Stopped:
          onSessionStoppedOrCanceled(false);
          emitter.fire(e);
          break;
        case SpeechToTextStatus.Error:
          emitter.fire(e);
          break;
      }
    }));
    return {
      onDidChange: emitter.event
    };
  }
  normalizeWord(word) {
    word = rtrim(word, ".");
    word = rtrim(word, ",");
    word = rtrim(word, "?");
    return word.toLowerCase();
  }
};
VoiceChatService = __decorateClass([
  __decorateParam(0, ISpeechService),
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IContextKeyService)
], VoiceChatService);
export {
  IVoiceChatService,
  VoiceChatInProgress,
  VoiceChatService
};
