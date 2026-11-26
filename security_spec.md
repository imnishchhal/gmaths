# Security Specification — Math Speedster (`gmaths`) Cross-Device RBAC, Referral Attribution & Monetization

## 1. Data Invariants
1. **Default-Deny Catch-All**: No unmatched collection or path is readable or writable.
2. **Verified Email Identity**: All writes across `/users`, `/agents`, `/referralCodes`, `/parents`, `/children`, `/childLeaderboard`, `/subscriptions`, `/leads`, `/studentSubscriptions`, `/payoutRequests`, `/vouchers`, and `/practiceSessions` require `request.auth != null && request.auth.token.email_verified == true`.
3. **Cross-Device Role Isolation Without `get()` in `list` Queries**:
   - **Admin** (`kumarnishchhal175@gmail.com` verified or `/admins/{uid}`): full workspace access (`workspaceId == 'gmaths_main'`).
   - **Agent**: scoped via `resource.data.email == request.auth.token.email` (on `/agents`) and `resource.data.agentEmail == request.auth.token.email` (on `/parents`, `/children`, `/subscriptions`, `/practiceSessions`, `/leads`, `/studentSubscriptions`, `/payoutRequests`, `/vouchers`).
   - **Parent**: scoped via `resource.data.email == request.auth.token.email` (on `/parents`) and `resource.data.parentEmail == request.auth.token.email` (on `/children`, `/subscriptions`, `/practiceSessions`).
   - **Student Subscriber**: scoped via `ownerUid == request.auth.uid` or `subscriberEmail == request.auth.token.email` (on `/studentSubscriptions`).
4. **Zero-PII Public Referral Lookup (`/referralCodes/{code}`)**: Public single-doc `get` (no `list`) exposes only `{ code, workspaceId, agentId, agentName, isActive, approvalStatus, emailHash, phoneHash, updatedAt }` without leaking agent emails, phone numbers, or UPI IDs.
5. **Agent Approval & Payout Guardrails**:
   - Self-signup creates `/agents/{id}` strictly with `approvalStatus: 'pending'`, `isActive: false`, `commissionRate: 0`. Only Admin can approve/suspend or adjust commission rates.
   - `/payoutRequests/{payoutId}` strictly requires an active, approved agent (`isActive == true && approvalStatus == 'approved'`), `amount >= 500`, initial `status == 'pending'`, `utrNumber == ''`, and Admin-only settlement (`status: 'paid'`).
6. **Self-Referral & Single-Use Voucher Guards**:
   - `/studentSubscriptions/{subscriptionId}` forbids self-attribution (`agent.ownerUid != request.auth.uid && agent.email != userEmailLower()`) and bounds non-admin commission amounts (`<= 350`).
   - `/vouchers/{voucherId}` permits creation only by Admin (`status: 'unused'`) and enforces single-use redemption (`existing().status == 'unused' && incoming().status == 'redeemed'`, binding `redeemedByUid` and `redeemedByEmail`).
7. **Anti-Cheat Leaderboard Moderation**:
   - Non-admin users cannot modify `isHidden` on `/leaderboard` or `/childLeaderboard`; Admin alone controls visibility moderation (`isHidden`) and clears/updates `isFlagged` / `flagReason`.

## 2. Adversarial Payloads (All Must Return PERMISSION_DENIED)
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
13. **DD-13 (Agent Self-Approval Escalation)**: Non-admin creating `/agents/{id}` with `approvalStatus: 'approved'` or `isActive: true`.
14. **DD-14 (Pending Agent Payout Request)**: Pending/inactive agent requesting a payout on `/payoutRequests/{id}`.
15. **DD-15 (Below-Minimum Payout Request)**: Approved agent creating `/payoutRequests/{id}` with `amount: 400` (`< 500`).
16. **DD-16 (Double Voucher Redemption)**: Redeeming an already-redeemed `/vouchers/{id}`.
17. **DD-17 (Cross-Tenant Financial/Lead Read)**: Unrelated user reading another user's `/payoutRequests/{id}` or `/studentSubscriptions/{id}`.
18. **DD-18 (Non-Admin Leaderboard Moderation Spoof)**: Non-admin setting `isHidden: true` on `/leaderboard/{id}`.
19. **DD-19 (Self-Referral Commission Attribution)**: Agent attributing their own `/studentSubscriptions/{id}` purchase to themselves.
