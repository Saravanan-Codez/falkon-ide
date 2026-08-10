var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { n } from "../../../../../base/browser/dom.js";
import { ActionBar } from "../../../../../base/browser/ui/actionbar/actionbar.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { createHotClass } from "../../../../../base/common/hotReloadHelpers.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { autorun, derived, observableValue } from "../../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { nativeHoverDelegate } from "../../../../../platform/hover/browser/hover.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { IStatusbarService, StatusbarAlignment } from "../../../../services/statusbar/browser/statusbar.js";
import { AI_STATS_SETTING_ID } from "../settingIds.js";
import { createAiStatsChart } from "./aiStatsChart.js";
import "./media.css";
let AiStatsStatusBar = class extends Disposable {
  constructor(_aiStatsFeature, _statusbarService, _commandService, _telemetryService) {
    super();
    this._aiStatsFeature = _aiStatsFeature;
    this._statusbarService = _statusbarService;
    this._commandService = _commandService;
    this._telemetryService = _telemetryService;
    this._register(autorun((reader) => {
      const statusBarItem = this._createStatusBar().keepUpdated(reader.store);
      const store = this._register(new DisposableStore());
      reader.store.add(this._statusbarService.addEntry({
        name: localize("inlineSuggestions", "Inline Suggestions"),
        ariaLabel: localize("inlineSuggestionsStatusBar", "Inline suggestions status bar"),
        text: "",
        tooltip: {
          element: async (_token) => {
            this._sendHoverTelemetry();
            store.clear();
            const elem = createAiStatsHover({
              data: this._aiStatsFeature,
              onOpenSettings: () => openSettingsCommand({ ids: [AI_STATS_SETTING_ID] }).run(this._commandService)
            });
            return elem.keepUpdated(store).element;
          },
          markdownNotSupportedFallback: void 0
        },
        content: statusBarItem.element
      }, "aiStatsStatusBar", StatusbarAlignment.RIGHT, 100));
    }));
  }
  static {
    this.hot = createHotClass(this);
  }
  _sendHoverTelemetry() {
    this._telemetryService.publicLog2(
      "aiStatsStatusBar.hover",
      {
        aiRate: this._aiStatsFeature.aiRate.get()
      }
    );
  }
  _createStatusBar() {
    return n.div({
      style: {
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: "3px",
        marginRight: "3px"
      }
    }, [
      n.div(
        {
          class: "ai-stats-status-bar",
          style: {
            display: "flex",
            flexDirection: "column",
            width: 50,
            height: 6,
            borderRadius: 6,
            borderWidth: "1px",
            borderStyle: "solid"
          }
        },
        [
          n.div({
            style: {
              flex: 1,
              display: "flex",
              overflow: "hidden",
              borderRadius: 6,
              border: "1px solid transparent"
            }
          }, [
            n.div({
              style: {
                width: this._aiStatsFeature.aiRate.map((v) => `${v * 100}%`),
                backgroundColor: "currentColor"
              }
            })
          ])
        ]
      )
    ]);
  }
};
AiStatsStatusBar = __decorateClass([
  __decorateParam(1, IStatusbarService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, ITelemetryService)
], AiStatsStatusBar);
function createAiStatsHover(options) {
  const chartViewMode = observableValue("chartViewMode", "days");
  const aiRatePercent = options.data.aiRate.map((r) => `${Math.round(r * 100)}%`);
  const createToggleButton = (mode, tooltip, icon) => {
    return derived((reader) => {
      const currentMode = chartViewMode.read(reader);
      const isActive = currentMode === mode;
      return n.div({
        class: ["chart-toggle-button", isActive ? "active" : ""],
        style: {
          padding: "2px 4px",
          borderRadius: "3px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        },
        onclick: () => {
          chartViewMode.set(mode, void 0);
        },
        title: tooltip
      }, [
        n.div({
          class: ThemeIcon.asClassName(icon),
          style: { fontSize: "14px" }
        })
      ]);
    });
  };
  return n.div({
    class: "ai-stats-status-bar"
  }, [
    n.div(
      {
        class: "header",
        style: {
          minWidth: "280px"
        }
      },
      [
        n.div({ style: { flex: 1 } }, [localize("aiStatsStatusBarHeader", "AI Usage Statistics")]),
        n.div({ style: { marginLeft: "auto" } }, options.onOpenSettings ? actionBar([
          {
            action: {
              id: "aiStats.statusBar.settings",
              label: "",
              enabled: true,
              run: options.onOpenSettings,
              class: ThemeIcon.asClassName(Codicon.gear),
              tooltip: localize("aiStats.statusBar.configure", "Configure")
            },
            options: { icon: true, label: false, hoverDelegate: nativeHoverDelegate }
          }
        ]) : [])
      ]
    ),
    n.div({ style: { display: "flex" } }, [
      n.div({ style: { flex: 1, paddingRight: "4px" } }, [
        localize("text1", "AI vs Typing Average: {0}", aiRatePercent.get())
      ])
    ]),
    n.div({ style: { flex: 1, paddingRight: "4px" } }, [
      localize("text2", "Accepted inline suggestions today: {0}", options.data.acceptedInlineSuggestionsToday.get())
    ]),
    // Chart section
    n.div({
      style: {
        marginTop: "8px",
        borderTop: "1px solid var(--vscode-widget-border)",
        paddingTop: "8px"
      }
    }, [
      // Chart header with toggle
      n.div({
        class: "header",
        style: {
          display: "flex",
          alignItems: "center",
          marginBottom: "4px"
        }
      }, [
        n.div({ style: { flex: 1 } }, [
          chartViewMode.map(
            (mode) => mode === "days" ? localize("chartHeaderDays", "AI Rate by Day") : localize("chartHeaderSessions", "AI Rate by Session")
          )
        ]),
        n.div({
          class: "chart-view-toggle",
          style: { marginLeft: "auto", display: "flex", gap: "2px" }
        }, [
          createToggleButton("days", localize("viewByDays", "Days"), Codicon.calendar),
          createToggleButton("sessions", localize("viewBySessions", "Sessions"), Codicon.listFlat)
        ])
      ]),
      // Chart container
      derived((reader) => {
        const sessions = options.data.sessions.read(reader);
        const viewMode = chartViewMode.read(reader);
        return n.div({
          ref: (container) => {
            const chart = createAiStatsChart({
              sessions,
              viewMode
            });
            container.appendChild(chart);
          }
        });
      })
    ])
  ]);
}
function actionBar(actions, options) {
  return derived((_reader) => n.div({
    class: [],
    style: {},
    ref: (elem) => {
      const actionBar2 = _reader.store.add(new ActionBar(elem, options));
      for (const { action, options: options2 } of actions) {
        actionBar2.push(action, options2);
      }
    }
  }));
}
class CommandWithArgs {
  constructor(commandId, args = []) {
    this.commandId = commandId;
    this.args = args;
  }
  run(commandService) {
    commandService.executeCommand(this.commandId, ...this.args);
  }
}
function openSettingsCommand(options = {}) {
  return new CommandWithArgs("workbench.action.openSettings", [{
    query: options.ids ? options.ids.map((id) => `@id:${id}`).join(" ") : void 0
  }]);
}
export {
  AiStatsStatusBar,
  createAiStatsHover
};
