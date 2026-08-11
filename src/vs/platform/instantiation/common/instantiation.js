var _util;
((_util2) => {
  _util2.serviceIds = /* @__PURE__ */ new Map();
  _util2.DI_TARGET = "$di$target";
  _util2.DI_DEPENDENCIES = "$di$dependencies";
  function getServiceDependencies(ctor) {
    return ctor[_util2.DI_DEPENDENCIES] || [];
  }
  _util2.getServiceDependencies = getServiceDependencies;
})(_util || (_util = {}));
const IInstantiationService = createDecorator("instantiationService");
function storeServiceDependency(id, target, index) {
  if (target[_util.DI_TARGET] === target) {
    target[_util.DI_DEPENDENCIES].push({ id, index });
  } else {
    target[_util.DI_DEPENDENCIES] = [{ id, index }];
    target[_util.DI_TARGET] = target;
  }
}
function createDecorator(serviceId) {
  if (_util.serviceIds.has(serviceId)) {
    return _util.serviceIds.get(serviceId);
  }
  const id = function(target, key, index) {
    if (arguments.length !== 3) {
      throw new Error("@IServiceName-decorator can only be used to decorate a parameter");
    }
    storeServiceDependency(id, target, index);
  };
  id.toString = () => serviceId;
  _util.serviceIds.set(serviceId, id);
  return id;
}
function refineServiceDecorator(serviceIdentifier) {
  return serviceIdentifier;
}
export {
  IInstantiationService,
  _util,
  createDecorator,
  refineServiceDecorator
};
