import { StorageScope, StorageTarget } from "../../storage/common/storage.js";
const STORAGE_KEY = "browserView.sessionTrustData";
const TRUST_DURATION_MS = 7 * 24 * 60 * 60 * 1e3;
class BrowserSessionTrust {
  constructor(_session) {
    this._session = _session;
    /**
     * Trusted certificates stored as host → (fingerprint → expiration epoch ms).
     * Entries are time-limited; see {@link TRUST_DURATION_MS}.
     */
    this._trustedCertificates = /* @__PURE__ */ new Map();
    /**
     * Last known certificate per host (hostname → { fingerprint, error }).
     * Populated by `setCertificateVerifyProc` which fires for every TLS
     * handshake, not just errors. This lets us look up cert status for a
     * URL even after Chromium has cached the allow decision.
     */
    this._certErrors = /* @__PURE__ */ new Map();
    this._installCertVerifyProc();
  }
  /**
   * Install the session-level certificate verification callback that records cert errors and accepts the self-signed proxy cert.
   */
  _installCertVerifyProc() {
    this._session.electronSession.setCertificateVerifyProc((request, callback) => {
      const { hostname, errorCode, certificate, verificationResult } = request;
      const proxy = this._session.remote.proxy;
      if (proxy && hostname === proxy.host && certificate.fingerprint === proxy.certFingerprint) {
        return callback(0);
      }
      if (errorCode !== 0) {
        this._certErrors.set(hostname, { certificate, error: verificationResult });
      } else {
        this._certErrors.delete(hostname);
      }
      return callback(-3);
    });
  }
  /**
   * Install a `certificate-error` handler on a {@link Electron.WebContents}
   * so that user-trusted certificates are accepted at the page level.
   */
  installCertErrorHandler(webContents) {
    webContents.on("certificate-error", (event, url, _error, certificate, callback) => {
      event.preventDefault();
      const host = URL.parse(url)?.hostname;
      if (!host) {
        return callback(false);
      }
      if (this.isCertificateTrusted(host, certificate.fingerprint)) {
        return callback(true);
      }
      return callback(false);
    });
  }
  /**
   * Look up the certificate status for a URL by extracting the host and
   * checking whether we have a last-known bad cert that was user-trusted.
   * Returns the cert error info if the host has a bad cert that was trusted,
   * or `undefined` if the cert is valid or unknown.
   */
  getCertificateError(url) {
    const parsed = URL.parse(url);
    if (!parsed || parsed.protocol !== "https:") {
      return void 0;
    }
    const host = parsed.hostname;
    if (!host) {
      return void 0;
    }
    const known = this._certErrors.get(host);
    if (!known) {
      return void 0;
    }
    const cert = known.certificate;
    return {
      host,
      fingerprint: cert.fingerprint,
      error: known.error,
      url,
      hasTrustedException: this.isCertificateTrusted(host, cert.fingerprint),
      issuerName: cert.issuerName,
      subjectName: cert.subjectName,
      validStart: cert.validStart,
      validExpiry: cert.validExpiry
    };
  }
  /**
   * Trust a certificate identified by host and SHA-256 fingerprint.
   */
  async trustCertificate(host, fingerprint) {
    let entries = this._trustedCertificates.get(host);
    if (!entries) {
      entries = /* @__PURE__ */ new Map();
      this._trustedCertificates.set(host, entries);
    }
    entries.set(fingerprint, Date.now() + TRUST_DURATION_MS);
    this.writeStorage();
  }
  /**
   * Revoke trust for a certificate identified by host and fingerprint.
   */
  async untrustCertificate(host, fingerprint) {
    const entries = this._trustedCertificates.get(host);
    if (entries && entries.delete(fingerprint)) {
      if (entries.size === 0) {
        this._trustedCertificates.delete(host);
      }
    } else {
      throw new Error(`Certificate not found: host=${host} fingerprint=${fingerprint}`);
    }
    this.writeStorage();
    await this._session.electronSession.closeAllConnections();
  }
  /**
   * Check whether a certificate is trusted for a given host.
   */
  isCertificateTrusted(host, fingerprint) {
    const expiresAt = this._trustedCertificates.get(host)?.get(fingerprint);
    if (expiresAt === void 0) {
      return false;
    }
    if (Date.now() > expiresAt) {
      return false;
    }
    return true;
  }
  /**
   * Connect application storage so that trusted certificates are
   * persisted across restarts. Restores any previously-saved data on
   * first call; subsequent calls are no-ops.
   */
  connectStorage(storage) {
    if (this._storage) {
      return;
    }
    this._storage = storage;
    this.readStorage();
  }
  /**
   * Clear all trust state: in-memory certs, cert-error cache, persisted
   * data, and close open connections that may be using now-untrusted certs.
   */
  async clear() {
    this._trustedCertificates.clear();
    this._certErrors.clear();
    this.writeStorage();
    await this._session.electronSession.closeAllConnections();
  }
  // #region Persistence helpers
  /**
   * Restore trusted certificates from application storage.
   */
  readStorage() {
    const storage = this._storage;
    if (!storage) {
      return;
    }
    const raw = storage.get(STORAGE_KEY, StorageScope.APPLICATION);
    if (!raw) {
      return;
    }
    const now = Date.now();
    let pruned = false;
    try {
      const all = JSON.parse(raw);
      const certs = all[this._session.id]?.trustedCerts;
      if (certs) {
        for (const { host, fingerprint, expiresAt } of certs) {
          if (expiresAt > now) {
            let entries = this._trustedCertificates.get(host);
            if (!entries) {
              entries = /* @__PURE__ */ new Map();
              this._trustedCertificates.set(host, entries);
            }
            entries.set(fingerprint, expiresAt);
          } else {
            pruned = true;
          }
        }
      }
    } catch {
    }
    if (pruned) {
      this.writeStorage();
    }
  }
  /**
   * Write trusted certificates to application storage.
   * The single storage key holds **all** sessions' data so that we can
   * clean up stale entries atomically.
   */
  writeStorage() {
    const storage = this._storage;
    if (!storage) {
      return;
    }
    let all = {};
    try {
      const raw = storage.get(STORAGE_KEY, StorageScope.APPLICATION);
      if (raw) {
        all = JSON.parse(raw);
      }
    } catch {
    }
    if (!all[this._session.id]) {
      all[this._session.id] = {};
    }
    if (this._trustedCertificates.size === 0) {
      delete all[this._session.id].trustedCerts;
    } else {
      const certs = [];
      for (const [host, entries] of this._trustedCertificates) {
        for (const [fingerprint, expiresAt] of entries) {
          certs.push({ host, fingerprint, expiresAt });
        }
      }
      all[this._session.id].trustedCerts = certs;
    }
    if (Object.keys(all[this._session.id]).length === 0) {
      delete all[this._session.id];
    }
    if (Object.keys(all).length === 0) {
      storage.remove(STORAGE_KEY, StorageScope.APPLICATION);
    } else {
      storage.store(STORAGE_KEY, JSON.stringify(all), StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  }
  // #endregion
}
export {
  BrowserSessionTrust
};
