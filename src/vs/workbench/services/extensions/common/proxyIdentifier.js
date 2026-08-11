class ProxyIdentifier {
  constructor(sid) {
    this._proxyIdentifierBrand = void 0;
    this.sid = sid;
    this.nid = ++ProxyIdentifier.count;
  }
  static {
    this.count = 0;
  }
}
const identifiers = [];
function createProxyIdentifier(identifier) {
  const result = new ProxyIdentifier(identifier);
  identifiers[result.nid] = result;
  return result;
}
function getStringIdentifierForProxy(nid) {
  return identifiers[nid].sid;
}
class SerializableObjectWithBuffers {
  constructor(value) {
    this.value = value;
  }
}
export {
  ProxyIdentifier,
  SerializableObjectWithBuffers,
  createProxyIdentifier,
  getStringIdentifierForProxy
};
