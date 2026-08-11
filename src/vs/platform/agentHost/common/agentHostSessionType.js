const REMOTE_AGENT_HOST_SESSION_TYPE_PREFIX = "remote-";
function remoteAgentHostSessionTypeId(connectionAuthority, agentProvider) {
  return `${remoteAgentHostSessionTypeAuthorityPrefix(connectionAuthority)}${agentProvider}`;
}
function remoteAgentHostSessionTypeAuthorityPrefix(connectionAuthority) {
  return `${REMOTE_AGENT_HOST_SESSION_TYPE_PREFIX}${connectionAuthority}-`;
}
function isRemoteAgentHostSessionType(sessionType) {
  return sessionType.startsWith(REMOTE_AGENT_HOST_SESSION_TYPE_PREFIX);
}
function findRemoteAgentHostSessionTypeAuthority(sessionType, connectionAuthorities) {
  if (!isRemoteAgentHostSessionType(sessionType)) {
    return void 0;
  }
  let bestMatch;
  for (const authority of connectionAuthorities) {
    if (isRemoteAgentHostSessionTypeForAuthority(sessionType, authority) && (!bestMatch || authority.length > bestMatch.length)) {
      bestMatch = authority;
    }
  }
  return bestMatch;
}
function isRemoteAgentHostSessionTypeForAuthority(sessionType, connectionAuthority) {
  return !!connectionAuthority && sessionType.startsWith(remoteAgentHostSessionTypeAuthorityPrefix(connectionAuthority));
}
function parseRemoteAgentHostHarness(sessionType) {
  if (!isRemoteAgentHostSessionType(sessionType)) {
    return void 0;
  }
  const lastDash = sessionType.lastIndexOf("-");
  const harness = sessionType.slice(lastDash + 1);
  return harness || void 0;
}
function parseRemoteAgentHostSessionTypeAuthority(sessionType, agentProvider) {
  if (!isRemoteAgentHostSessionType(sessionType)) {
    return void 0;
  }
  const providerSuffix = `-${agentProvider}`;
  if (!sessionType.endsWith(providerSuffix)) {
    return void 0;
  }
  const authority = sessionType.slice(REMOTE_AGENT_HOST_SESSION_TYPE_PREFIX.length, sessionType.length - providerSuffix.length);
  return authority || void 0;
}
export {
  findRemoteAgentHostSessionTypeAuthority,
  isRemoteAgentHostSessionType,
  parseRemoteAgentHostHarness,
  parseRemoteAgentHostSessionTypeAuthority,
  remoteAgentHostSessionTypeAuthorityPrefix,
  remoteAgentHostSessionTypeId
};
