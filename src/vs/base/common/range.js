var Range;
((Range2) => {
  function intersect(one, other) {
    if (one.start >= other.end || other.start >= one.end) {
      return { start: 0, end: 0 };
    }
    const start = Math.max(one.start, other.start);
    const end = Math.min(one.end, other.end);
    if (end - start <= 0) {
      return { start: 0, end: 0 };
    }
    return { start, end };
  }
  Range2.intersect = intersect;
  function isEmpty(range) {
    return range.end - range.start <= 0;
  }
  Range2.isEmpty = isEmpty;
  function intersects(one, other) {
    return !isEmpty(intersect(one, other));
  }
  Range2.intersects = intersects;
  function relativeComplement(one, other) {
    const result = [];
    const first = { start: one.start, end: Math.min(other.start, one.end) };
    const second = { start: Math.max(other.end, one.start), end: one.end };
    if (!isEmpty(first)) {
      result.push(first);
    }
    if (!isEmpty(second)) {
      result.push(second);
    }
    return result;
  }
  Range2.relativeComplement = relativeComplement;
})(Range || (Range = {}));
export {
  Range
};
