# Controlled Tool System & Permission Policies

## Tool Architecture (`ToolExecutor`)
Each tool defines:
- `id`, `name`, `description`
- `capability` & `requiredCapability`
- `riskLevel`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
- `policyRiskLevel`: `SAFE` | `CONTROLLED` | `RESTRICTED`
- `inputSchema` & `outputSchema`
- `timeoutMs`

## Policy Enforcement
- **SAFE**: Auto-executed by agents possessing matching capabilities.
- **CONTROLLED**: Capability & policy verified before dispatch.
- **RESTRICTED**: Suspends execution, emits `approval.requested`, and requires explicit human authorization via `HumanApprovalManager`.

## Safety Boundaries
- Strictly prevents arbitrary shell execution (`exec`, `bash`, `cmd`, `powershell`).
- Prevents destructive filesystem modifications (`rm -rf`, delete root).
- Quarantines sensitive files (`.env`, `.git`, private keys).
- Enforces strict execution timeouts preventing hung operations.
