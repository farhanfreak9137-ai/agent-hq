# Security & Safety Boundaries

## Authentication & Authorization
- **Bcrypt Hashing**: Password storage utilizes salted bcrypt hashing (work factor 10).
- **HMAC Tokens**: Authenticated sessions utilize signed HMAC-SHA256 tokens transmitted in `HttpOnly` `SameSite=Strict` cookies.
- **RBAC**: Role-based access control enforces `ADMIN` vs `USER` access boundaries.

## Zero Secret Leakage
- API keys (`GEMINI_API_KEY`, provider tokens) are injected strictly server-side via environment variables.
- Database tables (`provider_configs`, `audit_logs`, `events`) store only sanitized metadata.
- Audit logs automatically sanitize query parameters and body payloads.

## Human Approval Boundary
Critical actions (production deployment, cryptographic release, credential modification) are classified as `RESTRICTED`. They cannot be bypassed autonomously by agent prompts.
