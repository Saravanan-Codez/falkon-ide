import { AbstractOneDataSystemAppender } from "../common/1dsAppender.js";
class OneDataSystemWebAppender extends AbstractOneDataSystemAppender {
  constructor(isInternalTelemetry, eventPrefix, defaultData, iKeyOrClientFactory) {
    super(isInternalTelemetry, eventPrefix, defaultData, iKeyOrClientFactory);
    fetch(this.endPointHealthUrl, { method: "GET" }).catch((err) => {
      this._aiCoreOrKey = void 0;
    });
  }
}
export {
  OneDataSystemWebAppender
};
