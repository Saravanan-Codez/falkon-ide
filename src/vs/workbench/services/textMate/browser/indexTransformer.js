class MonotonousIndexTransformer {
  constructor(transformation) {
    this.transformation = transformation;
    this.idx = 0;
    this.offset = 0;
  }
  static fromMany(transformations) {
    const transformers = transformations.map((t) => new MonotonousIndexTransformer(t));
    return new CombinedIndexTransformer(transformers);
  }
  /**
   * Precondition: index >= previous-value-of(index).
   */
  transform(index) {
    let nextChange = this.transformation.replacements.at(this.idx);
    while (nextChange && nextChange.replaceRange.endExclusive <= index) {
      this.offset += nextChange.getLengthDelta();
      this.idx++;
      nextChange = this.transformation.replacements.at(this.idx);
    }
    if (nextChange && nextChange.replaceRange.start <= index) {
      return void 0;
    }
    return index + this.offset;
  }
}
class CombinedIndexTransformer {
  constructor(transformers) {
    this.transformers = transformers;
  }
  transform(index) {
    for (const transformer of this.transformers) {
      const result = transformer.transform(index);
      if (result === void 0) {
        return void 0;
      }
      index = result;
    }
    return index;
  }
}
export {
  CombinedIndexTransformer,
  MonotonousIndexTransformer
};
