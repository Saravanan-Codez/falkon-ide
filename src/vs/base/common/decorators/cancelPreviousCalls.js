import { assertDefined } from "../types.js";
import { DisposableMap } from "../lifecycle.js";
import { CancellationTokenSource, CancellationToken } from "../cancellation.js";
function cancelPreviousCalls(_proto, methodName, descriptor) {
  const originalMethod = descriptor.value;
  assertDefined(
    originalMethod,
    `Method '${methodName}' is not defined.`
  );
  const objectRecords = /* @__PURE__ */ new WeakMap();
  descriptor.value = function(...args) {
    let record = objectRecords.get(this);
    if (!record) {
      record = new DisposableMap();
      objectRecords.set(this, record);
      this._register({
        dispose: () => {
          objectRecords.get(this)?.dispose();
          objectRecords.delete(this);
        }
      });
    }
    record.get(methodName)?.dispose(true);
    const lastArgument = args.length > 0 ? args[args.length - 1] : void 0;
    const token = CancellationToken.isCancellationToken(lastArgument) ? lastArgument : void 0;
    const cancellationSource = new CancellationTokenSource(token);
    record.set(methodName, cancellationSource);
    if (CancellationToken.isCancellationToken(lastArgument)) {
      args[args.length - 1] = cancellationSource.token;
    } else {
      args.push(cancellationSource.token);
    }
    return originalMethod.call(this, ...args);
  };
  return descriptor;
}
export {
  cancelPreviousCalls
};
