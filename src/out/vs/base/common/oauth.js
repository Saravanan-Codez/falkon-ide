import { decodeBase64 } from "./buffer.js";
const WELL_KNOWN_ROUTE = "/.well-known";
const AUTH_PROTECTED_RESOURCE_METADATA_DISCOVERY_PATH = `${WELL_KNOWN_ROUTE}/oauth-protected-resource`;
const AUTH_SERVER_METADATA_DISCOVERY_PATH = `${WELL_KNOWN_ROUTE}/oauth-authorization-server`;
const OPENID_CONNECT_DISCOVERY_PATH = `${WELL_KNOWN_ROUTE}/openid-configuration`;
const AUTH_SCOPE_SEPARATOR = " ";
const GRANT_TYPE_TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange";
const TOKEN_TYPE_ACCESS_TOKEN = "urn:ietf:params:oauth:token-type:access_token";
const TOKEN_TYPE_ID_TOKEN = "urn:ietf:params:oauth:token-type:id_token";
const TOKEN_TYPE_ID_JAG = "urn:ietf:params:oauth:token-type:id-jag";
const GRANT_TYPE_JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer";
function buildIdJagExchangeBody(clientId, clientSecret, idToken, audience, resource, scopes) {
  const body = new URLSearchParams();
  body.append("client_id", clientId);
  if (clientSecret) {
    body.append("client_secret", clientSecret);
  }
  body.append("grant_type", GRANT_TYPE_TOKEN_EXCHANGE);
  body.append("subject_token", idToken);
  body.append("subject_token_type", TOKEN_TYPE_ID_TOKEN);
  body.append("requested_token_type", TOKEN_TYPE_ID_JAG);
  body.append("audience", audience);
  if (resource) {
    body.append("resource", resource);
  }
  if (scopes.length) {
    body.append("scope", scopes.join(AUTH_SCOPE_SEPARATOR));
  }
  return body;
}
function buildResourceRedemptionBody(clientId, clientSecret, idJag, resource, scopes) {
  const body = new URLSearchParams();
  body.append("client_id", clientId);
  if (clientSecret) {
    body.append("client_secret", clientSecret);
  }
  body.append("grant_type", GRANT_TYPE_JWT_BEARER);
  body.append("assertion", idJag);
  if (resource) {
    body.append("resource", resource);
  }
  if (scopes.length) {
    body.append("scope", scopes.join(AUTH_SCOPE_SEPARATOR));
  }
  return body;
}
var AuthorizationErrorType = /* @__PURE__ */ ((AuthorizationErrorType2) => {
  AuthorizationErrorType2["InvalidRequest"] = "invalid_request";
  AuthorizationErrorType2["InvalidClient"] = "invalid_client";
  AuthorizationErrorType2["InvalidGrant"] = "invalid_grant";
  AuthorizationErrorType2["UnauthorizedClient"] = "unauthorized_client";
  AuthorizationErrorType2["UnsupportedGrantType"] = "unsupported_grant_type";
  AuthorizationErrorType2["InvalidScope"] = "invalid_scope";
  return AuthorizationErrorType2;
})(AuthorizationErrorType || {});
var AuthorizationDeviceCodeErrorType = /* @__PURE__ */ ((AuthorizationDeviceCodeErrorType2) => {
  AuthorizationDeviceCodeErrorType2["AuthorizationPending"] = "authorization_pending";
  AuthorizationDeviceCodeErrorType2["SlowDown"] = "slow_down";
  AuthorizationDeviceCodeErrorType2["AccessDenied"] = "access_denied";
  AuthorizationDeviceCodeErrorType2["ExpiredToken"] = "expired_token";
  return AuthorizationDeviceCodeErrorType2;
})(AuthorizationDeviceCodeErrorType || {});
var AuthorizationRegistrationErrorType = /* @__PURE__ */ ((AuthorizationRegistrationErrorType2) => {
  AuthorizationRegistrationErrorType2["InvalidRedirectUri"] = "invalid_redirect_uri";
  AuthorizationRegistrationErrorType2["InvalidClientMetadata"] = "invalid_client_metadata";
  AuthorizationRegistrationErrorType2["InvalidSoftwareStatement"] = "invalid_software_statement";
  AuthorizationRegistrationErrorType2["UnapprovedSoftwareStatement"] = "unapproved_software_statement";
  return AuthorizationRegistrationErrorType2;
})(AuthorizationRegistrationErrorType || {});
function isAuthorizationProtectedResourceMetadata(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const metadata = obj;
  if (!metadata.resource) {
    return false;
  }
  if (metadata.scopes_supported !== void 0 && !Array.isArray(metadata.scopes_supported)) {
    return false;
  }
  return true;
}
const urisToCheck = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "registration_endpoint",
  "jwks_uri"
];
function isAuthorizationServerMetadata(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const metadata = obj;
  if (!metadata.issuer) {
    throw new Error("Authorization server metadata must have an issuer");
  }
  for (const uri of urisToCheck) {
    if (!metadata[uri]) {
      continue;
    }
    if (typeof metadata[uri] !== "string") {
      throw new Error(`Authorization server metadata '${uri}' must be a string`);
    }
    if (!metadata[uri].startsWith("https://") && !metadata[uri].startsWith("http://")) {
      throw new Error(`Authorization server metadata '${uri}' must start with http:// or https://`);
    }
  }
  return true;
}
function isAuthorizationDynamicClientRegistrationResponse(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const response = obj;
  return response.client_id !== void 0;
}
function isAuthorizationAuthorizeResponse(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const response = obj;
  return response.code !== void 0 && response.state !== void 0;
}
function isAuthorizationTokenResponse(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const response = obj;
  return response.access_token !== void 0 && response.token_type !== void 0;
}
function isAuthorizationDeviceResponse(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const response = obj;
  return response.device_code !== void 0 && response.user_code !== void 0 && response.verification_uri !== void 0 && response.expires_in !== void 0;
}
function isAuthorizationErrorResponse(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const response = obj;
  return response.error !== void 0;
}
function isAuthorizationRegistrationErrorResponse(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  const response = obj;
  return response.error !== void 0;
}
function getDefaultMetadataForUrl(authorizationServer) {
  return {
    issuer: authorizationServer.toString(),
    authorization_endpoint: new URL("/authorize", authorizationServer).toString(),
    token_endpoint: new URL("/token", authorizationServer).toString(),
    registration_endpoint: new URL("/register", authorizationServer).toString(),
    // Default values for Dynamic OpenID Providers
    // https://openid.net/specs/openid-connect-discovery-1_0.html
    response_types_supported: ["code", "id_token", "id_token token"]
  };
}
const grantTypesSupported = ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:device_code"];
const DEFAULT_AUTH_FLOW_PORT = 33418;
async function fetchDynamicRegistration(serverMetadata, clientName, scopes) {
  if (!serverMetadata.registration_endpoint) {
    throw new Error("Server does not support dynamic registration");
  }
  const requestBody = {
    client_name: clientName,
    client_uri: "https://code.visualstudio.com",
    grant_types: serverMetadata.grant_types_supported ? serverMetadata.grant_types_supported.filter((gt) => grantTypesSupported.includes(gt)) : grantTypesSupported,
    response_types: ["code"],
    redirect_uris: [
      "https://insiders.vscode.dev/redirect",
      "https://vscode.dev/redirect",
      "http://127.0.0.1/",
      // Added these for any server that might do
      // only exact match on the redirect URI even
      // though the spec says it should not care
      // about the port.
      `http://127.0.0.1:${DEFAULT_AUTH_FLOW_PORT}/`
    ],
    scope: scopes?.join(AUTH_SCOPE_SEPARATOR),
    token_endpoint_auth_method: "none",
    application_type: "native"
  };
  const response = await fetch(serverMetadata.registration_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const result = await response.text();
    let errorDetails = result;
    try {
      const errorResponse = JSON.parse(result);
      if (isAuthorizationRegistrationErrorResponse(errorResponse)) {
        errorDetails = `${errorResponse.error}${errorResponse.error_description ? `: ${errorResponse.error_description}` : ""}`;
      }
    } catch {
    }
    throw new Error(`Registration to ${serverMetadata.registration_endpoint} failed: ${errorDetails}`);
  }
  const registration = await response.json();
  if (isAuthorizationDynamicClientRegistrationResponse(registration)) {
    return registration;
  }
  throw new Error(`Invalid authorization dynamic client registration response: ${JSON.stringify(registration)}`);
}
function parseWWWAuthenticateHeader(wwwAuthenticateHeaderValue) {
  const challenges = [];
  const tokens = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < wwwAuthenticateHeaderValue.length; i++) {
    const char = wwwAuthenticateHeaderValue[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === "," && !inQuotes) {
      if (current.trim()) {
        tokens.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    tokens.push(current.trim());
  }
  let currentChallenge;
  for (const token of tokens) {
    const hasEquals = token.includes("=");
    if (!hasEquals) {
      if (currentChallenge) {
        challenges.push(currentChallenge);
      }
      currentChallenge = { scheme: token.trim(), params: {} };
    } else {
      const spaceIndex = token.indexOf(" ");
      if (spaceIndex > 0) {
        const beforeSpace = token.substring(0, spaceIndex);
        const afterSpace = token.substring(spaceIndex + 1);
        if (!beforeSpace.includes("=") && afterSpace.includes("=")) {
          if (currentChallenge) {
            challenges.push(currentChallenge);
          }
          currentChallenge = { scheme: beforeSpace.trim(), params: {} };
          const equalIndex = afterSpace.indexOf("=");
          if (equalIndex > 0) {
            const key = afterSpace.substring(0, equalIndex).trim();
            const value = afterSpace.substring(equalIndex + 1).trim().replace(/^"|"$/g, "");
            if (key && value !== void 0) {
              currentChallenge.params[key] = value;
            }
          }
          continue;
        }
      }
      if (currentChallenge) {
        const equalIndex = token.indexOf("=");
        if (equalIndex > 0) {
          const key = token.substring(0, equalIndex).trim();
          const value = token.substring(equalIndex + 1).trim().replace(/^"|"$/g, "");
          if (key && value !== void 0) {
            currentChallenge.params[key] = value;
          }
        }
      }
    }
  }
  if (currentChallenge) {
    challenges.push(currentChallenge);
  }
  return challenges;
}
function getClaimsFromJWT(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT token format: token must have three parts separated by dots");
  }
  const [header, payload, _signature] = parts;
  try {
    const decodedHeader = JSON.parse(decodeBase64(header).toString());
    if (typeof decodedHeader !== "object") {
      throw new Error("Invalid JWT token format: header is not a JSON object");
    }
    const decodedPayload = JSON.parse(decodeBase64(payload).toString());
    if (typeof decodedPayload !== "object") {
      throw new Error("Invalid JWT token format: payload is not a JSON object");
    }
    return decodedPayload;
  } catch (e) {
    if (e instanceof Error) {
      throw new Error(`Failed to parse JWT token: ${e.message}`);
    }
    throw new Error("Failed to parse JWT token");
  }
}
function scopesMatch(scopes1, scopes2) {
  if (scopes1 === scopes2) {
    return true;
  }
  if (!scopes1 || !scopes2) {
    return false;
  }
  if (scopes1.length !== scopes2.length) {
    return false;
  }
  const sortedScopes1 = [...scopes1].sort();
  const sortedScopes2 = [...scopes2].sort();
  return sortedScopes1.every((scope, index) => scope === sortedScopes2[index]);
}
async function fetchResourceMetadata(targetResource, resourceMetadataUrl, options = {}) {
  const {
    sameOriginHeaders = {},
    fetch: fetchImpl = fetch
  } = options;
  const targetResourceUrlObj = new URL(targetResource);
  const fetchPrm = async (prmUrl, validateUrl) => {
    let headers = {
      "Accept": "application/json"
    };
    const resourceMetadataUrlObj = new URL(prmUrl);
    if (resourceMetadataUrlObj.origin === targetResourceUrlObj.origin) {
      headers = {
        ...headers,
        ...sameOriginHeaders
      };
    }
    const response = await fetchImpl(prmUrl, { method: "GET", headers });
    if (response.status !== 200) {
      let errorText;
      try {
        errorText = await response.text();
      } catch {
        errorText = response.statusText;
      }
      throw new Error(`Failed to fetch resource metadata from ${prmUrl}: ${response.status} ${errorText}`);
    }
    const body = await response.json();
    if (isAuthorizationProtectedResourceMetadata(body)) {
      const prmValue = new URL(body.resource).toString();
      const expectedResource = new URL(validateUrl).toString();
      if (prmValue !== expectedResource) {
        throw new Error(`Protected Resource Metadata 'resource' property value "${prmValue}" does not match expected value "${expectedResource}" for URL ${prmUrl}. Per RFC 9728, these MUST match. See https://datatracker.ietf.org/doc/html/rfc9728#PRConfigurationValidation`);
      }
      return body;
    } else {
      throw new Error(`Invalid resource metadata from ${prmUrl}. Expected to follow shape of https://datatracker.ietf.org/doc/html/rfc9728#name-protected-resource-metadata (Hints: is scopes_supported an array? Is resource a string?). Current payload: ${JSON.stringify(body)}`);
    }
  };
  const errors = [];
  if (resourceMetadataUrl) {
    try {
      const metadata = await fetchPrm(resourceMetadataUrl, targetResource);
      return { metadata, discoveryUrl: resourceMetadataUrl, errors };
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }
  const hasPathComponent = targetResourceUrlObj.pathname !== "/";
  const rootUrl = `${targetResourceUrlObj.origin}${AUTH_PROTECTED_RESOURCE_METADATA_DISCOVERY_PATH}`;
  if (hasPathComponent) {
    const pathAppendedUrl = `${rootUrl}${targetResourceUrlObj.pathname}`;
    try {
      const metadata = await fetchPrm(pathAppendedUrl, targetResource);
      return { metadata, discoveryUrl: pathAppendedUrl, errors };
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }
  try {
    const metadata = await fetchPrm(rootUrl, targetResourceUrlObj.origin);
    return { metadata, discoveryUrl: rootUrl, errors };
  } catch (e) {
    errors.push(e instanceof Error ? e : new Error(String(e)));
  }
  if (errors.length === 1) {
    throw errors[0];
  } else {
    throw new AggregateError(errors, "Failed to fetch resource metadata from all attempted URLs");
  }
}
async function tryParseAuthServerMetadata(response) {
  if (response.status !== 200) {
    return void 0;
  }
  try {
    const body = await response.json();
    if (isAuthorizationServerMetadata(body)) {
      return body;
    }
  } catch {
  }
  return void 0;
}
async function getErrText(res) {
  try {
    return await res.text();
  } catch {
    return res.statusText;
  }
}
async function fetchAuthorizationServerMetadata(authorizationServer, options = {}) {
  const {
    additionalHeaders = {},
    fetch: fetchImpl = fetch
  } = options;
  const authorizationServerUrl = new URL(authorizationServer);
  const extraPath = authorizationServerUrl.pathname === "/" ? "" : authorizationServerUrl.pathname;
  const errors = [];
  const doFetch = async (url) => {
    try {
      const rawResponse = await fetchImpl(url, {
        method: "GET",
        headers: {
          ...additionalHeaders,
          "Accept": "application/json"
        }
      });
      const metadata2 = await tryParseAuthServerMetadata(rawResponse);
      if (metadata2) {
        return metadata2;
      }
      errors.push(new Error(`Failed to fetch authorization server metadata from ${url}: ${rawResponse.status} ${await getErrText(rawResponse)}`));
      return void 0;
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)));
      return void 0;
    }
  };
  const pathToFetch = new URL(AUTH_SERVER_METADATA_DISCOVERY_PATH, authorizationServer).toString() + extraPath;
  let metadata = await doFetch(pathToFetch);
  if (metadata) {
    return { metadata, discoveryUrl: pathToFetch, errors };
  }
  const openidPathInsertionUrl = new URL(OPENID_CONNECT_DISCOVERY_PATH, authorizationServer).toString() + extraPath;
  metadata = await doFetch(openidPathInsertionUrl);
  if (metadata) {
    return { metadata, discoveryUrl: openidPathInsertionUrl, errors };
  }
  const openidPathAdditionUrl = authorizationServer.endsWith("/") ? authorizationServer + OPENID_CONNECT_DISCOVERY_PATH.substring(1) : authorizationServer + OPENID_CONNECT_DISCOVERY_PATH;
  metadata = await doFetch(openidPathAdditionUrl);
  if (metadata) {
    return { metadata, discoveryUrl: openidPathAdditionUrl, errors };
  }
  if (errors.length === 1) {
    throw errors[0];
  } else {
    throw new AggregateError(errors, "Failed to fetch authorization server metadata from all attempted URLs");
  }
}
export {
  AUTH_PROTECTED_RESOURCE_METADATA_DISCOVERY_PATH,
  AUTH_SCOPE_SEPARATOR,
  AUTH_SERVER_METADATA_DISCOVERY_PATH,
  AuthorizationDeviceCodeErrorType,
  AuthorizationErrorType,
  AuthorizationRegistrationErrorType,
  DEFAULT_AUTH_FLOW_PORT,
  GRANT_TYPE_JWT_BEARER,
  GRANT_TYPE_TOKEN_EXCHANGE,
  OPENID_CONNECT_DISCOVERY_PATH,
  TOKEN_TYPE_ACCESS_TOKEN,
  TOKEN_TYPE_ID_JAG,
  TOKEN_TYPE_ID_TOKEN,
  buildIdJagExchangeBody,
  buildResourceRedemptionBody,
  fetchAuthorizationServerMetadata,
  fetchDynamicRegistration,
  fetchResourceMetadata,
  getClaimsFromJWT,
  getDefaultMetadataForUrl,
  isAuthorizationAuthorizeResponse,
  isAuthorizationDeviceResponse,
  isAuthorizationDynamicClientRegistrationResponse,
  isAuthorizationErrorResponse,
  isAuthorizationProtectedResourceMetadata,
  isAuthorizationRegistrationErrorResponse,
  isAuthorizationServerMetadata,
  isAuthorizationTokenResponse,
  parseWWWAuthenticateHeader,
  scopesMatch
};
