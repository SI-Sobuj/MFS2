export type TransactionType =
  | 'send_money'
  | 'cash_in'
  | 'cash_out'
  | 'mobile_recharge'
  | 'utility_bill'
  | 'qr_payment'
  | 'savings_deposit'
  | 'savings_withdraw';

export interface UserWallet {
  uid: string;
  displayName: string;
  accountNumber: string;
  balance: number;
  savingsBalance: number;
  rewardPoints: number;
  biometricEnabled: boolean;
  pinHash: string;
  kycTier: 'Verified Tier 1' | 'Premier MFS';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface DecryptedTransactionDetails {
  recipientFull: string;
  recipientName: string;
  referenceNote: string;
  providerOrBank?: string;
  meterOrAccountNo?: string;
  biometricSignature: string;
  receiptVerificationCode: string;
  timestampIso: string;
}

export interface EncryptedTransaction {
  uid: string;
  txId: string;
  type: TransactionType;
  title: string;
  counterpartyMasked: string;
  amount: number;
  fee: number;
  cashback: number;
  balanceAfter: number;
  encryptedPayload: string;
  iv: string;
  cipherAlg: 'AES-256-GCM';
  authMethod: 'Biometric Passkey' | 'PIN + Biometric';
  status: 'completed';
  createdAt: unknown;
  createdAtMs?: number;
  decrypted?: DecryptedTransactionDetails | null;
}

export interface SavingsGoal {
  uid: string;
  goalId: string;
  name: string;
  schemeType: 'Islamic Mudarabah DPS' | 'Fixed Term Savings' | 'Micro Vault';
  targetAmount: number;
  currentAmount: number;
  monthlyInstallment: number;
  profitRate: number;
  maturityDate: string;
  status: 'active' | 'completed';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface NotificationItem {
  uid: string;
  notifId: string;
  title: string;
  body: string;
  category: 'transaction' | 'security' | 'cashback' | 'savings';
  read: boolean;
  createdAt: unknown;
  updatedAt: unknown;
  createdAtMs?: number;
}

export interface QuickContact {
  name: string;
  number: string;
  relation: string;
  isPriyo: boolean;
}

export interface UtilityBiller {
  id: string;
  name: string;
  category: 'Electricity' | 'Gas' | 'Water' | 'Internet';
  billerCode: string;
  sampleMeter: string;
  cashbackPct: number;
}

export interface QrMerchantPreset {
  id: string;
  name: string;
  category: string;
  qrCodeId: string;
  cashbackPct: number;
  suggestedAmount: number;
  location: string;
}

export const QUICK_CONTACTS: QuickContact[] = [
  { name: 'Tanvir Ahmed', number: '01711-938412', relation: 'Priyo Contact', isPriyo: true },
  { name: 'Fatema Begum', number: '01819-442019', relation: 'Family Priyo', isPriyo: true },
  { name: 'Nusrat Jahan', number: '01914-883104', relation: 'Colleague', isPriyo: false },
  { name: 'Kamrul Hasan', number: '01612-774920', relation: 'Landlord', isPriyo: false },
];

export const UTILITY_BILLERS: UtilityBiller[] = [
  {
    id: 'desco',
    name: 'DESCO Prepaid Electricity',
    category: 'Electricity',
    billerCode: 'ELEC-DESCO-01',
    sampleMeter: '41098273641',
    cashbackPct: 5,
  },
  {
    id: 'dpdc',
    name: 'DPDC Smart Grid Power',
    category: 'Electricity',
    billerCode: 'ELEC-DPDC-02',
    sampleMeter: '88291044512',
    cashbackPct: 5,
  },
  {
    id: 'titas',
    name: 'Titas Gas Transmission',
    category: 'Gas',
    billerCode: 'GAS-TITAS-01',
    sampleMeter: '109283746',
    cashbackPct: 3,
  },
  {
    id: 'dwasa',
    name: 'Dhaka WASA Water Supply',
    category: 'Water',
    billerCode: 'WASA-DHK-01',
    sampleMeter: '330192847',
    cashbackPct: 4,
  },
  {
    id: 'carnival',
    name: 'Carnival Fiber Internet',
    category: 'Internet',
    billerCode: 'ISP-CRNV-09',
    sampleMeter: 'CID-994821',
    cashbackPct: 10,
  },
  {
    id: 'amberit',
    name: 'Amber IT Broadband',
    category: 'Internet',
    billerCode: 'ISP-AMBR-04',
    sampleMeter: 'AMB-772104',
    cashbackPct: 8,
  },
];

export const QR_MERCHANTS: QrMerchantPreset[] = [
  {
    id: 'shwapno',
    name: 'Shwapno Superstore — Gulshan 2',
    category: 'Grocery & Daily Needs',
    qrCodeId: 'TAKAPAY://MERCHANT/SHWAPNO-GLS2',
    cashbackPct: 15,
    suggestedAmount: 1450,
    location: 'Gulshan Avenue, Dhaka',
  },
  {
    id: 'northend',
    name: 'North End Coffee Roasters',
    category: 'Cafe & Dining',
    qrCodeId: 'TAKAPAY://MERCHANT/NORTHEND-DHK',
    cashbackPct: 10,
    suggestedAmount: 680,
    location: 'Banani Road 11, Dhaka',
  },
  {
    id: 'lazzpharma',
    name: 'Lazz Pharma Limited',
    category: 'Healthcare & Pharmacy',
    qrCodeId: 'TAKAPAY://MERCHANT/LAZZ-PHARMA',
    cashbackPct: 12,
    suggestedAmount: 920,
    location: 'Dhanmondi 27, Dhaka',
  },
  {
    id: 'aarong',
    name: 'Aarong Lifestyle Flagship',
    category: 'Apparel & Crafts',
    qrCodeId: 'TAKAPAY://MERCHANT/AARONG-TEJ',
    cashbackPct: 15,
    suggestedAmount: 3200,
    location: 'Tejgaon Link Road, Dhaka',
  },
];

export const MOBILE_OPERATORS = [
  { id: 'gp', name: 'Grameenphone', prefix: '017', color: 'text-sky-600 dark:text-sky-400' },
  { id: 'robi', name: 'Robi Axiata', prefix: '018', color: 'text-rose-600 dark:text-rose-400' },
  { id: 'bl', name: 'Banglalink', prefix: '019', color: 'text-amber-600 dark:text-amber-400' },
  { id: 'airtel', name: 'Airtel BD', prefix: '016', color: 'text-red-600 dark:text-red-400' },
  { id: 'teletalk', name: 'Teletalk 5G', prefix: '015', color: 'text-emerald-600 dark:text-emerald-400' },
];

export const RECHARGE_BUNDLES = [
  { id: 'b1', label: '30 GB + 500 Min (30 Days)', amount: 499, cashback: 45, tag: 'Popular Combo' },
  { id: 'b2', label: '15 GB High-Speed Data (15 Days)', amount: 249, cashback: 20, tag: 'Data Pack' },
  { id: 'b3', label: '350 Min All-Net Talktime (30 Days)', amount: 199, cashback: 15, tag: 'Voice Saver' },
  { id: 'b4', label: 'Unlimited Night + 5 GB (7 Days)', amount: 98, cashback: 10, tag: 'Weekly' },
];
