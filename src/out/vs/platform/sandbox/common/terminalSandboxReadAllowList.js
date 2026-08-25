import { OperatingSystem } from "../../../base/common/platform.js";
import { matchesTerminalSandboxCommandRule } from "./terminalSandboxCommandRules.js";
var TerminalSandboxReadAllowListOperation = /* @__PURE__ */ ((TerminalSandboxReadAllowListOperation2) => {
  TerminalSandboxReadAllowListOperation2["Git"] = "git";
  TerminalSandboxReadAllowListOperation2["Node"] = "node";
  TerminalSandboxReadAllowListOperation2["Rust"] = "rust";
  TerminalSandboxReadAllowListOperation2["Go"] = "go";
  TerminalSandboxReadAllowListOperation2["Python"] = "python";
  TerminalSandboxReadAllowListOperation2["Java"] = "java";
  TerminalSandboxReadAllowListOperation2["Dotnet"] = "dotnet";
  TerminalSandboxReadAllowListOperation2["Nuget"] = "nuget";
  TerminalSandboxReadAllowListOperation2["Msbuild"] = "msbuild";
  TerminalSandboxReadAllowListOperation2["Ruby"] = "ruby";
  TerminalSandboxReadAllowListOperation2["NativeBuild"] = "nativeBuild";
  TerminalSandboxReadAllowListOperation2["Conan"] = "conan";
  TerminalSandboxReadAllowListOperation2["GnuPG"] = "gnupg";
  TerminalSandboxReadAllowListOperation2["Ssh"] = "ssh";
  return TerminalSandboxReadAllowListOperation2;
})(TerminalSandboxReadAllowListOperation || {});
const terminalSandboxReadAllowListKeywordMap = /* @__PURE__ */ new Map([
  ["git", "git" /* Git */],
  ["gh", "git" /* Git */],
  ["gpg", "gnupg" /* GnuPG */],
  ["node", "node" /* Node */],
  ["npm", "node" /* Node */],
  ["npx", "node" /* Node */],
  ["pnpm", "node" /* Node */],
  ["yarn", "node" /* Node */],
  ["corepack", "node" /* Node */],
  ["bun", "node" /* Node */],
  ["deno", "node" /* Node */],
  ["nvm", "node" /* Node */],
  ["volta", "node" /* Node */],
  ["fnm", "node" /* Node */],
  ["asdf", "node" /* Node */],
  ["mise", "node" /* Node */],
  ["cargo", "rust" /* Rust */],
  ["rustc", "rust" /* Rust */],
  ["rustup", "rust" /* Rust */],
  ["go", "go" /* Go */],
  ["gofmt", "go" /* Go */],
  ["python", "python" /* Python */],
  ["python3", "python" /* Python */],
  ["pip", "python" /* Python */],
  ["pip3", "python" /* Python */],
  ["poetry", "python" /* Python */],
  ["uv", "python" /* Python */],
  ["pipx", "python" /* Python */],
  ["pyenv", "python" /* Python */],
  ["java", "java" /* Java */],
  ["javac", "java" /* Java */],
  ["jar", "java" /* Java */],
  ["mvn", "java" /* Java */],
  ["mvnw", "java" /* Java */],
  ["gradle", "java" /* Java */],
  ["gradlew", "java" /* Java */],
  ["sdk", "java" /* Java */],
  ["dotnet", "dotnet" /* Dotnet */],
  ["nuget", "nuget" /* Nuget */],
  ["msbuild", "msbuild" /* Msbuild */],
  ["ruby", "ruby" /* Ruby */],
  ["gem", "ruby" /* Ruby */],
  ["bundle", "ruby" /* Ruby */],
  ["bundler", "ruby" /* Ruby */],
  ["rake", "ruby" /* Ruby */],
  ["rbenv", "ruby" /* Ruby */],
  ["rvm", "ruby" /* Ruby */],
  ["ccache", "nativeBuild" /* NativeBuild */],
  ["sccache", "nativeBuild" /* NativeBuild */],
  ["cmake", "nativeBuild" /* NativeBuild */],
  ["conan", "conan" /* Conan */]
]);
function getTerminalSandboxReadAllowListForOperation(operation, os) {
  if (os === OperatingSystem.Windows) {
    return [];
  }
  switch (operation) {
    case "git" /* Git */:
      switch (os) {
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return [
            "~/.gitconfig",
            "~/.config/gh/config.yml",
            "~/.config/git/config",
            "~/.gitignore",
            "~/.gitignore_global",
            "~/.config/git/ignore",
            "~/.config/git/attributes"
          ];
      }
    case "node" /* Node */:
      switch (os) {
        case OperatingSystem.Macintosh:
          return [
            "~/.npm",
            "~/Library/Caches/node",
            "~/Library/Caches/electron",
            "~/Library/Caches/ms-playwright",
            "~/Library/Caches/Yarn",
            "~/Library/Caches/deno",
            "~/Library/pnpm",
            "~/.electron-gyp",
            "~/.node-gyp",
            "~/.yarn/berry",
            "~/.local/share/pnpm",
            "~/.pnpm-store",
            "~/.bun/install/cache",
            "~/.bun/bin",
            "~/.deno",
            "~/.nvm/versions",
            "~/.nvm/alias",
            "~/.volta/bin",
            "~/.volta/tools",
            "~/.fnm",
            "~/.asdf/installs/nodejs",
            "~/.asdf/shims",
            "~/.local/share/mise/installs/node",
            "~/.local/share/mise/shims"
          ];
        case OperatingSystem.Linux:
        default:
          return [
            "~/.npm",
            "~/.cache/node",
            "~/.cache/node/corepack",
            "~/.cache/electron",
            "~/.cache/ms-playwright",
            "~/.cache/yarn",
            "~/.electron-gyp",
            "~/.node-gyp",
            "~/.yarn/berry",
            "~/.local/share/pnpm",
            "~/.pnpm-store",
            "~/.bun/install/cache",
            "~/.bun/bin",
            "~/.deno",
            "~/.cache/deno",
            "~/.nvm/versions",
            "~/.nvm/alias",
            "~/.volta/bin",
            "~/.volta/tools",
            "~/.fnm",
            "~/.asdf/installs/nodejs",
            "~/.asdf/shims",
            "~/.local/share/mise/installs/node",
            "~/.local/share/mise/shims"
          ];
      }
    case "rust" /* Rust */:
      switch (os) {
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return [
            "~/.cargo/bin",
            "~/.cargo/registry",
            "~/.cargo/git",
            "~/.rustup/toolchains"
          ];
      }
    case "go" /* Go */:
      switch (os) {
        case OperatingSystem.Macintosh:
          return [
            "~/go/pkg/mod",
            "~/go/bin",
            "~/Library/Caches/go-build"
          ];
        case OperatingSystem.Linux:
        default:
          return [
            "~/go/pkg/mod",
            "~/go/bin",
            "~/.cache/go-build"
          ];
      }
    case "python" /* Python */:
      switch (os) {
        case OperatingSystem.Macintosh:
          return [
            "~/Library/Caches/pip",
            "~/Library/Caches/pypoetry",
            "~/Library/Caches/uv",
            "~/.local/bin",
            "~/.local/share/virtualenv",
            "~/.local/share/pipx",
            "~/.pyenv/versions",
            "~/.pyenv/shims"
          ];
        case OperatingSystem.Linux:
        default:
          return [
            "~/.cache/pip",
            "~/.cache/pypoetry",
            "~/.cache/uv",
            "~/.local/bin",
            "~/.local/share/virtualenv",
            "~/.local/share/pipx",
            "~/.pyenv/versions",
            "~/.pyenv/shims"
          ];
      }
    case "java" /* Java */:
      switch (os) {
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return [
            "~/.m2/repository",
            "~/.gradle/caches",
            "~/.gradle/wrapper/dists",
            "~/.sdkman/candidates"
          ];
      }
    case "dotnet" /* Dotnet */:
      switch (os) {
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return [
            "~/.dotnet"
          ];
      }
    case "nuget" /* Nuget */:
      switch (os) {
        case OperatingSystem.Macintosh:
          return [
            "~/.nuget/packages",
            "~/Library/Caches/NuGet/v3-cache"
          ];
        case OperatingSystem.Linux:
        default:
          return [
            "~/.nuget/packages",
            "~/.local/share/NuGet/v3-cache"
          ];
      }
    case "msbuild" /* Msbuild */:
      switch (os) {
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return [];
      }
    case "ruby" /* Ruby */:
      switch (os) {
        case OperatingSystem.Macintosh:
          return [
            "~/.gem",
            "~/.rbenv/versions",
            "~/.rbenv/shims",
            "~/.rvm/rubies"
          ];
        case OperatingSystem.Linux:
        default:
          return [
            "~/.gem",
            "~/.rbenv/versions",
            "~/.rbenv/shims",
            "~/.rvm/rubies"
          ];
      }
    case "nativeBuild" /* NativeBuild */:
      switch (os) {
        case OperatingSystem.Macintosh:
          return [
            "~/Library/Caches/ccache",
            "~/Library/Caches/sccache"
          ];
        case OperatingSystem.Linux:
        default:
          return [
            "~/.cache/ccache",
            "~/.cache/sccache"
          ];
      }
    case "conan" /* Conan */:
      switch (os) {
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return [
            "~/.conan2/p",
            "~/.conan2/b"
          ];
      }
    case "gnupg" /* GnuPG */:
      switch (os) {
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return [
            "~/.gnupg"
          ];
      }
    case "ssh" /* Ssh */:
      switch (os) {
        case OperatingSystem.Macintosh:
        case OperatingSystem.Linux:
        default:
          return [
            "~/.ssh"
          ];
      }
  }
}
function getTerminalSandboxReadAllowListForCommandDetails(os, commandDetails) {
  const operations = /* @__PURE__ */ new Set();
  for (const command of commandDetails) {
    for (const rule of terminalSandboxReadAllowListCommandDetailRules) {
      if (matchesTerminalSandboxCommandRule(command, rule, { os })) {
        operations.add(rule.value);
      }
    }
  }
  const paths = [...operations].flatMap((operation) => getTerminalSandboxReadAllowListForOperation(operation, os));
  return [...new Set(paths)];
}
const terminalSandboxReadAllowListCommandDetailRules = [
  {
    keywords: ["gpg", "gpg2"],
    value: "gnupg" /* GnuPG */
  },
  {
    keywords: ["git"],
    value: "gnupg" /* GnuPG */
  },
  {
    keywords: ["git", "ssh", "scp", "sftp", "rsync"],
    value: "ssh" /* Ssh */
  }
];
function getTerminalSandboxReadAllowListForCommands(os, commandKeywords, commandDetails = []) {
  if (commandKeywords.length === 0) {
    return getTerminalSandboxReadAllowListForCommandDetails(os, commandDetails);
  }
  const operations = /* @__PURE__ */ new Set();
  for (const keyword of commandKeywords) {
    const operation = terminalSandboxReadAllowListKeywordMap.get(keyword.toLowerCase());
    if (operation) {
      operations.add(operation);
    }
  }
  const paths = [...operations].flatMap((operation) => getTerminalSandboxReadAllowListForOperation(operation, os));
  return [.../* @__PURE__ */ new Set([...paths, ...getTerminalSandboxReadAllowListForCommandDetails(os, commandDetails)])];
}
export {
  TerminalSandboxReadAllowListOperation,
  getTerminalSandboxReadAllowListForCommands
};
