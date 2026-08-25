const MIN_HOST_WIDTH = 320;
function spaceMarkCenters(marks, height, minGap) {
  const n = marks.length;
  if (n === 0) {
    return;
  }
  const lo = minGap / 2;
  const hi = height - minGap / 2;
  if (hi <= lo) {
    return;
  }
  if ((n - 1) * minGap > hi - lo) {
    const step = (hi - lo) / (n - 1);
    for (let i = 0; i < n; i++) {
      marks[i].center = lo + i * step;
    }
    return;
  }
  let prev = lo - minGap;
  for (let i = 0; i < n; i++) {
    prev = marks[i].center = Math.max(marks[i].center, prev + minGap, lo);
  }
  let next = hi + minGap;
  for (let i = n - 1; i >= 0; i--) {
    next = marks[i].center = Math.min(marks[i].center, next - minGap, hi);
  }
}
export {
  MIN_HOST_WIDTH,
  spaceMarkCenters
};
