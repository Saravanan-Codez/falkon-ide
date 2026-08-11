async function openAndSendSideChat(sessionsManagementService, sessionsService, session, sideChat, query) {
  await sessionsService.openChat(session, sideChat.resource);
  await sessionsManagementService.sendRequest(session, sideChat, { query });
}
async function createAndSendSideChat(sessionsManagementService, sessionsService, session, sourceChat, turnId, query, selection) {
  const sideChat = await sessionsManagementService.createSideChatInSession(session, sourceChat, turnId, selection);
  await openAndSendSideChat(sessionsManagementService, sessionsService, session, sideChat, query);
  return sideChat;
}
export {
  createAndSendSideChat,
  openAndSendSideChat
};
