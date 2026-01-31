//! Utility helpers for ACP content extraction.

use agent_client_protocol::ContentBlock;

/// Extract the text payload from a content block when available.
pub fn content_block_text(block: &ContentBlock) -> Option<&str> {
    match block {
        ContentBlock::Text(text) => Some(text.text.as_str()),
        _ => None,
    }
}
