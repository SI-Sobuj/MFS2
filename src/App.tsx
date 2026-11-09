/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Smartphone,
  Zap,
  QrCode,
  PiggyBank,
  ShieldCheck,
  Bell,
  Eye,
  EyeOff,
  Search,
  Lock,
  Fingerprint,
  Sun,
  Moon,
  LogIn,
  LogOut,
  CheckCheck,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  TransactionType,
  UserWallet,
  EncryptedTransaction,
  SavingsGoal,
  NotificationItem,
} from './types/mfs';
import {
  encryptTransactionDetails,
  decryptTransactionDetails,
  hashPin,
  verifyWebAuthnBiometric,
  playNotificationChime,
} from './utils/crypto';
import {
  TransactionModal,
  ExecuteTransactionInput,
} from './components/TransactionModal';
import { CipherInspectorModal } from './components/CipherInspectorModal';
import { SavingsDpsSection } from './components/SavingsDpsSection';

const CASHBACK_BANNER_URL = '/src/assets/images/mfs_cashback_banner_1794245925869.jpg';

type NavSection = 'dashboard' | 'transactions' | 'savings' | 'security';
type TxFilter = 'all' | 'transfers' | 'bills' | 'qr' | 'savings';

function toMillis(val: unknown): number {
  if (!val) return Date.now();
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  if (typeof val === 'number') return val;
  return Date.now();
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Wallet, Encrypted Transactions, Savings Goals, and Real-time Notifications
  const [wallet, setWallet] = useState<UserWallet>({
    uid: 'sandbox_user_01',
    displayName: 'Sobuj Islam',
    accountNumber: '01711-849201',
    balance: 28450,
    savingsBalance: 45000,
    rewardPoints: 640,
    biometricEnabled: true,
    pinHash: '5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5',
    kycTier: 'Premier MFS',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [transactions, setTransactions] = useState<EncryptedTransaction[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // UI Interaction States
  const [balanceRevealed, setBalanceRevealed] = useState(true);
  const [activeModalType, setActiveModalType] = useState<TransactionType | null>(null);
  const [inspectedTx, setInspectedTx] = useState<EncryptedTransaction | null>(null);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [livePushToast, setLivePushToast] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [txFilter, setTxFilter] = useState<TxFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerImgError, setBannerImgError] = useState(false);

  // Security Vault Form States
  const [newPin, setNewPin] = useState('');
  const [pinUpdateStatus, setPinUpdateStatus] = useState<string | null>(null);
  const [bioTestResult, setBioTestResult] = useState<string | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Seed initial encrypted demo data for immediate sandbox readiness
  useEffect(() => {
    let cancelled = false;
    async function seedInitialSandbox() {
      const uid = 'sandbox_user_01';
      const sampleRaw = [
        {
          txId: 'TXN9482019A',
          type: 'qr_payment' as TransactionType,
          title: 'QR Pay — Shwapno Superstore — Gulshan 2',
          counterpartyMasked: 'TAKA***LS2',
          amount: 1450,
          fee: 0,
          cashback: 217.5,
          balanceAfter: 28450,
          authMethod: 'Biometric Passkey' as const,
          createdAtMs: Date.now() - 1000 * 60 * 24,
          details: {
            recipientFull: 'TAKAPAY://MERCHANT/SHWAPNO-GLS2',
            recipientName: 'Shwapno Superstore — Gulshan 2',
            referenceNote: 'Weekly grocery checkout',
            providerOrBank: 'Grocery & Daily Needs',
            meterOrAccountNo: 'POS-GLS2-09',
            biometricSignature: 'FIDO2-88A1F09C44B2',
            receiptVerificationCode: 'RCP-SHW-9482019A',
            timestampIso: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
          },
        },
        {
          txId: 'TXN9481882B',
          type: 'utility_bill' as TransactionType,
          title: 'Pay Bill — DESCO Prepaid Electricity',
          counterpartyMasked: 'Mete***641',
          amount: 1850,
          fee: 0,
          cashback: 92.5,
          balanceAfter: 29682.5,
          authMethod: 'PIN + Biometric' as const,
          createdAtMs: Date.now() - 1000 * 60 * 190,
          details: {
            recipientFull: 'Meter #41098273641',
            recipientName: 'DESCO Prepaid Electricity',
            referenceNote: 'November smart meter token recharge',
            providerOrBank: 'Electricity (ELEC-DESCO-01)',
            meterOrAccountNo: '41098273641',
            biometricSignature: 'BIO-SHA256-39C182D01E',
            receiptVerificationCode: 'DESCO-TOKEN-8849-2210-9941',
            timestampIso: new Date(Date.now() - 1000 * 60 * 190).toISOString(),
          },
        },
        {
          txId: 'TXN9481104C',
          type: 'cash_in' as TransactionType,
          title: 'Add Money (Deposit)',
          counterpartyMasked: 'AC-1***412',
          amount: 10000,
          fee: 0,
          cashback: 50,
          balanceAfter: 31440,
          authMethod: 'Biometric Passkey' as const,
          createdAtMs: Date.now() - 1000 * 60 * 60 * 18,
          details: {
            recipientFull: 'AC-1092837412',
            recipientName: 'City Bank PLC — Citytouch Instant',
            referenceNote: 'Salary transfer top-up',
            providerOrBank: 'City Bank PLC — Citytouch Instant',
            meterOrAccountNo: 'AC-1092837412',
            biometricSignature: 'FIDO2-71E09B3321AA',
            receiptVerificationCode: 'CITY-INST-9481104C',
            timestampIso: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
          },
        },
      ];

      const builtTxs: EncryptedTransaction[] = [];
      for (const item of sampleRaw) {
        const enc = await encryptTransactionDetails(uid, item.details);
        const dec = await decryptTransactionDetails(uid, enc.encryptedPayload, enc.iv);
        builtTxs.push({
          uid,
          txId: item.txId,
          type: item.type,
          title: item.title,
          counterpartyMasked: item.counterpartyMasked,
          amount: item.amount,
          fee: item.fee,
          cashback: item.cashback,
          balanceAfter: item.balanceAfter,
          encryptedPayload: enc.encryptedPayload,
          iv: enc.iv,
          cipherAlg: 'AES-256-GCM',
          authMethod: item.authMethod,
          status: 'completed',
          createdAt: item.createdAtMs,
          createdAtMs: item.createdAtMs,
          decrypted: dec,
        });
      }

      if (cancelled) return;
      setTransactions(builtTxs);
      setSavingsGoals([
        {
          uid,
          goalId: 'goal_mudarabah_01',
          name: 'Islamic Mudarabah Family DPS',
          schemeType: 'Islamic Mudarabah DPS',
          targetAmount: 100000,
          currentAmount: 32500,
          monthlyInstallment: 2500,
          profitRate: 9.25,
          maturityDate: '2027-12-31',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          uid,
          goalId: 'goal_emergency_02',
          name: 'Emergency Medical & Travel Vault',
          schemeType: 'Fixed Term Savings',
          targetAmount: 50000,
          currentAmount: 12500,
          monthlyInstallment: 1500,
          profitRate: 9.75,
          maturityDate: '2027-06-30',
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
      setNotifications([
        {
          uid,
          notifId: 'notif_seed_1',
          title: '৳217.50 Instant QR Cashback Credited',
          body: '15% cashback added for your BanglaQR payment at Shwapno Superstore — Gulshan 2.',
          category: 'cashback',
          read: false,
          createdAt: Date.now() - 1000 * 60 * 24,
          updatedAt: Date.now() - 1000 * 60 * 24,
          createdAtMs: Date.now() - 1000 * 60 * 24,
        },
        {
          uid,
          notifId: 'notif_seed_2',
          title: 'AES-256-GCM Biometric Enclave Active',
          body: 'All transaction histories are encrypted client-side using Web Crypto PBKDF2 + AES-256-GCM.',
          category: 'security',
          read: false,
          createdAt: Date.now() - 1000 * 60 * 120,
          updatedAt: Date.now() - 1000 * 60 * 120,
          createdAtMs: Date.now() - 1000 * 60 * 120,
        },
      ]);
    }

    seedInitialSandbox();
    return () => {
      cancelled = true;
    };
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      setAuthReady(true);
      if (!user) return;

      // Bootstrap user wallet in Firestore if not already created
      const walletRef = doc(db, 'users', user.uid);
      try {
        const snap = await getDoc(walletRef);
        if (!snap.exists()) {
          const defaultPinHash = await hashPin('12345', user.uid);
          const randomSuffix = String(Math.floor(100000 + Math.random() * 900000));
          const initialWallet = {
            uid: user.uid,
            displayName: (user.displayName || 'TakaPay Member').slice(0, 80),
            accountNumber: `01711-${randomSuffix}`,
            balance: 25000,
            savingsBalance: 15000,
            rewardPoints: 500,
            biometricEnabled: true,
            pinHash: defaultPinHash,
            kycTier: 'Premier MFS' as const,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(walletRef, initialWallet);

          // Also create initial DPS goal and welcome notification
          const goalId = 'dps_welcome_01';
          await setDoc(doc(db, 'users', user.uid, 'savingsGoals', goalId), {
            uid: user.uid,
            goalId,
            name: 'Premier Mudarabah DPS',
            schemeType: 'Islamic Mudarabah DPS',
            targetAmount: 100000,
            currentAmount: 15000,
            monthlyInstallment: 2500,
            profitRate: 9.25,
            maturityDate: '2027-12-31',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const notifId = 'notif_welcome_01';
          await setDoc(doc(db, 'users', user.uid, 'notifications', notifId), {
            uid: user.uid,
            notifId,
            title: 'Cloud MFS Wallet Provisioned',
            body: 'Your TakaPay wallet and AES-256-GCM encrypted ledger are now synced with Firestore.',
            category: 'security',
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    });
    return () => unsub();
  }, []);

  // Attach real-time Firestore listeners when authenticated
  useEffect(() => {
    if (!authReady || !fbUser) return;
    const uid = fbUser.uid;

    const unsubWallet = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setWallet(snap.data() as UserWallet);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${uid}`)
    );

    const txQuery = query(
      collection(db, 'users', uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubTxs = onSnapshot(
      txQuery,
      async (snap) => {
        const items: EncryptedTransaction[] = [];
        for (const d of snap.docs) {
          const raw = d.data() as EncryptedTransaction;
          const dec = await decryptTransactionDetails(uid, raw.encryptedPayload, raw.iv);
          items.push({
            ...raw,
            createdAtMs: toMillis(raw.createdAt),
            decrypted: dec,
          });
        }
        setTransactions(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/transactions`)
    );

    const goalsQuery = query(
      collection(db, 'users', uid, 'savingsGoals'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubGoals = onSnapshot(
      goalsQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as SavingsGoal);
        setSavingsGoals(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/savingsGoals`)
    );

    const notifQuery = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const unsubNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as NotificationItem;
          return {
            ...data,
            createdAtMs: toMillis(data.createdAt),
          };
        });
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/notifications`)
    );

    return () => {
      unsubWallet();
      unsubTxs();
      unsubGoals();
      unsubNotifs();
    };
  }, [authReady, fbUser]);

  const triggerPushNotificationBanner = (title: string, body: string) => {
    playNotificationChime('success');
    setLivePushToast({ title, body });
    setTimeout(() => {
      setLivePushToast((prev) => (prev?.title === title ? null : prev));
    }, 5500);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    }
  };

  const handleRequestBrowserPush = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        triggerPushNotificationBanner(
          'Real-Time Browser Push Active',
          'You will receive instant alerts for every MFS transaction and cashback credit.'
        );
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in popup was closed or blocked.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Execute any MFS transaction with AES-256-GCM encryption + atomic wallet & notification update
  const handleExecuteTransaction = async (input: ExecuteTransactionInput) => {
    const uid = fbUser ? fbUser.uid : wallet.uid;
    const txId = `TXN${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    const notifId = `NTF${Date.now().toString(36).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;

    const netDelta =
      input.type === 'cash_in'
        ? input.amount + input.cashback
        : -(input.amount + input.fee) + input.cashback;

    const newBalance = Number((wallet.balance + netDelta).toFixed(2));
    const earnedPoints = Math.max(1, Math.round(input.amount / 50));
    const newRewardPoints = wallet.rewardPoints + earnedPoints;

    const plaintextDetails = {
      recipientFull: input.recipientFull,
      recipientName: input.recipientName,
      referenceNote: input.referenceNote,
      providerOrBank: input.providerOrBank,
      meterOrAccountNo: input.meterOrAccountNo,
      biometricSignature: input.biometricSignature,
      receiptVerificationCode: `RCP-${txId}`,
      timestampIso: new Date().toISOString(),
    };

    const { encryptedPayload, iv } = await encryptTransactionDetails(uid, plaintextDetails);

    const notifTitle = `${input.title} Successful (৳${input.amount.toLocaleString('en-IN')})`;
    const notifBody =
      input.cashback > 0
        ? `TxID ${txId}: Paid ৳${input.amount.toFixed(2)} to ${input.recipientName}. Instant Cashback +৳${input.cashback.toFixed(2)} credited!`
        : `TxID ${txId}: ৳${input.amount.toFixed(2)} settled with ${input.recipientName}. New Balance: ৳${newBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`;

    if (fbUser) {
      const batch = writeBatch(db);
      const walletRef = doc(db, 'users', uid);
      const txRef = doc(db, 'users', uid, 'transactions', txId);
      const notifRef = doc(db, 'users', uid, 'notifications', notifId);

      batch.update(walletRef, {
        balance: newBalance,
        savingsBalance: wallet.savingsBalance,
        rewardPoints: newRewardPoints,
        updatedAt: serverTimestamp(),
      });

      batch.set(txRef, {
        uid,
        txId,
        type: input.type,
        title: input.title.slice(0, 100),
        counterpartyMasked: input.counterpartyMasked.slice(0, 80),
        amount: input.amount,
        fee: input.fee,
        cashback: input.cashback,
        balanceAfter: newBalance,
        encryptedPayload,
        iv,
        cipherAlg: 'AES-256-GCM',
        authMethod: input.authMethod,
        status: 'completed',
        createdAt: serverTimestamp(),
      });

      batch.set(notifRef, {
        uid,
        notifId,
        title: notifTitle.slice(0, 100),
        body: notifBody.slice(0, 280),
        category: input.cashback > 0 ? 'cashback' : 'transaction',
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/transactions/${txId}`);
      }
    } else {
      // Update instant sandbox state
      const nowMs = Date.now();
      setWallet((prev) => ({
        ...prev,
        balance: newBalance,
        rewardPoints: newRewardPoints,
        updatedAt: nowMs,
      }));
      setTransactions((prev) => [
        {
          uid,
          txId,
          type: input.type,
          title: input.title,
          counterpartyMasked: input.counterpartyMasked,
          amount: input.amount,
          fee: input.fee,
          cashback: input.cashback,
          balanceAfter: newBalance,
          encryptedPayload,
          iv,
          cipherAlg: 'AES-256-GCM',
          authMethod: input.authMethod,
          status: 'completed',
          createdAt: nowMs,
          createdAtMs: nowMs,
          decrypted: plaintextDetails,
        },
        ...prev,
      ]);
      setNotifications((prev) => [
        {
          uid,
          notifId,
          title: notifTitle,
          body: notifBody,
          category: input.cashback > 0 ? 'cashback' : 'transaction',
          read: false,
          createdAt: nowMs,
          updatedAt: nowMs,
          createdAtMs: nowMs,
        },
        ...prev,
      ]);
    }

    triggerPushNotificationBanner(notifTitle, notifBody);
  };

  // Create new DPS / Savings Goal
  const handleCreateSavingsGoal = async (input: {
    name: string;
    schemeType: 'Islamic Mudarabah DPS' | 'Fixed Term Savings' | 'Micro Vault';
    targetAmount: number;
    monthlyInstallment: number;
    profitRate: number;
    maturityDate: string;
    initialDeposit: number;
  }) => {
    const uid = fbUser ? fbUser.uid : wallet.uid;
    const goalId = `DPS${Date.now().toString(36).toUpperCase()}`;
    const txId = `TXN${Date.now().toString(36).toUpperCase()}S`;
    const notifId = `NTF${Date.now().toString(36).toUpperCase()}S`;

    const newLiquidBalance = Number((wallet.balance - input.initialDeposit).toFixed(2));
    const newSavingsBalance = Number((wallet.savingsBalance + input.initialDeposit).toFixed(2));
    const newPoints = wallet.rewardPoints + 25;

    const details = {
      recipientFull: goalId,
      recipientName: input.name,
      referenceNote: `Opened ${input.schemeType} (${input.profitRate}% p.a.)`,
      providerOrBank: input.schemeType,
      meterOrAccountNo: goalId,
      biometricSignature: 'FIDO2-DPS-ENCLAVE',
      receiptVerificationCode: `DPS-${txId}`,
      timestampIso: new Date().toISOString(),
    };
    const { encryptedPayload, iv } = await encryptTransactionDetails(uid, details);

    if (fbUser) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', uid), {
        balance: newLiquidBalance,
        savingsBalance: newSavingsBalance,
        rewardPoints: newPoints,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', uid, 'savingsGoals', goalId), {
        uid,
        goalId,
        name: input.name.slice(0, 80),
        schemeType: input.schemeType,
        targetAmount: input.targetAmount,
        currentAmount: input.initialDeposit,
        monthlyInstallment: input.monthlyInstallment,
        profitRate: input.profitRate,
        maturityDate: input.maturityDate.slice(0, 32),
        status: input.initialDeposit >= input.targetAmount ? 'completed' : 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (input.initialDeposit > 0) {
        batch.set(doc(db, 'users', uid, 'transactions', txId), {
          uid,
          txId,
          type: 'savings_deposit',
          title: `DPS Opening — ${input.name}`.slice(0, 100),
          counterpartyMasked: goalId,
          amount: input.initialDeposit,
          fee: 0,
          cashback: 0,
          balanceAfter: newLiquidBalance,
          encryptedPayload,
          iv,
          cipherAlg: 'AES-256-GCM',
          authMethod: 'Biometric Passkey',
          status: 'completed',
          createdAt: serverTimestamp(),
        });
      }
      batch.set(doc(db, 'users', uid, 'notifications', notifId), {
        uid,
        notifId,
        title: `New ${input.schemeType} Activated`,
        body: `${input.name} opened with ৳${input.initialDeposit.toLocaleString('en-IN')} initial deposit at ${input.profitRate}% annual profit.`,
        category: 'savings',
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/savingsGoals/${goalId}`);
      }
    } else {
      const nowMs = Date.now();
      setWallet((prev) => ({
        ...prev,
        balance: newLiquidBalance,
        savingsBalance: newSavingsBalance,
        rewardPoints: newPoints,
      }));
      setSavingsGoals((prev) => [
        {
          uid,
          goalId,
          name: input.name,
          schemeType: input.schemeType,
          targetAmount: input.targetAmount,
          currentAmount: input.initialDeposit,
          monthlyInstallment: input.monthlyInstallment,
          profitRate: input.profitRate,
          maturityDate: input.maturityDate,
          status: input.initialDeposit >= input.targetAmount ? 'completed' : 'active',
          createdAt: nowMs,
          updatedAt: nowMs,
        },
        ...prev,
      ]);
      if (input.initialDeposit > 0) {
        setTransactions((prev) => [
          {
            uid,
            txId,
            type: 'savings_deposit',
            title: `DPS Opening — ${input.name}`,
            counterpartyMasked: goalId,
            amount: input.initialDeposit,
            fee: 0,
            cashback: 0,
            balanceAfter: newLiquidBalance,
            encryptedPayload,
            iv,
            cipherAlg: 'AES-256-GCM',
            authMethod: 'Biometric Passkey',
            status: 'completed',
            createdAt: nowMs,
            createdAtMs: nowMs,
            decrypted: details,
          },
          ...prev,
        ]);
      }
    }

    triggerPushNotificationBanner(
      `New ${input.schemeType} Activated`,
      `${input.name} opened with ৳${input.initialDeposit.toLocaleString('en-IN')} initial deposit.`
    );
  };

  // Deposit or Withdraw from an existing Savings Goal in real-time
  const handleMutateSavingsGoal = async (
    goal: SavingsGoal,
    amount: number,
    direction: 'deposit' | 'withdraw'
  ) => {
    const uid = fbUser ? fbUser.uid : wallet.uid;
    const txId = `TXN${Date.now().toString(36).toUpperCase()}G`;
    const notifId = `NTF${Date.now().toString(36).toUpperCase()}G`;

    const newGoalCurrent =
      direction === 'deposit'
        ? Number((goal.currentAmount + amount).toFixed(2))
        : Number((goal.currentAmount - amount).toFixed(2));
    const newLiquid =
      direction === 'deposit'
        ? Number((wallet.balance - amount).toFixed(2))
        : Number((wallet.balance + amount).toFixed(2));
    const newTotalSavings =
      direction === 'deposit'
        ? Number((wallet.savingsBalance + amount).toFixed(2))
        : Number((wallet.savingsBalance - amount).toFixed(2));
    const newGoalStatus: 'active' | 'completed' =
      newGoalCurrent >= goal.targetAmount ? 'completed' : 'active';

    const txType: TransactionType =
      direction === 'deposit' ? 'savings_deposit' : 'savings_withdraw';
    const txTitle =
      direction === 'deposit'
        ? `DPS Installment — ${goal.name}`
        : `Savings Encashment — ${goal.name}`;

    const details = {
      recipientFull: goal.goalId,
      recipientName: goal.name,
      referenceNote:
        direction === 'deposit'
          ? 'Real-time DPS installment transfer'
          : 'Instant liquidity withdrawal to MFS wallet',
      providerOrBank: goal.schemeType,
      meterOrAccountNo: goal.goalId,
      biometricSignature: 'FIDO2-SAVINGS-SYNC',
      receiptVerificationCode: `SAV-${txId}`,
      timestampIso: new Date().toISOString(),
    };
    const { encryptedPayload, iv } = await encryptTransactionDetails(uid, details);

    if (fbUser) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', uid), {
        balance: newLiquid,
        savingsBalance: newTotalSavings,
        rewardPoints: wallet.rewardPoints + 10,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', uid, 'savingsGoals', goal.goalId), {
        currentAmount: newGoalCurrent,
        status: newGoalStatus,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', uid, 'transactions', txId), {
        uid,
        txId,
        type: txType,
        title: txTitle.slice(0, 100),
        counterpartyMasked: goal.goalId,
        amount,
        fee: 0,
        cashback: 0,
        balanceAfter: newLiquid,
        encryptedPayload,
        iv,
        cipherAlg: 'AES-256-GCM',
        authMethod: 'Biometric Passkey',
        status: 'completed',
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', uid, 'notifications', notifId), {
        uid,
        notifId,
        title: txTitle.slice(0, 100),
        body: `৳${amount.toLocaleString('en-IN')} ${
          direction === 'deposit' ? 'added to' : 'withdrawn from'
        } ${goal.name}. Updated Goal Balance: ৳${newGoalCurrent.toLocaleString('en-IN')}.`,
        category: 'savings',
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `users/${uid}/savingsGoals/${goal.goalId}`
        );
      }
    } else {
      const nowMs = Date.now();
      setWallet((prev) => ({
        ...prev,
        balance: newLiquid,
        savingsBalance: newTotalSavings,
        rewardPoints: prev.rewardPoints + 10,
      }));
      setSavingsGoals((prev) =>
        prev.map((g) =>
          g.goalId === goal.goalId
            ? { ...g, currentAmount: newGoalCurrent, status: newGoalStatus, updatedAt: nowMs }
            : g
        )
      );
      setTransactions((prev) => [
        {
          uid,
          txId,
          type: txType,
          title: txTitle,
          counterpartyMasked: goal.goalId,
          amount,
          fee: 0,
          cashback: 0,
          balanceAfter: newLiquid,
          encryptedPayload,
          iv,
          cipherAlg: 'AES-256-GCM',
          authMethod: 'Biometric Passkey',
          status: 'completed',
          createdAt: nowMs,
          createdAtMs: nowMs,
          decrypted: details,
        },
        ...prev,
      ]);
    }

    triggerPushNotificationBanner(
      txTitle,
      `৳${amount.toLocaleString('en-IN')} ${
        direction === 'deposit' ? 'deposited into' : 'withdrawn from'
      } ${goal.name}.`
    );
  };

  const handleMarkNotificationRead = async (notif: NotificationItem) => {
    if (notif.read) return;
    if (fbUser) {
      try {
        await updateDoc(doc(db, 'users', fbUser.uid, 'notifications', notif.notifId), {
          read: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `users/${fbUser.uid}/notifications/${notif.notifId}`
        );
      }
    } else {
      setNotifications((prev) =>
        prev.map((n) => (n.notifId === notif.notifId ? { ...n, read: true } : n))
      );
    }
  };

  const handleUpdateSecuritySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinUpdateStatus(null);
    if (newPin.trim().length !== 5 || !/^\d{5}$/.test(newPin.trim())) {
      setPinUpdateStatus('Please enter an exact 5-digit numeric MFS PIN.');
      return;
    }
    const uid = fbUser ? fbUser.uid : wallet.uid;
    const hashed = await hashPin(newPin.trim(), uid);

    if (fbUser) {
      try {
        await updateDoc(doc(db, 'users', uid), {
          displayName: wallet.displayName,
          biometricEnabled: wallet.biometricEnabled,
          pinHash: hashed,
          kycTier: wallet.kycTier,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
      }
    } else {
      setWallet((prev) => ({ ...prev, pinHash: hashed }));
    }
    setNewPin('');
    setPinUpdateStatus('SHA-256 PIN hash updated and synced to your wallet security profile.');
  };

  const handleToggleBiometric = async () => {
    const nextVal = !wallet.biometricEnabled;
    const uid = fbUser ? fbUser.uid : wallet.uid;
    if (fbUser) {
      try {
        await updateDoc(doc(db, 'users', uid), {
          displayName: wallet.displayName,
          biometricEnabled: nextVal,
          pinHash: wallet.pinHash,
          kycTier: wallet.kycTier,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
      }
    } else {
      setWallet((prev) => ({ ...prev, biometricEnabled: nextVal }));
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (txFilter === 'transfers' && !['send_money', 'cash_in', 'cash_out'].includes(tx.type)) {
        return false;
      }
      if (txFilter === 'bills' && !['mobile_recharge', 'utility_bill'].includes(tx.type)) {
        return false;
      }
      if (txFilter === 'qr' && tx.type !== 'qr_payment') {
        return false;
      }
      if (txFilter === 'savings' && !['savings_deposit', 'savings_withdraw'].includes(tx.type)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = tx.title.toLowerCase().includes(q);
        const matchId = tx.txId.toLowerCase().includes(q);
        const matchRecip = tx.decrypted?.recipientName?.toLowerCase().includes(q);
        const matchNote = tx.decrypted?.referenceNote?.toLowerCase().includes(q);
        return matchTitle || matchId || matchRecip || matchNote;
      }
      return true;
    });
  }, [transactions, txFilter, searchQuery]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12 transition-colors">
      {/* Real-time Push Notification Toast */}
      {livePushToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 right-4 z-50 max-w-sm w-full bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 rounded-2xl p-4 shadow-xl animate-in fade-in slide-in-from-top-4 duration-150"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-bold text-rose-400">
                Real-Time MFS Push Alert
              </div>
              <div className="text-sm font-semibold">{livePushToast.title}</div>
              <div className="text-xs text-slate-300 leading-relaxed">{livePushToast.body}</div>
            </div>
            <button
              type="button"
              onClick={() => setLivePushToast(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TOP BAR CONTRACT: Strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 h-14">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveNav('dashboard');
            }}
            className="text-xl font-bold font-display tracking-tight text-rose-600 dark:text-rose-500 whitespace-nowrap shrink-0"
          >
            TakaPay
          </a>

          {/* Zone 2: 4 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-400">
            {(
              [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'transactions', label: 'Transactions' },
                { id: 'savings', label: 'Savings DPS' },
                { id: 'security', label: 'Security Vault' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeNav === item.id
                    ? 'border-rose-600 text-slate-900 dark:text-slate-100'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveModalType('send_money')}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Send Money
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (Full 1440px Desktop Responsive Presence + Mobile Ergonomics) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Contextual Workspace & Wallet Hero Bar */}
        <section className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Left: Account Identity & Signature bKash/Nagad Tap-for-Balance Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white font-display font-bold text-lg flex items-center justify-center shrink-0">
                {wallet.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                    {wallet.displayName}
                  </h1>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    · {wallet.accountNumber} · {wallet.kycTier}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {fbUser
                    ? `Firebase Cloud Sync Active (${fbUser.email})`
                    : 'Interactive Sandbox Wallet · Sign in with Google to sync across devices'}
                </div>
              </div>
            </div>

            {/* Right: Tap-to-Reveal Balance + Utility Controls */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3">
              {/* Tap for Balance Interactive Button */}
              <button
                type="button"
                onClick={() => setBalanceRevealed((v) => !v)}
                className="min-h-[48px] px-4 py-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 transition-all hover:border-rose-400"
                aria-label="Toggle balance visibility"
              >
                <div className="text-left">
                  <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                    Liquid MFS Balance
                  </div>
                  <div className="text-lg sm:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {balanceRevealed
                      ? `৳${wallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      : 'Tap for Balance'}
                  </div>
                </div>
                {balanceRevealed ? (
                  <EyeOff className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                ) : (
                  <Eye className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
              </button>

              {/* Notification Bell Trigger */}
              <button
                type="button"
                onClick={() => setShowNotifDrawer((v) => !v)}
                className="relative min-h-[48px] min-w-[48px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                aria-label="Open real-time notifications"
              >
                <Bell className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Theme Switcher */}
              <button
                type="button"
                onClick={() => setDarkMode((v) => !v)}
                className="min-h-[48px] min-w-[48px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                aria-label="Toggle dark or light theme"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-amber-400" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-700" />
                )}
              </button>

              {/* Cloud Auth Button */}
              {fbUser ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[48px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="min-h-[48px] px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold flex items-center gap-2 transition-opacity whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-4 h-4" />
                  Sync with Google
                </button>
              )}
            </div>
          </div>

          {authError && (
            <div className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              Note: {authError} (Continuing in encrypted local sandbox mode.)
            </div>
          )}

          {/* Secondary Metric Strip (Savings Balance, Cashback Points, Biometric Status) */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Real-Time DPS & Savings
              </div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {balanceRevealed
                  ? `৳${wallet.savingsBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : '৳ ••••••'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total Net MFS Wealth
              </div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {balanceRevealed
                  ? `৳${(wallet.balance + wallet.savingsBalance).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}`
                  : '৳ ••••••'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                TakaPay Reward Points
              </div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                {wallet.rewardPoints.toLocaleString('en-IN')} pts
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Ledger Security
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>AES-256-GCM · {wallet.biometricEnabled ? 'Biometric On' : 'PIN Only'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Slide-down Real-time Notification Drawer */}
        {showNotifDrawer && (
          <section className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Real-Time Push Notification Center
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live Firestore snapshot alerts for incoming transfers, bill tokens, and cashback rewards
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRequestBrowserPush}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Enable Desktop Push
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotifDrawer(false)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  No notifications yet. Complete a transaction to trigger a live push alert.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.notifId}
                    onClick={() => handleMarkNotificationRead(n)}
                    className={`py-3 px-2 flex items-start justify-between gap-4 cursor-pointer rounded-xl transition-colors ${
                      n.read
                        ? 'opacity-70'
                        : 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/80'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {n.title}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{n.body}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-mono tabular-nums text-slate-400">
                        {n.createdAtMs
                          ? new Date(n.createdAtMs).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Now'}
                      </div>
                      {!n.read && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          <CheckCheck className="w-3 h-3" /> Mark read
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* VIEW ROUTING */}
        {activeNav === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Columns: MFS Service Matrix + Promotional Cashback Banner + Quick DPS Preview */}
            <div className="lg:col-span-7 space-y-6">
              {/* 8-Tile MFS Core Service Matrix (bKash / Nagad / Rocket inspired) */}
              <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    MFS Financial Services
                  </h2>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Biometric + PIN Protected
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5">
                  {[
                    {
                      label: 'Send Money',
                      sub: 'Free Priyo',
                      icon: Send,
                      color: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
                      action: () => setActiveModalType('send_money'),
                    },
                    {
                      label: 'Add Money',
                      sub: 'Bank / Card',
                      icon: ArrowDownLeft,
                      color:
                        'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
                      action: () => setActiveModalType('cash_in'),
                    },
                    {
                      label: 'Cash Out',
                      sub: '1.49% Agent',
                      icon: ArrowUpRight,
                      color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
                      action: () => setActiveModalType('cash_out'),
                    },
                    {
                      label: 'Recharge',
                      sub: 'All Telcos',
                      icon: Smartphone,
                      color: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400',
                      action: () => setActiveModalType('mobile_recharge'),
                    },
                    {
                      label: 'Pay Bill',
                      sub: 'DESCO · Gas',
                      icon: Zap,
                      color:
                        'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
                      action: () => setActiveModalType('utility_bill'),
                    },
                    {
                      label: 'Scan QR Pay',
                      sub: 'Up to 15% Back',
                      icon: QrCode,
                      color: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
                      action: () => setActiveModalType('qr_payment'),
                    },
                    {
                      label: 'Savings DPS',
                      sub: '9.75% Yield',
                      icon: PiggyBank,
                      color:
                        'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
                      action: () => setActiveNav('savings'),
                    },
                    {
                      label: 'Cipher Vault',
                      sub: 'AES-256-GCM',
                      icon: ShieldCheck,
                      color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
                      action: () => setActiveNav('security'),
                    },
                  ].map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.action}
                        className="min-h-[88px] p-2.5 sm:p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 flex flex-col items-center justify-center text-center transition-all active:scale-[0.98]"
                      >
                        <div
                          className={`w-11 h-11 rounded-2xl ${item.color} flex items-center justify-center mb-2`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:inline">
                          {item.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Promotional Merchant QR Cashback Spotlight */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[210px] bg-slate-900">
                {!bannerImgError ? (
                  <img
                    src={CASHBACK_BANNER_URL}
                    alt="Contactless BanglaQR retail payment"
                    referrerPolicy="no-referrer"
                    onError={() => setBannerImgError(true)}
                    className="w-full h-56 object-cover"
                  />
                ) : (
                  <div className="w-full h-56 bg-gradient-to-r from-rose-900 via-slate-900 to-emerald-950" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-6 flex flex-col justify-end">
                  <div className="max-w-lg space-y-2">
                    <div className="text-xs font-semibold text-rose-300">
                      BanglaQR Retail & Utility Cashback Campaign · November 2026
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      Instant 15% Cashback at Shwapno, Aarong & North End Coffee
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveModalType('qr_payment')}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                      >
                        Scan Merchant QR Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveModalType('utility_bill')}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-xs text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                      >
                        Pay DESCO / Titas Bill
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-Time Savings DPS Snapshot on Dashboard */}
              <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Real-Time Savings & DPS Pods
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Automated profit accrual up to 9.75% p.a.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('savings')}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0"
                  >
                    Manage All Vaults →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {savingsGoals.slice(0, 2).map((g) => {
                    const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
                    return (
                      <div
                        key={g.goalId}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {g.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {g.schemeType} · {g.profitRate}% p.a.
                            </div>
                          </div>
                          <span className="text-xs font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            {pct}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            ৳{g.currentAmount.toLocaleString('en-IN')}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            Target ৳{g.targetAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 5 Columns: Live AES-256-GCM Encrypted Transaction Ledger */}
            <div className="lg:col-span-5 p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Encrypted Transaction History
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click any entry to verify AES-256-GCM ciphertext & receipt
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNav('transactions')}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap shrink-0"
                >
                  Full Ledger
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'transfers', label: 'Transfers' },
                    { id: 'bills', label: 'Bills' },
                    { id: 'qr', label: 'QR Pay' },
                    { id: 'savings', label: 'Savings' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTxFilter(tab.id)}
                    className={`flex-1 min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      txFilter === tab.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Transaction Tap Rows */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.slice(0, 6).map((tx) => {
                  const isCredit =
                    tx.type === 'cash_in' || tx.type === 'savings_withdraw';
                  return (
                    <button
                      key={tx.txId}
                      type="button"
                      onClick={() => setInspectedTx(tx)}
                      className="w-full min-h-[64px] py-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between gap-3 text-left transition-colors rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isCredit
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {tx.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {tx.decrypted?.recipientName || tx.counterpartyMasked} · {tx.cipherAlg}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div
                          className={`text-xs font-bold ${
                            isCredit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {isCredit ? '+' : '-'}৳{tx.amount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tx.cashback > 0 ? `+৳${tx.cashback} Back` : tx.txId.slice(0, 10)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* FULL ENCRYPTED TRANSACTIONS VIEW */}
        {activeNav === 'transactions' && (
          <section className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Immutable Encrypted Transaction Ledger
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Every record is encrypted with Web Crypto AES-256-GCM before storage. Select any row to inspect raw ciphertext or download receipt.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search TxID, recipient, memo..."
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-xl">
              {(
                [
                  { id: 'all', label: 'All Entries' },
                  { id: 'transfers', label: 'Transfers' },
                  { id: 'bills', label: 'Utility & Recharge' },
                  { id: 'qr', label: 'QR Payments' },
                  { id: 'savings', label: 'Savings DPS' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTxFilter(tab.id)}
                  className={`flex-1 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    txFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-3">Transaction & Reference</th>
                    <th className="py-3 px-3">Decrypted Counterparty & Memo</th>
                    <th className="py-3 px-3">Cipher & Auth</th>
                    <th className="py-3 px-3 text-right">Amount & Fee</th>
                    <th className="py-3 px-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredTransactions.map((tx) => {
                    const isCredit =
                      tx.type === 'cash_in' || tx.type === 'savings_withdraw';
                    return (
                      <tr
                        key={tx.txId}
                        onClick={() => setInspectedTx(tx)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {tx.title}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500">
                            {tx.txId}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {tx.decrypted?.recipientName || tx.counterpartyMasked}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {tx.decrypted?.referenceNote || 'Encrypted MFS Settlement'}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                            {tx.cipherAlg}
                          </div>
                          <div className="text-[11px] text-slate-500">{tx.authMethod}</div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                          <div
                            className={`font-bold ${
                              isCredit
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {isCredit ? '+' : '-'}৳
                            {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Fee: ৳{tx.fee.toFixed(2)}
                            {tx.cashback > 0 ? ` · +৳${tx.cashback} Back` : ''}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                          ৳{tx.balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* REAL-TIME SAVINGS & DPS VIEW */}
        {activeNav === 'savings' && (
          <SavingsDpsSection
            wallet={wallet}
            goals={savingsGoals}
            onCreateGoal={handleCreateSavingsGoal}
            onMutateGoalBalance={handleMutateSavingsGoal}
          />
        )}

        {/* SECURITY & BIOMETRIC VAULT VIEW */}
        {activeNav === 'security' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Biometric Passkey & SHA-256 PIN Configuration
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage WebAuthn hardware passkeys and your 5-digit MFS transaction PIN.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Require Biometric Verification for All Outgoing Transfers
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enforces TouchID, FaceID, or FIDO2 security passkey signature before AES-256-GCM encryption.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleBiometric}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                    wallet.biometricEnabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {wallet.biometricEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Test Live Hardware Biometric Enclave
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Generate a verifiable cryptographic passkey challenge signature now.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await verifyWebAuthnBiometric(wallet.accountNumber);
                      setBioTestResult(
                        `Verified (${res.mode}) · Signature Hash: ${res.signatureHash}`
                      );
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Fingerprint className="w-4 h-4" />
                    Verify Passkey Now
                  </button>
                </div>
                {bioTestResult && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-mono">
                    {bioTestResult}
                  </div>
                )}
              </div>

              <form onSubmit={handleUpdateSecuritySettings} className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Rotate 5-Digit MFS PIN (Stored as SHA-256 Digest)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="password"
                    maxLength={5}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="Enter new 5-digit PIN"
                    className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    Update PIN Hash
                  </button>
                </div>
                {pinUpdateStatus && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {pinUpdateStatus}
                  </p>
                )}
              </form>
            </div>

            <div className="lg:col-span-5 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Zero-Trust Cryptographic Specification
              </h3>
              <div className="space-y-3 text-xs">
                <div className="py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500">Ledger Cipher Algorithm</span>
                  <span className="font-mono font-semibold">Web Crypto AES-256-GCM</span>
                </div>
                <div className="py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500">Key Derivation Function</span>
                  <span className="font-mono font-semibold">PBKDF2-HMAC-SHA256 (50k iter)</span>
                </div>
                <div className="py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-500">PIN Digest Hash</span>
                  <span className="font-mono truncate max-w-[180px]">{wallet.pinHash}</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500">Firestore Ledger Mutability</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    Append-Only (Immutable)
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* MOBILE BOTTOM TAB BAR (Navigation Anchor — Obeys 15% Mobile Sticky Cap & 44px Hitboxes) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center h-16"
      >
        {(
          [
            { id: 'dashboard', label: 'Home', icon: Sparkles },
            { id: 'transactions', label: 'History', icon: FileText },
            { id: 'savings', label: 'Savings', icon: PiggyBank },
            { id: 'security', label: 'Security', icon: ShieldCheck },
          ] as const
        ).map((tab) => {
          const IconComp = tab.icon;
          const active = activeNav === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveNav(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
                active
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <IconComp className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-1">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <TransactionModal
        activeType={activeModalType}
        wallet={wallet}
        onClose={() => setActiveModalType(null)}
        onExecute={handleExecuteTransaction}
      />

      <CipherInspectorModal
        transaction={inspectedTx}
        onClose={() => setInspectedTx(null)}
      />
    </div>
  );
}
