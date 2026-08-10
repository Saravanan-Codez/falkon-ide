import { OperatingSystem } from "../../../../base/common/platform.js";
import { CommandString } from "../../../../workbench/contrib/tasks/common/taskConfiguration.js";
function osToTaskTargetOS(os) {
  switch (os) {
    case OperatingSystem.Windows:
      return "windows";
    case OperatingSystem.Macintosh:
      return "osx";
    case OperatingSystem.Linux:
    default:
      return "linux";
  }
}
function expandVariables(value, ctx) {
  return ctx.resolveVariables ? ctx.resolveVariables(value) : value;
}
const POSIX_NEEDS_QUOTING = /[^A-Za-z0-9_\-.,:/=@%+]/;
function posixStrong(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function posixWeak(value) {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}
function posixEscape(value) {
  return value.replace(/([\\\s"'`$&|;<>(){}[\]*?#~!])/g, "\\$1");
}
async function renderArg(arg, ctx) {
  if (typeof arg === "string") {
    const value2 = await expandVariables(arg, ctx);
    return POSIX_NEEDS_QUOTING.test(value2) ? posixStrong(value2) : value2;
  }
  if (Array.isArray(arg)) {
    return (await Promise.all(arg.map((a) => renderArg(a, ctx)))).join(" ");
  }
  const value = await expandVariables(CommandString.value(arg), ctx);
  switch (arg.quoting) {
    case "strong":
      return posixStrong(value);
    case "weak":
      return posixWeak(value);
    case "escape":
      return posixEscape(value);
    default:
      return POSIX_NEEDS_QUOTING.test(value) ? posixStrong(value) : value;
  }
}
async function resolveOwnCommand(task, ctx) {
  const override = ctx.targetOS ? task[ctx.targetOS] : void 0;
  const command = override?.command ?? task.command;
  const args = override?.args ?? task.args;
  if (command) {
    const parts = [await expandVariables(command, ctx)];
    if (args) {
      for (const arg of args) {
        parts.push(await renderArg(arg, ctx));
      }
    }
    return parts.join(" ");
  }
  if (task.script && (!task.type || task.type === "npm")) {
    return `npm run ${task.script}`;
  }
  return void 0;
}
async function resolveDependencies(task, ctx, stack) {
  if (!task.dependsOn || !ctx.lookup) {
    return void 0;
  }
  const depLabels = typeof task.dependsOn === "string" ? [task.dependsOn] : task.dependsOn;
  const resolved = [];
  for (const label of depLabels) {
    const dep = ctx.lookup(label);
    if (!dep) {
      continue;
    }
    const cmd = await resolveInternal(dep, ctx, stack);
    if (cmd) {
      resolved.push(cmd);
    }
  }
  if (resolved.length === 0) {
    return void 0;
  }
  if (resolved.length === 1) {
    return resolved[0];
  }
  return task.dependsOrder === "parallel" ? `${resolved.map((c) => `( ${c} )`).join(" & ")} & wait` : resolved.join(" && ");
}
async function resolveInternal(task, ctx, stack) {
  if (stack.has(task.label)) {
    return void 0;
  }
  stack.add(task.label);
  try {
    const own = await resolveOwnCommand(task, ctx);
    const deps = await resolveDependencies(task, ctx, stack);
    if (own && deps) {
      return `${deps} && ${own}`;
    }
    return own ?? deps;
  } finally {
    stack.delete(task.label);
  }
}
function resolveTaskCommand(task, ctx) {
  return resolveInternal(task, ctx ?? {}, /* @__PURE__ */ new Set());
}
export {
  osToTaskTargetOS,
  resolveTaskCommand
};
