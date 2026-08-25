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
import * as dom from "../../../../../../base/browser/dom.js";
import { Button } from "../../../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { toErrorMessage } from "../../../../../../base/common/errorMessage.js";
import { Lazy } from "../../../../../../base/common/lazy.js";
import { DisposableStore } from "../../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../../base/common/uri.js";
import { ICommandService } from "../../../../../../platform/commands/common/commands.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../../platform/log/common/log.js";
import { asCssVariable } from "../../../../../../platform/theme/common/colorUtils.js";
import { contentRefUrl } from "../../../common/widget/annotations.js";
import { getFullyQualifiedId, IChatAgentNameService, IChatAgentService } from "../../../common/participants/chatAgents.js";
import { chatSlashCommandBackground, chatSlashCommandForeground } from "../../../common/widget/chatColors.js";
import { chatAgentLeader, ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestDynamicVariablePart, ChatRequestSlashCommandPart, ChatRequestSlashPromptPart, ChatRequestTextPart, ChatRequestToolPart, chatSubcommandLeader } from "../../../common/requestParser/chatParserTypes.js";
import { IChatService } from "../../../common/chatService/chatService.js";
import { ILanguageModelToolsService } from "../../../common/tools/languageModelToolsService.js";
import { IChatWidgetService } from "../../chat.js";
import { ChatAgentHover, getChatAgentHoverOptions } from "../chatAgentHover.js";
import { IChatMarkdownAnchorService } from "./chatMarkdownAnchorService.js";
import { InlineAnchorWidget } from "./chatInlineAnchorWidget.js";
const decorationRefUrl = `http://_vscodedecoration_`;
const agentRefUrl = `http://_chatagent_`;
const agentSlashRefUrl = `http://_chatslash_`;
function agentToMarkdown(agent, sessionResource, isClickable, accessor) {
  const chatAgentNameService = accessor.get(IChatAgentNameService);
  const chatAgentService = accessor.get(IChatAgentService);
  const isAllowed = chatAgentNameService.getAgentNameRestriction(agent);
  let name = `${isAllowed ? agent.name : getFullyQualifiedId(agent)}`;
  const isDupe = isAllowed && chatAgentService.agentHasDupeName(agent.id);
  if (isDupe) {
    name += ` (${agent.publisherDisplayName})`;
  }
  const args = { agentId: agent.id, sessionResource, name, isClickable };
  return `[${agent.name}](${agentRefUrl}?${encodeURIComponent(JSON.stringify(args))})`;
}
function agentSlashCommandToMarkdown(agent, command, sessionResource) {
  const text = `${chatSubcommandLeader}${command.name}`;
  const args = { agentId: agent.id, command: command.name, sessionResource };
  return `[${text}](${agentSlashRefUrl}?${encodeURIComponent(JSON.stringify(args))})`;
}
let ChatMarkdownDecorationsRenderer = class {
  constructor(keybindingService, logService, chatAgentService, instantiationService, hoverService, chatService, chatWidgetService, commandService, labelService, toolsService, chatMarkdownAnchorService) {
    this.keybindingService = keybindingService;
    this.logService = logService;
    this.chatAgentService = chatAgentService;
    this.instantiationService = instantiationService;
    this.hoverService = hoverService;
    this.chatService = chatService;
    this.chatWidgetService = chatWidgetService;
    this.commandService = commandService;
    this.labelService = labelService;
    this.toolsService = toolsService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
  }
  convertParsedRequestToMarkdown(sessionResource, parsedRequest) {
    let result = "";
    for (const part of parsedRequest.parts) {
      if (part instanceof ChatRequestTextPart) {
        result += part.text;
      } else if (part instanceof ChatRequestAgentPart) {
        result += this.instantiationService.invokeFunction((accessor) => agentToMarkdown(part.agent, sessionResource, false, accessor));
      } else {
        result += this.genericDecorationToMarkdown(part);
      }
    }
    return result;
  }
  genericDecorationToMarkdown(part) {
    const uri = part instanceof ChatRequestDynamicVariablePart && part.data instanceof URI ? part.data : void 0;
    const title = uri ? this.labelService.getUriLabel(uri, { relative: true }) : part instanceof ChatRequestSlashCommandPart ? part.slashCommand.detail : part instanceof ChatRequestAgentSubcommandPart ? part.command.description : part instanceof ChatRequestSlashPromptPart ? part.name : part instanceof ChatRequestToolPart ? this.toolsService.getTool(part.toolId)?.userDescription : "";
    const args = { title };
    const text = part.text;
    return `[${text}](${decorationRefUrl}?${encodeURIComponent(JSON.stringify(args))})`;
  }
  walkTreeAndAnnotateReferenceLinks(content, element) {
    const store = new DisposableStore();
    element.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("data-href");
      if (href) {
        if (href.startsWith(agentRefUrl)) {
          let args;
          try {
            args = JSON.parse(decodeURIComponent(href.slice(agentRefUrl.length + 1)));
          } catch (e) {
            this.logService.error("Invalid chat widget render data JSON", toErrorMessage(e));
          }
          if (args) {
            a.replaceWith(this.renderAgentWidget(args, store));
          }
        } else if (href.startsWith(agentSlashRefUrl)) {
          let args;
          try {
            args = JSON.parse(decodeURIComponent(href.slice(agentRefUrl.length + 1)));
          } catch (e) {
            this.logService.error("Invalid chat slash command render data JSON", toErrorMessage(e));
          }
          if (args) {
            a.replaceWith(this.renderSlashCommandWidget(a.textContent, args, store));
          }
        } else if (href.startsWith(decorationRefUrl)) {
          let args;
          try {
            args = JSON.parse(decodeURIComponent(href.slice(decorationRefUrl.length + 1)));
          } catch (e) {
          }
          a.replaceWith(this.renderResourceWidget(a.textContent, args, store));
        } else if (href.startsWith(contentRefUrl)) {
          this.renderFileWidget(content, href, a, store);
        } else if (href.startsWith("command:")) {
          this.injectKeybindingHint(a, href, this.keybindingService);
        }
      }
    });
    return store;
  }
  renderAgentWidget(args, store) {
    const nameWithLeader = `${chatAgentLeader}${args.name}`;
    let container;
    if (args.isClickable) {
      container = dom.$("span.chat-agent-widget");
      const button = store.add(new Button(container, {
        buttonBackground: asCssVariable(chatSlashCommandBackground),
        buttonForeground: asCssVariable(chatSlashCommandForeground),
        buttonHoverBackground: void 0
      }));
      button.label = nameWithLeader;
      store.add(button.onDidClick(() => {
        const agent2 = this.chatAgentService.getAgent(args.agentId);
        const widget = this.chatWidgetService.getWidgetBySessionResource(args.sessionResource) || this.chatWidgetService.lastFocusedWidget;
        if (!widget || !agent2) {
          return;
        }
        this.chatService.sendRequest(
          widget.viewModel.sessionResource,
          agent2.metadata.sampleRequest ?? "",
          {
            location: widget.location,
            agentId: agent2.id,
            ...widget.getSelectedModelRequestOptions(),
            modeInfo: widget.input.currentModeInfo
          }
        );
      }));
    } else {
      container = this.renderResourceWidget(nameWithLeader, void 0, store);
    }
    const agent = this.chatAgentService.getAgent(args.agentId);
    const hover = new Lazy(() => store.add(this.instantiationService.createInstance(ChatAgentHover)));
    store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), container, () => {
      hover.value.setAgent(args.agentId);
      return hover.value.domNode;
    }, agent && getChatAgentHoverOptions(() => agent, this.commandService)));
    return container;
  }
  renderSlashCommandWidget(name, args, store) {
    const container = dom.$("span.chat-agent-widget.chat-command-widget");
    const agent = this.chatAgentService.getAgent(args.agentId);
    const button = store.add(new Button(container, {
      buttonBackground: asCssVariable(chatSlashCommandBackground),
      buttonForeground: asCssVariable(chatSlashCommandForeground),
      buttonHoverBackground: void 0
    }));
    button.label = name;
    store.add(button.onDidClick(() => {
      const widget = this.chatWidgetService.getWidgetBySessionResource(args.sessionResource) || this.chatWidgetService.lastFocusedWidget;
      if (!widget || !agent) {
        return;
      }
      const command = agent.slashCommands.find((c) => c.name === args.command);
      this.chatService.sendRequest(widget.viewModel.sessionResource, command?.sampleRequest ?? "", {
        location: widget.location,
        agentId: agent.id,
        slashCommand: args.command,
        ...widget.getSelectedModelRequestOptions(),
        modeInfo: widget.input.currentModeInfo
      });
    }));
    return container;
  }
  renderFileWidget(content, href, a, store) {
    const fullUri = URI.parse(href);
    const data = content.inlineReferences?.[fullUri.path.slice(1)];
    if (!data) {
      this.logService.error("Invalid chat widget render data JSON");
      return;
    }
    const inlineAnchor = store.add(this.instantiationService.createInstance(InlineAnchorWidget, a, data, void 0, void 0));
    store.add(this.chatMarkdownAnchorService.register(inlineAnchor));
  }
  renderResourceWidget(name, args, store) {
    const container = dom.$("span.chat-resource-widget");
    const alias = dom.$("span", void 0, name);
    if (args?.title) {
      store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), container, args.title));
    }
    container.appendChild(alias);
    return container;
  }
  injectKeybindingHint(a, href, keybindingService) {
    const command = href.match(/command:([^\)]+)/)?.[1];
    if (command) {
      a.textContent = keybindingService.appendKeybinding(a.textContent || "", command);
    }
  }
};
ChatMarkdownDecorationsRenderer = __decorateClass([
  __decorateParam(0, IKeybindingService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IChatAgentService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IChatService),
  __decorateParam(6, IChatWidgetService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, ILanguageModelToolsService),
  __decorateParam(10, IChatMarkdownAnchorService)
], ChatMarkdownDecorationsRenderer);
export {
  ChatMarkdownDecorationsRenderer,
  agentSlashCommandToMarkdown,
  agentToMarkdown
};
