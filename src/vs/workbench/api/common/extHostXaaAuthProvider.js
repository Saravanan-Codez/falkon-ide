import { stringHash } from "../../../base/common/hash.js";
import { buildIdJagExchangeBody, buildResourceRedemptionBody, fetchAuthorizationServerMetadata, getClaimsFromJWT, isAuthorizationTokenResponse } from "../../../base/common/oauth.js";
const IDP_SCOPES = ["openid", "offline_access"];
function cacheKey(resource, scopes) {
  return resource + "|" + [...scopes].sort().join(" ");
}
function isExpired(entry, now = Date.now()) {
  if (entry.token.expires_in === void 0) {
    return false;
  }
  return now > entry.created_at + entry.token.expires_in * 1e3 - 6e4;
}
function XaaifyAuthProvider(Base) {
  return class XaaAuthenticationProvider extends Base {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args) {
      super(...args);
      this._resourceTokens = /* @__PURE__ */ new Map();
      /**
       * Per-(resource, client_id) client secrets. Lazily populated via the main-thread
       * prompt. Keyed by both the resource indicator and the client_id because two
       * different resources may legitimately share a client_id but require different
       * secrets — keying by client_id alone could send the wrong secret to the wrong AS.
       */
      this._resourceClientSecrets = /* @__PURE__ */ new Map();
      const issuer = this.authorizationServer;
      this.id = `xaa:${issuer.toString(true)}`;
      this._logger.trace(`[XAA] Provider constructed for issuer ${issuer.toString(true)}. authorization_endpoint=${this._serverMetadata.authorization_endpoint}, token_endpoint=${this._serverMetadata.token_endpoint}`);
    }
    /** Compound key for {@link _resourceClientSecrets}, matching main-thread secret storage scoping. */
    _resourceClientSecretKey(resource, clientId) {
      return `${resource}|${clientId}`;
    }
    async getSessions(scopes, options) {
      const resource = options.resource;
      const audience = options.audience;
      if (!scopes && !resource && !audience) {
        return super.getSessions(scopes, options);
      }
      if (!resource || !scopes || !audience) {
        return [];
      }
      const key = cacheKey(resource, scopes);
      const entry = this._resourceTokens.get(key);
      if (entry && !isExpired(entry)) {
        return [toSession(entry.token, entry.scopes, entry.account)];
      }
      if (entry) {
        this._resourceTokens.delete(key);
      }
      const idpSession = await this._tryGetSilentIdpSession();
      if (!idpSession?.idToken) {
        return [];
      }
      try {
        const minted = await this._mintResourceToken(
          idpSession,
          [...scopes],
          audience,
          resource,
          options,
          /* silent */
          true
        );
        if (!minted) {
          return [];
        }
        return [toSession(minted.token, minted.scopes, minted.account)];
      } catch (err) {
        this._logger.warn(`[XAA] Silent token mint failed for resource=${resource}; falling back to interactive. Error: ${err.message}`);
        return [];
      }
    }
    async createSession(scopes, options) {
      const audience = options.audience;
      const resource = options.resource;
      this._logger.trace(`[XAA] createSession scopes=[${scopes.join(" ")}] audience=${audience} resource=${resource}`);
      if (!audience) {
        throw new Error("Enterprise-managed authentication requires `options.audience` (the resource's authorization server URL) but none was provided.");
      }
      if (!resource) {
        throw new Error("Enterprise-managed authentication requires `options.resource` (the resource indicator / MCP server URL) but none was provided.");
      }
      const idpSession = await this._ensureIdpSession();
      if (!idpSession.idToken) {
        throw new Error("IdP session is missing an id_token; the issuer must support OpenID Connect and the `openid` scope.");
      }
      const minted = await this._mintResourceToken(
        idpSession,
        scopes,
        audience,
        resource,
        options,
        /* silent */
        false
      );
      if (!minted) {
        throw new Error("Failed to mint a resource access token for the enterprise-managed MCP server.");
      }
      return toSession(minted.token, minted.scopes, minted.account);
    }
    /**
     * Mints a resource-scoped access token by running legs 2-4 of the XAA flow:
     *   2. Exchange IdP id_token → ID-JAG (RFC 8693 token exchange at issuer)
     *   3. Discover the resource AS token endpoint
     *   4. Redeem the ID-JAG at the resource AS for an access token (RFC 7523 jwt-bearer grant)
     *
     * When `silent` is true, this method MUST NOT prompt the user. If the resource AS uses a
     * distinct client_id (xaa.dev's "{client}-at-{resource}" pattern) and no client_secret can
     * be resolved without prompting, this returns `undefined`.
     *
     * Caches the resulting token in `_resourceTokens` so subsequent getSessions are O(1).
     */
    async _mintResourceToken(idpSession, scopes, audience, resource, options, silent) {
      const jag = await this._exchangeForIdJag(idpSession.idToken, audience, resource, scopes);
      const resourceTokenEndpoint = await this._discoverResourceTokenEndpoint(audience);
      let resourceClientId = this._clientId;
      let resourceClientIdFromJag = false;
      const configuredResourceClientId = typeof options.clientId === "string" && options.clientId.length > 0 ? options.clientId : void 0;
      if (configuredResourceClientId) {
        resourceClientId = configuredResourceClientId;
        resourceClientIdFromJag = resourceClientId !== this._clientId;
      } else {
        try {
          const jagClaims = getClaimsFromJWT(jag);
          if (typeof jagClaims.client_id === "string" && jagClaims.client_id.length > 0) {
            resourceClientId = jagClaims.client_id;
            resourceClientIdFromJag = resourceClientId !== this._clientId;
          }
        } catch (err) {
          this._logger.warn(`[XAA] Could not decode ID-JAG to read resource client_id; falling back to IdP client_id. Error: ${err.message}`);
        }
      }
      let resourceClientSecret = this._clientSecret;
      const configuredResourceClientSecret = typeof options.clientSecret === "string" && options.clientSecret.length > 0 ? options.clientSecret : void 0;
      const secretCacheKey = this._resourceClientSecretKey(resource, resourceClientId);
      if (configuredResourceClientSecret) {
        resourceClientSecret = configuredResourceClientSecret;
        this._resourceClientSecrets.set(secretCacheKey, configuredResourceClientSecret);
      } else if (resourceClientIdFromJag) {
        if (this._resourceClientSecrets.has(secretCacheKey)) {
          resourceClientSecret = this._resourceClientSecrets.get(secretCacheKey);
        } else if (silent) {
          this._logger.info(`[XAA] Silent mint requires resource client_secret for '${resourceClientId}' but none is cached or configured; deferring to interactive flow.`);
          return void 0;
        } else {
          this._logger.info(`[XAA] Resource AS requires a distinct client_id '${resourceClientId}' \u2014 prompting for matching client_secret.`);
          const promptedSecret = await this._proxy.$promptForResourceClientSecret(resourceClientId, resource);
          if (promptedSecret === void 0) {
            return void 0;
          }
          this._resourceClientSecrets.set(secretCacheKey, promptedSecret);
          resourceClientSecret = promptedSecret.length > 0 ? promptedSecret : void 0;
        }
      }
      const resourceToken = await this._redeemAtResource(resourceTokenEndpoint, jag, resource, scopes, resourceClientId, resourceClientSecret);
      const entry = {
        resource,
        scopes,
        token: resourceToken,
        // Fallback identity, used when the resource token carries no id_token of its own (the usual case).
        account: idpSession.account,
        created_at: Date.now()
      };
      this._resourceTokens.set(cacheKey(resource, scopes), entry);
      return entry;
    }
    /**
     * Returns the IdP session if one is available without any user interaction, otherwise
     * `undefined`. Critically does NOT call `super.createSession`, so this is safe to use
     * from {@link getSessions}.
     */
    async _tryGetSilentIdpSession() {
      const cleanOptions = {};
      const existing = await super.getSessions(IDP_SCOPES, cleanOptions);
      return existing.length ? existing[0] : void 0;
    }
    async _ensureIdpSession() {
      this._logger.trace(`[XAA] _ensureIdpSession: scopes=[${IDP_SCOPES.join(" ")}] authorization_endpoint=${this._serverMetadata.authorization_endpoint}`);
      const silent = await this._tryGetSilentIdpSession();
      if (silent?.idToken) {
        this._logger.trace(`[XAA] _ensureIdpSession: reusing existing IdP session`);
        return silent;
      }
      this._logger.trace(`[XAA] _ensureIdpSession: creating new IdP session via super.createSession`);
      return super.createSession([...IDP_SCOPES], {});
    }
    async _exchangeForIdJag(idToken, audience, resource, scopes) {
      const tokenEndpoint = this._serverMetadata.token_endpoint;
      if (!tokenEndpoint) {
        throw new Error("Issuer metadata is missing token_endpoint; cannot perform XAA token exchange.");
      }
      const body = buildIdJagExchangeBody(this._clientId, this._clientSecret, idToken, audience, resource, scopes);
      this._logger.trace(`[XAA] POST ${tokenEndpoint} (ID-JAG exchange) audience=${audience} resource=${resource} scope=${scopes.join(" ")}`);
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: body.toString()
      });
      if (!response.ok) {
        throw new Error(`XAA token exchange (IdP) failed: ${response.status} ${await safeText(response)}`);
      }
      const data = await response.json();
      const issued = data && typeof data === "object" && typeof data.access_token === "string" ? data.access_token : void 0;
      if (!issued) {
        throw new Error(`XAA token exchange (IdP) returned no access_token. Response: ${JSON.stringify(data)}`);
      }
      return issued;
    }
    async _discoverResourceTokenEndpoint(audience) {
      const { metadata, errors } = await fetchAuthorizationServerMetadata(audience);
      if (!metadata?.token_endpoint) {
        throw new Error(`Failed to discover resource authorization server metadata for '${audience}': ${errors.map((e) => e.message).join("; ") || "no token_endpoint in metadata"}`);
      }
      return metadata.token_endpoint;
    }
    async _redeemAtResource(tokenEndpoint, idJag, resource, scopes, resourceClientId, resourceClientSecret) {
      const body = buildResourceRedemptionBody(resourceClientId, resourceClientSecret, idJag, resource, scopes);
      this._logger.trace(`[XAA] POST ${tokenEndpoint} (ID-JAG redemption) client_id=${resourceClientId} resource=${resource} scope=${scopes.join(" ")}`);
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: body.toString()
      });
      if (!response.ok) {
        throw new Error(`XAA token exchange (resource) failed: ${response.status} ${await safeText(response)}`);
      }
      const data = await response.json();
      if (!isAuthorizationTokenResponse(data)) {
        throw new Error(`XAA token exchange (resource) returned an invalid token response: ${JSON.stringify(data)}`);
      }
      return data;
    }
  };
}
function toSession(token, scopes, fallbackAccount) {
  let account;
  if (token.id_token) {
    try {
      const claims = getClaimsFromJWT(token.id_token);
      account = {
        id: claims.sub || "unknown",
        label: claims.preferred_username || claims.name || claims.email || "XAA"
      };
    } catch {
    }
  }
  account ??= fallbackAccount ?? { id: "unknown", label: "XAA" };
  return {
    id: stringHash(token.access_token, 0).toString(),
    accessToken: token.access_token,
    account,
    scopes: [...scopes],
    idToken: token.id_token
  };
}
async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}
export {
  IDP_SCOPES,
  XaaifyAuthProvider,
  cacheKey,
  isExpired,
  toSession
};
