async function areWorkspaceFoldersEmpty(workspace, fileService) {
  for (const folder of workspace.folders) {
    const folderStat = await fileService.resolve(folder.uri);
    if (folderStat.children && folderStat.children.length > 0) {
      return false;
    }
  }
  return true;
}
export {
  areWorkspaceFoldersEmpty
};
