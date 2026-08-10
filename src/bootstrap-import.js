import { fileURLToPath, pathToFileURL } from "node:url";
import { promises } from "node:fs";
import { join } from "node:path";
const _specifierToUrl = {};
const _specifierToFormat = {};
async function initialize(injectPath) {
  const injectPackageJSONPath = fileURLToPath(new URL("../package.json", pathToFileURL(injectPath)));
  const packageJSON = JSON.parse(String(await promises.readFile(injectPackageJSONPath)));
  for (const [name] of Object.entries(packageJSON.dependencies)) {
    try {
      const path = join(injectPackageJSONPath, `../node_modules/${name}/package.json`);
      const pkgJson = JSON.parse(String(await promises.readFile(path)));
      let main;
      if (pkgJson.exports?.["."]) {
        const dotExport = pkgJson.exports["."];
        if (typeof dotExport === "string") {
          main = dotExport;
        } else if (typeof dotExport === "object" && dotExport !== null) {
          const resolveCondition = (v) => {
            if (typeof v === "string") {
              return v;
            }
            if (typeof v === "object" && v !== null) {
              const d = v.default;
              if (typeof d === "string") {
                return d;
              }
            }
            return void 0;
          };
          main = resolveCondition(dotExport.import) ?? resolveCondition(dotExport.default);
        }
      }
      if (typeof main !== "string") {
        main = typeof pkgJson.main === "string" ? pkgJson.main : void 0;
      }
      if (!main) {
        main = "index.js";
      }
      if (!main.endsWith(".js") && !main.endsWith(".mjs") && !main.endsWith(".cjs")) {
        main += ".js";
      }
      const mainPath = join(injectPackageJSONPath, `../node_modules/${name}/${main}`);
      _specifierToUrl[name] = pathToFileURL(mainPath).href;
      const isModule = main.endsWith(".mjs") ? true : main.endsWith(".cjs") ? false : pkgJson.type === "module";
      _specifierToFormat[name] = isModule ? "module" : "commonjs";
    } catch (err) {
      console.error(name);
      console.error(err);
    }
  }
  console.log(`[bootstrap-import] Initialized node_modules redirector for: ${injectPath}`);
}
async function resolve(specifier, context, nextResolve) {
  const newSpecifier = _specifierToUrl[specifier];
  if (newSpecifier !== void 0) {
    return {
      format: _specifierToFormat[specifier] ?? "commonjs",
      shortCircuit: true,
      url: newSpecifier
    };
  }
  return nextResolve(specifier, context);
}
export {
  initialize,
  resolve
};
