function onObservableChange(observable, callback) {
  const o = {
    beginUpdate() {
    },
    endUpdate() {
    },
    handlePossibleChange(observable2) {
      observable2.reportChanges();
    },
    handleChange(_observable, change) {
      callback(change);
    }
  };
  observable.addObserver(o);
  return {
    dispose() {
      observable.removeObserver(o);
    }
  };
}
export {
  onObservableChange
};
