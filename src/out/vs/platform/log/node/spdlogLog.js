import { ByteSize } from "../../files/common/files.js";
import { AbstractMessageLogger, LogLevel } from "../common/log.js";
var SpdLogLevel = /* @__PURE__ */ ((SpdLogLevel2) => {
  SpdLogLevel2[SpdLogLevel2["Trace"] = 0] = "Trace";
  SpdLogLevel2[SpdLogLevel2["Debug"] = 1] = "Debug";
  SpdLogLevel2[SpdLogLevel2["Info"] = 2] = "Info";
  SpdLogLevel2[SpdLogLevel2["Warning"] = 3] = "Warning";
  SpdLogLevel2[SpdLogLevel2["Error"] = 4] = "Error";
  SpdLogLevel2[SpdLogLevel2["Critical"] = 5] = "Critical";
  SpdLogLevel2[SpdLogLevel2["Off"] = 6] = "Off";
  return SpdLogLevel2;
})(SpdLogLevel || {});
async function createSpdLogLogger(name, logfilePath, filesize, filecount, donotUseFormatters) {
  try {
    const _spdlog = await import("@vscode/spdlog");
    _spdlog.setFlushOn(0 /* Trace */);
    const logger = await _spdlog.createAsyncRotatingLogger(name, logfilePath, filesize, filecount);
    if (donotUseFormatters) {
      logger.clearFormatters();
    } else {
      logger.setPattern("%Y-%m-%d %H:%M:%S.%e [%l] %v");
    }
    return logger;
  } catch (e) {
    console.error(e);
  }
  return null;
}
function log(logger, level, message) {
  switch (level) {
    case LogLevel.Trace:
      logger.trace(message);
      break;
    case LogLevel.Debug:
      logger.debug(message);
      break;
    case LogLevel.Info:
      logger.info(message);
      break;
    case LogLevel.Warning:
      logger.warn(message);
      break;
    case LogLevel.Error:
      logger.error(message);
      break;
    case LogLevel.Off:
      break;
    default:
      throw new Error(`Invalid log level ${level}`);
  }
}
function setLogLevel(logger, level) {
  switch (level) {
    case LogLevel.Trace:
      logger.setLevel(0 /* Trace */);
      break;
    case LogLevel.Debug:
      logger.setLevel(1 /* Debug */);
      break;
    case LogLevel.Info:
      logger.setLevel(2 /* Info */);
      break;
    case LogLevel.Warning:
      logger.setLevel(3 /* Warning */);
      break;
    case LogLevel.Error:
      logger.setLevel(4 /* Error */);
      break;
    case LogLevel.Off:
      logger.setLevel(6 /* Off */);
      break;
    default:
      throw new Error(`Invalid log level ${level}`);
  }
}
class SpdLogLogger extends AbstractMessageLogger {
  constructor(name, filepath, rotating, donotUseFormatters, level) {
    super();
    this.buffer = [];
    this.setLevel(level);
    this._loggerCreationPromise = this._createSpdLogLogger(name, filepath, rotating, donotUseFormatters);
    this._register(this.onDidChangeLogLevel((level2) => {
      if (this._logger) {
        setLogLevel(this._logger, level2);
      }
    }));
  }
  async _createSpdLogLogger(name, filepath, rotating, donotUseFormatters) {
    const filecount = rotating ? 6 : 1;
    const filesize = 30 / filecount * ByteSize.MB;
    const logger = await createSpdLogLogger(name, filepath, filesize, filecount, donotUseFormatters);
    if (logger) {
      this._logger = logger;
      setLogLevel(this._logger, this.getLevel());
      for (const { level, message } of this.buffer) {
        log(this._logger, level, message);
      }
      this.buffer = [];
    }
  }
  log(level, message) {
    if (this._logger) {
      log(this._logger, level, message);
    } else if (this.getLevel() <= level) {
      this.buffer.push({ level, message });
    }
  }
  flush() {
    if (this._logger) {
      this.flushLogger();
    } else {
      this._loggerCreationPromise.then(() => this.flushLogger());
    }
  }
  dispose() {
    if (this._logger) {
      this.disposeLogger();
    } else {
      this._loggerCreationPromise.then(() => this.disposeLogger());
    }
    super.dispose();
  }
  flushLogger() {
    if (this._logger) {
      this._logger.flush();
    }
  }
  disposeLogger() {
    if (this._logger) {
      this._logger.drop();
      this._logger = void 0;
    }
  }
}
export {
  SpdLogLogger
};
