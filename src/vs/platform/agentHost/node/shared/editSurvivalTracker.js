function compute4GramTextSimilarity(text1, text2) {
  const n = 4;
  if (text1.length < n || text2.length < n) {
    return text1 === text2 ? 1 : 0;
  }
  const nGramIdx = /* @__PURE__ */ new Map();
  for (let i = 0; i <= text1.length - n; i++) {
    const nGram = text1.substring(i, i + n);
    const count = nGramIdx.get(nGram) || 0;
    nGramIdx.set(nGram, count + 1);
  }
  for (let i = 0; i <= text2.length - n; i++) {
    const nGram = text2.substring(i, i + n);
    const count = nGramIdx.get(nGram) || 0;
    nGramIdx.set(nGram, count - 1);
  }
  const totalNGramCount = text1.length - n + 1 + text2.length - n + 1;
  let differentNGramCount = 0;
  for (const count of nGramIdx.values()) {
    differentNGramCount += Math.abs(count);
  }
  const equalNGramCount = totalNGramCount - differentNGramCount;
  return equalNGramCount / totalNGramCount;
}
function computeFractionPresentIn(chunk, currentText) {
  const n = 4;
  if (chunk.length === 0) {
    return 1;
  }
  if (chunk.length < n) {
    return currentText.includes(chunk) ? 1 : 0;
  }
  if (currentText.length < n) {
    return 0;
  }
  return computeFractionPresentInSet(chunk, buildNGramSet(currentText, n), n);
}
function buildNGramSet(text, n) {
  const set = /* @__PURE__ */ new Set();
  for (let i = 0; i <= text.length - n; i++) {
    set.add(text.substring(i, i + n));
  }
  return set;
}
function computeFractionPresentInSet(chunk, fileNGrams, n) {
  const total = chunk.length - n + 1;
  let present = 0;
  for (let i = 0; i < total; i++) {
    if (fileNGrams.has(chunk.substring(i, i + n))) {
      present++;
    }
  }
  return present / total;
}
function computeChunkedFourGramSurvival(aiChunks, currentText) {
  if (aiChunks.length === 0) {
    return 0;
  }
  const n = 4;
  const fileNGrams = currentText.length >= n ? buildNGramSet(currentText, n) : void 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const chunk of aiChunks) {
    const weight = Math.max(1, chunk.length - n + 1);
    let fraction;
    if (chunk.length === 0) {
      fraction = 1;
    } else if (chunk.length < n) {
      fraction = currentText.includes(chunk) ? 1 : 0;
    } else if (!fileNGrams) {
      fraction = 0;
    } else {
      fraction = computeFractionPresentInSet(chunk, fileNGrams, n);
    }
    weightedSum += fraction * weight;
    totalWeight += weight;
  }
  return weightedSum / totalWeight;
}
function computeNoRevertScore(beforeText, afterText, currentText) {
  const aiSimilarity = compute4GramTextSimilarity(afterText, beforeText);
  if (aiSimilarity === 1) {
    return 1;
  }
  const userSimilarity = compute4GramTextSimilarity(currentText, beforeText);
  return 1 - Math.max(userSimilarity - aiSimilarity, 0) / (1 - aiSimilarity);
}
function computeWholeFileEditSurvival(beforeText, afterText, currentText) {
  return {
    fourGram: compute4GramTextSimilarity(currentText, afterText),
    noRevert: computeNoRevertScore(beforeText, afterText, currentText)
  };
}
function computeChunkedEditSurvival(beforeText, afterText, aiChunks, currentText) {
  const fourGram = aiChunks.length === 0 ? compute4GramTextSimilarity(currentText, afterText) : computeChunkedFourGramSurvival(aiChunks, currentText);
  return {
    fourGram,
    noRevert: computeNoRevertScore(beforeText, afterText, currentText)
  };
}
export {
  compute4GramTextSimilarity,
  computeChunkedEditSurvival,
  computeChunkedFourGramSurvival,
  computeFractionPresentIn,
  computeNoRevertScore,
  computeWholeFileEditSurvival
};
