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
import { assertNever } from "../../../../../base/common/assert.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { extname } from "../../../../../base/common/path.js";
import { normalizePath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { localize } from "../../../../../nls.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IWebContentExtractorService } from "../../../../../platform/webContentExtractor/common/webContentExtractor.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { detectEncodingFromBuffer } from "../../../../services/textfile/common/encoding.js";
import { ITrustedDomainService } from "../../../url/browser/trustedDomainService.js";
import { IChatService } from "../../common/chatService/chatService.js";
import { ChatImageMimeType } from "../../common/languageModels.js";
import { ToolDataSource } from "../../common/tools/languageModelToolsService.js";
import { InternalFetchWebPageToolId } from "../../common/tools/builtinTools/tools.js";
import { IAgentNetworkFilterService } from "../../../../../platform/networkFilter/common/networkFilterService.js";
import { WorkingDirectory } from "../../common/workingDirectory.js";
const FetchWebPageToolData = {
  id: InternalFetchWebPageToolId,
  displayName: "Fetch Web Page",
  canBeReferencedInPrompt: false,
  modelDescription: "Fetches the main content from a web page. This tool is useful for summarizing or analyzing the content of a webpage.",
  source: ToolDataSource.Internal,
  canRequestPostApproval: true,
  canRequestPreApproval: true,
  inputSchema: {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: {
          type: "string"
        },
        description: localize("fetchWebPage.urlsDescription", "An array of URLs to fetch content from.")
      }
    },
    required: ["urls"]
  }
};
let FetchWebPageTool = class {
  constructor(_readerModeService, _fileService, _trustedDomainService, _chatService, _workspaceContextService, _agentNetworkFilterService) {
    this._readerModeService = _readerModeService;
    this._fileService = _fileService;
    this._trustedDomainService = _trustedDomainService;
    this._chatService = _chatService;
    this._workspaceContextService = _workspaceContextService;
    this._agentNetworkFilterService = _agentNetworkFilterService;
  }
  async invoke(invocation, _countTokens, _progress, token) {
    const urls = invocation.parameters.urls || [];
    const { webUris, fileUris, invalidUris, blockedUris } = this._parseUris(urls);
    const allValidUris = [...webUris.values(), ...fileUris.values()];
    if (!allValidUris.length && invalidUris.size === 0 && blockedUris.size === 0) {
      return {
        content: [{ kind: "text", value: localize("fetchWebPage.noValidUrls", "No valid URLs provided.") }]
      };
    }
    let webContents = [];
    if (webUris.size > 0) {
      const trustedDomains = this._trustedDomainService.trustedDomains;
      webContents = await this._readerModeService.extract([...webUris.values()], { trustedDomains });
    }
    const fileContents = [];
    const successfulFileUris = [];
    for (const uri of fileUris.values()) {
      try {
        const fileContent = await this._fileService.readFile(uri, void 0, token);
        const imageMimeType = this._getSupportedImageMimeType(uri);
        if (imageMimeType) {
          fileContents.push({
            type: "tooldata",
            value: {
              kind: "data",
              value: {
                mimeType: imageMimeType,
                data: fileContent.value
              }
            }
          });
        } else {
          const detected = detectEncodingFromBuffer({ buffer: fileContent.value, bytesRead: fileContent.value.byteLength });
          if (detected.seemsBinary) {
            fileContents.push(localize("fetchWebPage.binaryNotSupported", "Binary files are not supported at the moment."));
          } else {
            fileContents.push(fileContent.value.toString());
          }
        }
        successfulFileUris.push(uri);
      } catch (error) {
        fileContents.push(void 0);
      }
    }
    const results = [];
    let webIndex = 0;
    let fileIndex = 0;
    for (const url of urls) {
      if (blockedUris.has(url)) {
        results.push(this._agentNetworkFilterService.formatError(URI.parse(url)));
      } else if (invalidUris.has(url)) {
        results.push(void 0);
      } else if (webUris.has(url)) {
        results.push({ type: "extracted", value: webContents[webIndex] });
        webIndex++;
      } else if (fileUris.has(url)) {
        results.push(fileContents[fileIndex]);
        fileIndex++;
      } else {
        results.push(void 0);
      }
    }
    let confirmResults;
    if (webContents.every((e) => e.status === "error" || e.status === "redirect")) {
      confirmResults = false;
    }
    const actuallyValidUris = [...webUris.values(), ...successfulFileUris];
    return {
      content: this._getPromptPartsForResults(urls, results),
      toolResultDetails: actuallyValidUris,
      confirmResults
    };
  }
  async prepareToolInvocation(context, token) {
    const { webUris, fileUris, invalidUris, blockedUris } = this._parseUris(context.parameters.urls);
    const validFileUris = [];
    const additionalInvalidUrls = [];
    for (const [originalUrl, uri] of fileUris.entries()) {
      try {
        await this._fileService.stat(uri);
        validFileUris.push(uri);
      } catch (error) {
        additionalInvalidUrls.push(originalUrl);
      }
    }
    const invalid = [...Array.from(invalidUris), ...additionalInvalidUrls, ...Array.from(blockedUris)];
    const allFetchedUris = new ResourceSet([...webUris.values(), ...validFileUris]);
    const workingDir = new WorkingDirectory(this._workspaceContextService, context.workingDirectory);
    const fileUrisOutsideWorkspace = validFileUris.filter((uri) => !workingDir.getFolder(uri));
    const urlsNeedingConfirmation = new ResourceSet([...webUris.values(), ...fileUrisOutsideWorkspace]);
    const pastTenseMessage = invalid.length ? invalid.length > 1 ? new MarkdownString(
      localize(
        "fetchWebPage.pastTenseMessage.plural",
        "Fetched {0} resources, but the following were invalid URLs:\n\n{1}\n\n",
        allFetchedUris.size,
        invalid.map((url) => `- ${url}`).join("\n")
      )
    ) : new MarkdownString(
      localize(
        "fetchWebPage.pastTenseMessage.singular",
        "Fetched resource, but the following was an invalid URL:\n\n{0}\n\n",
        invalid[0]
      )
    ) : new MarkdownString();
    const invocationMessage = new MarkdownString();
    if (allFetchedUris.size > 1) {
      pastTenseMessage.appendMarkdown(localize("fetchWebPage.pastTenseMessageResult.plural", "Fetched {0} resources", allFetchedUris.size));
      invocationMessage.appendMarkdown(localize("fetchWebPage.invocationMessage.plural", "Fetching {0} resources", allFetchedUris.size));
    } else if (allFetchedUris.size === 1) {
      const url = Iterable.first(allFetchedUris).toString(true);
      if (url.length > 400 || validFileUris.length === 1) {
        pastTenseMessage.appendMarkdown(localize({
          key: "fetchWebPage.pastTenseMessageResult.singularAsLink",
          comment: [
            // Make sure the link syntax is correct
            '{Locked="]({0})"}'
          ]
        }, "Fetched [resource]({0})", url));
        invocationMessage.appendMarkdown(localize({
          key: "fetchWebPage.invocationMessage.singularAsLink",
          comment: [
            // Make sure the link syntax is correct
            '{Locked="]({0})"}'
          ]
        }, "Fetching [resource]({0})", url));
      } else {
        pastTenseMessage.appendMarkdown(localize("fetchWebPage.pastTenseMessageResult.singular", "Fetched {0}", url));
        invocationMessage.appendMarkdown(localize("fetchWebPage.invocationMessage.singular", "Fetching {0}", url));
      }
    }
    let confirmationNotNeededReason;
    if (context.chatSessionResource) {
      const model = this._chatService.getSession(context.chatSessionResource);
      const userMessages = model?.getRequests().map((r) => r.message.text) ?? [];
      const referencedResources = collectReferencedResources(userMessages);
      let urlsMentionedInPrompt = false;
      for (const uri of urlsNeedingConfirmation) {
        if (referencedResources.has(uri)) {
          urlsNeedingConfirmation.delete(uri);
          urlsMentionedInPrompt = true;
        }
      }
      if (urlsMentionedInPrompt && urlsNeedingConfirmation.size === 0) {
        confirmationNotNeededReason = localize("fetchWebPage.urlMentionedInPrompt", "Auto approved because URL was in prompt");
      }
    }
    const result = { invocationMessage, pastTenseMessage };
    const allDomainsTrusted = Iterable.every(urlsNeedingConfirmation, (u) => this._trustedDomainService.isValid(u));
    let confirmationTitle;
    let confirmationMessage;
    if (urlsNeedingConfirmation.size && !allDomainsTrusted) {
      if (urlsNeedingConfirmation.size === 1) {
        confirmationTitle = localize("fetchWebPage.confirmationTitle.singular", "Fetch web page?");
        confirmationMessage = new MarkdownString(
          Iterable.first(urlsNeedingConfirmation).toString(true),
          { supportThemeIcons: true }
        );
      } else {
        confirmationTitle = localize("fetchWebPage.confirmationTitle.plural", "Fetch web pages?");
        confirmationMessage = new MarkdownString(
          [...urlsNeedingConfirmation].map((uri) => `- ${uri.toString(true)}`).join("\n"),
          { supportThemeIcons: true }
        );
      }
    }
    result.confirmationMessages = {
      title: confirmationTitle,
      message: confirmationMessage,
      confirmResults: urlsNeedingConfirmation.size > 0,
      allowAutoConfirm: true,
      disclaimer: new MarkdownString("$(info) " + localize("fetchWebPage.confirmationMessage.plural", "Web content may contain malicious code or attempt prompt injection attacks."), { supportThemeIcons: true }),
      confirmationNotNeededReason
    };
    return result;
  }
  _parseUris(urls) {
    const webUris = /* @__PURE__ */ new Map();
    const fileUris = /* @__PURE__ */ new Map();
    const invalidUris = /* @__PURE__ */ new Set();
    const blockedUris = /* @__PURE__ */ new Set();
    urls?.forEach((url) => {
      try {
        const uriObj = URI.parse(url);
        if (uriObj.scheme === "http" || uriObj.scheme === "https") {
          if (!this._agentNetworkFilterService.isUriAllowed(uriObj)) {
            blockedUris.add(url);
          } else {
            webUris.set(url, uriObj);
          }
        } else {
          fileUris.set(url, normalizePath(uriObj));
        }
      } catch (e) {
        invalidUris.add(url);
      }
    });
    return { webUris, fileUris, invalidUris, blockedUris };
  }
  _getPromptPartsForResults(urls, results) {
    return results.map((value, i) => {
      const title = results.length > 1 ? localize("fetchWebPage.fetchedFrom", "Fetched from {0}", urls[i]) : void 0;
      if (!value) {
        return {
          kind: "text",
          title,
          value: localize("fetchWebPage.invalidUrl", "Invalid URL")
        };
      } else if (typeof value === "string") {
        return {
          kind: "text",
          title,
          value
        };
      } else if (value.type === "tooldata") {
        return { ...value.value, title };
      } else if (value.type === "extracted") {
        switch (value.value.status) {
          case "ok":
            return { kind: "text", title, value: value.value.result };
          case "redirect":
            return { kind: "text", title, value: `The webpage has redirected to "${value.value.toURI.toString(true)}". Use the ${InternalFetchWebPageToolId} again to get its contents.` };
          case "error":
            return { kind: "text", title, value: `An error occurred retrieving the fetch result: ${value.value.error}` };
          default:
            assertNever(value.value);
        }
      } else {
        throw new Error("unreachable");
      }
    });
  }
  _getSupportedImageMimeType(uri) {
    const ext = extname(uri.path).toLowerCase();
    switch (ext) {
      case ".png":
        return ChatImageMimeType.PNG;
      case ".jpg":
      case ".jpeg":
        return ChatImageMimeType.JPEG;
      case ".gif":
        return ChatImageMimeType.GIF;
      case ".webp":
        return ChatImageMimeType.WEBP;
      case ".bmp":
        return ChatImageMimeType.BMP;
      default:
        return void 0;
    }
  }
};
FetchWebPageTool = __decorateClass([
  __decorateParam(0, IWebContentExtractorService),
  __decorateParam(1, IFileService),
  __decorateParam(2, ITrustedDomainService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IAgentNetworkFilterService)
], FetchWebPageTool);
const _schemePrefix = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
function collectReferencedResources(messages) {
  const resources = new ResourceSet();
  for (const message of messages) {
    for (const rawToken of message.split(/\s+/)) {
      const token = rawToken.replace(/^[<("'`[{]+/, "").replace(/[>)"'`\]},.;]+$/, "");
      if (!_schemePrefix.test(token)) {
        continue;
      }
      try {
        resources.add(URI.parse(token, true));
      } catch {
      }
    }
  }
  return resources;
}
export {
  FetchWebPageTool,
  FetchWebPageToolData
};
