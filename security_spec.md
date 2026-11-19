# gmaths / Math Speedster — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity & Workspace Ownership**: Every document under `/users/{userId}`, `/users/{userId}/sessions/{sessionId}`, and RBAC collections (`/agents`, `/parents`, `/children`, `/subscriptions`, `/practiceSessions`) enforces verified Google authentication (`request.auth.token.email_verified == true`) and strict `ownerUid == request.auth.uid` or bootstrapped Admin (`kumarnishchhal175@gmail.com`) isolation.
2. **No Self-Assigned Admin Privileges**: Users cannot write `/admins/{uid}` unless already a bootstrapped Admin (`kumarnishchhal175@gmail.com` with `email_verified == true`).
3. **PII Isolation**: User/Agent/Parent contact details are never exposed to unrelated authenticated users (`allow list` always enforces `resource.data.ownerUid == request.auth.uid` or bootstrapped Admin scoped to `workspaceId == 'gmaths_main'`). Public `/leaderboard/{entryId}` prohibits PII fields via `hasOnly()`.
4. **Relational Integrity (Master Gate)**:
   - Creating a `/users/{userId}/sessions/{sessionId}` requires `/users/{userId}` to exist.
   - Creating a `/parents/{parentId}` requires its referencing `/agents/{createdByAgentId}` to exist.
   - Creating a `/children/{childId}` requires its referencing `/parents/{parentId}` to exist.
   - Creating a `/subscriptions/{subscriptionId}` requires both `/parents/{parentId}` and `/agents/{collectedByAgentId}` to exist.
   - Creating a `/practiceSessions/{sessionId}` requires both `/children/{childId}` and `/parents/{parentId}` to exist.
5. **Strict Yearly Subscription Integrity**: `planType` MUST equal `'yearly'`, `startDate`/`expiryDate` MUST match `YYYY-MM-DD`, `feeAmount` MUST be `0..1000000`, `paymentMethod` MUST be in `['cash', 'upi', 'bank']`, and `status` MUST be in `['active', 'expired', 'suspended']`.
6. **Immutable Historical Logs**: `/users/{userId}/sessions/{sessionId}` and `/practiceSessions/{sessionId}` forbid updates (`allow update: if false`).
7. **Temporal & Volumetric Integrity**: `createdAt == request.time`, `updatedAt == request.time`, all IDs match `^[a-zA-Z0-9_\-]+$` (`<= 128`), and every string enforces explicit `.size()` bounds.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Adversarial Payload / Context | Expected Outcome |
|---|---|---|---|---|
| 1 | **Identity Spoofing (Profile)** | `/users/victim_uid` (create as `attacker_uid`) | Spoofed `uid` != `request.auth.uid` | `PERMISSION_DENIED` |
| 2 | **Unverified Email Write** | `/agents/agent_1` (auth with `email_verified: false`) | Even with admin email, `email_verified: false` | `PERMISSION_DENIED` |
| 3 | **Self-Assigned Admin Escalation** | `/admins/attacker_uid` (create as non-admin) | `{ uid: "attacker_uid", email: "eve@example.com", createdAt: SERVER_TIME }` | `PERMISSION_DENIED` |
| 4 | **Shadow Field Injection on Agent** | `/agents/agent_1` | Valid agent fields + ghost field `superUser: true` | `PERMISSION_DENIED` |
| 5 | **Orphaned Parent Creation** | `/parents/parent_1` | References non-existent `createdByAgentId: "missing_agent"` | `PERMISSION_DENIED` |
| 6 | **Orphaned Child Creation** | `/children/child_1` | References non-existent `parentId: "missing_parent"` | `PERMISSION_DENIED` |
| 7 | **Invalid Subscription Plan Type** | `/subscriptions/sub_1` | `{ planType: "monthly", feeAmount: -500, ... }` | `PERMISSION_DENIED` |
| 8 | **Immutable Subscription Owner Mutation** | `/subscriptions/sub_1` (`update`) | Attempts to change `parentId` or `ownerUid` | `PERMISSION_DENIED` |
| 9 | **Practice Session Tampering** | `/practiceSessions/ps_1` (`update`) | Attempts to raise child `score` after completion | `PERMISSION_DENIED` |
| 10 | **Cross-Tenant PII Read** | `/parents/parent_1` (`get` as unrelated user) | Non-owner, non-admin authenticated read | `PERMISSION_DENIED` |
| 11 | **Oversized ID / String Poisoning** | `/agents/${'x'.repeat(160)}` | 160-char document ID or oversized `name` | `PERMISSION_DENIED` |
| 12 | **Leaderboard Slot Spam & PII Injection** | `/leaderboard/spam_id` | Non-deterministic ID or injected `email` field | `PERMISSION_DENIED` |
