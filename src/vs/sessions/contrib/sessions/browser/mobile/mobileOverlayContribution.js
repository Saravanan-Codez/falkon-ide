import { MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { Event } from "../../../../../base/common/event.js";
import { registerAction2, Action2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ILayoutService } from "../../../../../platform/layout/browser/layoutService.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { ITextFileService } from "../../../../../workbench/services/textfile/common/textfiles.js";
import { ISessionsService } from "../../../../../sessions/services/sessions/browser/sessionsService.js";
import { MOBILE_OPEN_DIFF_VIEW_COMMAND_ID, openMobileDiffView } from "../../../../../sessions/browser/parts/mobile/contributions/mobileDiffView.js";
import { MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID, toRow, rowToDiffData } from "../../../../../sessions/browser/parts/mobile/contributions/mobileChangesView.js";
import { MobileMultiDiffView } from "../../../../../sessions/browser/parts/mobile/contributions/mobileMultiDiffView.js";
import { IsPhoneLayoutContext } from "../../../../../sessions/common/contextkeys.js";
import { localize, localize2 } from "../../../../../nls.js";
const activeDiffView = new MutableDisposable();
const activeMultiDiffView = new MutableDisposable();
class MobileOpenDiffViewAction extends Action2 {
  constructor() {
    super({
      id: MOBILE_OPEN_DIFF_VIEW_COMMAND_ID,
      title: localize2("mobileOpenFileDiff", "Open File Diff"),
      precondition: IsPhoneLayoutContext,
      f1: false
    });
  }
  run(accessor, arg) {
    const layoutService = accessor.get(ILayoutService);
    const textFileService = accessor.get(ITextFileService);
    const languageService = accessor.get(ILanguageService);
    const data = isMobileDiffViewData(arg) ? arg : { diff: arg };
    activeDiffView.value = openMobileDiffView(layoutService.mainContainer, data, textFileService, languageService);
    const view = activeDiffView.value;
    Event.once(view.onDidDispose)(() => {
      if (activeDiffView.value === view) {
        activeDiffView.clear();
      }
    });
  }
}
class MobileOpenChangesViewAction extends Action2 {
  constructor() {
    super({
      id: MOBILE_OPEN_CHANGES_VIEW_COMMAND_ID,
      title: localize2("mobileOpenSessionChanges", "Open Session Changes"),
      precondition: IsPhoneLayoutContext,
      f1: false
    });
  }
  run(accessor) {
    const layoutService = accessor.get(ILayoutService);
    const textFileService = accessor.get(ITextFileService);
    const fileService = accessor.get(IFileService);
    const languageService = accessor.get(ILanguageService);
    const notificationService = accessor.get(INotificationService);
    const sessionsService = accessor.get(ISessionsService);
    const session = sessionsService.activeSession.get();
    const changes = session?.changes.get() ?? [];
    const rows = changes.map((c) => toRow(c));
    const diffs = rows.map((r) => rowToDiffData(r)).filter((d) => d.originalURI || d.modifiedURI);
    if (diffs.length === 0) {
      notificationService.info(localize("mobileChangesNotAvailable", "File-level changes are not available for this session yet."));
      return;
    }
    if (diffs.length === 1) {
      const commandService = accessor.get(ICommandService);
      commandService.executeCommand(MOBILE_OPEN_DIFF_VIEW_COMMAND_ID, { diff: diffs[0] });
      return;
    }
    const data = { diffs };
    activeMultiDiffView.value = new MobileMultiDiffView(
      layoutService.mainContainer,
      data,
      textFileService,
      fileService,
      languageService
    );
    const view = activeMultiDiffView.value;
    Event.once(view.onDidDispose)(() => {
      if (activeMultiDiffView.value === view) {
        activeMultiDiffView.clear();
      }
    });
  }
}
function isMobileDiffViewData(arg) {
  return arg && typeof arg === "object" && "diff" in arg;
}
registerAction2(MobileOpenDiffViewAction);
registerAction2(MobileOpenChangesViewAction);
