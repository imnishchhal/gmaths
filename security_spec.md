# Security Specification — Math Speedster (`gmaths`) Cross-Device RBAC & Top 3 Champions

## 1. Data Invariants
1. **Default-Deny Catch-All**: No unmatched collection or path is readable or writable.
2. **Verified Email Identity**: All writes across `/users`, `/agents`, `/parents`, `/children`, `/childLeaderboard`, `/subscriptions`, and `/practiceSessions` require `request.auth != null && request.auth.token.email_verified == true`.
3. **Cross-Device Role Isolation Without `get()` in `list` Queries**:
   - **Admin** (`kumarnishchhal175@gmail.com` verified or `/admins/{uid}`): full workspace access (`workspaceId == 'gmaths_main'`).
   - **Agent**: scoped via `resource.data.email == request.auth.token.email` (on `/agents`) and `resource.data.agentEmail == request.auth.token.email` (on `/parents`, `/children`, `/subscriptions`, `/practiceSessions`).
   - **Parent**: scoped via `resource.data.email == request.auth.token.email` (on `/parents`) and `resource.data.parentEmail == request.auth.token.email` (on `/children`, `/subscriptions`, `/practiceSessions`).
4. **Credential-Free Children + Indian Class Enum**: `/children/{childId}` strictly forbids legacy `username`, `pinHash`, or `age` fields via `hasOnly()`, and enforces `grade in ['Nursery','LKG','UKG','1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th']`.
5. **PII-Free Public Top 3 Champions (`/childLeaderboard/{childId}`)**: Contains strictly `name`, `grade`, `totalScore`, `sessionsCount`, `bestStreak`, `isPublic: true` (zero emails/phones). Public `list` enforces `resource.data.totalScore >= 1` using single-field index `totalScore DESC` (`limit(3)`), and writes require owning or parent authority verified via `get(/children/{childId})`.
6. **Referential Integrity & Immutability**:
   - `/parents/{parentId}` requires `exists(/agents/{createdByAgentId})`.
   - `/children/{childId}` requires `exists(/parents/{parentId})`.
   - `/subscriptions/{subscriptionId}` requires `planType == 'yearly'`, `exists(/parents/{parentId})`, and `exists(/agents/{collectedByAgentId})`.
   - `/practiceSessions/{sessionId}` requires `exists(/children/{childId})` and `exists(/parents/{parentId})`, and is immutable (`allow update: if false`).

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **DD-01 (Unverified Admin Spoof)**: Admin email with `email_verified: false` reading `/agents`.
2. **DD-02 (Self-Escalation to `/admins`)**: Non-admin user creating `/admins/{uid}`.
3. **DD-03 (Shadow Ghost Field on Agent)**: Creating `/agents/{id}` with extra field `isSuperAdmin: true`.
4. **DD-04 (Orphaned Parent)**: Creating `/parents/{id}` referencing nonexistent `createdByAgentId`.
5. **DD-05 (Orphaned Child)**: Creating `/children/{id}` referencing nonexistent `parentId`.
6. **DD-06 (Legacy Child Credentials Rejected)**: Creating `/children/{id}` with forbidden `username` or `pinHash` field.
7. **DD-07 (Invalid Grade Enum on Child)**: Creating `/children/{id}` with `grade: 'Grade 99'` outside Indian school classes.
8. **DD-08 (Invalid Monthly Subscription)**: Creating `/subscriptions/{id}` with `planType: 'monthly'`.
9. **DD-09 (Immutable Subscription `parentId` Mutation)**: Updating `/subscriptions/{id}` to reassign `parentId`.
10. **DD-10 (Practice Session Tampering)**: Updating `/practiceSessions/{id}` to inflate `score`.
11. **DD-11 (Cross-Tenant Parent PII Read)**: Unrelated user reading another parent's `/parents/{id}` doc.
12. **DD-12 (Public Child Leaderboard PII Injection / Spoof)**: Non-owner writing to `/childLeaderboard/{childId}` or injecting `email` ghost field.
