import { timeout } from "../../../../base/common/async.js";
async function writeP(terminal, data) {
  return new Promise((resolve, reject) => {
    const failTimeout = timeout(2e3);
    failTimeout.then(() => reject("Writing to xterm is taking longer than 2 seconds"));
    terminal.write(data, () => {
      failTimeout.cancel();
      resolve();
    });
  });
}
export {
  writeP
};
