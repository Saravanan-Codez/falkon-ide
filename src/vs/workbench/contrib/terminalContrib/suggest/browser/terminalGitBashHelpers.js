function gitBashToWindowsPath(path, driveLetter) {
  const systemDrive = (driveLetter || "C:").toUpperCase();
  if (path === "/") {
    return `${systemDrive}\\`;
  }
  const match = path.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (match) {
    const drive = match[1].toUpperCase();
    const rest = match[2] ? match[2].replace(/\//g, "\\") : "\\";
    return `${drive}:${rest}`;
  }
  return path.replace(/\//g, "\\");
}
function windowsToGitBashPath(path) {
  return path.replace(/^[a-zA-Z]:\\/, (match) => `/${match[0].toLowerCase()}/`).replace(/\\/g, "/");
}
export {
  gitBashToWindowsPath,
  windowsToGitBashPath
};
