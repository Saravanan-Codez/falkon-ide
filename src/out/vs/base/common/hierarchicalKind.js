class HierarchicalKind {
  constructor(value) {
    this.value = value;
  }
  static {
    this.sep = ".";
  }
  static {
    this.None = new HierarchicalKind("@@none@@");
  }
  static {
    // Special kind that matches nothing
    this.Empty = new HierarchicalKind("");
  }
  equals(other) {
    return this.value === other.value;
  }
  contains(other) {
    return this.equals(other) || this.value === "" || other.value.startsWith(this.value + HierarchicalKind.sep);
  }
  intersects(other) {
    return this.contains(other) || other.contains(this);
  }
  append(...parts) {
    return new HierarchicalKind((this.value ? [this.value, ...parts] : parts).join(HierarchicalKind.sep));
  }
}
export {
  HierarchicalKind
};
