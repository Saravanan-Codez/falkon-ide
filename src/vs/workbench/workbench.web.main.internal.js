import "./workbench.web.main.js";
import { create, commands, env, window, workspace, logger } from "./browser/web.factory.js";
import { Menu } from "./browser/web.api.js";
import { URI } from "../base/common/uri.js";
import { Event, Emitter } from "../base/common/event.js";
import { Disposable } from "../base/common/lifecycle.js";
import { GroupOrientation } from "./services/editor/common/editorGroupsService.js";
import { RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode } from "../platform/remote/common/remoteAuthorityResolver.js";
import { LogLevel } from "../platform/log/common/log.js";
export {
  Disposable,
  Emitter,
  Event,
  GroupOrientation,
  LogLevel,
  Menu,
  RemoteAuthorityResolverError,
  RemoteAuthorityResolverErrorCode,
  URI,
  commands,
  create,
  env,
  logger,
  window,
  workspace
};
