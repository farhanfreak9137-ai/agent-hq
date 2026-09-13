# Layered Memory & Relevance Scoring

## 4-Layer Memory System (`LayeredMemory`)
1. **Working Memory**: Fast short-term scratchpad holding intermediate thoughts and immediate tool responses.
2. **Task Memory**: Scoped to the current task execution and flushed/summarized between tasks.
3. **Persistent Memory**: Durable storage backed by SQLite `memory_entries` with automatic background synchronization.
4. **Semantic Memory**: Provider-independent abstraction for vector/lexical retrieval.

## Multi-Signal Relevance Scoring (`RelevanceScorer`)
Retrieved memories are ranked using a multi-signal composite function:
$$S = 0.35 \cdot S_{\text{similarity}} + 0.25 \cdot S_{\text{recency}} + 0.15 \cdot S_{\text{role}} + 0.15 \cdot S_{\text{importance}} + 0.10 \cdot S_{\text{tags}}$$

- **Recency Decay**: $S_{\text{recency}} = e^{-\lambda \Delta t}$, with half-life $\tau = 30$ minutes.
- **Similarity**: Normalized token overlap between query and memory content/metadata.
- **Role Match**: Bonus when the storing agent matches the executing agent or role.
- **Importance**: Explicit weighting ($0.0 \le w \le 1.0$) assigned to critical architectural decisions.
