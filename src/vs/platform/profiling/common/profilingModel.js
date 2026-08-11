const computeAggregateTime = (index, nodes) => {
  const row = nodes[index];
  if (row.aggregateTime) {
    return row.aggregateTime;
  }
  let total = row.selfTime;
  for (const child of row.children) {
    total += computeAggregateTime(child, nodes);
  }
  return row.aggregateTime = total;
};
const ensureSourceLocations = (profile) => {
  let locationIdCounter = 0;
  const locationsByRef = /* @__PURE__ */ new Map();
  const getLocationIdFor = (callFrame) => {
    const ref = [
      callFrame.functionName,
      callFrame.url,
      callFrame.scriptId,
      callFrame.lineNumber,
      callFrame.columnNumber
    ].join(":");
    const existing = locationsByRef.get(ref);
    if (existing) {
      return existing.id;
    }
    const id = locationIdCounter++;
    locationsByRef.set(ref, {
      id,
      callFrame,
      location: {
        lineNumber: callFrame.lineNumber + 1,
        columnNumber: callFrame.columnNumber + 1
        // source: {
        // 	name: maybeFileUrlToPath(callFrame.url),
        // 	path: maybeFileUrlToPath(callFrame.url),
        // 	sourceReference: 0,
        // },
      }
    });
    return id;
  };
  for (const node of profile.nodes) {
    node.locationId = getLocationIdFor(node.callFrame);
    node.positionTicks = node.positionTicks?.map((tick) => ({
      ...tick,
      // weirdly, line numbers here are 1-based, not 0-based. The position tick
      // only gives line-level granularity, so 'mark' the entire range of source
      // code the tick refers to
      startLocationId: getLocationIdFor({
        ...node.callFrame,
        lineNumber: tick.line - 1,
        columnNumber: 0
      }),
      endLocationId: getLocationIdFor({
        ...node.callFrame,
        lineNumber: tick.line,
        columnNumber: 0
      })
    }));
  }
  return [...locationsByRef.values()].sort((a, b) => a.id - b.id).map((l) => ({ locations: [l.location], callFrame: l.callFrame }));
};
const buildModel = (profile) => {
  if (!profile.timeDeltas || !profile.samples) {
    return {
      nodes: [],
      locations: [],
      samples: profile.samples || [],
      timeDeltas: profile.timeDeltas || [],
      // rootPath: profile.$vscode?.rootPath,
      duration: profile.endTime - profile.startTime
    };
  }
  const { samples, timeDeltas } = profile;
  const sourceLocations = ensureSourceLocations(profile);
  const locations = sourceLocations.map((l, id) => {
    const src = l.locations[0];
    return {
      id,
      selfTime: 0,
      aggregateTime: 0,
      ticks: 0,
      // category: categorize(l.callFrame, src),
      callFrame: l.callFrame,
      src
    };
  });
  const idMap = /* @__PURE__ */ new Map();
  const mapId = (nodeId) => {
    let id = idMap.get(nodeId);
    if (id === void 0) {
      id = idMap.size;
      idMap.set(nodeId, id);
    }
    return id;
  };
  const nodes = new Array(profile.nodes.length);
  for (let i = 0; i < profile.nodes.length; i++) {
    const node = profile.nodes[i];
    const id = mapId(node.id);
    nodes[id] = {
      id,
      selfTime: 0,
      aggregateTime: 0,
      locationId: node.locationId,
      children: node.children?.map(mapId) || []
    };
    for (const child of node.positionTicks || []) {
      if (child.startLocationId) {
        locations[child.startLocationId].ticks += child.ticks;
      }
    }
  }
  for (const node of nodes) {
    for (const child of node.children) {
      nodes[child].parent = node.id;
    }
  }
  const duration = profile.endTime - profile.startTime;
  let lastNodeTime = duration - timeDeltas[0];
  for (let i = 0; i < timeDeltas.length - 1; i++) {
    const d = timeDeltas[i + 1];
    nodes[mapId(samples[i])].selfTime += d;
    lastNodeTime -= d;
  }
  if (nodes.length) {
    nodes[mapId(samples[timeDeltas.length - 1])].selfTime += lastNodeTime;
    timeDeltas.push(lastNodeTime);
  }
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const location = locations[node.locationId];
    location.aggregateTime += computeAggregateTime(i, nodes);
    location.selfTime += node.selfTime;
  }
  return {
    nodes,
    locations,
    samples: samples.map(mapId),
    timeDeltas,
    // rootPath: profile.$vscode?.rootPath,
    duration
  };
};
class BottomUpNode {
  constructor(location, parent) {
    this.location = location;
    this.parent = parent;
    this.children = {};
    this.aggregateTime = 0;
    this.selfTime = 0;
    this.ticks = 0;
    this.childrenSize = 0;
  }
  static root() {
    return new BottomUpNode({
      id: -1,
      selfTime: 0,
      aggregateTime: 0,
      ticks: 0,
      callFrame: {
        functionName: "(root)",
        lineNumber: -1,
        columnNumber: -1,
        scriptId: "0",
        url: ""
      }
    });
  }
  get id() {
    return this.location.id;
  }
  get callFrame() {
    return this.location.callFrame;
  }
  get src() {
    return this.location.src;
  }
  addNode(node) {
    this.selfTime += node.selfTime;
    this.aggregateTime += node.aggregateTime;
  }
}
const processNode = (aggregate, node, model, initialNode = node) => {
  let child = aggregate.children[node.locationId];
  if (!child) {
    child = new BottomUpNode(model.locations[node.locationId], aggregate);
    aggregate.childrenSize++;
    aggregate.children[node.locationId] = child;
  }
  child.addNode(initialNode);
  if (node.parent) {
    processNode(child, model.nodes[node.parent], model, initialNode);
  }
};
export {
  BottomUpNode,
  buildModel,
  processNode
};
