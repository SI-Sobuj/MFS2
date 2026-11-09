/**
 * Adversarial Security Test Suite for TakaPay Firestore Rules ("Dirty Dozen" Verification)
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on Wallet',
    collectionPath: '/users/user_alpha',
    operation: 'create',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      uid: 'user_alpha',
      displayName: 'Rahim Uddin',
      accountNumber: '01711849201',
      balance: 5000,
      savingsBalance: 1000,
      rewardPoints: 50,
      biometricEnabled: true,
      pinHash: 'a1b2c3d4e5f6g7h8',
      kycTier: 'Verified Tier 1',
      isAdmin: true
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    collectionPath: '/users/user_alpha',
    operation: 'create',
    auth: { uid: 'user_alpha', email_verified: false },
    payload: {
      uid: 'user_alpha',
      displayName: 'Spoofed User',
      accountNumber: '01711849201',
      balance: 5000,
      savingsBalance: 0,
      rewardPoints: 0,
      biometricEnabled: true,
      pinHash: 'a1b2c3d4e5f6g7h8',
      kycTier: 'Verified Tier 1'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 3,
    name: 'Cross-User Wallet Read',
    collectionPath: '/users/user_beta',
    operation: 'get',
    auth: { uid: 'user_alpha', email_verified: true },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 4,
    name: 'Identity Spoofing on Transaction Create',
    collectionPath: '/users/user_alpha/transactions/tx_001',
    operation: 'create',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      uid: 'user_beta',
      txId: 'tx_001',
      type: 'send_money',
      title: 'Send Money',
      counterpartyMasked: '017***201',
      amount: 500,
      fee: 5,
      cashback: 0,
      balanceAfter: 4495,
      encryptedPayload: 'U2FsdGVkX1+abc123',
      iv: 'MTIzNDU2Nzg5MDEy',
      cipherAlg: 'AES-256-GCM',
      authMethod: 'Biometric Passkey',
      status: 'completed'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 5,
    name: 'Negative Balance Injection',
    collectionPath: '/users/user_alpha',
    operation: 'update',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      balance: -99999
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 6,
    name: 'Immutable Transaction Ledger Tampering',
    collectionPath: '/users/user_alpha/transactions/tx_001',
    operation: 'update',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      amount: 50
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 7,
    name: 'Terminal Savings Goal State Mutation',
    collectionPath: '/users/user_alpha/savingsGoals/goal_completed',
    operation: 'update',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      currentAmount: 999999
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 8,
    name: 'ID Poisoning Attack with Invalid Characters',
    collectionPath: '/users/user_alpha/transactions/invalid$id!@#',
    operation: 'create',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {},
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    collectionPath: '/users/user_alpha/notifications/notif_01',
    operation: 'create',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      createdAt: '1999-01-01T00:00:00Z'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 10,
    name: 'Immortal Field Overwrite on Wallet',
    collectionPath: '/users/user_alpha',
    operation: 'update',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      accountNumber: '01999999999'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 11,
    name: 'Value Poisoning on Whitelisted Key',
    collectionPath: '/users/user_alpha',
    operation: 'update',
    auth: { uid: 'user_alpha', email_verified: true },
    payload: {
      biometricEnabled: 'TRUE_STRING_POISON'
    },
    expectedResult: 'PERMISSION_DENIED'
  },
  {
    id: 12,
    name: 'Cross-User Transaction List Scraping',
    collectionPath: '/users/user_beta/transactions',
    operation: 'list',
    auth: { uid: 'user_alpha', email_verified: true },
    expectedResult: 'PERMISSION_DENIED'
  }
];
