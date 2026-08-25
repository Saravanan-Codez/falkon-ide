async function generateSelfSignedCert() {
  const crypto = await import("crypto");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const cert = createSelfSignedCertPem(crypto, privateKey, publicKey);
  const certDer = pemToDer(cert);
  const hash = crypto.createHash("sha256").update(certDer).digest("base64");
  const fingerprint = `sha256/${hash}`;
  return { key: privateKey, cert, fingerprint };
}
function createSelfSignedCertPem(crypto, privateKeyPem, publicKeyPem) {
  const spkiDer = pemToDer(publicKeyPem);
  const serial = crypto.randomBytes(8);
  serial[0] &= 127;
  const now = /* @__PURE__ */ new Date();
  const notAfter = new Date(now);
  notAfter.setFullYear(now.getFullYear() + 1);
  const cnOid = derOid(Buffer.from([85, 4, 3]));
  const issuerAndSubject = derSequence([
    derSet([
      derSequence([
        cnOid,
        derUtf8String("TunnelProxy")
      ])
    ])
  ]);
  const validity = derSequence([
    derTime(now),
    derTime(notAfter)
  ]);
  const version = Buffer.from([160, 3, 2, 1, 2]);
  const serialNumber = derInteger(serial);
  const sigAlgOidBytes = Buffer.from([42, 134, 72, 206, 61, 4, 3, 2]);
  const sigAlg = derSequence([derOid(sigAlgOidBytes)]);
  const sanExtension = buildSanExtension();
  const extensions = Buffer.concat([
    Buffer.from([163]),
    derLengthPrefix(derSequence([sanExtension]))
  ]);
  const tbs = derSequence([
    version,
    serialNumber,
    sigAlg,
    issuerAndSubject,
    validity,
    issuerAndSubject,
    spkiDer,
    extensions
  ]);
  const signer = crypto.createSign("SHA256");
  signer.update(tbs);
  const signature = signer.sign(privateKeyPem);
  const sigBitString = Buffer.concat([
    Buffer.from([3]),
    derLength(signature.length + 1),
    Buffer.from([0]),
    // no unused bits
    signature
  ]);
  const certDer = derSequence([tbs, sigAlg, sigBitString]);
  const b64 = certDer.toString("base64");
  const lines = [];
  for (let i = 0; i < b64.length; i += 64) {
    lines.push(b64.substring(i, i + 64));
  }
  return `-----BEGIN CERTIFICATE-----
${lines.join("\n")}
-----END CERTIFICATE-----
`;
}
function buildSanExtension() {
  const sanOid = derOid(Buffer.from([85, 29, 17]));
  const ipBytes = Buffer.from([135, 4, 127, 0, 0, 1]);
  const sanValue = derOctetString(derSequence([ipBytes]));
  return derSequence([sanOid, sanValue]);
}
function pemToDer(pem) {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s/g, "");
  return Buffer.from(b64, "base64");
}
function derLength(length) {
  if (length < 128) {
    return Buffer.from([length]);
  } else if (length < 256) {
    return Buffer.from([129, length]);
  } else if (length < 65536) {
    return Buffer.from([130, length >> 8 & 255, length & 255]);
  } else if (length < 16777216) {
    return Buffer.from([131, length >> 16 & 255, length >> 8 & 255, length & 255]);
  } else {
    throw new Error(`derLength: value too large (${length})`);
  }
}
function derLengthPrefix(content) {
  return Buffer.concat([derLength(content.length), content]);
}
function derSequence(items) {
  const content = Buffer.concat(items);
  return Buffer.concat([Buffer.from([48]), derLength(content.length), content]);
}
function derSet(items) {
  const content = Buffer.concat(items);
  return Buffer.concat([Buffer.from([49]), derLength(content.length), content]);
}
function derInteger(value) {
  if (value.length === 0) {
    throw new Error("derInteger: value must be non-empty");
  }
  let start = 0;
  while (start < value.length - 1 && value[start] === 0 && (value[start + 1] & 128) === 0) {
    start++;
  }
  let content = value.subarray(start);
  if (content[0] & 128) {
    content = Buffer.concat([Buffer.from([0]), content]);
  }
  return Buffer.concat([Buffer.from([2]), derLength(content.length), content]);
}
function derOid(value) {
  return Buffer.concat([Buffer.from([6]), derLength(value.length), value]);
}
function derUtf8String(str) {
  const content = Buffer.from(str, "utf8");
  return Buffer.concat([Buffer.from([12]), derLength(content.length), content]);
}
function derOctetString(content) {
  return Buffer.concat([Buffer.from([4]), derLength(content.length), content]);
}
function derTime(date) {
  const iso = date.toISOString().replace(/[-:T]/g, "");
  const year = date.getUTCFullYear();
  if (year >= 1950 && year < 2050) {
    const content = Buffer.from(iso.substring(2, 14) + "Z", "ascii");
    return Buffer.concat([Buffer.from([23]), derLength(content.length), content]);
  } else {
    const content = Buffer.from(iso.substring(0, 14) + "Z", "ascii");
    return Buffer.concat([Buffer.from([24]), derLength(content.length), content]);
  }
}
export {
  generateSelfSignedCert
};
