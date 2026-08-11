import { distinct } from "../../../../base/common/arrays.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isDefined } from "../../../../base/common/types.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { SymbolNavigationAction } from "../../../../editor/contrib/gotoSymbol/browser/goToCommands.js";
import { ReferencesModel } from "../../../../editor/contrib/gotoSymbol/browser/referencesModel.js";
import { MessageController } from "../../../../editor/contrib/message/browser/messageController.js";
import { PeekContext } from "../../../../editor/contrib/peekView/browser/peekView.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, ContextKeyGreaterExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { widgetClose } from "../../../../platform/theme/common/iconRegistry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ViewAction } from "../../../browser/parts/views/viewPane.js";
import { FocusedViewContext } from "../../../common/contextkeys.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { TestItemTreeElement } from "./explorerProjections/index.js";
import * as icons from "./icons.js";
import { TestCommandId, TestExplorerViewMode, TestExplorerViewSorting, Testing, testConfigurationGroupNames } from "../common/constants.js";
import { getTestingConfiguration, TestingConfigKeys, TestingResultsViewLayout } from "../common/configuration.js";
import { ITestCoverageService } from "../common/testCoverageService.js";
import { TestId } from "../common/testId.js";
import { ITestProfileService, canUseProfileWithTest } from "../common/testProfileService.js";
import { ITestResultService } from "../common/testResultService.js";
import { ITestService, expandAndGetTestById, testsInFile, testsUnderUri } from "../common/testService.js";
import { ExtTestRunProfileKind, TestItemExpandState, TestRunProfileBitset } from "../common/testTypes.js";
import { TestingContextKeys } from "../common/testingContextKeys.js";
import { ITestingContinuousRunService } from "../common/testingContinuousRunService.js";
import { ITestingPeekOpener } from "../common/testingPeekOpener.js";
import { isFailedState } from "../common/testingStates.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
const category = Categories.Test;
var ActionOrder = /* @__PURE__ */ ((ActionOrder2) => {
  ActionOrder2[ActionOrder2["Refresh"] = 10] = "Refresh";
  ActionOrder2[ActionOrder2["Run"] = 11] = "Run";
  ActionOrder2[ActionOrder2["Debug"] = 12] = "Debug";
  ActionOrder2[ActionOrder2["Coverage"] = 13] = "Coverage";
  ActionOrder2[ActionOrder2["RunContinuous"] = 14] = "RunContinuous";
  ActionOrder2[ActionOrder2["RunUsing"] = 15] = "RunUsing";
  ActionOrder2[ActionOrder2["Collapse"] = 16] = "Collapse";
  ActionOrder2[ActionOrder2["ClearResults"] = 17] = "ClearResults";
  ActionOrder2[ActionOrder2["DisplayMode"] = 18] = "DisplayMode";
  ActionOrder2[ActionOrder2["Sort"] = 19] = "Sort";
  ActionOrder2[ActionOrder2["GoToTest"] = 20] = "GoToTest";
  ActionOrder2[ActionOrder2["HideTest"] = 21] = "HideTest";
  ActionOrder2[ActionOrder2["ContinuousRunTest"] = 2147483647] = "ContinuousRunTest";
  return ActionOrder2;
})(ActionOrder || {});
const hasAnyTestProvider = ContextKeyGreaterExpr.create(TestingContextKeys.providerCount.key, 0);
const LABEL_RUN_TESTS = localize2("runSelectedTests", "Run Tests");
const LABEL_DEBUG_TESTS = localize2("debugSelectedTests", "Debug Tests");
const LABEL_COVERAGE_TESTS = localize2("coverageSelectedTests", "Run Tests with Coverage");
class HideTestAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.HideTestAction,
      title: localize2("hideTest", "Hide Test"),
      menu: {
        id: MenuId.TestItem,
        group: "builtin@2",
        when: TestingContextKeys.testItemIsHidden.isEqualTo(false)
      }
    });
  }
  run(accessor, ...elements) {
    const service = accessor.get(ITestService);
    for (const element of elements) {
      service.excluded.toggle(element.test, true);
    }
    return Promise.resolve();
  }
}
class UnhideTestAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.UnhideTestAction,
      title: localize2("unhideTest", "Unhide Test"),
      menu: {
        id: MenuId.TestItem,
        order: 21 /* HideTest */,
        when: TestingContextKeys.testItemIsHidden.isEqualTo(true)
      }
    });
  }
  run(accessor, ...elements) {
    const service = accessor.get(ITestService);
    for (const element of elements) {
      if (element instanceof TestItemTreeElement) {
        service.excluded.toggle(element.test, false);
      }
    }
    return Promise.resolve();
  }
}
class UnhideAllTestsAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.UnhideAllTestsAction,
      title: localize2("unhideAllTests", "Unhide All Tests")
    });
  }
  run(accessor) {
    const service = accessor.get(ITestService);
    service.excluded.clear();
    return Promise.resolve();
  }
}
const testItemInlineAndInContext = (order, when) => [
  {
    id: MenuId.TestItem,
    group: "inline",
    order,
    when
  },
  {
    id: MenuId.TestItem,
    group: "builtin@1",
    order,
    when
  }
];
class RunVisibleAction extends ViewAction {
  constructor(bitset, desc) {
    super({
      ...desc,
      viewId: Testing.ExplorerViewId
    });
    this.bitset = bitset;
  }
  /**
   * @override
   */
  runInView(accessor, view, ...elements) {
    const { include, exclude } = view.getTreeIncludeExclude(this.bitset, elements.map((e) => e.test));
    return accessor.get(ITestService).runTests({
      tests: include,
      exclude,
      group: this.bitset
    });
  }
}
class DebugAction extends RunVisibleAction {
  constructor() {
    super(TestRunProfileBitset.Debug, {
      id: TestCommandId.DebugAction,
      title: localize2("debug test", "Debug Test"),
      icon: icons.testingDebugIcon,
      menu: testItemInlineAndInContext(12 /* Debug */, TestingContextKeys.hasDebuggableTests.isEqualTo(true))
    });
  }
}
class CoverageAction extends RunVisibleAction {
  constructor() {
    super(TestRunProfileBitset.Coverage, {
      id: TestCommandId.RunWithCoverageAction,
      title: localize2("run with cover test", "Run Test with Coverage"),
      icon: icons.testingCoverageIcon,
      menu: testItemInlineAndInContext(13 /* Coverage */, TestingContextKeys.hasCoverableTests.isEqualTo(true))
    });
  }
}
class RunUsingProfileAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.RunUsingProfileAction,
      title: localize2("testing.runUsing", "Execute Using Profile..."),
      icon: icons.testingDebugIcon,
      menu: {
        id: MenuId.TestItem,
        order: 15 /* RunUsing */,
        group: "builtin@2",
        when: TestingContextKeys.hasNonDefaultProfile.isEqualTo(true)
      }
    });
  }
  async run(acessor, ...elements) {
    const commandService = acessor.get(ICommandService);
    const testService = acessor.get(ITestService);
    const profile = await commandService.executeCommand("vscode.pickTestProfile", {
      onlyForTest: elements[0].test
    });
    if (!profile) {
      return;
    }
    testService.runResolvedTests({
      group: profile.group,
      targets: [{
        profileId: profile.profileId,
        controllerId: profile.controllerId,
        testIds: elements.filter((t) => canUseProfileWithTest(profile, t.test)).map((t) => t.test.item.extId)
      }]
    });
  }
}
class RunAction extends RunVisibleAction {
  constructor() {
    super(TestRunProfileBitset.Run, {
      id: TestCommandId.RunAction,
      title: localize2("run test", "Run Test"),
      icon: icons.testingRunIcon,
      menu: testItemInlineAndInContext(11 /* Run */, TestingContextKeys.hasRunnableTests.isEqualTo(true))
    });
  }
}
class SelectDefaultTestProfiles extends Action2 {
  constructor() {
    super({
      id: TestCommandId.SelectDefaultTestProfiles,
      title: localize2("testing.selectDefaultTestProfiles", "Select Default Profile"),
      icon: icons.testingUpdateProfiles,
      category
    });
  }
  async run(acessor, onlyGroup) {
    const commands = acessor.get(ICommandService);
    const testProfileService = acessor.get(ITestProfileService);
    const profiles = await commands.executeCommand("vscode.pickMultipleTestProfiles", {
      showConfigureButtons: false,
      selected: testProfileService.getGroupDefaultProfiles(onlyGroup),
      onlyGroup
    });
    if (profiles?.length) {
      testProfileService.setGroupDefaultProfiles(onlyGroup, profiles);
    }
  }
}
class ContinuousRunTestAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ToggleContinousRunForTest,
      title: localize2("testing.toggleContinuousRunOn", "Turn on Continuous Run"),
      icon: icons.testingTurnContinuousRunOn,
      precondition: ContextKeyExpr.or(
        TestingContextKeys.isContinuousModeOn.isEqualTo(true),
        TestingContextKeys.isParentRunningContinuously.isEqualTo(false)
      ),
      toggled: {
        condition: TestingContextKeys.isContinuousModeOn.isEqualTo(true),
        icon: icons.testingContinuousIsOn,
        title: localize("testing.toggleContinuousRunOff", "Turn off Continuous Run")
      },
      menu: testItemInlineAndInContext(2147483647 /* ContinuousRunTest */, TestingContextKeys.supportsContinuousRun.isEqualTo(true))
    });
  }
  async run(accessor, ...elements) {
    const crService = accessor.get(ITestingContinuousRunService);
    for (const element of elements) {
      const id = element.test.item.extId;
      if (crService.isSpecificallyEnabledFor(id)) {
        crService.stop(id);
        continue;
      }
      crService.start(TestRunProfileBitset.Run, id);
    }
  }
}
class ContinuousRunUsingProfileTestAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ContinousRunUsingForTest,
      title: localize2("testing.startContinuousRunUsing", "Start Continous Run Using..."),
      icon: icons.testingDebugIcon,
      menu: [
        {
          id: MenuId.TestItem,
          order: 14 /* RunContinuous */,
          group: "builtin@2",
          when: ContextKeyExpr.and(
            TestingContextKeys.supportsContinuousRun.isEqualTo(true),
            TestingContextKeys.isContinuousModeOn.isEqualTo(false)
          )
        }
      ]
    });
  }
  async run(accessor, ...elements) {
    const crService = accessor.get(ITestingContinuousRunService);
    const profileService = accessor.get(ITestProfileService);
    const notificationService = accessor.get(INotificationService);
    const quickInputService = accessor.get(IQuickInputService);
    for (const element of elements) {
      const selected = await selectContinuousRunProfiles(
        crService,
        notificationService,
        quickInputService,
        [{ profiles: profileService.getControllerProfiles(element.test.controllerId) }]
      );
      if (selected.length) {
        crService.start(selected, element.test.item.extId);
      }
    }
  }
}
class ConfigureTestProfilesAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ConfigureTestProfilesAction,
      title: localize2("testing.configureProfile", "Configure Test Profiles"),
      icon: icons.testingUpdateProfiles,
      f1: true,
      category,
      menu: {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasConfigurableProfile.isEqualTo(true)
      }
    });
  }
  async run(acessor, onlyGroup) {
    const commands = acessor.get(ICommandService);
    const testProfileService = acessor.get(ITestProfileService);
    const profile = await commands.executeCommand("vscode.pickTestProfile", {
      placeholder: localize("configureProfile", "Select a profile to update"),
      showConfigureButtons: false,
      onlyConfigurable: true,
      onlyGroup
    });
    if (profile) {
      testProfileService.configure(profile.controllerId, profile.profileId);
    }
  }
}
const continuousMenus = (whenIsContinuousOn) => [
  {
    id: MenuId.ViewTitle,
    group: "navigation",
    order: 15 /* RunUsing */,
    when: ContextKeyExpr.and(
      ContextKeyExpr.equals("view", Testing.ExplorerViewId),
      TestingContextKeys.supportsContinuousRun.isEqualTo(true),
      TestingContextKeys.isContinuousModeOn.isEqualTo(whenIsContinuousOn)
    )
  },
  {
    id: MenuId.CommandPalette,
    when: TestingContextKeys.supportsContinuousRun.isEqualTo(true)
  }
];
class StopContinuousRunAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.StopContinousRun,
      title: localize2("testing.stopContinuous", "Stop Continuous Run"),
      category,
      icon: icons.testingTurnContinuousRunOff,
      menu: continuousMenus(true)
    });
  }
  run(accessor) {
    accessor.get(ITestingContinuousRunService).stop();
  }
}
function selectContinuousRunProfiles(crs, notificationService, quickInputService, profilesToPickFrom) {
  const items = [];
  for (const { controller, profiles } of profilesToPickFrom) {
    for (const profile of profiles) {
      if (profile.supportsContinuousRun) {
        items.push({
          label: profile.label || controller?.label.get() || "",
          description: controller?.label.get(),
          profile
        });
      }
    }
  }
  if (items.length === 0) {
    notificationService.info(localize("testing.noProfiles", "No test continuous run-enabled profiles were found"));
    return Promise.resolve([]);
  }
  if (items.length === 1) {
    return Promise.resolve([items[0].profile]);
  }
  const qpItems = [];
  const selectedItems = [];
  const lastRun = crs.lastRunProfileIds;
  items.sort((a, b) => a.profile.group - b.profile.group || a.profile.controllerId.localeCompare(b.profile.controllerId) || a.label.localeCompare(b.label));
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i === 0 || items[i - 1].profile.group !== item.profile.group) {
      qpItems.push({ type: "separator", label: testConfigurationGroupNames[item.profile.group] });
    }
    qpItems.push(item);
    if (lastRun.has(item.profile.profileId)) {
      selectedItems.push(item);
    }
  }
  const disposables = new DisposableStore();
  const quickpick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
  quickpick.title = localize("testing.selectContinuousProfiles", "Select profiles to run when files change:");
  quickpick.canSelectMany = true;
  quickpick.items = qpItems;
  quickpick.selectedItems = selectedItems;
  quickpick.show();
  return new Promise((resolve) => {
    disposables.add(quickpick.onDidAccept(() => {
      resolve(quickpick.selectedItems.map((i) => i.profile));
      disposables.dispose();
    }));
    disposables.add(quickpick.onDidHide(() => {
      resolve([]);
      disposables.dispose();
    }));
  });
}
class StartContinuousRunAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.StartContinousRun,
      title: localize2("testing.startContinuous", "Start Continuous Run"),
      category,
      icon: icons.testingTurnContinuousRunOn,
      menu: continuousMenus(false)
    });
  }
  async run(accessor) {
    const crs = accessor.get(ITestingContinuousRunService);
    const profileService = accessor.get(ITestProfileService);
    const lastRunProfiles = [...profileService.all()].flatMap((p) => p.profiles.filter((p2) => crs.lastRunProfileIds.has(p2.profileId)));
    if (lastRunProfiles.length) {
      return crs.start(lastRunProfiles);
    }
    const selected = await selectContinuousRunProfiles(crs, accessor.get(INotificationService), accessor.get(IQuickInputService), accessor.get(ITestProfileService).all());
    if (selected.length) {
      crs.start(selected);
    }
  }
}
class ExecuteSelectedAction extends ViewAction {
  constructor(options, group) {
    super({
      ...options,
      menu: [{
        id: MenuId.ViewTitle,
        order: group === TestRunProfileBitset.Run ? 11 /* Run */ : group === TestRunProfileBitset.Debug ? 12 /* Debug */ : 13 /* Coverage */,
        group: "navigation",
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("view", Testing.ExplorerViewId),
          TestingContextKeys.isRunning.isEqualTo(false),
          TestingContextKeys.capabilityToContextKey[group].isEqualTo(true)
        )
      }],
      category,
      viewId: Testing.ExplorerViewId
    });
    this.group = group;
  }
  /**
   * @override
   */
  runInView(accessor, view) {
    const { include, exclude } = view.getTreeIncludeExclude(this.group);
    return accessor.get(ITestService).runTests({ tests: include, exclude, group: this.group });
  }
}
class GetSelectedProfiles extends Action2 {
  constructor() {
    super({ id: TestCommandId.GetSelectedProfiles, title: localize2("getSelectedProfiles", "Get Selected Profiles") });
  }
  /**
   * @override
   */
  run(accessor) {
    const profiles = accessor.get(ITestProfileService);
    return [
      ...profiles.getGroupDefaultProfiles(TestRunProfileBitset.Run),
      ...profiles.getGroupDefaultProfiles(TestRunProfileBitset.Debug),
      ...profiles.getGroupDefaultProfiles(TestRunProfileBitset.Coverage)
    ].map((p) => ({
      controllerId: p.controllerId,
      label: p.label,
      kind: p.group & TestRunProfileBitset.Coverage ? ExtTestRunProfileKind.Coverage : p.group & TestRunProfileBitset.Debug ? ExtTestRunProfileKind.Debug : ExtTestRunProfileKind.Run
    }));
  }
}
class GetExplorerSelection extends ViewAction {
  constructor() {
    super({ id: TestCommandId.GetExplorerSelection, title: localize2("getExplorerSelection", "Get Explorer Selection"), viewId: Testing.ExplorerViewId });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    const { include, exclude } = view.getTreeIncludeExclude(TestRunProfileBitset.Run, void 0, "selected");
    const mapper = (i) => i.item.extId;
    return { include: include.map(mapper), exclude: exclude.map(mapper) };
  }
}
class RunSelectedAction extends ExecuteSelectedAction {
  constructor() {
    super({
      id: TestCommandId.RunSelectedAction,
      title: LABEL_RUN_TESTS,
      icon: icons.testingRunAllIcon
    }, TestRunProfileBitset.Run);
  }
}
class DebugSelectedAction extends ExecuteSelectedAction {
  constructor() {
    super({
      id: TestCommandId.DebugSelectedAction,
      title: LABEL_DEBUG_TESTS,
      icon: icons.testingDebugAllIcon
    }, TestRunProfileBitset.Debug);
  }
}
class CoverageSelectedAction extends ExecuteSelectedAction {
  constructor() {
    super({
      id: TestCommandId.CoverageSelectedAction,
      title: LABEL_COVERAGE_TESTS,
      icon: icons.testingCoverageAllIcon
    }, TestRunProfileBitset.Coverage);
  }
}
const showDiscoveringWhile = (progress, task) => {
  return progress.withProgress(
    {
      location: ProgressLocation.Window,
      title: localize("discoveringTests", "Discovering Tests")
    },
    () => task
  );
};
class RunOrDebugAllTestsAction extends Action2 {
  constructor(options, group, noTestsFoundError) {
    super({
      ...options,
      category,
      menu: [{
        id: MenuId.CommandPalette,
        when: TestingContextKeys.capabilityToContextKey[group].isEqualTo(true)
      }]
    });
    this.group = group;
    this.noTestsFoundError = noTestsFoundError;
  }
  async run(accessor) {
    const testService = accessor.get(ITestService);
    const notifications = accessor.get(INotificationService);
    const roots = [...testService.collection.rootItems].filter((r) => r.children.size || r.expand === TestItemExpandState.Expandable || r.expand === TestItemExpandState.BusyExpanding);
    if (!roots.length) {
      notifications.info(this.noTestsFoundError);
      return;
    }
    await testService.runTests({ tests: roots, group: this.group });
  }
}
class RunAllAction extends RunOrDebugAllTestsAction {
  constructor() {
    super(
      {
        id: TestCommandId.RunAllAction,
        title: localize2("runAllTests", "Run All Tests"),
        icon: icons.testingRunAllIcon,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyA)
        }
      },
      TestRunProfileBitset.Run,
      localize("noTestProvider", "No tests found in this workspace. You may need to install a test provider extension")
    );
  }
}
class DebugAllAction extends RunOrDebugAllTestsAction {
  constructor() {
    super(
      {
        id: TestCommandId.DebugAllAction,
        title: localize2("debugAllTests", "Debug All Tests"),
        icon: icons.testingDebugIcon,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyA)
        }
      },
      TestRunProfileBitset.Debug,
      localize("noDebugTestProvider", "No debuggable tests found in this workspace. You may need to install a test provider extension")
    );
  }
}
class CoverageAllAction extends RunOrDebugAllTestsAction {
  constructor() {
    super(
      {
        id: TestCommandId.RunAllWithCoverageAction,
        title: localize2("runAllWithCoverage", "Run All Tests with Coverage"),
        icon: icons.testingCoverageIcon,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA)
        }
      },
      TestRunProfileBitset.Coverage,
      localize("noCoverageTestProvider", "No tests with coverage runners found in this workspace. You may need to install a test provider extension")
    );
  }
}
class CancelTestRunAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CancelTestRunAction,
      title: localize2("testing.cancelRun", "Cancel Test Run"),
      icon: icons.testingCancelIcon,
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyX)
      },
      menu: [{
        id: MenuId.ViewTitle,
        order: 11 /* Run */,
        group: "navigation",
        when: ContextKeyExpr.and(
          ContextKeyExpr.equals("view", Testing.ExplorerViewId),
          ContextKeyExpr.equals(TestingContextKeys.isRunning.serialize(), true)
        )
      }, {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.isRunning
      }]
    });
  }
  /**
   * @override
   */
  async run(accessor, resultId, taskId) {
    const resultService = accessor.get(ITestResultService);
    const testService = accessor.get(ITestService);
    if (resultId) {
      testService.cancelTestRun(resultId, taskId);
    } else {
      for (const run of resultService.results) {
        if (!run.completedAt) {
          testService.cancelTestRun(run.id);
        }
      }
    }
  }
}
class TestingViewAsListAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingViewAsListAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.viewAsList", "View as List"),
      toggled: TestingContextKeys.viewMode.isEqualTo(TestExplorerViewMode.List),
      menu: {
        id: MenuId.ViewTitle,
        order: 18 /* DisplayMode */,
        group: "viewAs",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewMode = TestExplorerViewMode.List;
  }
}
class TestingViewAsTreeAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingViewAsTreeAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.viewAsTree", "View as Tree"),
      toggled: TestingContextKeys.viewMode.isEqualTo(TestExplorerViewMode.Tree),
      menu: {
        id: MenuId.ViewTitle,
        order: 18 /* DisplayMode */,
        group: "viewAs",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewMode = TestExplorerViewMode.Tree;
  }
}
class TestingSortByStatusAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingSortByStatusAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.sortByStatus", "Sort by Status"),
      toggled: TestingContextKeys.viewSorting.isEqualTo(TestExplorerViewSorting.ByStatus),
      menu: {
        id: MenuId.ViewTitle,
        order: 19 /* Sort */,
        group: "sortBy",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewSorting = TestExplorerViewSorting.ByStatus;
  }
}
class TestingSortByLocationAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingSortByLocationAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.sortByLocation", "Sort by Location"),
      toggled: TestingContextKeys.viewSorting.isEqualTo(TestExplorerViewSorting.ByLocation),
      menu: {
        id: MenuId.ViewTitle,
        order: 19 /* Sort */,
        group: "sortBy",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewSorting = TestExplorerViewSorting.ByLocation;
  }
}
class TestingSortByDurationAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.TestingSortByDurationAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.sortByDuration", "Sort by Duration"),
      toggled: TestingContextKeys.viewSorting.isEqualTo(TestExplorerViewSorting.ByDuration),
      menu: {
        id: MenuId.ViewTitle,
        order: 19 /* Sort */,
        group: "sortBy",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.viewSorting = TestExplorerViewSorting.ByDuration;
  }
}
class ShowMostRecentOutputAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ShowMostRecentOutputAction,
      title: localize2("testing.showMostRecentOutput", "Show Output"),
      category,
      icon: Codicon.terminal,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyO)
      },
      precondition: TestingContextKeys.hasAnyResults.isEqualTo(true),
      menu: [{
        id: MenuId.ViewTitle,
        order: 16 /* Collapse */,
        group: "navigation",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }, {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }]
    });
  }
  async run(accessor) {
    const viewService = accessor.get(IViewsService);
    const testView = await viewService.openView(Testing.ResultsViewId, true);
    testView?.showLatestRun();
  }
}
class CollapseAllAction extends ViewAction {
  constructor() {
    super({
      id: TestCommandId.CollapseAllAction,
      viewId: Testing.ExplorerViewId,
      title: localize2("testing.collapseAll", "Collapse All Tests"),
      icon: Codicon.collapseAll,
      menu: {
        id: MenuId.ViewTitle,
        order: 16 /* Collapse */,
        group: "displayAction",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }
    });
  }
  /**
   * @override
   */
  runInView(_accessor, view) {
    view.viewModel.collapseAll();
  }
}
class ClearTestResultsAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ClearTestResultsAction,
      title: localize2("testing.clearResults", "Clear All Results"),
      category,
      icon: Codicon.clearAll,
      menu: [{
        id: MenuId.TestPeekTitle
      }, {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }, {
        id: MenuId.ViewTitle,
        order: 17 /* ClearResults */,
        group: "displayAction",
        when: ContextKeyExpr.equals("view", Testing.ExplorerViewId)
      }, {
        id: MenuId.ViewTitle,
        order: 17 /* ClearResults */,
        group: "navigation",
        when: ContextKeyExpr.equals("view", Testing.ResultsViewId)
      }]
    });
  }
  /**
   * @override
   */
  run(accessor) {
    accessor.get(ITestResultService).clear();
  }
}
class GoToTest extends Action2 {
  constructor() {
    super({
      id: TestCommandId.GoToTest,
      title: localize2("testing.editFocusedTest", "Go to Test"),
      icon: Codicon.goToFile,
      menu: {
        id: MenuId.TestItem,
        group: "builtin@1",
        order: 20 /* GoToTest */,
        when: TestingContextKeys.testItemHasUri.isEqualTo(true)
      },
      keybinding: {
        weight: KeybindingWeight.EditorContrib - 10,
        when: FocusedViewContext.isEqualTo(Testing.ExplorerViewId),
        primary: KeyCode.Enter | KeyMod.Alt
      }
    });
  }
  async run(accessor, element, preserveFocus) {
    if (!element) {
      const view = accessor.get(IViewsService).getActiveViewWithId(Testing.ExplorerViewId);
      element = view?.focusedTreeElements[0];
    }
    if (element && element instanceof TestItemTreeElement) {
      accessor.get(ICommandService).executeCommand("vscode.revealTest", element.test.item.extId, preserveFocus);
    }
  }
}
async function getTestsAtCursor(testService, uriIdentityService, uri, position, filter) {
  let bestNodes = [];
  let bestRange;
  let bestNodesBefore = [];
  let bestRangeBefore;
  for await (const tests of testsInFile(testService, uriIdentityService, uri)) {
    for (const test of tests) {
      if (!test.item.range || filter?.(test) === false) {
        continue;
      }
      const irange = Range.lift(test.item.range);
      if (irange.containsPosition(position)) {
        if (bestRange && Range.equalsRange(test.item.range, bestRange)) {
          if (!bestNodes.some((b) => TestId.isChild(b.item.extId, test.item.extId))) {
            bestNodes.push(test);
          }
        } else {
          bestRange = irange;
          bestNodes = [test];
        }
      } else if (Position.isBefore(irange.getStartPosition(), position)) {
        if (!bestRangeBefore || bestRangeBefore.getStartPosition().isBefore(irange.getStartPosition())) {
          bestRangeBefore = irange;
          bestNodesBefore = [test];
        } else if (irange.equalsRange(bestRangeBefore) && !bestNodesBefore.some((b) => TestId.isChild(b.item.extId, test.item.extId))) {
          bestNodesBefore.push(test);
        }
      }
    }
  }
  return bestNodes.length ? bestNodes : bestNodesBefore;
}
var EditorContextOrder = /* @__PURE__ */ ((EditorContextOrder2) => {
  EditorContextOrder2[EditorContextOrder2["RunAtCursor"] = 0] = "RunAtCursor";
  EditorContextOrder2[EditorContextOrder2["DebugAtCursor"] = 1] = "DebugAtCursor";
  EditorContextOrder2[EditorContextOrder2["RunInFile"] = 2] = "RunInFile";
  EditorContextOrder2[EditorContextOrder2["DebugInFile"] = 3] = "DebugInFile";
  EditorContextOrder2[EditorContextOrder2["GoToRelated"] = 4] = "GoToRelated";
  EditorContextOrder2[EditorContextOrder2["PeekRelated"] = 5] = "PeekRelated";
  return EditorContextOrder2;
})(EditorContextOrder || {});
class ExecuteTestAtCursor extends Action2 {
  constructor(options, group) {
    super({
      ...options,
      menu: [{
        id: MenuId.CommandPalette,
        when: hasAnyTestProvider
      }, {
        id: MenuId.EditorContext,
        group: "testing",
        order: group === TestRunProfileBitset.Run ? 0 /* RunAtCursor */ : 1 /* DebugAtCursor */,
        when: ContextKeyExpr.and(TestingContextKeys.activeEditorHasTests, TestingContextKeys.capabilityToContextKey[group])
      }]
    });
    this.group = group;
  }
  /**
   * @override
   */
  async run(accessor) {
    const codeEditorService = accessor.get(ICodeEditorService);
    const editorService = accessor.get(IEditorService);
    const activeEditorPane = editorService.activeEditorPane;
    let editor = codeEditorService.getActiveCodeEditor();
    if (!activeEditorPane || !editor) {
      return;
    }
    if (editor instanceof EmbeddedCodeEditorWidget) {
      editor = editor.getParentEditor();
    }
    const position = editor?.getPosition();
    const model = editor?.getModel();
    if (!position || !model || !("uri" in model)) {
      return;
    }
    const testService = accessor.get(ITestService);
    const profileService = accessor.get(ITestProfileService);
    const uriIdentityService = accessor.get(IUriIdentityService);
    const progressService = accessor.get(IProgressService);
    const configurationService = accessor.get(IConfigurationService);
    const saveBeforeTest = getTestingConfiguration(configurationService, TestingConfigKeys.SaveBeforeTest);
    if (saveBeforeTest) {
      await editorService.save({ editor: activeEditorPane.input, groupId: activeEditorPane.group.id });
      await testService.syncTests();
    }
    const testsToRun = await showDiscoveringWhile(
      progressService,
      getTestsAtCursor(
        testService,
        uriIdentityService,
        model.uri,
        position,
        (test) => !!(profileService.capabilitiesForTest(test.item) & this.group)
      )
    );
    if (testsToRun.length) {
      await testService.runTests({ group: this.group, tests: testsToRun });
      return;
    }
    const relatedTests = await testService.getTestsRelatedToCode(model.uri, position);
    if (relatedTests.length) {
      await testService.runTests({ group: this.group, tests: relatedTests });
      return;
    }
    if (editor) {
      MessageController.get(editor)?.showMessage(localize("noTestsAtCursor", "No tests found here"), position);
    }
  }
}
class RunAtCursor extends ExecuteTestAtCursor {
  constructor() {
    super({
      id: TestCommandId.RunAtCursor,
      title: localize2("testing.runAtCursor", "Run Test at Cursor"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyC)
      }
    }, TestRunProfileBitset.Run);
  }
}
class DebugAtCursor extends ExecuteTestAtCursor {
  constructor() {
    super({
      id: TestCommandId.DebugAtCursor,
      title: localize2("testing.debugAtCursor", "Debug Test at Cursor"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyC)
      }
    }, TestRunProfileBitset.Debug);
  }
}
class CoverageAtCursor extends ExecuteTestAtCursor {
  constructor() {
    super({
      id: TestCommandId.CoverageAtCursor,
      title: localize2("testing.coverageAtCursor", "Run Test at Cursor with Coverage"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC)
      }
    }, TestRunProfileBitset.Coverage);
  }
}
class ExecuteTestsUnderUriAction extends Action2 {
  constructor(options, group) {
    super({
      ...options,
      menu: [{
        id: MenuId.ExplorerContext,
        when: TestingContextKeys.capabilityToContextKey[group].isEqualTo(true),
        group: "6.5_testing",
        order: (group === TestRunProfileBitset.Run ? 11 /* Run */ : 12 /* Debug */) + 0.1
      }]
    });
    this.group = group;
  }
  async run(accessor, uri) {
    const testService = accessor.get(ITestService);
    const notificationService = accessor.get(INotificationService);
    const tests = await Iterable.asyncToArray(testsUnderUri(
      testService,
      accessor.get(IUriIdentityService),
      uri
    ));
    if (!tests.length) {
      notificationService.notify({ message: localize("noTests", "No tests found in the selected file or folder"), severity: Severity.Info });
      return;
    }
    return testService.runTests({ tests, group: this.group });
  }
}
class RunTestsUnderUri extends ExecuteTestsUnderUriAction {
  constructor() {
    super({
      id: TestCommandId.RunByUri,
      title: LABEL_RUN_TESTS,
      category
    }, TestRunProfileBitset.Run);
  }
}
class DebugTestsUnderUri extends ExecuteTestsUnderUriAction {
  constructor() {
    super({
      id: TestCommandId.DebugByUri,
      title: LABEL_DEBUG_TESTS,
      category
    }, TestRunProfileBitset.Debug);
  }
}
class CoverageTestsUnderUri extends ExecuteTestsUnderUriAction {
  constructor() {
    super({
      id: TestCommandId.CoverageByUri,
      title: LABEL_COVERAGE_TESTS,
      category
    }, TestRunProfileBitset.Coverage);
  }
}
class ExecuteTestsInCurrentFile extends Action2 {
  constructor(options, group) {
    super({
      ...options,
      menu: [{
        id: MenuId.CommandPalette,
        when: TestingContextKeys.capabilityToContextKey[group].isEqualTo(true)
      }, {
        id: MenuId.EditorContext,
        group: "testing",
        order: group === TestRunProfileBitset.Run ? 2 /* RunInFile */ : 3 /* DebugInFile */,
        when: ContextKeyExpr.and(TestingContextKeys.activeEditorHasTests, TestingContextKeys.capabilityToContextKey[group])
      }]
    });
    this.group = group;
  }
  async _runByUris(accessor, files) {
    const uriIdentity = accessor.get(IUriIdentityService);
    const testService = accessor.get(ITestService);
    const discovered = [];
    for (const uri of files) {
      for await (const files2 of testsInFile(testService, uriIdentity, uri, void 0, true)) {
        for (const file of files2) {
          discovered.push(file);
        }
      }
    }
    if (discovered.length) {
      const r = await testService.runTests({ tests: discovered, group: this.group });
      return { completedAt: r.completedAt };
    }
    return { completedAt: void 0 };
  }
  /**
   * @override
   */
  run(accessor, files) {
    if (files?.length) {
      return this._runByUris(accessor, files);
    }
    const uriIdentity = accessor.get(IUriIdentityService);
    let editor = accessor.get(ICodeEditorService).getActiveCodeEditor();
    if (!editor) {
      return;
    }
    if (editor instanceof EmbeddedCodeEditorWidget) {
      editor = editor.getParentEditor();
    }
    const position = editor?.getPosition();
    const model = editor?.getModel();
    if (!position || !model || !("uri" in model)) {
      return;
    }
    const testService = accessor.get(ITestService);
    const queue = [testService.collection.rootIds];
    const discovered = [];
    while (queue.length) {
      for (const id of queue.pop()) {
        const node = testService.collection.getNodeById(id);
        if (uriIdentity.extUri.isEqual(node.item.uri, model.uri)) {
          discovered.push(node);
        } else {
          queue.push(node.children);
        }
      }
    }
    if (discovered.length) {
      return testService.runTests({
        tests: discovered,
        group: this.group
      });
    }
    if (editor) {
      MessageController.get(editor)?.showMessage(localize("noTestsInFile", "No tests found in this file"), position);
    }
    return void 0;
  }
}
class RunCurrentFile extends ExecuteTestsInCurrentFile {
  constructor() {
    super({
      id: TestCommandId.RunCurrentFile,
      title: localize2("testing.runCurrentFile", "Run Tests in Current File"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyF)
      }
    }, TestRunProfileBitset.Run);
  }
}
class DebugCurrentFile extends ExecuteTestsInCurrentFile {
  constructor() {
    super({
      id: TestCommandId.DebugCurrentFile,
      title: localize2("testing.debugCurrentFile", "Debug Tests in Current File"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyF)
      }
    }, TestRunProfileBitset.Debug);
  }
}
class CoverageCurrentFile extends ExecuteTestsInCurrentFile {
  constructor() {
    super({
      id: TestCommandId.CoverageCurrentFile,
      title: localize2("testing.coverageCurrentFile", "Run Tests with Coverage in Current File"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: EditorContextKeys.editorTextFocus,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF)
      }
    }, TestRunProfileBitset.Coverage);
  }
}
const discoverAndRunTests = async (collection, progress, ids, runTests) => {
  const todo = Promise.all(ids.map((p) => expandAndGetTestById(collection, p)));
  const tests = (await showDiscoveringWhile(progress, todo)).filter(isDefined);
  return tests.length ? await runTests(tests) : void 0;
};
class RunOrDebugExtsByPath extends Action2 {
  /**
   * @override
   */
  async run(accessor, ...args) {
    const testService = accessor.get(ITestService);
    await discoverAndRunTests(
      accessor.get(ITestService).collection,
      accessor.get(IProgressService),
      [...this.getTestExtIdsToRun(accessor, ...args)],
      (tests) => this.runTest(testService, tests)
    );
  }
}
class RunOrDebugFailedTests extends RunOrDebugExtsByPath {
  constructor(options) {
    super({
      ...options,
      menu: {
        id: MenuId.CommandPalette,
        when: hasAnyTestProvider
      }
    });
  }
  /**
   * @inheritdoc
   */
  getTestExtIdsToRun(accessor) {
    const { results } = accessor.get(ITestResultService);
    const ids = /* @__PURE__ */ new Set();
    for (let i = results.length - 1; i >= 0; i--) {
      const resultSet = results[i];
      for (const test of resultSet.tests) {
        if (isFailedState(test.ownComputedState)) {
          ids.add(test.item.extId);
        } else {
          ids.delete(test.item.extId);
        }
      }
    }
    return ids;
  }
}
class RunOrDebugLastRun extends Action2 {
  constructor(options) {
    super({
      ...options,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(
          hasAnyTestProvider,
          TestingContextKeys.hasAnyResults.isEqualTo(true)
        )
      }
    });
  }
  getLastTestRunRequest(accessor, runId) {
    const resultService = accessor.get(ITestResultService);
    const lastResult = runId ? resultService.results.find((r) => r.id === runId) : resultService.results[0];
    return lastResult?.request;
  }
  /** @inheritdoc */
  async run(accessor, runId) {
    const resultService = accessor.get(ITestResultService);
    const lastResult = runId ? resultService.results.find((r) => r.id === runId) : resultService.results[0];
    if (!lastResult) {
      return;
    }
    const req = lastResult.request;
    const testService = accessor.get(ITestService);
    const profileService = accessor.get(ITestProfileService);
    const profileExists = (t) => profileService.getControllerProfiles(t.controllerId).some((p) => p.profileId === t.profileId);
    await discoverAndRunTests(
      testService.collection,
      accessor.get(IProgressService),
      req.targets.flatMap((t) => t.testIds),
      (tests) => {
        if (this.getGroup() & req.group && req.targets.every(profileExists)) {
          return testService.runResolvedTests({
            targets: req.targets,
            group: req.group,
            exclude: req.exclude
          });
        } else {
          return testService.runTests({ tests, group: this.getGroup() });
        }
      }
    );
  }
}
class ReRunFailedTests extends RunOrDebugFailedTests {
  constructor() {
    super({
      id: TestCommandId.ReRunFailedTests,
      title: localize2("testing.reRunFailTests", "Rerun Failed Tests"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyE)
      }
    });
  }
  runTest(service, internalTests) {
    return service.runTests({
      group: TestRunProfileBitset.Run,
      tests: internalTests
    });
  }
}
class DebugFailedTests extends RunOrDebugFailedTests {
  constructor() {
    super({
      id: TestCommandId.DebugFailedTests,
      title: localize2("testing.debugFailTests", "Debug Failed Tests"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyE)
      }
    });
  }
  runTest(service, internalTests) {
    return service.runTests({
      group: TestRunProfileBitset.Debug,
      tests: internalTests
    });
  }
}
class ReRunLastRun extends RunOrDebugLastRun {
  constructor() {
    super({
      id: TestCommandId.ReRunLastRun,
      title: localize2("testing.reRunLastRun", "Rerun Last Run"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyCode.KeyL)
      }
    });
  }
  getGroup() {
    return TestRunProfileBitset.Run;
  }
}
class DebugLastRun extends RunOrDebugLastRun {
  constructor() {
    super({
      id: TestCommandId.DebugLastRun,
      title: localize2("testing.debugLastRun", "Debug Last Run"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyL)
      }
    });
  }
  getGroup() {
    return TestRunProfileBitset.Debug;
  }
}
class CoverageLastRun extends RunOrDebugLastRun {
  constructor() {
    super({
      id: TestCommandId.CoverageLastRun,
      title: localize2("testing.coverageLastRun", "Rerun Last Run with Coverage"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL)
      }
    });
  }
  getGroup() {
    return TestRunProfileBitset.Coverage;
  }
}
class RunOrDebugFailedFromLastRun extends Action2 {
  constructor(options) {
    super({
      ...options,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(
          hasAnyTestProvider,
          TestingContextKeys.hasAnyResults.isEqualTo(true)
        )
      }
    });
  }
  /** @inheritdoc */
  async run(accessor, runId) {
    const resultService = accessor.get(ITestResultService);
    const testService = accessor.get(ITestService);
    const progressService = accessor.get(IProgressService);
    const lastResult = runId ? resultService.results.find((r) => r.id === runId) : resultService.results[0];
    if (!lastResult) {
      return;
    }
    const failedTestIds = /* @__PURE__ */ new Set();
    for (const test of lastResult.tests) {
      if (isFailedState(test.ownComputedState)) {
        failedTestIds.add(test.item.extId);
      }
    }
    if (failedTestIds.size === 0) {
      return;
    }
    await discoverAndRunTests(
      testService.collection,
      progressService,
      Array.from(failedTestIds),
      (tests) => testService.runTests({ tests, group: this.getGroup() })
    );
  }
}
class ReRunFailedFromLastRun extends RunOrDebugFailedFromLastRun {
  constructor() {
    super({
      id: TestCommandId.ReRunFailedFromLastRun,
      title: localize2("testing.reRunFailedFromLastRun", "Rerun Failed Tests from Last Run"),
      category
    });
  }
  getGroup() {
    return TestRunProfileBitset.Run;
  }
}
class DebugFailedFromLastRun extends RunOrDebugFailedFromLastRun {
  constructor() {
    super({
      id: TestCommandId.DebugFailedFromLastRun,
      title: localize2("testing.debugFailedFromLastRun", "Debug Failed Tests from Last Run"),
      category
    });
  }
  getGroup() {
    return TestRunProfileBitset.Debug;
  }
}
class SearchForTestExtension extends Action2 {
  constructor() {
    super({
      id: TestCommandId.SearchForTestExtension,
      title: localize2("testing.searchForTestExtension", "Search for Test Extension")
    });
  }
  async run(accessor) {
    accessor.get(IExtensionsWorkbenchService).openSearch('@category:"testing"');
  }
}
class OpenOutputPeek extends Action2 {
  constructor() {
    super({
      id: TestCommandId.OpenOutputPeek,
      title: localize2("testing.openOutputPeek", "Peek Output"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyM)
      },
      menu: {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }
    });
  }
  async run(accessor) {
    accessor.get(ITestingPeekOpener).open();
  }
}
class ToggleInlineTestOutput extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ToggleInlineTestOutput,
      title: localize2("testing.toggleInlineTestOutput", "Toggle Inline Test Output"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyI)
      },
      menu: {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }
    });
  }
  async run(accessor) {
    const testService = accessor.get(ITestService);
    testService.showInlineOutput.value = !testService.showInlineOutput.value;
  }
}
const refreshMenus = (whenIsRefreshing) => [
  {
    id: MenuId.TestItem,
    group: "inline",
    order: 10 /* Refresh */,
    when: ContextKeyExpr.and(
      TestingContextKeys.canRefreshTests.isEqualTo(true),
      TestingContextKeys.isRefreshingTests.isEqualTo(whenIsRefreshing)
    )
  },
  {
    id: MenuId.ViewTitle,
    group: "navigation",
    order: 10 /* Refresh */,
    when: ContextKeyExpr.and(
      ContextKeyExpr.equals("view", Testing.ExplorerViewId),
      TestingContextKeys.canRefreshTests.isEqualTo(true),
      TestingContextKeys.isRefreshingTests.isEqualTo(whenIsRefreshing)
    )
  },
  {
    id: MenuId.CommandPalette,
    when: TestingContextKeys.canRefreshTests.isEqualTo(true)
  }
];
class RefreshTestsAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.RefreshTestsAction,
      title: localize2("testing.refreshTests", "Refresh Tests"),
      category,
      icon: icons.testingRefreshTests,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.Semicolon, KeyMod.CtrlCmd | KeyCode.KeyR),
        when: TestingContextKeys.canRefreshTests.isEqualTo(true)
      },
      menu: refreshMenus(false)
    });
  }
  async run(accessor, ...elements) {
    const testService = accessor.get(ITestService);
    const progressService = accessor.get(IProgressService);
    const controllerIds = distinct(elements.filter(isDefined).map((e) => e.test.controllerId));
    return progressService.withProgress({ location: Testing.ViewletId }, async () => {
      if (controllerIds.length) {
        await Promise.all(controllerIds.map((id) => testService.refreshTests(id)));
      } else {
        await testService.refreshTests();
      }
    });
  }
}
class CancelTestRefreshAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CancelTestRefreshAction,
      title: localize2("testing.cancelTestRefresh", "Cancel Test Refresh"),
      category,
      icon: icons.testingCancelRefreshTests,
      menu: refreshMenus(true)
    });
  }
  async run(accessor) {
    accessor.get(ITestService).cancelRefreshTests();
  }
}
class CleareCoverage extends Action2 {
  constructor() {
    super({
      id: TestCommandId.CoverageClear,
      title: localize2("testing.clearCoverage", "Clear Coverage"),
      icon: widgetClose,
      category,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 10 /* Refresh */,
        when: ContextKeyExpr.equals("view", Testing.CoverageViewId)
      }, {
        id: MenuId.CommandPalette,
        when: TestingContextKeys.isTestCoverageOpen.isEqualTo(true)
      }]
    });
  }
  run(accessor) {
    accessor.get(ITestCoverageService).closeCoverage();
  }
}
class OpenCoverage extends Action2 {
  constructor() {
    super({
      id: TestCommandId.OpenCoverage,
      title: localize2("testing.openCoverage", "Open Coverage"),
      category,
      menu: [{
        id: MenuId.CommandPalette,
        when: TestingContextKeys.hasAnyResults.isEqualTo(true)
      }]
    });
  }
  run(accessor) {
    const results = accessor.get(ITestResultService).results;
    const task = results.length && results[0].tasks.find((r) => r.coverage);
    if (!task) {
      const notificationService = accessor.get(INotificationService);
      notificationService.info(localize("testing.noCoverage", "No coverage information available on the last test run."));
      return;
    }
    accessor.get(ITestCoverageService).openCoverage(task, true);
  }
}
class TestNavigationAction extends SymbolNavigationAction {
  runEditorCommand(accessor, editor, ...args) {
    this.testService = accessor.get(ITestService);
    this.uriIdentityService = accessor.get(IUriIdentityService);
    return super.runEditorCommand(accessor, editor, ...args);
  }
  _getAlternativeCommand(editor) {
    return editor.getOption(EditorOption.gotoLocation).alternativeTestsCommand;
  }
  _getGoToPreference(editor) {
    return editor.getOption(EditorOption.gotoLocation).multipleTests || "peek";
  }
}
class GoToRelatedTestAction extends TestNavigationAction {
  async _getLocationModel(_languageFeaturesService, model, position, token) {
    const tests = await this.testService.getTestsRelatedToCode(model.uri, position, token);
    return new ReferencesModel(
      tests.map((t) => t.item.uri && { uri: t.item.uri, range: t.item.range || new Range(1, 1, 1, 1) }).filter(isDefined),
      localize("relatedTests", "Related Tests")
    );
  }
  _getNoResultFoundMessage() {
    return localize("noTestFound", "No related tests found.");
  }
}
class GoToRelatedTest extends GoToRelatedTestAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: TestCommandId.GoToRelatedTest,
      title: localize2("testing.goToRelatedTest", "Go to Related Test"),
      category,
      precondition: ContextKeyExpr.and(
        // todo@connor4312: make this more explicit based on cursor position
        ContextKeyExpr.not(TestingContextKeys.activeEditorHasTests.key),
        TestingContextKeys.canGoToRelatedTest
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "testing",
        order: 4 /* GoToRelated */
      }]
    });
  }
}
class PeekRelatedTest extends GoToRelatedTestAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: TestCommandId.PeekRelatedTest,
      title: localize2("testing.peekToRelatedTest", "Peek Related Test"),
      category,
      precondition: ContextKeyExpr.and(
        TestingContextKeys.canGoToRelatedTest,
        // todo@connor4312: make this more explicit based on cursor position
        ContextKeyExpr.not(TestingContextKeys.activeEditorHasTests.key),
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "testing",
        order: 5 /* PeekRelated */
      }]
    });
  }
}
class GoToRelatedCodeAction extends TestNavigationAction {
  async _getLocationModel(_languageFeaturesService, model, position, token) {
    const testsAtCursor = await getTestsAtCursor(this.testService, this.uriIdentityService, model.uri, position);
    const code = await Promise.all(testsAtCursor.map((t) => this.testService.getCodeRelatedToTest(t)));
    return new ReferencesModel(code.flat(), localize("relatedCode", "Related Code"));
  }
  _getNoResultFoundMessage() {
    return localize("noRelatedCode", "No related code found.");
  }
}
class GoToRelatedCode extends GoToRelatedCodeAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: false,
      muteMessage: false
    }, {
      id: TestCommandId.GoToRelatedCode,
      title: localize2("testing.goToRelatedCode", "Go to Related Code"),
      category,
      precondition: ContextKeyExpr.and(
        TestingContextKeys.activeEditorHasTests,
        TestingContextKeys.canGoToRelatedCode
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "testing",
        order: 4 /* GoToRelated */
      }]
    });
  }
}
class PeekRelatedCode extends GoToRelatedCodeAction {
  constructor() {
    super({
      openToSide: false,
      openInPeek: true,
      muteMessage: false
    }, {
      id: TestCommandId.PeekRelatedCode,
      title: localize2("testing.peekToRelatedCode", "Peek Related Code"),
      category,
      precondition: ContextKeyExpr.and(
        TestingContextKeys.activeEditorHasTests,
        TestingContextKeys.canGoToRelatedCode,
        PeekContext.notInPeekEditor,
        EditorContextKeys.isInEmbeddedEditor.toNegated()
      ),
      menu: [{
        id: MenuId.EditorContext,
        group: "testing",
        order: 5 /* PeekRelated */
      }]
    });
  }
}
class ToggleResultsViewLayoutAction extends Action2 {
  constructor() {
    super({
      id: TestCommandId.ToggleResultsViewLayoutAction,
      title: localize2("testing.toggleResultsViewLayout", "Toggle Tree Position"),
      category,
      icon: Codicon.arrowSwap,
      menu: {
        id: MenuId.ViewTitle,
        order: 18 /* DisplayMode */,
        group: "navigation",
        when: ContextKeyExpr.equals("view", Testing.ResultsViewId)
      }
    });
  }
  async run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    const currentLayout = getTestingConfiguration(configurationService, TestingConfigKeys.ResultsViewLayout);
    const newLayout = currentLayout === TestingResultsViewLayout.TreeLeft ? TestingResultsViewLayout.TreeRight : TestingResultsViewLayout.TreeLeft;
    await configurationService.updateValue(TestingConfigKeys.ResultsViewLayout, newLayout);
  }
}
const allTestActions = [
  CancelTestRefreshAction,
  CancelTestRunAction,
  CleareCoverage,
  ClearTestResultsAction,
  CollapseAllAction,
  ConfigureTestProfilesAction,
  ContinuousRunTestAction,
  ContinuousRunUsingProfileTestAction,
  CoverageAction,
  CoverageAllAction,
  CoverageAtCursor,
  CoverageCurrentFile,
  CoverageLastRun,
  CoverageSelectedAction,
  CoverageTestsUnderUri,
  DebugAction,
  DebugAllAction,
  DebugAtCursor,
  DebugCurrentFile,
  DebugFailedTests,
  DebugLastRun,
  DebugSelectedAction,
  DebugTestsUnderUri,
  GetExplorerSelection,
  GetSelectedProfiles,
  GoToRelatedCode,
  GoToRelatedTest,
  GoToTest,
  HideTestAction,
  OpenCoverage,
  OpenOutputPeek,
  PeekRelatedCode,
  PeekRelatedTest,
  RefreshTestsAction,
  ReRunFailedTests,
  ReRunLastRun,
  RunAction,
  RunAllAction,
  RunAtCursor,
  RunCurrentFile,
  RunSelectedAction,
  RunTestsUnderUri,
  RunUsingProfileAction,
  SearchForTestExtension,
  SelectDefaultTestProfiles,
  ShowMostRecentOutputAction,
  StartContinuousRunAction,
  StopContinuousRunAction,
  TestingSortByDurationAction,
  TestingSortByLocationAction,
  TestingSortByStatusAction,
  TestingViewAsListAction,
  TestingViewAsTreeAction,
  ToggleInlineTestOutput,
  ToggleResultsViewLayoutAction,
  UnhideAllTestsAction,
  UnhideTestAction,
  ReRunFailedFromLastRun,
  DebugFailedFromLastRun
];
export {
  CancelTestRefreshAction,
  CancelTestRunAction,
  ClearTestResultsAction,
  CleareCoverage,
  CollapseAllAction,
  ConfigureTestProfilesAction,
  ContinuousRunTestAction,
  ContinuousRunUsingProfileTestAction,
  CoverageAction,
  CoverageAllAction,
  CoverageAtCursor,
  CoverageCurrentFile,
  CoverageLastRun,
  CoverageSelectedAction,
  DebugAction,
  DebugAllAction,
  DebugAtCursor,
  DebugCurrentFile,
  DebugFailedFromLastRun,
  DebugFailedTests,
  DebugLastRun,
  DebugSelectedAction,
  GetExplorerSelection,
  GetSelectedProfiles,
  GoToTest,
  HideTestAction,
  OpenCoverage,
  OpenOutputPeek,
  ReRunFailedFromLastRun,
  ReRunFailedTests,
  ReRunLastRun,
  RefreshTestsAction,
  RunAction,
  RunAllAction,
  RunAtCursor,
  RunCurrentFile,
  RunSelectedAction,
  RunUsingProfileAction,
  SearchForTestExtension,
  SelectDefaultTestProfiles,
  ShowMostRecentOutputAction,
  TestingSortByDurationAction,
  TestingSortByLocationAction,
  TestingSortByStatusAction,
  TestingViewAsListAction,
  TestingViewAsTreeAction,
  ToggleInlineTestOutput,
  ToggleResultsViewLayoutAction,
  UnhideAllTestsAction,
  UnhideTestAction,
  allTestActions,
  discoverAndRunTests
};
