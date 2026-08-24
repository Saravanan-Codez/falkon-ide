use crate::error::FalkonError;
use crate::services::marketplace::MarketplaceService;
use std::collections::HashMap;

#[tauri::command]
pub async fn marketplace_proxy(
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<String, FalkonError> {
    tokio::task::spawn_blocking(move || {
        MarketplaceService::proxy_request(&url, method.as_deref(), headers.as_ref(), body.as_deref())
    })
    .await
    .map_err(|e| FalkonError::IoError { message: e.to_string() })?
}
