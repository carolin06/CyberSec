# =============================================================================
# THIS IS THE CONTRACT BETWEEN PERSON A AND PERSON B.
# NEVER CHANGE THIS FILE WITHOUT TELLING YOUR PARTNER.
# Person A writes to FEATURE_SCHEMA.
# Person B reads from FEATURE_SCHEMA.
# =============================================================================

# Maps feature name -> expected Python type.
# All values are per-session aggregates computed by the feature extractor.
FEATURE_SCHEMA: dict[str, type] = {
    # --- Keystroke timing ---
    "avg_dwell_ms":        float,  # mean key-held duration
    "std_dwell_ms":        float,  # variability in dwell times
    "avg_flight_ms":       float,  # mean time between key-up and next key-down
    "std_flight_ms":       float,  # variability in flight times
    "rhythm_cov":          float,  # coefficient of variation of inter-key intervals

    # --- Session behaviour ---
    "typing_speed_wpm":    float,  # words per minute
    "error_rate":          float,  # backspace/delete events / total keystrokes
    "pause_entropy":       float,  # Shannon entropy of pause duration distribution
    "session_duration_s":  float,  # wall-clock length of the session
    "keystrokes_total":    int,    # raw keystroke count

    # --- Statistical anomaly signals (Person A computes vs stored profile) ---
    "zscore_dwell":        float,  # z-score of avg_dwell_ms vs user baseline
    "zscore_flight":       float,  # z-score of avg_flight_ms vs user baseline
    "zscore_rhythm":       float,  # z-score of rhythm_cov vs user baseline

    # --- Model reconstruction error (Person A runs lightweight LSTM pass) ---
    "lstm_recon_error":    float,  # MSE between input sequence and LSTM reconstruction

    # --- GNN navigation features ---
    "nav_coherence_score":      float,  # score of navigation path through app screens
    "session_graph_similarity": float,  # cosine similarity vs user's historical session graphs
}

# Schema for the JSON response returned by the risk API (Person B writes this).
RISK_OUTPUT_SCHEMA: dict[str, type] = {
    "risk_score": float,  # 0.0 (benign) to 1.0 (high risk)
    "decision":   str,    # "allow" | "challenge" | "block"
    "reason":     str,    # human-readable explanation
    "shap_values": dict,  # feature name -> SHAP contribution value
    "latency_ms": float,  # end-to-end inference time
}
