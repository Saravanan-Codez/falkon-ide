class AgentHostAuthenticationService {
  constructor(_logService) {
    this._logService = _logService;
    this._tokens = /* @__PURE__ */ new Map();
  }
  async authenticate(params, providers) {
    this._logService.trace(`[AgentHostAuthenticationService] authenticate called: resource=${params.resource}`);
    const providerList = [...providers];
    const matching = providerList.filter(
      (p) => p.getProtectedResources().some((r) => r.resource === params.resource)
    );
    const settled = await Promise.allSettled(
      matching.map((p) => p.authenticate(params.resource, params.token))
    );
    let authenticated = false;
    let rejected = false;
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      if (result.status === "fulfilled") {
        authenticated ||= result.value;
      } else {
        rejected = true;
        this._logService.error(
          result.reason,
          `[AgentHostAuthenticationService] Provider '${matching[i].id}' authenticate threw for resource=${params.resource}`
        );
      }
    }
    const sessionResourceHandlers = providerList.filter((p) => p.handleAuthenticationToken);
    const sessionResourceSettled = await Promise.allSettled(
      sessionResourceHandlers.map((p) => p.handleAuthenticationToken ? p.handleAuthenticationToken(params) : Promise.resolve(false))
    );
    for (let i = 0; i < sessionResourceSettled.length; i++) {
      const result = sessionResourceSettled[i];
      if (result.status === "fulfilled") {
        authenticated ||= result.value;
      } else {
        rejected = true;
        this._logService.error(
          result.reason,
          `[AgentHostAuthenticationService] Provider '${sessionResourceHandlers[i].id}' handleAuthenticationToken threw for resource=${params.resource}`
        );
      }
    }
    const scopes = this._normalizeScopes(params.scopes);
    if (!authenticated && !rejected) {
      authenticated = this._tokens.get(this._key(params.resource, scopes))?.token === params.token;
    }
    if (authenticated) {
      this._tokens.set(this._key(params.resource, scopes), { resource: params.resource, scopes, token: params.token });
    }
    return { authenticated };
  }
  async replay(provider) {
    const protectedResources = new Set(provider.getProtectedResources().map((resource) => resource.resource));
    for (const stored of this._tokens.values()) {
      const params = { resource: stored.resource, scopes: stored.scopes, token: stored.token };
      if (protectedResources.has(stored.resource)) {
        try {
          await provider.authenticate(stored.resource, stored.token);
        } catch (error) {
          this._logService.error(error, `[AgentHostAuthenticationService] Provider '${provider.id}' rejected replayed authentication for resource=${stored.resource}`);
        }
      }
      if (provider.handleAuthenticationToken) {
        try {
          await provider.handleAuthenticationToken(params);
        } catch (error) {
          this._logService.error(error, `[AgentHostAuthenticationService] Provider '${provider.id}' rejected replayed session authentication for resource=${stored.resource}`);
        }
      }
    }
  }
  getAuthToken(request) {
    const scopes = this._normalizeScopes(request.scopes);
    const exact = this._tokens.get(this._key(request.resource, scopes));
    if (exact) {
      return exact.token;
    }
    if (scopes.length === 0) {
      return void 0;
    }
    const requested = new Set(scopes);
    let best;
    for (const candidate of this._tokens.values()) {
      if (candidate.resource !== request.resource || candidate.scopes.length === 0) {
        continue;
      }
      if (!this._containsAll(candidate.scopes, requested)) {
        continue;
      }
      if (!best || candidate.scopes.length < best.scopes.length) {
        best = candidate;
      }
    }
    if (best) {
      return best.token;
    }
    return this._tokens.get(this._key(request.resource, []))?.token;
  }
  _containsAll(scopes, requested) {
    for (const scope of requested) {
      if (!scopes.includes(scope)) {
        return false;
      }
    }
    return true;
  }
  _key(resource, scopes) {
    return `${resource}\0${scopes.join("\0")}`;
  }
  _normalizeScopes(scopes) {
    return scopes ? [...new Set(scopes)].sort() : [];
  }
}
export {
  AgentHostAuthenticationService
};
