import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import { join } from "../../../../base/common/path.js";
import { URI } from "../../../../base/common/uri.js";
import { MessageAttachmentKind } from "../../common/state/sessionState.js";
const EMPTY_TEXT_ELEMENTS = [];
function resolveCodexInput(prompt, attachments) {
  const cleanupPaths = [];
  const input = [];
  const textChunks = [prompt];
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      switch (att.type) {
        case MessageAttachmentKind.Resource: {
          const uri = URI.parse(att.uri);
          if (uri.scheme === "file") {
            textChunks.push(`@${uri.fsPath}`);
          } else {
            textChunks.push(uri.toString());
          }
          break;
        }
        case MessageAttachmentKind.EmbeddedResource: {
          if (att.contentType.startsWith("image/")) {
            const ext = guessImageExtension(att.contentType);
            const tmp = join(os.tmpdir(), `codex-img-${crypto.randomBytes(8).toString("hex")}${ext}`);
            try {
              fs.writeFileSync(tmp, Buffer.from(att.data, "base64"));
              cleanupPaths.push(tmp);
              input.push({ type: "localImage", path: tmp });
            } catch {
            }
            break;
          }
          if (isTextualContentType(att.contentType)) {
            const inlined = renderTextualEmbeddedResource(att);
            if (inlined) {
              textChunks.push(inlined);
            }
            break;
          }
          break;
        }
        case MessageAttachmentKind.Simple: {
          const rep = att.modelRepresentation;
          if (typeof rep === "string" && rep.length > 0) {
            textChunks.push(rep);
          }
          break;
        }
      }
    }
  }
  const text = textChunks.filter((s) => s.length > 0).join("\n\n");
  input.unshift({ type: "text", text, text_elements: EMPTY_TEXT_ELEMENTS });
  return { input, cleanupPaths };
}
function guessImageExtension(contentType) {
  const subtype = contentType.slice("image/".length).toLowerCase();
  switch (subtype) {
    case "jpeg":
    case "jpg":
      return ".jpg";
    case "png":
      return ".png";
    case "gif":
      return ".gif";
    case "webp":
      return ".webp";
    case "bmp":
      return ".bmp";
    default:
      return "";
  }
}
function isTextualContentType(contentType) {
  const type = contentType.toLowerCase().split(";", 1)[0].trim();
  if (type.startsWith("text/")) {
    return true;
  }
  return type === "application/json" || type === "application/xml" || type === "application/javascript" || type === "application/typescript" || type.endsWith("+json") || type.endsWith("+xml");
}
function renderTextualEmbeddedResource(att) {
  let content;
  try {
    content = Buffer.from(att.data, "base64").toString("utf8");
  } catch {
    return void 0;
  }
  if (content.length === 0) {
    return void 0;
  }
  const label = att.label || "attachment";
  const range = att.selection?.range;
  const suffix = range ? ` (lines ${range.start.line + 1}-${range.end.line + 1})` : "";
  return `${label}${suffix}:
\`\`\`
${content}
\`\`\``;
}
export {
  resolveCodexInput
};
