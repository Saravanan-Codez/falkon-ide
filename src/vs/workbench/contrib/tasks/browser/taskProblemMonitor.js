import { Disposable, DisposableMap, DisposableStore } from "../../../../base/common/lifecycle.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
class TaskProblemMonitor extends Disposable {
  constructor() {
    super();
    this.terminalMarkerMap = /* @__PURE__ */ new Map();
    this.terminalDisposables = new DisposableMap();
  }
  addTerminal(terminal, problemMatcher) {
    this.terminalMarkerMap.set(terminal.instanceId, {
      resources: /* @__PURE__ */ new Map(),
      markers: /* @__PURE__ */ new Map()
    });
    const store = new DisposableStore();
    this.terminalDisposables.set(terminal.instanceId, store);
    store.add(terminal.onDisposed(() => {
      this.terminalMarkerMap.delete(terminal.instanceId);
      this.terminalDisposables.deleteAndDispose(terminal.instanceId);
    }));
    store.add(problemMatcher.onDidFindErrors((markers) => {
      const markerData = this.terminalMarkerMap.get(terminal.instanceId);
      if (markerData) {
        markerData.markers.clear();
        markerData.resources.clear();
        for (const marker of markers) {
          if (marker.severity === MarkerSeverity.Error) {
            markerData.resources.set(marker.resource.toString(), marker.resource);
            const markersForOwner = markerData.markers.get(marker.owner);
            let markerMap = markersForOwner;
            if (!markerMap) {
              markerMap = /* @__PURE__ */ new Map();
              markerData.markers.set(marker.owner, markerMap);
            }
            markerMap.set(marker.resource.toString(), marker);
            this.terminalMarkerMap.set(terminal.instanceId, markerData);
          }
        }
      }
    }));
    store.add(problemMatcher.onDidRequestInvalidateLastMarker(() => {
      const markerData = this.terminalMarkerMap.get(terminal.instanceId);
      markerData?.markers.clear();
      markerData?.resources.clear();
      this.terminalMarkerMap.set(terminal.instanceId, {
        resources: /* @__PURE__ */ new Map(),
        markers: /* @__PURE__ */ new Map()
      });
    }));
  }
  /**
   * Gets the task problems for a specific terminal instance
   * @param instanceId The terminal instance ID
   * @returns Map of problem matchers to their resources and marker data, or undefined if no problems found
   */
  getTaskProblems(instanceId) {
    const markerData = this.terminalMarkerMap.get(instanceId);
    if (!markerData) {
      return void 0;
    } else if (markerData.markers.size === 0) {
      return /* @__PURE__ */ new Map();
    }
    const result = /* @__PURE__ */ new Map();
    for (const [owner, markersMap] of markerData.markers) {
      const resources = [];
      const markers = [];
      for (const [resource, marker] of markersMap) {
        resources.push(markerData.resources.get(resource));
        markers.push(marker);
      }
      result.set(owner, { resources, markers });
    }
    return result;
  }
}
export {
  TaskProblemMonitor
};
