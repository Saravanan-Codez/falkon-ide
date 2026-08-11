import { DeferredPromise } from "../../../../../../base/common/async.js";
import { MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
function setupRecreatingStartMarker(xterm, startMarker, fire, store, log) {
  const markerListener = new MutableDisposable();
  const recreateStartMarker = () => {
    if (store.isDisposed) {
      return;
    }
    const marker = xterm.raw.registerMarker();
    startMarker.value = marker ?? void 0;
    fire(marker);
    if (!marker) {
      markerListener.clear();
      return;
    }
    markerListener.value = marker.onDispose(() => {
      log?.("Start marker was disposed, recreating");
      recreateStartMarker();
    });
  };
  recreateStartMarker();
  store.add(toDisposable(() => {
    markerListener.dispose();
    startMarker.clear();
    fire(void 0);
  }));
  store.add(startMarker);
  return toDisposable(() => markerListener.dispose());
}
function createAltBufferPromise(xterm, store, log) {
  const deferred = new DeferredPromise();
  const complete = () => {
    if (!deferred.isSettled) {
      log?.("Detected alternate buffer entry");
      deferred.complete();
    }
  };
  if (xterm.raw.buffer.active === xterm.raw.buffer.alternate) {
    complete();
  } else {
    store.add(xterm.raw.buffer.onBufferChange(() => {
      if (xterm.raw.buffer.active === xterm.raw.buffer.alternate) {
        complete();
      }
    }));
  }
  return deferred.p;
}
function stripCommandEchoAndPrompt(output, commandLine, log) {
  log?.(`stripCommandEchoAndPrompt input: output length=${output.length}, commandLine length=${commandLine.length}`);
  const result = _stripCommandEchoAndPromptOnce(output, commandLine, log);
  if (result.trim().length > 0 && findCommandEcho(result, commandLine)) {
    return _stripCommandEchoAndPromptOnce(result, commandLine, log);
  }
  return result;
}
function _stripCommandEchoAndPromptOnce(output, commandLine, log) {
  const echoResult = findCommandEcho(
    output,
    commandLine,
    /*allowSuffixMatch*/
    true
  );
  const lines = echoResult ? echoResult.linesAfter : output.split("\n");
  const startIndex = 0;
  const promptBefore = echoResult?.contentBefore ?? "";
  const isUnixAt = /\w+@[\w.-]+:/.test(promptBefore);
  const isUnixHost = !isUnixAt && /[\w.-]+:\S/.test(promptBefore);
  const isUnix = isUnixAt || isUnixHost;
  const isPowerShell = /^PS\s/i.test(promptBefore);
  const isCmd = !isPowerShell && /^[A-Z]:\\/.test(promptBefore);
  const isStarship = /\u276f/.test(promptBefore);
  const isPython = />>>/.test(promptBefore);
  const knownPrompt = isUnix || isPowerShell || isCmd || isStarship || isPython;
  let endIndex = lines.length;
  let trailingStrippedCount = 0;
  const maxTrailingPromptLines = 2;
  while (endIndex > startIndex) {
    const line = lines[endIndex - 1].trimEnd();
    if (line.length === 0) {
      endIndex--;
      continue;
    }
    if (trailingStrippedCount >= maxTrailingPromptLines) {
      break;
    }
    const isCompletePrompt = (
      // Bash/zsh: user@host:path ending with $ or #
      // e.g., "user@host:~/src $ " or "root@server:/var/log# "
      (!knownPrompt || isUnixAt) && /^\s*\w+@[\w.-]+:.*[#$]\s*$/.test(line) || // hostname:path user$ or hostname:path user#
      // e.g., "dsm12-be220-abc:testWorkspace runner$"
      (!knownPrompt || isUnixHost) && /^\s*[\w.-]+:\S.*\s\w+[#$]\s*$/.test(line) || // PowerShell: PS C:\path>
      (!knownPrompt || isPowerShell) && /^PS\s+[A-Z]:\\.*>\s*$/.test(line) || // Windows cmd: C:\path>
      (!knownPrompt || isCmd) && /^[A-Z]:\\.*>\s*$/.test(line) || // Starship prompt character
      // allow-any-unicode-next-line
      (!knownPrompt || isStarship) && /\u276f\s*$/.test(line) || // Python REPL
      (!knownPrompt || isPython) && /^>>>\s*$/.test(line)
    );
    const isPromptFragment = (
      // Wrapped fragment ending with $ or # (e.g. "er$", "ts/testWorkspace$")
      (!knownPrompt || isUnix) && /^\s*[\w/.-]+[#$]\s*$/.test(line) || // Bracketed prompt start: [ hostname:/path or [ user@host:/path
      // e.g., "[ alex@MacBook-Pro:/Users/alex/src/vscode4/extensions/vscode-api-test"
      // e.g., "[W007DV9PF9-1:~/vss/_work/1/s/extensions/vscode-api-tests/testWorkspace] cloudte"
      (!knownPrompt || isUnix) && /^\[\s*[\w.-]+(@[\w.-]+)?:[~\/]/.test(line) || // Wrapped continuation: user@host:path or hostname:path (no trailing $)
      // Only matched after we've already stripped a prompt fragment below.
      // e.g., "cloudtest@host:/mnt/vss/.../vscode-api-tes" or "dsm12-abc:testWorkspace runn"
      (!knownPrompt || isUnix) && trailingStrippedCount > 0 && /^\s*[\w][-\w.]*(@[\w.-]+)?:\S/.test(line) || // Bracketed prompt end: ...] $ or ...] #
      // e.g., "s/testWorkspace (main**) ] $ "
      (!knownPrompt || isUnix) && /\]\s*[#$]\s*$/.test(line)
    );
    if (isCompletePrompt) {
      endIndex--;
      trailingStrippedCount++;
      break;
    } else if (isPromptFragment) {
      endIndex--;
      trailingStrippedCount++;
    } else {
      break;
    }
  }
  const result = lines.slice(startIndex, endIndex).join("\n");
  log?.(`stripCommandEchoAndPrompt result: length=${result.length} (startIndex=${startIndex}, endIndex=${endIndex}, totalLines=${lines.length})`);
  return result;
}
function findCommandEcho(output, commandLine, allowSuffixMatch) {
  const trimmedCommand = commandLine.trim();
  if (trimmedCommand.length === 0) {
    return void 0;
  }
  const { strippedOutput, indexMapping } = stripNewLinesAndBuildMapping(output);
  const matchIndex = strippedOutput.indexOf(trimmedCommand);
  let matchEndInStripped;
  let contentBefore;
  if (matchIndex !== -1) {
    contentBefore = strippedOutput.substring(0, matchIndex).trim();
    matchEndInStripped = matchIndex + trimmedCommand.length - 1;
  } else if (allowSuffixMatch) {
    let suffixLen = 0;
    for (let len = trimmedCommand.length - 1; len >= 1; len--) {
      const suffix = trimmedCommand.substring(trimmedCommand.length - len);
      if (strippedOutput.startsWith(suffix)) {
        const charBefore = trimmedCommand[trimmedCommand.length - len - 1];
        if (charBefore !== void 0 && charBefore !== " " && charBefore !== "	") {
          suffixLen = len;
        }
        break;
      }
    }
    if (suffixLen === 0) {
      return void 0;
    }
    contentBefore = "";
    matchEndInStripped = suffixLen - 1;
  } else {
    return void 0;
  }
  const originalEnd = indexMapping[matchEndInStripped];
  const lines = output.split("\n");
  let echoEndLine = 0;
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = offset + lines[i].length;
    if (offset <= originalEnd && originalEnd <= lineEnd) {
      echoEndLine = i + 1;
      break;
    }
    offset = lineEnd + 1;
  }
  return {
    contentBefore,
    linesAfter: lines.slice(echoEndLine)
  };
}
function stripNewLinesAndBuildMapping(output) {
  const indexMapping = [];
  const strippedChars = [];
  for (let i = 0; i < output.length; i++) {
    if (output[i] !== "\n") {
      strippedChars.push(output[i]);
      indexMapping.push(i);
    }
  }
  return { strippedOutput: strippedChars.join(""), indexMapping };
}
export {
  createAltBufferPromise,
  findCommandEcho,
  setupRecreatingStartMarker,
  stripCommandEchoAndPrompt,
  stripNewLinesAndBuildMapping
};
