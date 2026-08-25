import { getMediaMime } from "../../../../base/common/mime.js";
import { URI } from "../../../../base/common/uri.js";
import { McpServerTransportType } from "./mcpTypes.js";
const mcpAllowableContentTypes = [
  "image/webp",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif"
];
var IconTheme = /* @__PURE__ */ ((IconTheme2) => {
  IconTheme2[IconTheme2["Light"] = 0] = "Light";
  IconTheme2[IconTheme2["Dark"] = 1] = "Dark";
  IconTheme2[IconTheme2["Any"] = 2] = "Any";
  return IconTheme2;
})(IconTheme || {});
function validateIcon(icon, launch, logger) {
  const mimeType = icon.mimeType?.toLowerCase() || getMediaMime(icon.src);
  if (!mimeType || !mcpAllowableContentTypes.includes(mimeType)) {
    logger.debug(`Ignoring icon with unsupported mime type: ${icon.src} (${mimeType}), allowed: ${mcpAllowableContentTypes.join(", ")}`);
    return;
  }
  const uri = URI.parse(icon.src);
  if (uri.scheme === "data") {
    return uri;
  }
  if (uri.scheme === "https" || uri.scheme === "http") {
    if (launch.type !== McpServerTransportType.HTTP) {
      logger.debug(`Ignoring icon with HTTP/HTTPS URL: ${icon.src} as the MCP server is not launched with HTTP transport.`);
      return;
    }
    const expectedAuthority = launch.uri.authority.toLowerCase();
    if (uri.authority.toLowerCase() !== expectedAuthority) {
      logger.debug(`Ignoring icon with untrusted authority: ${icon.src}, expected authority: ${expectedAuthority}`);
      return;
    }
    return uri;
  }
  if (uri.scheme === "file") {
    if (launch.type !== McpServerTransportType.Stdio) {
      logger.debug(`Ignoring icon with file URL: ${icon.src} as the MCP server is not launched as a local process.`);
      return;
    }
    return uri;
  }
  logger.debug(`Ignoring icon with unsupported scheme: ${icon.src}. Allowed: data:, http:, https:, file:`);
  return;
}
function parseAndValidateMcpIcon(icons, launch, logger) {
  const result = [];
  for (const icon of icons.icons || []) {
    const uri = validateIcon(icon, launch, logger);
    if (!uri) {
      continue;
    }
    const sizesArr = typeof icon.sizes === "string" ? icon.sizes.split(" ") : Array.isArray(icon.sizes) ? icon.sizes : [];
    result.push({
      src: uri,
      theme: icon.theme === "light" ? 0 /* Light */ : icon.theme === "dark" ? 1 /* Dark */ : 2 /* Any */,
      sizes: sizesArr.map((size) => {
        const [widthStr, heightStr] = size.toLowerCase().split("x");
        return { width: Number(widthStr) || 0, height: Number(heightStr) || 0 };
      }).sort((a, b) => a.width - b.width)
    });
  }
  result.sort((a, b) => a.sizes[0]?.width - b.sizes[0]?.width);
  return result;
}
class McpIcons {
  constructor(_icons) {
    this._icons = _icons;
  }
  static fromStored(icons) {
    return McpIcons.fromParsed(icons?.map((i) => ({ src: URI.revive(i.src), theme: i.theme, sizes: i.sizes })));
  }
  static fromParsed(icons) {
    return new McpIcons(icons || []);
  }
  getUrl(size) {
    const dark = this.getSizeWithTheme(size, 1 /* Dark */);
    if (dark?.theme === 2 /* Any */) {
      return { dark: dark.src };
    }
    const light = this.getSizeWithTheme(size, 0 /* Light */);
    if (!light && !dark) {
      return void 0;
    }
    return { dark: (dark || light).src, light: light?.src };
  }
  getSizeWithTheme(size, theme) {
    let bestOfAnySize;
    for (const icon of this._icons) {
      if (icon.theme === theme || icon.theme === 2 /* Any */ || icon.theme === void 0) {
        bestOfAnySize = icon;
        const matchingSize = icon.sizes.find((s) => s.width >= size);
        if (matchingSize) {
          return { ...icon, sizes: [matchingSize] };
        }
      }
    }
    return bestOfAnySize;
  }
}
export {
  McpIcons,
  parseAndValidateMcpIcon
};
