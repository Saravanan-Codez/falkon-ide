function createChatPhoneInputSessionContext(session) {
  return session ? {
    providerId: session.providerId,
    sessionId: session.sessionId,
    sessionType: session.sessionType,
    chatResource: session.activeChat.get().resource,
    modelId: session.modelId.get()
  } : void 0;
}
function createChatPhoneInputTarget(session, uriIdentityService) {
  return session ? {
    providerId: session.providerId,
    sessionId: session.sessionId,
    chatResourceKey: uriIdentityService.extUri.getComparisonKey(session.chatResource)
  } : void 0;
}
function matchesChatPhoneInputTarget(target, session, uriIdentityService) {
  return target === void 0 ? session === void 0 : !!session && session.providerId === target.providerId && session.sessionId === target.sessionId && uriIdentityService.extUri.getComparisonKey(session.chatResource) === target.chatResourceKey;
}
export {
  createChatPhoneInputSessionContext,
  createChatPhoneInputTarget,
  matchesChatPhoneInputTarget
};
