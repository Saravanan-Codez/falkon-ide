const MAX_TICKS = 24;
const oneDayMs = 864e5;
function bucketKey(date, now) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= startOfToday) {
    return `today-${date.getTime()}`;
  }
  const daysAgo = (startOfToday.getTime() - date.getTime()) / oneDayMs;
  if (daysAgo < 1) {
    return `yesterday-h${date.getHours()}`;
  }
  if (daysAgo < 30) {
    return `day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  return `month-${date.getFullYear()}-${date.getMonth()}`;
}
function toBucket(prompt, prompts = [prompt]) {
  return {
    prompt,
    prompts,
    count: prompts.length
  };
}
function bucketPrompts(prompts, now) {
  const buckets = [];
  let currentKey;
  for (const prompt of prompts) {
    const key = bucketKey(new Date(prompt.timestamp), now);
    const current = buckets[buckets.length - 1];
    if (!current || key !== currentKey) {
      buckets.push(toBucket(prompt));
      currentKey = key;
    } else {
      const groupedPrompts = [...current.prompts, prompt];
      buckets[buckets.length - 1] = toBucket(current.prompt, groupedPrompts);
    }
  }
  return buckets;
}
function uniformSample(buckets, maxTicks) {
  if (buckets.length <= maxTicks) {
    return buckets;
  }
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (maxTicks <= 2) {
    return [first, last];
  }
  const sampled = [first];
  const step = (buckets.length - 1) / (maxTicks - 1);
  for (let i = 1; i <= maxTicks - 2; i++) {
    const index = Math.round(i * step);
    if (index > 0 && index < buckets.length - 1) {
      sampled.push(buckets[index]);
    }
  }
  sampled.push(last);
  return sampled;
}
function expandBucket(bucket, budget) {
  if (bucket.count <= budget + 1) {
    return bucket.prompts.map((prompt) => toBucket(prompt));
  }
  const expandedCount = budget;
  const remainder = bucket.prompts.slice(0, bucket.count - expandedCount);
  const expandedPrompts = bucket.prompts.slice(bucket.count - expandedCount);
  return [
    toBucket(remainder[0], remainder),
    ...expandedPrompts.map((prompt) => toBucket(prompt))
  ];
}
function expandRecentBuckets(buckets, maxTicks) {
  if (buckets.length >= maxTicks) {
    return buckets;
  }
  let expanded = buckets;
  let total = buckets.length;
  for (let i = expanded.length - 1; i >= 0 && total < maxTicks; i--) {
    const bucket = expanded[i];
    if (bucket.count <= 1) {
      continue;
    }
    const replacement = expandBucket(bucket, maxTicks - total);
    total += replacement.length - 1;
    expanded = [
      ...expanded.slice(0, i),
      ...replacement,
      ...expanded.slice(i + 1)
    ];
  }
  return expanded;
}
function budgetBucketPrompts(prompts, now = Date.now(), maxTicks = MAX_TICKS) {
  const cap = Math.min(MAX_TICKS, Math.max(1, maxTicks));
  const buckets = bucketPrompts(prompts, new Date(now));
  if (buckets.length > cap) {
    return uniformSample(buckets, cap);
  }
  if (buckets.length < cap) {
    return expandRecentBuckets(buckets, cap);
  }
  return buckets;
}
const _testing = {
  bucketKey,
  bucketPrompts,
  uniformSample,
  expandRecentBuckets
};
export {
  MAX_TICKS,
  _testing,
  budgetBucketPrompts
};
