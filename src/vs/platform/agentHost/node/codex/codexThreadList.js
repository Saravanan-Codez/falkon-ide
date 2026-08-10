const THREAD_LIST_PAGE_SIZE = 100;
const THREAD_LIST_MAX_PAGES = 50;
function buildThreadListPageRequest(cursor) {
  return {
    limit: THREAD_LIST_PAGE_SIZE,
    modelProviders: [],
    ...cursor !== void 0 ? { cursor } : {}
  };
}
async function collectThreadListPages(fetchPage, onTruncated) {
  const items = [];
  const seenCursors = /* @__PURE__ */ new Set();
  let cursor;
  for (let page = 0; page < THREAD_LIST_MAX_PAGES; page++) {
    const response = await fetchPage(buildThreadListPageRequest(cursor));
    items.push(...response.data);
    const nextCursor = response.nextCursor ?? void 0;
    if (nextCursor === void 0 || seenCursors.has(nextCursor)) {
      return items;
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
  onTruncated?.(items.length);
  return items;
}
export {
  THREAD_LIST_MAX_PAGES,
  THREAD_LIST_PAGE_SIZE,
  buildThreadListPageRequest,
  collectThreadListPages
};
