import { revive } from "../../../../../base/common/marshalling.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { OffsetRange } from "../../../../../editor/common/core/ranges/offsetRange.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { reviveSerializedAgent } from "../participants/chatAgents.js";
import { IDiagnosticVariableEntryFilterData, chatReferenceVariableEntryFromDynamicValue, isChatReferenceDynamicVariableValue } from "../attachments/chatVariableEntries.js";
import { arrayEquals } from "../../../../../base/common/equals.js";
var IParsedChatRequest;
((IParsedChatRequest2) => {
  function equals(a, b) {
    return a.text === b.text && arrayEquals(
      a.parts,
      b.parts,
      (p1, p2) => p1.kind === p2.kind && OffsetRange.equals(p1.range, p2.range) && Range.equalsRange(p1.editorRange, p2.editorRange) && p1.text === p2.text
    );
  }
  IParsedChatRequest2.equals = equals;
})(IParsedChatRequest || (IParsedChatRequest = {}));
function getPromptText(request) {
  const message = request.parts.map((r) => r.promptText).join("").trimStart();
  const diff = request.text.length - message.length;
  return { message, diff };
}
class ChatRequestTextPart {
  constructor(range, editorRange, text) {
    this.range = range;
    this.editorRange = editorRange;
    this.text = text;
    this.kind = ChatRequestTextPart.Kind;
  }
  static {
    this.Kind = "text";
  }
  get promptText() {
    return this.text;
  }
}
const chatVariableLeader = "#";
const chatAgentLeader = "@";
const chatSubcommandLeader = "/";
class ChatRequestVariablePart {
  constructor(range, editorRange, variableName, variableArg, variableId) {
    this.range = range;
    this.editorRange = editorRange;
    this.variableName = variableName;
    this.variableArg = variableArg;
    this.variableId = variableId;
    this.kind = ChatRequestVariablePart.Kind;
  }
  static {
    this.Kind = "var";
  }
  get text() {
    const argPart = this.variableArg ? `:${this.variableArg}` : "";
    return `${chatVariableLeader}${this.variableName}${argPart}`;
  }
  get promptText() {
    return this.text;
  }
}
class ChatRequestToolPart {
  constructor(range, editorRange, toolName, toolId, displayName, icon) {
    this.range = range;
    this.editorRange = editorRange;
    this.toolName = toolName;
    this.toolId = toolId;
    this.displayName = displayName;
    this.icon = icon;
    this.kind = ChatRequestToolPart.Kind;
  }
  static {
    this.Kind = "tool";
  }
  get text() {
    return `${chatVariableLeader}${this.toolName}`;
  }
  get promptText() {
    return this.text;
  }
  toVariableEntry() {
    return { kind: "tool", id: this.toolId, name: this.toolName, range: this.range, value: void 0, icon: ThemeIcon.isThemeIcon(this.icon) ? this.icon : void 0, fullName: this.displayName };
  }
}
class ChatRequestToolSetPart {
  constructor(range, editorRange, id, name, icon, tools) {
    this.range = range;
    this.editorRange = editorRange;
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.tools = tools;
    this.kind = ChatRequestToolSetPart.Kind;
  }
  static {
    this.Kind = "toolset";
  }
  get text() {
    return `${chatVariableLeader}${this.name}`;
  }
  get promptText() {
    return this.text;
  }
  toVariableEntry() {
    return { kind: "toolset", id: this.id, name: this.name, range: this.range, icon: this.icon, value: this.tools };
  }
}
class ChatRequestAgentPart {
  constructor(range, editorRange, agent) {
    this.range = range;
    this.editorRange = editorRange;
    this.agent = agent;
    this.kind = ChatRequestAgentPart.Kind;
  }
  static {
    this.Kind = "agent";
  }
  get text() {
    return `${chatAgentLeader}${this.agent.name}`;
  }
  get promptText() {
    return "";
  }
}
class ChatRequestAgentSubcommandPart {
  constructor(range, editorRange, command) {
    this.range = range;
    this.editorRange = editorRange;
    this.command = command;
    this.kind = ChatRequestAgentSubcommandPart.Kind;
  }
  static {
    this.Kind = "subcommand";
  }
  get text() {
    return `${chatSubcommandLeader}${this.command.name}`;
  }
  get promptText() {
    return "";
  }
}
class ChatRequestSlashCommandPart {
  constructor(range, editorRange, slashCommand) {
    this.range = range;
    this.editorRange = editorRange;
    this.slashCommand = slashCommand;
    this.kind = ChatRequestSlashCommandPart.Kind;
  }
  static {
    this.Kind = "slash";
  }
  get text() {
    return `${chatSubcommandLeader}${this.slashCommand.command}`;
  }
  get promptText() {
    return `${chatSubcommandLeader}${this.slashCommand.command}`;
  }
}
class ChatRequestSlashPromptPart {
  constructor(range, editorRange, name, displayText) {
    this.range = range;
    this.editorRange = editorRange;
    this.name = name;
    this.kind = ChatRequestSlashPromptPart.Kind;
    if (displayText !== void 0) {
      this.displayText = displayText;
    }
  }
  static {
    this.Kind = "prompt";
  }
  get text() {
    return this.displayText ?? `${chatSubcommandLeader}${this.name}`;
  }
  get promptText() {
    return this.displayText ?? `${chatSubcommandLeader}${this.name}`;
  }
}
class ChatRequestDynamicVariablePart {
  constructor(range, editorRange, text, id, modelDescription, data, fullName, icon, isFile, isDirectory, _meta, isAttachmentReference) {
    this.range = range;
    this.editorRange = editorRange;
    this.text = text;
    this.id = id;
    this.modelDescription = modelDescription;
    this.data = data;
    this.fullName = fullName;
    this.icon = icon;
    this.isFile = isFile;
    this.isDirectory = isDirectory;
    this._meta = _meta;
    this.isAttachmentReference = isAttachmentReference;
    this.kind = ChatRequestDynamicVariablePart.Kind;
  }
  static {
    this.Kind = "dynamic";
  }
  get referenceText() {
    return this.text.replace(chatVariableLeader, "");
  }
  get promptText() {
    return this.text;
  }
  toVariableEntry() {
    if (this.id === "vscode.problems") {
      return IDiagnosticVariableEntryFilterData.toEntry(this.data.filter);
    }
    if (isChatReferenceDynamicVariableValue(this.data)) {
      const entry = chatReferenceVariableEntryFromDynamicValue(this.data, this.id, this.fullName ?? this.referenceText, this.range, this._meta);
      if (entry) {
        return entry;
      }
    }
    return { kind: this.isDirectory ? "directory" : this.isFile ? "file" : "generic", id: this.id, name: this.referenceText, range: this.range, value: this.data, fullName: this.fullName, icon: this.icon, _meta: this._meta };
  }
}
function reviveParsedChatRequest(serialized) {
  return {
    text: serialized.text,
    parts: serialized.parts.map((part) => {
      if (part.kind === ChatRequestTextPart.Kind) {
        return new ChatRequestTextPart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          part.text
        );
      } else if (part.kind === ChatRequestVariablePart.Kind) {
        return new ChatRequestVariablePart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          part.variableName,
          part.variableArg,
          part.variableId || ""
        );
      } else if (part.kind === ChatRequestToolPart.Kind) {
        return new ChatRequestToolPart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          part.toolName,
          part.toolId,
          part.displayName,
          part.icon
        );
      } else if (part.kind === ChatRequestToolSetPart.Kind) {
        return new ChatRequestToolSetPart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          part.id,
          part.name,
          part.icon,
          part.tools ?? []
        );
      } else if (part.kind === ChatRequestAgentPart.Kind) {
        let agent = part.agent;
        agent = reviveSerializedAgent(agent);
        return new ChatRequestAgentPart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          agent
        );
      } else if (part.kind === ChatRequestAgentSubcommandPart.Kind) {
        return new ChatRequestAgentSubcommandPart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          part.command
        );
      } else if (part.kind === ChatRequestSlashCommandPart.Kind) {
        return new ChatRequestSlashCommandPart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          part.slashCommand
        );
      } else if (part.kind === ChatRequestSlashPromptPart.Kind) {
        return new ChatRequestSlashPromptPart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          part.name,
          part.displayText
        );
      } else if (part.kind === ChatRequestDynamicVariablePart.Kind) {
        return new ChatRequestDynamicVariablePart(
          new OffsetRange(part.range.start, part.range.endExclusive),
          part.editorRange,
          part.text,
          part.id,
          part.modelDescription,
          revive(part.data),
          part.fullName,
          part.icon,
          part.isFile,
          part.isDirectory,
          part._meta,
          part.isAttachmentReference
        );
      } else {
        throw new Error(`Unknown chat request part: ${part.kind}`);
      }
    })
  };
}
function extractAgentAndCommand(parsed) {
  const agentPart = parsed.parts.find((r) => r instanceof ChatRequestAgentPart);
  const commandPart = parsed.parts.find((r) => r instanceof ChatRequestAgentSubcommandPart);
  return { agentPart, commandPart };
}
function formatChatQuestion(chatAgentService, location, prompt, participant = null, command = null) {
  let question = "";
  if (participant && participant !== chatAgentService.getDefaultAgent(location)?.id) {
    const agent = chatAgentService.getAgent(participant);
    if (!agent) {
      return void 0;
    }
    question += `${chatAgentLeader}${agent.name} `;
    if (command) {
      question += `${chatSubcommandLeader}${command} `;
    }
  }
  return question + prompt;
}
export {
  ChatRequestAgentPart,
  ChatRequestAgentSubcommandPart,
  ChatRequestDynamicVariablePart,
  ChatRequestSlashCommandPart,
  ChatRequestSlashPromptPart,
  ChatRequestTextPart,
  ChatRequestToolPart,
  ChatRequestToolSetPart,
  IParsedChatRequest,
  chatAgentLeader,
  chatSubcommandLeader,
  chatVariableLeader,
  extractAgentAndCommand,
  formatChatQuestion,
  getPromptText,
  reviveParsedChatRequest
};
