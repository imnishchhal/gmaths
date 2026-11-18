# Math Speedster — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity Ownership**: Every document under `/users/{userId}` and `/users/{userId}/sessions/{sessionId}` MUST strictly belong to `request.auth.uid == userId` and `data.userId == request.auth.uid`.
2. **Verified Accounts Only**: All write operations mandate `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: User email addresses reside exclusively inside `/users/{userId}`, where `allow list` is unconditionally denied (`false`) and `allow get` requires `isOwner(userId)`. Public leaderboard entries (`/leaderboard/{entryId}`) strictly prohibit PII fields via `hasOnly()`.
4. **Master Gate Relational Sync**: A `SessionRecord` in `/users/{userId}/sessions/{sessionId}` cannot be created unless its parent `/users/{userId}` document exists (`exists(...)`), and `LeaderboardEntry` creation likewise requires the owning `/users/{userId}` document to exist.
5. **Immutable Audit History**: `SessionRecord` documents are append-only (`allow update: if false`).
6. **Deterministic Anti-Spam Leaderboard Keys**: Every `/leaderboard/{entryId}` document ID MUST equal `{userId}_{mode}_{difficulty}_{sessionType}_{durationSec}`, restricting each user to one personal-best slot per configuration bucket.
7. **Monotonic Leaderboard Updates & Immutable Keys**: Updates to `/leaderboard/{entryId}` MUST preserve immutable keys (`id`, `userId`, `mode`, `difficulty`, `sessionType`, `durationSec`, `isPublic`, `createdAt`), allowlist mutable keys via `affectedKeys().hasOnly(...)`, and require a non-regressing score (`incoming().score > existing().score` or equal score with higher/equal accuracy).
8. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time` (server timestamps).
9. **Path & Payload Volumetric Hardening**: All single-document path IDs must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), all strings enforce explicit `.size()` bounds, and all numeric metrics enforce strict mathematical bounds (e.g., `correct <= attempted`, `bestStreak <= score`, `0 <= accuracy <= 100`).
10. **Secure List Queries**: No blanket `allow list: if isSignedIn();`. Every `allow list` evaluates `resource.data` directly without `get()`/`exists()` lookups.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Adversarial Payload / Context | Expected Outcome |
|---|---|---|---|---|
| 1 | **Identity Spoofing (Profile)** | `/users/victim_uid` (create as `attacker_uid`) | `{ uid: "victim_uid", displayName: "Eve", email: "eve@example.com", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` | `PERMISSION_DENIED` |
| 2 | **Unverified Email Write** | `/users/unverified_uid` (auth with `email_verified: false`) | `{ uid: "unverified_uid", displayName: "Bot", email: "bot@example.com", createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` | `PERMISSION_DENIED` |
| 3 | **Shadow Field Injection (Ghost Field)** | `/users/alice_uid` (create as `alice_uid`) | `{ uid: "alice_uid", displayName: "Alice", email: "alice@example.com", isAdmin: true, createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` | `PERMISSION_DENIED` |
| 4 | **PII Cross-User Read** | `/users/victim_uid` (`get` as `attacker_uid`) | Authenticated non-owner attempts to read victim's email | `PERMISSION_DENIED` |
| 5 | **Orphaned Session Write (Master Gate Bypass)** | `/users/ghost_uid/sessions/sess_1` (no `/users/ghost_uid` parent doc) | Valid `SessionRecord` payload where parent `/users/ghost_uid` does not exist | `PERMISSION_DENIED` |
| 6 | **Session History Tampering (Update)** | `/users/alice_uid/sessions/sess_1` (`update` as `alice_uid`) | `{ score: 999 }` modifying historical session | `PERMISSION_DENIED` |
| 7 | **Impossible Math Metrics Integrity** | `/users/alice_uid/sessions/sess_2` (create as `alice_uid`) | `{ ..., score: 50, correct: 50, attempted: 10, accuracy: 500, bestStreak: 99 }` (`correct > attempted`, `accuracy > 100`) | `PERMISSION_DENIED` |
| 8 | **Timestamp Forgery (Temporal Integrity)** | `/users/alice_uid/sessions/sess_3` (create as `alice_uid`) | Valid fields except `createdAt: "2020-01-01T00:00:00Z"` (client-forged timestamp != `request.time`) | `PERMISSION_DENIED` |
| 9 | **Resource Poisoning (Oversized ID / String)** | `/users/alice_uid/sessions/${"a".repeat(200)}` (create as `alice_uid`) | Document ID > 128 chars or `displayName` > 40 chars | `PERMISSION_DENIED` |
| 10 | **Leaderboard Slot Spam (Non-Deterministic ID)** | `/leaderboard/alice_uid_custom_spam_99` (create as `alice_uid`) | `{ id: "alice_uid_custom_spam_99", userId: "alice_uid", mode: "mixed", difficulty: "medium", sessionType: "sprint", durationSec: 60, ... }` | `PERMISSION_DENIED` |
| 11 | **Leaderboard PII Leak / Ghost Field** | `/leaderboard/alice_uid_mixed_medium_sprint_60` (create as `alice_uid`) | Valid leaderboard payload plus `email: "alice@example.com"` | `PERMISSION_DENIED` |
| 12 | **Leaderboard Value Poisoning & Immutable Key Mutation** | `/leaderboard/alice_uid_mixed_medium_sprint_60` (`update` as `alice_uid`) | `{ score: "1000", mode: "hard", updatedAt: SERVER_TIME }` (wrong type + mutating immutable `mode`) | `PERMISSION_DENIED` |
