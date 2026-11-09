# TakaPay MFS — Hardened Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership & Verified Identity**: Every `/users/{userId}` document and all subcollections (`transactions`, `savingsGoals`, `notifications`) belong exclusively to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. **Master Gate Relational Integrity**: Subcollection documents (`transactions`, `savingsGoals`, `notifications`) cannot be created or mutated unless the parent `/users/{userId}` wallet document exists and its `uid` matches `request.auth.uid`.
3. **Immutable Encrypted Transaction Ledger**: Once an `EncryptedTransaction` document is created with `status == 'completed'`, it can never be updated or deleted (`allow update, delete: if false`).
4. **Terminal State Locking on Savings Goals**: Once a `SavingsGoal` reaches `status == 'completed'`, further updates are rejected (`existing().status != 'completed'`).
5. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must match `request.time` on creation, and `createdAt` is strictly immutable on updates while `updatedAt == request.time`.
6. **Zero-Blanket List Queries**: Every `allow list` rule enforces `existing().uid == request.auth.uid` without `get()` calls inside list evaluations.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Wallet**: Adding `"isAdmin": true` to `/users/{userId}` creation payload.
2. **Unverified Email Spoof**: Attempting wallet creation with `email_verified: false`.
3. **Cross-User PII/Balance Read**: Authenticated User A attempting `get` on `/users/userB`.
4. **Identity Spoofing on Transaction**: Authenticated User A setting `uid: "userB"` inside `/users/userA/transactions/tx1`.
5. **Negative Balance Injection**: Updating `/users/userA` with `balance: -5000`.
6. **Transaction Ledger Tampering**: Attempting `update` on `/users/userA/transactions/tx1` to alter `amount`.
7. **Terminal Savings Goal Mutation**: Attempting `update` on a `SavingsGoal` where `existing().status == 'completed'`.
8. **ID Poisoning Attack**: Passing a 256-character or special-character document ID (`txId` with spaces/slashes).
9. **Client Timestamp Forgery**: Creating a transaction with a past or future `createdAt` timestamp (`createdAt != request.time`).
10. **Immortal Field Overwrite**: Updating `/users/userA` while modifying `createdAt` or `accountNumber`.
11. **Value Poisoning on Whitelisted Key**: Updating `biometricEnabled` on `/users/userA` with a 1MB string instead of a boolean.
12. **Unscoped List Scraping**: Attempting `list` on `/users/userA/transactions` without filtering or as another user.
