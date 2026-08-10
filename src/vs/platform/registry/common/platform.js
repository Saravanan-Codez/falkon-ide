import * as Assert from "../../../base/common/assert.js";
import * as Types from "../../../base/common/types.js";
class RegistryImpl {
  constructor() {
    this.data = /* @__PURE__ */ new Map();
  }
  add(id, data) {
    Assert.ok(Types.isString(id));
    Assert.ok(Types.isObject(data));
    Assert.ok(!this.data.has(id), "There is already an extension with this id");
    this.data.set(id, data);
  }
  knows(id) {
    return this.data.has(id);
  }
  as(id) {
    return this.data.get(id) || null;
  }
  dispose() {
    this.data.forEach((value) => {
      if (Types.isFunction(value.dispose)) {
        value.dispose();
      }
    });
    this.data.clear();
  }
}
const Registry = new RegistryImpl();
export {
  Registry
};
