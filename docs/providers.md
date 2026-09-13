# Agent HQ — Provider Integration Guide

## Supported Providers

Agent HQ Phase 2 introduces multi-provider extensibility via `AgentProvider` and `ProviderRegistry`.

| Provider | ID | Capabilities | Status / Setup |
| :--- | :--- | :--- | :--- |
| **Mock Agent Provider** | `mock` | `task_execution`, `code_generation`, `memory`, `tool_use`, `streaming` | Built-in, zero dependencies, deterministic simulation. Always available. |
| **Google Gemini Provider** | `gemini` | `task_execution`, `code_generation`, `memory`, `tool_use`, `reasoning` | Backed by Node.js bridge (`server/index.ts`) using `@google/genai`. Configured via `GEMINI_API_KEY`. |
| **Antigravity Provider** | `antigravity` | `task_execution`, `code_generation`, `tool_use`, `external_runtime` | Adapter for official Antigravity CLI/SDK/daemon. Reports `unavailable` cleanly when daemon is inactive, automatically falling back to Mock. |

---

## Security & Architectural Boundaries

1. **Zero Browser Secrets**:
   - The browser frontend NEVER stores or accesses `GEMINI_API_KEY` or provider auth tokens.
   - All AI calls are routed through the backend bridge on port 3001 via Vite's `/api` proxy.

2. **Antigravity Boundary**:
   - No scraping of local storage, session cookies, or reverse-engineered private endpoints.
   - Antigravity agent execution interfaces exclusively through clean official SDK or local daemon endpoints.
   - When the daemon is offline, `AntigravityProvider.healthCheck()` returns `status: 'unavailable'` with clear human-readable explanations, and `ProviderRegistry.resolveProviderForAgent()` routes execution safely through `MockAgentProvider`.

---

## Configuring Providers

### Setting up Gemini API
1. Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   PORT=3001
   ```
2. Start the backend bridge:
   ```bash
   npm run server
   ```
3. Start the Agent HQ frontend:
   ```bash
   npm run dev
   ```

### Assigning Providers to Agents
Each agent in `src/data/agents.ts` has a default `providerId` and `systemRole`:
- **Boss**: `mock` (Strategic Director)
- **Nova**: `antigravity` (Principal Architect)
- **Atlas**: `gemini` (Full Stack Engineer)
- **Pixel**: `mock` (Design Engineer)
- **Echo**: `antigravity` (Comms & Integration)
- **Vector**: `mock` (Data Engineer)
- **Sentinel**: `gemini` (Security Lead)
