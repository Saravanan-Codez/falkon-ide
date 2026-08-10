import * as cookie from "cookie";
import * as fs from "fs";
import * as path from "../../base/common/path.js";
import { generateUuid } from "../../base/common/uuid.js";
import { connectionTokenCookieName, connectionTokenQueryName } from "../../base/common/network.js";
import { Promises } from "../../base/node/pfs.js";
const connectionTokenRegex = /^[0-9A-Za-z_-]+$/;
var ServerConnectionTokenType = /* @__PURE__ */ ((ServerConnectionTokenType2) => {
  ServerConnectionTokenType2[ServerConnectionTokenType2["None"] = 0] = "None";
  ServerConnectionTokenType2[ServerConnectionTokenType2["Optional"] = 1] = "Optional";
  ServerConnectionTokenType2[ServerConnectionTokenType2["Mandatory"] = 2] = "Mandatory";
  return ServerConnectionTokenType2;
})(ServerConnectionTokenType || {});
class NoneServerConnectionToken {
  constructor() {
    this.type = 0 /* None */;
  }
  validate(connectionToken) {
    return true;
  }
}
class MandatoryServerConnectionToken {
  constructor(value) {
    this.value = value;
    this.type = 2 /* Mandatory */;
  }
  validate(connectionToken) {
    return connectionToken === this.value;
  }
}
class ServerConnectionTokenParseError {
  constructor(message) {
    this.message = message;
  }
}
async function parseServerConnectionToken(args, defaultValue) {
  const withoutConnectionToken = args["without-connection-token"];
  const connectionToken = args["connection-token"];
  const connectionTokenFile = args["connection-token-file"];
  if (withoutConnectionToken) {
    if (typeof connectionToken !== "undefined" || typeof connectionTokenFile !== "undefined") {
      return new ServerConnectionTokenParseError(`Please do not use the argument '--connection-token' or '--connection-token-file' at the same time as '--without-connection-token'.`);
    }
    return new NoneServerConnectionToken();
  }
  if (typeof connectionTokenFile !== "undefined") {
    if (typeof connectionToken !== "undefined") {
      return new ServerConnectionTokenParseError(`Please do not use the argument '--connection-token' at the same time as '--connection-token-file'.`);
    }
    let rawConnectionToken;
    try {
      rawConnectionToken = fs.readFileSync(connectionTokenFile).toString().replace(/\r?\n$/, "");
    } catch (e) {
      return new ServerConnectionTokenParseError(`Unable to read the connection token file at '${connectionTokenFile}'.`);
    }
    if (!connectionTokenRegex.test(rawConnectionToken)) {
      return new ServerConnectionTokenParseError(`The connection token defined in '${connectionTokenFile} does not adhere to the characters 0-9, a-z, A-Z, _, or -.`);
    }
    return new MandatoryServerConnectionToken(rawConnectionToken);
  }
  if (typeof connectionToken !== "undefined") {
    if (!connectionTokenRegex.test(connectionToken)) {
      return new ServerConnectionTokenParseError(`The connection token '${connectionToken} does not adhere to the characters 0-9, a-z, A-Z or -.`);
    }
    return new MandatoryServerConnectionToken(connectionToken);
  }
  return new MandatoryServerConnectionToken(await defaultValue());
}
async function determineServerConnectionToken(args) {
  const readOrGenerateConnectionToken = async () => {
    if (!args["user-data-dir"]) {
      return generateUuid();
    }
    const storageLocation = path.join(args["user-data-dir"], "token");
    try {
      const fileContents = await fs.promises.readFile(storageLocation);
      const connectionToken2 = fileContents.toString().replace(/\r?\n$/, "");
      if (connectionTokenRegex.test(connectionToken2)) {
        return connectionToken2;
      }
    } catch (err) {
    }
    const connectionToken = generateUuid();
    try {
      await Promises.writeFile(storageLocation, connectionToken, { mode: 384 });
    } catch (err) {
    }
    return connectionToken;
  };
  return parseServerConnectionToken(args, readOrGenerateConnectionToken);
}
function requestHasValidConnectionToken(connectionToken, req, parsedUrl) {
  if (connectionToken.validate(parsedUrl.query[connectionTokenQueryName])) {
    return true;
  }
  const cookies = cookie.parse(req.headers.cookie || "");
  return connectionToken.validate(cookies[connectionTokenCookieName]);
}
export {
  MandatoryServerConnectionToken,
  NoneServerConnectionToken,
  ServerConnectionTokenParseError,
  ServerConnectionTokenType,
  determineServerConnectionToken,
  parseServerConnectionToken,
  requestHasValidConnectionToken
};
