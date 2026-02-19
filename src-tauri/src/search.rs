use crate::db::DbState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub clip_id: String,
    pub score: f32,
}

// cosine similarity between two f32 vectors
fn cosine_sim(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() { return 0.0; }
    let mut dot = 0.0f32;
    let mut na = 0.0f32;
    let mut nb = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    let denom = na.sqrt() * nb.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}

// bytes to f32 vec
fn bytes_to_vec(bytes: &[u8]) -> Vec<f32> {
    bytes.chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

// f32 vec to bytes
pub fn vec_to_bytes(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|f| f.to_le_bytes()).collect()
}

// brute force search over all embeddings
pub fn search(db: &DbState, query_vec: &[f32], limit: usize) -> Result<Vec<SearchResult>, String> {
    let embeddings = db.get_all_embeddings()?;

    let mut results: Vec<SearchResult> = embeddings.iter()
        .map(|(clip_id, blob)| {
            let vec = bytes_to_vec(blob);
            let score = cosine_sim(query_vec, &vec);
            SearchResult { clip_id: clip_id.clone(), score }
        })
        .filter(|r| r.score > 0.1) // min threshold
        .collect();

    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(limit);
    Ok(results)
}
