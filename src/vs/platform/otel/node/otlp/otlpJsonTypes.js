var OtlpStatusCode = /* @__PURE__ */ ((OtlpStatusCode2) => {
  OtlpStatusCode2[OtlpStatusCode2["UNSET"] = 0] = "UNSET";
  OtlpStatusCode2[OtlpStatusCode2["OK"] = 1] = "OK";
  OtlpStatusCode2[OtlpStatusCode2["ERROR"] = 2] = "ERROR";
  return OtlpStatusCode2;
})(OtlpStatusCode || {});
var OtlpSpanKind = /* @__PURE__ */ ((OtlpSpanKind2) => {
  OtlpSpanKind2[OtlpSpanKind2["UNSPECIFIED"] = 0] = "UNSPECIFIED";
  OtlpSpanKind2[OtlpSpanKind2["INTERNAL"] = 1] = "INTERNAL";
  OtlpSpanKind2[OtlpSpanKind2["SERVER"] = 2] = "SERVER";
  OtlpSpanKind2[OtlpSpanKind2["CLIENT"] = 3] = "CLIENT";
  OtlpSpanKind2[OtlpSpanKind2["PRODUCER"] = 4] = "PRODUCER";
  OtlpSpanKind2[OtlpSpanKind2["CONSUMER"] = 5] = "CONSUMER";
  return OtlpSpanKind2;
})(OtlpSpanKind || {});
export {
  OtlpSpanKind,
  OtlpStatusCode
};
