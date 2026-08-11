import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { mcpSchemaId } from "../../../services/configuration/common/configuration.js";
import { inputsSchema } from "../../../services/configurationResolver/common/configurationResolverSchema.js";
import { Extensions } from "../../../services/extensionManagement/common/extensionFeatures.js";
const mcpActivationEventPrefix = "onMcpCollection:";
const mcpActivationEvent = (contributedCollectionId) => mcpActivationEventPrefix + contributedCollectionId;
var DiscoverySource = /* @__PURE__ */ ((DiscoverySource2) => {
  DiscoverySource2["ClaudeDesktop"] = "claude-desktop";
  DiscoverySource2["Windsurf"] = "windsurf";
  DiscoverySource2["CursorGlobal"] = "cursor-global";
  DiscoverySource2["CursorWorkspace"] = "cursor-workspace";
  return DiscoverySource2;
})(DiscoverySource || {});
const allDiscoverySources = Object.keys({
  ["claude-desktop" /* ClaudeDesktop */]: true,
  ["windsurf" /* Windsurf */]: true,
  ["cursor-global" /* CursorGlobal */]: true,
  ["cursor-workspace" /* CursorWorkspace */]: true
});
const discoverySourceLabel = {
  ["claude-desktop" /* ClaudeDesktop */]: localize("mcp.discovery.source.claude-desktop", "Claude Desktop"),
  ["windsurf" /* Windsurf */]: localize("mcp.discovery.source.windsurf", "Windsurf"),
  ["cursor-global" /* CursorGlobal */]: localize("mcp.discovery.source.cursor-global", "Cursor (Global)"),
  ["cursor-workspace" /* CursorWorkspace */]: localize("mcp.discovery.source.cursor-workspace", "Cursor (Workspace)")
};
const discoverySourceSettingsLabel = {
  ["claude-desktop" /* ClaudeDesktop */]: localize("mcp.discovery.source.claude-desktop.config", "Claude Desktop configuration (`claude_desktop_config.json`)"),
  ["windsurf" /* Windsurf */]: localize("mcp.discovery.source.windsurf.config", "Windsurf configurations (`~/.codeium/windsurf/mcp_config.json`)"),
  ["cursor-global" /* CursorGlobal */]: localize("mcp.discovery.source.cursor-global.config", "Cursor global configuration (`~/.cursor/mcp.json`)"),
  ["cursor-workspace" /* CursorWorkspace */]: localize("mcp.discovery.source.cursor-workspace.config", "Cursor workspace configuration (`.cursor/mcp.json`)")
};
const mcpConfigurationSection = "mcp";
const mcpDiscoverySection = "chat.mcp.discovery.enabled";
const mcpServerSamplingSection = "chat.mcp.serverSampling";
const mcpServerCollisionBehaviorSection = "chat.mcp.collisionBehavior";
const mcpEnterpriseManagedAuthIdpSection = "mcp.enterpriseManagedAuth.idp";
var McpCollisionBehavior = /* @__PURE__ */ ((McpCollisionBehavior2) => {
  McpCollisionBehavior2["Disable"] = "disable";
  McpCollisionBehavior2["Suffix"] = "suffix";
  return McpCollisionBehavior2;
})(McpCollisionBehavior || {});
const mcpSchemaExampleServers = {
  "mcp-server-time": {
    command: "python",
    args: ["-m", "mcp_server_time", "--local-timezone=America/Los_Angeles"],
    env: {}
  }
};
const httpSchemaExamples = {
  "my-mcp-server": {
    url: "http://localhost:3001/mcp",
    headers: {}
  }
};
const mcpDevModeProps = (stdio) => ({
  dev: {
    type: "object",
    markdownDescription: localize("app.mcp.dev", "Enabled development mode for the server. When present, the server will be started eagerly and output will be included in its output. Properties inside the `dev` object can configure additional behavior."),
    examples: [{ watch: "src/**/*.ts", debug: { type: "node" } }],
    properties: {
      watch: {
        description: localize("app.mcp.dev.watch", "A glob pattern or list of glob patterns relative to the workspace folder to watch. The MCP server will be restarted when these files change."),
        examples: ["src/**/*.ts"],
        oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }]
      },
      ...stdio && {
        debug: {
          markdownDescription: localize("app.mcp.dev.debug", "If set, debugs the MCP server using the given runtime as it's started."),
          oneOf: [
            {
              type: "object",
              required: ["type"],
              properties: {
                type: {
                  type: "string",
                  enum: ["node"],
                  description: localize("app.mcp.dev.debug.type.node", "Debug the MCP server using Node.js.")
                }
              },
              additionalProperties: false
            },
            {
              type: "object",
              required: ["type"],
              properties: {
                type: {
                  type: "string",
                  enum: ["debugpy"],
                  description: localize("app.mcp.dev.debug.type.python", "Debug the MCP server using Python and debugpy.")
                },
                debugpyPath: {
                  type: "string",
                  description: localize("app.mcp.dev.debug.debugpyPath", "Path to the debugpy executable.")
                }
              },
              additionalProperties: false
            }
          ]
        }
      }
    }
  }
});
const mcpStdioServerSchema = {
  type: "object",
  additionalProperties: false,
  examples: [mcpSchemaExampleServers["mcp-server-time"]],
  properties: {
    type: {
      type: "string",
      enum: ["stdio"],
      description: localize("app.mcp.json.type", "The type of the server.")
    },
    sandboxEnabled: {
      type: "boolean",
      default: false,
      description: localize("app.mcp.json.sandboxEnabled", "Whether to run the server in a sandboxed environment.")
    },
    command: {
      type: "string",
      description: localize("app.mcp.json.command", "The command to run the server.")
    },
    cwd: {
      type: "string",
      description: localize("app.mcp.json.cwd", "The working directory for the server command. Defaults to the workspace folder when run in a workspace."),
      examples: ["${workspaceFolder}"]
    },
    args: {
      type: "array",
      description: localize("app.mcp.args.command", "Arguments passed to the server."),
      items: {
        type: "string"
      }
    },
    envFile: {
      type: "string",
      description: localize("app.mcp.envFile.command", "Path to a file containing environment variables for the server."),
      examples: ["${workspaceFolder}/.env"]
    },
    env: {
      description: localize("app.mcp.env.command", "Environment variables passed to the server."),
      additionalProperties: {
        anyOf: [
          { type: "null" },
          { type: "string" },
          { type: "number" }
        ]
      }
    },
    ...mcpDevModeProps(true)
  }
};
const mcpServerSchema = {
  id: mcpSchemaId,
  type: "object",
  title: localize("app.mcp.json.title", "Model Context Protocol Servers"),
  allowTrailingCommas: true,
  allowComments: true,
  additionalProperties: false,
  properties: {
    sandbox: {
      description: localize("app.mcp.json.sandbox", "Sandbox config that determines file system and network access. Sandboxing is enabled when sandboxEnabled property is set at the server level on Mac OS and Linux only."),
      type: "object",
      additionalProperties: false,
      properties: {
        network: {
          description: localize("app.mcp.json.sandbox.network", "Network access settings for the sandboxed server."),
          type: "object",
          additionalProperties: false,
          properties: {
            allowedDomains: {
              description: localize("app.mcp.json.sandbox.network.allowedDomains", "List of domains that the server is allowed to access. Wildcards are supported, e.g. `*.example.com`."),
              type: "array",
              items: { type: "string" },
              default: []
            },
            deniedDomains: {
              description: localize("app.mcp.json.sandbox.network.deniedDomains", "List of domains that the server is not allowed to access. e.g. `invalid.example.com`."),
              type: "array",
              items: { type: "string" },
              default: []
            }
          }
        },
        filesystem: {
          description: localize("app.mcp.json.sandbox.filesystem", "Filesystem access settings for the sandboxed server. Glob patterns are supported for Mac OS only."),
          type: "object",
          additionalProperties: false,
          properties: {
            denyRead: {
              description: localize("app.mcp.json.sandbox.filesystem.denyRead", "List of file paths that the server is not allowed to read. By default, all files are allowed to be read. e.g. `~/src/secrets`."),
              type: "array",
              items: { type: "string" },
              default: []
            },
            allowWrite: {
              description: localize("app.mcp.json.sandbox.filesystem.allowWrite", "List of file paths that the server is allowed to write to. e.g. `~/src/`."),
              type: "array",
              items: { type: "string" },
              default: []
            },
            denyWrite: {
              description: localize("app.mcp.json.sandbox.filesystem.denyWrite", "List of file paths that the server is not allowed to write to. e.g. `~/src/auth/`."),
              type: "array",
              items: { type: "string" },
              default: []
            }
          }
        }
      }
    },
    servers: {
      examples: [
        mcpSchemaExampleServers,
        httpSchemaExamples
      ],
      additionalProperties: {
        oneOf: [
          mcpStdioServerSchema,
          {
            type: "object",
            additionalProperties: false,
            required: ["url"],
            examples: [httpSchemaExamples["my-mcp-server"]],
            properties: {
              type: {
                type: "string",
                enum: ["http", "sse"],
                description: localize("app.mcp.json.type", "The type of the server.")
              },
              url: {
                type: "string",
                format: "uri",
                pattern: "^https?:\\/\\/.+",
                patternErrorMessage: localize("app.mcp.json.url.pattern", "The URL must start with 'http://' or 'https://'."),
                description: localize("app.mcp.json.url", "The URL of the Streamable HTTP or SSE endpoint.")
              },
              headers: {
                type: "object",
                description: localize("app.mcp.json.headers", "Additional headers sent to the server."),
                additionalProperties: { type: "string" }
              },
              oauth: {
                type: "object",
                description: localize("app.mcp.json.oauth", "OAuth configuration for authenticating with the server."),
                additionalProperties: false,
                minProperties: 1,
                properties: {
                  clientId: {
                    type: "string",
                    minLength: 1,
                    markdownDescription: localize("app.mcp.json.oauth.clientId", "The OAuth client ID to use when authenticating with the server. When `enterpriseManaged` is `true`, this is the **resource** authorization server's client ID (the client trusted by the protected resource), not the IdP's. To set the matching client secret, use the *Set Client Secret* code lens above this field \u2014 secrets are stored in the OS secret store, not in this file.")
                  },
                  enterpriseManaged: {
                    type: "boolean",
                    default: false,
                    markdownDescription: localize("app.mcp.json.oauth.enterpriseManaged", "(Preview) When set to `true`, this MCP server authenticates through the SSO issuer configured by `#mcp.enterpriseManagedAuth.idp#` using OAuth Identity Assertion Authorization Grant (ID-JAG). After a one-time sign-in, subsequent enterprise-managed servers connect silently. The IdP issuer and client credentials are read from the `#mcp.enterpriseManagedAuth.idp#` setting; the `clientId` on this server entry is passed to the resource authorization server.")
                  }
                }
              },
              ...mcpDevModeProps(false)
            }
          }
        ]
      }
    },
    inputs: inputsSchema.definitions.inputs
  }
};
const mcpContributionPoint = {
  extensionPoint: "mcpServerDefinitionProviders",
  activationEventsGenerator: function* (contribs) {
    for (const contrib of contribs) {
      if (contrib.id) {
        yield mcpActivationEvent(contrib.id);
      }
    }
  },
  jsonSchema: {
    description: localize("vscode.extension.contributes.mcp", "Contributes Model Context Protocol servers. Users of this should also use `vscode.lm.registerMcpServerDefinitionProvider`."),
    type: "array",
    defaultSnippets: [{ body: [{ id: "", label: "" }] }],
    items: {
      additionalProperties: false,
      type: "object",
      defaultSnippets: [{ body: { id: "", label: "" } }],
      properties: {
        id: {
          description: localize("vscode.extension.contributes.mcp.id", "Unique ID for the collection."),
          type: "string"
        },
        label: {
          description: localize("vscode.extension.contributes.mcp.label", "Display name for the collection."),
          type: "string"
        },
        when: {
          description: localize("vscode.extension.contributes.mcp.when", "Condition which must be true to enable this collection."),
          type: "string"
        }
      }
    }
  }
};
class McpServerDefinitionsProviderRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.mcpServerDefinitionProviders && Array.isArray(manifest.contributes.mcpServerDefinitionProviders) && manifest.contributes.mcpServerDefinitionProviders.length > 0;
  }
  render(manifest) {
    const mcpServerDefinitionProviders = manifest.contributes?.mcpServerDefinitionProviders ?? [];
    const headers = [localize("id", "ID"), localize("name", "Name")];
    const rows = mcpServerDefinitionProviders.map((mcpServerDefinitionProvider) => {
      return [
        new MarkdownString().appendMarkdown(`\`${mcpServerDefinitionProvider.id}\``),
        mcpServerDefinitionProvider.label
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: mcpConfigurationSection,
  label: localize("mcpServerDefinitionProviders", "MCP Servers"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(McpServerDefinitionsProviderRenderer)
});
export {
  DiscoverySource,
  McpCollisionBehavior,
  allDiscoverySources,
  discoverySourceLabel,
  discoverySourceSettingsLabel,
  mcpActivationEvent,
  mcpConfigurationSection,
  mcpContributionPoint,
  mcpDiscoverySection,
  mcpEnterpriseManagedAuthIdpSection,
  mcpSchemaExampleServers,
  mcpServerCollisionBehaviorSection,
  mcpServerSamplingSection,
  mcpServerSchema,
  mcpStdioServerSchema
};
