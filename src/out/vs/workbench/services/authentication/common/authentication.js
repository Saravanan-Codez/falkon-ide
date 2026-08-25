import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
const INTERNAL_AUTH_PROVIDER_PREFIX = "__";
function isAuthenticationWwwAuthenticateRequest(obj) {
  return typeof obj === "object" && obj !== null && "wwwAuthenticate" in obj && typeof obj.wwwAuthenticate === "string";
}
function getDynamicAuthenticationProviderId(authorizationServer, resource) {
  return resource ? `${authorizationServer.toString(true)} ${resource.resource}` : authorizationServer.toString(true);
}
const IAuthenticationService = createDecorator("IAuthenticationService");
function isAuthenticationSession(thing) {
  if (typeof thing !== "object" || !thing) {
    return false;
  }
  const maybe = thing;
  if (typeof maybe.id !== "string") {
    return false;
  }
  if (typeof maybe.accessToken !== "string") {
    return false;
  }
  if (typeof maybe.account !== "object" || !maybe.account) {
    return false;
  }
  if (typeof maybe.account.label !== "string") {
    return false;
  }
  if (typeof maybe.account.id !== "string") {
    return false;
  }
  if (!Array.isArray(maybe.scopes)) {
    return false;
  }
  if (maybe.idToken && typeof maybe.idToken !== "string") {
    return false;
  }
  return true;
}
const IAuthenticationExtensionsService = createDecorator("IAuthenticationExtensionsService");
export {
  IAuthenticationExtensionsService,
  IAuthenticationService,
  INTERNAL_AUTH_PROVIDER_PREFIX,
  getDynamicAuthenticationProviderId,
  isAuthenticationSession,
  isAuthenticationWwwAuthenticateRequest
};
