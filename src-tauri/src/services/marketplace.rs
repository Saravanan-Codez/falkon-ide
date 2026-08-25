use crate::error::{FalkonError, FalkonResult};
use reqwest::blocking::Client;
use reqwest::redirect::Policy;
use std::collections::HashMap;
use std::time::Duration;
use url::Url;

pub struct MarketplaceService;

impl MarketplaceService {
    fn is_domain_allowed(host: &str) -> bool {
        let h = host.to_lowercase();
        h == "marketplace.visualstudio.com"
            || h == "open-vsx.org"
            || h.ends_with(".open-vsx.org")
            || h.ends_with(".vsassets.io")
            || h.ends_with(".microsoft.com")
            || h.ends_with(".vscode-cdn.net")
    }

    pub fn proxy_request(
        target_url: &str,
        method: Option<&str>,
        headers: Option<&HashMap<String, String>>,
        body: Option<&str>,
    ) -> FalkonResult<String> {
        let parsed_url = Url::parse(target_url).map_err(|_| FalkonError::InvalidDomain {
            url: target_url.to_string(),
        })?;

        // 1. Enforce HTTPS scheme
        if parsed_url.scheme() != "https" {
            return Err(FalkonError::InsecureProtocol {
                url: target_url.to_string(),
            });
        }

        // 2. Enforce exact / wildcard host allowlist
        let host = parsed_url.host_str().ok_or_else(|| FalkonError::InvalidDomain {
            url: target_url.to_string(),
        })?;

        if !Self::is_domain_allowed(host) {
            return Err(FalkonError::InvalidDomain {
                url: target_url.to_string(),
            });
        }

        // 3. Configure HTTP client with custom redirect security policy (disallow redirecting to non-allowlisted domains)
        let custom_redirect_policy = Policy::custom(|attempt| {
            if let Some(host) = attempt.url().host_str() {
                if attempt.url().scheme() == "https" && MarketplaceService::is_domain_allowed(host) {
                    attempt.follow()
                } else {
                    attempt.stop()
                }
            } else {
                attempt.stop()
            }
        });

        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(custom_redirect_policy)
            .build()
            .map_err(|e| FalkonError::IoError { message: e.to_string() })?;

        let is_post = method.unwrap_or("GET").eq_ignore_ascii_case("POST");

        let mut final_url = target_url.to_string();
        if is_post && !final_url.contains("api-version=") {
            if final_url.contains('?') {
                final_url.push_str("&api-version=6.0-preview.1");
            } else {
                final_url.push_str("?api-version=6.0-preview.1");
            }
        }

        let mut req = if is_post {
            client.post(&final_url)
        } else {
            client.get(&final_url)
        };

        req = req.header("User-Agent", "VSCode/1.133.0");
        req = req.header("Accept", "application/json;api-version=6.0-preview.1;excludeMetaData=true");
        if is_post {
            req = req.header("Content-Type", "application/json");
        }

        if let Some(hdrs) = headers {
            for (k, v) in hdrs {
                if k.eq_ignore_ascii_case("host")
                    || k.eq_ignore_ascii_case("content-length")
                    || k.eq_ignore_ascii_case("accept-encoding")
                    || k.eq_ignore_ascii_case("transfer-encoding")
                    || k.eq_ignore_ascii_case("user-agent")
                    || k.eq_ignore_ascii_case("accept")
                {
                    continue;
                }
                req = req.header(k, v);
            }
        }

        if is_post {
            if let Some(b) = body {
                req = req.body(b.to_string());
            }
        }

        let res = req.send().map_err(|e| FalkonError::IoError { message: e.to_string() })?;
        let text = res.text().map_err(|e| FalkonError::IoError { message: e.to_string() })?;

        Ok(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_domain_allowlist() {
        assert!(MarketplaceService::is_domain_allowed("marketplace.visualstudio.com"));
        assert!(MarketplaceService::is_domain_allowed("ms.vsassets.io"));
        assert!(MarketplaceService::is_domain_allowed("code.visualstudio.com") == false);
        assert!(MarketplaceService::is_domain_allowed("evil-proxy.com") == false);
    }

    #[test]
    fn test_insecure_http_rejection() {
        let res = MarketplaceService::proxy_request("http://marketplace.visualstudio.com", None, None, None);
        assert!(res.is_err());
        match res.unwrap_err() {
            FalkonError::InsecureProtocol { .. } => {}
            err => panic!("Expected InsecureProtocol, got {:?}", err),
        }
    }

    #[test]
    fn test_unauthorized_domain_rejection() {
        let res = MarketplaceService::proxy_request("https://evil-hacker.com/api", None, None, None);
        assert!(res.is_err());
        match res.unwrap_err() {
            FalkonError::InvalidDomain { .. } => {}
            err => panic!("Expected InvalidDomain, got {:?}", err),
        }
    }
}
