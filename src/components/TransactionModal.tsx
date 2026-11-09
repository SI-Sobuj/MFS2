import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Fingerprint,
  ShieldCheck,
  QrCode,
  ScanLine,
  Building2,
  Smartphone,
  Zap,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  TransactionType,
  QUICK_CONTACTS,
  UTILITY_BILLERS,
  QR_MERCHANTS,
  MOBILE_OPERATORS,
  RECHARGE_BUNDLES,
  UserWallet,
} from '../types/mfs';
import { QrCodeMatrix } from './QrCodeMatrix';
import { verifyWebAuthnBiometric } from '../utils/crypto';

export interface ExecuteTransactionInput {
  type: TransactionType;
  title: string;
  recipientFull: string;
  recipientName: string;
  counterpartyMasked: string;
  amount: number;
  fee: number;
  cashback: number;
  referenceNote: string;
  providerOrBank?: string;
  meterOrAccountNo?: string;
  authMethod: 'Biometric Passkey' | 'PIN + Biometric';
  biometricSignature: string;
}

interface TransactionModalProps {
  activeType: TransactionType | null;
  wallet: UserWallet;
  onClose: () => void;
  onExecute: (input: ExecuteTransactionInput) => Promise<void>;
}

const AGENT_AVATAR_URL = '/src/assets/images/avatar_verified_agent_1794245926596.jpg';

function maskIdentifier(raw: string): string {
  const clean = raw.trim();
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 4)}***${clean.slice(-3)}`;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  activeType,
  wallet,
  onClose,
  onExecute,
}) => {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [recipientNumber, setRecipientNumber] = useState('01711-938412');
  const [recipientName, setRecipientName] = useState('Tanvir Ahmed');
  const [isPriyoSelected, setIsPriyoSelected] = useState(true);
  const [amountStr, setAmountStr] = useState('500');
  const [referenceNote, setReferenceNote] = useState('Monthly family transfer');
  const [selectedBank, setSelectedBank] = useState('City Bank PLC — Citytouch Instant');
  const [selectedOperator, setSelectedOperator] = useState(MOBILE_OPERATORS[0].name);
  const [connectionType, setConnectionType] = useState<'Prepaid' | 'Postpaid'>('Prepaid');
  const [selectedBiller, setSelectedBiller] = useState(UTILITY_BILLERS[0]);
  const [meterNumber, setMeterNumber] = useState(UTILITY_BILLERS[0].sampleMeter);
  const [billMonth, setBillMonth] = useState('November 2026');
  const [qrTab, setQrTab] = useState<'scan' | 'my_qr'>('scan');
  const [selectedMerchant, setSelectedMerchant] = useState(QR_MERCHANTS[0]);
  const [pin, setPin] = useState('12345');
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [biometricSig, setBiometricSig] = useState('');
  const [holdProgress, setHoldProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [agentImgError, setAgentImgError] = useState(false);

  const holdTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setStep('form');
    setErrorMsg(null);
    setBiometricVerified(false);
    setBiometricSig('');
    setHoldProgress(0);

    if (activeType === 'send_money') {
      setRecipientNumber(QUICK_CONTACTS[0].number);
      setRecipientName(QUICK_CONTACTS[0].name);
      setIsPriyoSelected(true);
      setAmountStr('1000');
      setReferenceNote('Family support');
    } else if (activeType === 'cash_in') {
      setRecipientNumber('AC-1092837412');
      setRecipientName('City Bank PLC — Citytouch');
      setAmountStr('5000');
      setReferenceNote('Instant Wallet Top-Up');
    } else if (activeType === 'cash_out') {
      setRecipientNumber('01788-112233');
      setRecipientName('M/S Mayer Doa Telecom (Priyo Agent)');
      setAmountStr('2000');
      setReferenceNote('Agent Cash Withdrawal');
    } else if (activeType === 'mobile_recharge') {
      setRecipientNumber('01711-849201');
      setRecipientName('Grameenphone Prepaid');
      setAmountStr('499');
      setReferenceNote('30 GB + 500 Min Combo');
    } else if (activeType === 'utility_bill') {
      setSelectedBiller(UTILITY_BILLERS[0]);
      setMeterNumber(UTILITY_BILLERS[0].sampleMeter);
      setAmountStr('1850');
      setReferenceNote('Electricity Bill Settlement');
    } else if (activeType === 'qr_payment') {
      setSelectedMerchant(QR_MERCHANTS[0]);
      setAmountStr(String(QR_MERCHANTS[0].suggestedAmount));
      setReferenceNote('In-store QR Checkout');
    }
  }, [activeType]);

  if (!activeType) return null;

  const amount = Math.max(0, Number(amountStr) || 0);

  // Calculate realistic MFS fee and cashback
  let fee = 0;
  let cashback = 0;
  let title = 'MFS Transaction';
  let finalRecipientName = recipientName;
  let finalRecipientFull = recipientNumber;
  let providerOrBank = '';

  if (activeType === 'send_money') {
    title = 'Send Money';
    fee = isPriyoSelected ? 0 : amount > 500 ? 5 : 0;
    cashback = 0;
    providerOrBank = isPriyoSelected ? 'Priyo P2P Network (Zero Fee)' : 'Standard P2P Transfer';
  } else if (activeType === 'cash_in') {
    title = 'Add Money (Deposit)';
    fee = 0;
    cashback = amount >= 5000 ? 50 : 0;
    finalRecipientName = selectedBank;
    finalRecipientFull = recipientNumber;
    providerOrBank = selectedBank;
  } else if (activeType === 'cash_out') {
    title = 'Agent Cash Out';
    fee = Number((amount * 0.0149).toFixed(2)); // 1.49% Priyo Agent rate
    cashback = 0;
    providerOrBank = 'Priyo Agent Network (1.49%)';
  } else if (activeType === 'mobile_recharge') {
    title = `Mobile Recharge (${selectedOperator})`;
    fee = 0;
    const matchedBundle = RECHARGE_BUNDLES.find((b) => b.amount === amount);
    cashback = matchedBundle ? matchedBundle.cashback : Number((amount * 0.02).toFixed(2));
    finalRecipientName = `${selectedOperator} ${connectionType}`;
    providerOrBank = `${selectedOperator} (${connectionType})`;
  } else if (activeType === 'utility_bill') {
    title = `Pay Bill — ${selectedBiller.name}`;
    fee = 0;
    cashback = Math.min(150, Number(((amount * selectedBiller.cashbackPct) / 100).toFixed(2)));
    finalRecipientName = selectedBiller.name;
    finalRecipientFull = `Meter #${meterNumber}`;
    providerOrBank = `${selectedBiller.category} (${selectedBiller.billerCode})`;
  } else if (activeType === 'qr_payment') {
    title = `QR Pay — ${selectedMerchant.name}`;
    fee = 0;
    cashback = Math.min(300, Number(((amount * selectedMerchant.cashbackPct) / 100).toFixed(2)));
    finalRecipientName = selectedMerchant.name;
    finalRecipientFull = selectedMerchant.qrCodeId;
    providerOrBank = selectedMerchant.category;
  }

  const netWalletChange =
    activeType === 'cash_in' ? amount + cashback : -(amount + fee) + cashback;
  const projectedBalance = Number((wallet.balance + netWalletChange).toFixed(2));

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (amount < 10 || amount > 500000) {
      setErrorMsg('Enter an amount between ৳10 and ৳500,000.');
      return;
    }
    if (activeType !== 'cash_in' && projectedBalance < 0) {
      setErrorMsg(
        `Insufficient wallet balance. Required: ৳${(amount + fee).toFixed(2)}, Available: ৳${wallet.balance.toFixed(2)}`
      );
      return;
    }
    setStep('confirm');
  };

  const handleBiometricVerify = async () => {
    setErrorMsg(null);
    const res = await verifyWebAuthnBiometric(wallet.accountNumber);
    if (res.verified) {
      setBiometricVerified(true);
      setBiometricSig(res.signatureHash);
    }
  };

  const triggerFinalExecution = async () => {
    if (submitting) return;
    if (pin.trim().length < 4 && !biometricVerified) {
      setErrorMsg('Please enter your 5-digit MFS PIN or verify with Biometric Passkey.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      let sig = biometricSig;
      if (!sig) {
        const res = await verifyWebAuthnBiometric(wallet.accountNumber);
        sig = res.signatureHash;
      }
      await onExecute({
        type: activeType,
        title,
        recipientFull: finalRecipientFull,
        recipientName: finalRecipientName,
        counterpartyMasked: maskIdentifier(finalRecipientFull),
        amount,
        fee,
        cashback,
        referenceNote: referenceNote.trim() || title,
        providerOrBank,
        meterOrAccountNo: activeType === 'utility_bill' ? meterNumber : finalRecipientFull,
        authMethod: biometricVerified ? 'Biometric Passkey' : 'PIN + Biometric',
        biometricSignature: sig,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed. Please try again.');
      setSubmitting(false);
      setHoldProgress(0);
    }
  };

  const startHold = () => {
    if (submitting) return;
    if (holdTimerRef.current) window.clearInterval(holdTimerRef.current);
    let current = 0;
    holdTimerRef.current = window.setInterval(() => {
      current += 10;
      setHoldProgress(Math.min(100, current));
      if (current >= 100) {
        if (holdTimerRef.current) window.clearInterval(holdTimerRef.current);
        triggerFinalExecution();
      }
    }, 55);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!submitting && holdProgress < 100) {
      setHoldProgress(0);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              {activeType === 'send_money' && <Send className="w-5 h-5" />}
              {activeType === 'cash_in' && <ArrowDownLeft className="w-5 h-5" />}
              {activeType === 'cash_out' && <ArrowUpRight className="w-5 h-5" />}
              {activeType === 'mobile_recharge' && <Smartphone className="w-5 h-5" />}
              {activeType === 'utility_bill' && <Zap className="w-5 h-5" />}
              {activeType === 'qr_payment' && <QrCode className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Available Balance: ৳{wallet.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'form' ? (
            <form onSubmit={handleProceedToConfirm} className="space-y-4">
              {/* SEND MONEY SPECIFIC */}
              {activeType === 'send_money' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Quick Priyo & Frequent Contacts
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_CONTACTS.map((c) => {
                        const active = recipientNumber === c.number;
                        return (
                          <button
                            key={c.number}
                            type="button"
                            onClick={() => {
                              setRecipientNumber(c.number);
                              setRecipientName(c.name);
                              setIsPriyoSelected(c.isPriyo);
                            }}
                            className={`min-h-[48px] px-3 py-2 rounded-xl border text-left transition-colors ${
                              active
                                ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30 text-slate-900 dark:text-slate-100'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="text-xs font-semibold truncate">{c.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              {c.number} · {c.isPriyo ? '0 Fee' : 'Standard'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Recipient MFS Number
                      </label>
                      <input
                        type="text"
                        required
                        value={recipientNumber}
                        onChange={(e) => setRecipientNumber(e.target.value)}
                        placeholder="017XX-XXXXXX"
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Recipient Name"
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* CASH IN (ADD MONEY) SPECIFIC */}
              {activeType === 'cash_in' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Funding Source (Zero Deposit Charge)
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        'City Bank PLC — Citytouch Instant',
                        'BRAC Bank Astha — Linked Account',
                        'Eastern Bank Skybanking — Visa Debit',
                        'Islami Bank mCash / CellFin Bridge',
                      ].map((bank) => (
                        <button
                          key={bank}
                          type="button"
                          onClick={() => setSelectedBank(bank)}
                          className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                            selectedBank === bank
                              ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30 text-slate-900 dark:text-slate-100'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <span className="text-xs font-semibold flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            {bank}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                            Instant · ৳0 Fee
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* CASH OUT SPECIFIC */}
              {activeType === 'cash_out' && (
                <>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
                    {!agentImgError ? (
                      <img
                        src={AGENT_AVATAR_URL}
                        alt="Verified MFS Priyo Agent"
                        referrerPolicy="no-referrer"
                        onError={() => setAgentImgError(true)}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-center shrink-0">
                        AG
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {recipientName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                        Agent ID: {recipientNumber} · 1.49% Priyo Tariff
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Agent Number or ATM Cash-Out Code
                    </label>
                    <input
                      type="text"
                      required
                      value={recipientNumber}
                      onChange={(e) => setRecipientNumber(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                    />
                  </div>
                </>
              )}

              {/* MOBILE RECHARGE SPECIFIC */}
              {activeType === 'mobile_recharge' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Select Mobile Operator
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                      {MOBILE_OPERATORS.map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => {
                            setSelectedOperator(op.name);
                            if (!recipientNumber.startsWith(op.prefix)) {
                              setRecipientNumber(`${op.prefix}11-849201`);
                            }
                          }}
                          className={`min-h-[44px] px-2 py-2 rounded-xl border text-center transition-colors ${
                            selectedOperator === op.name
                              ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30 font-semibold'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className={`text-xs font-bold ${op.color}`}>{op.prefix}</div>
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                            {op.name.split(' ')[0]}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Mobile Number
                      </label>
                      <input
                        type="text"
                        required
                        value={recipientNumber}
                        onChange={(e) => setRecipientNumber(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Connection Type
                      </label>
                      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl h-[44px]">
                        {(['Prepaid', 'Postpaid'] as const).map((ct) => (
                          <button
                            key={ct}
                            type="button"
                            onClick={() => setConnectionType(ct)}
                            className={`flex-1 h-full text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                              connectionType === ct
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {ct}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Instant Cashback Internet & Voice Offers
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {RECHARGE_BUNDLES.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setAmountStr(String(b.amount));
                            setReferenceNote(b.label);
                          }}
                          className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-colors ${
                            Number(amountStr) === b.amount
                              ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {b.label}
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                            ৳{b.amount} · <span className="text-emerald-600 dark:text-emerald-400">+৳{b.cashback} Cashback</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* UTILITY BILL SPECIFIC */}
              {activeType === 'utility_bill' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Select Utility Biller (Electricity · Gas · Water · Internet)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {UTILITY_BILLERS.map((biller) => (
                        <button
                          key={biller.id}
                          type="button"
                          onClick={() => {
                            setSelectedBiller(biller);
                            setMeterNumber(biller.sampleMeter);
                          }}
                          className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-colors ${
                            selectedBiller.id === biller.id
                              ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {biller.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {biller.category} · {biller.cashbackPct}% Cashback
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Meter / Subscriber Account No
                      </label>
                      <input
                        type="text"
                        required
                        value={meterNumber}
                        onChange={(e) => setMeterNumber(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Billing Period
                      </label>
                      <select
                        value={billMonth}
                        onChange={(e) => setBillMonth(e.target.value)}
                        className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                      >
                        <option value="November 2026">November 2026 (Current)</option>
                        <option value="October 2026">October 2026</option>
                        <option value="Prepaid Instant Token">Prepaid Smart Token</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* QR CODE MERCHANT PAYMENT SPECIFIC */}
              {activeType === 'qr_payment' && (
                <>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setQrTab('scan')}
                      className={`flex-1 min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                        qrTab === 'scan'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <ScanLine className="w-3.5 h-3.5 text-rose-600" />
                      Scan Merchant QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrTab('my_qr')}
                      className={`flex-1 min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                        qrTab === 'my_qr'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      My Receive QR Code
                    </button>
                  </div>

                  {qrTab === 'my_qr' ? (
                    <div className="py-4 text-center space-y-3">
                      <QrCodeMatrix
                        value={`TAKAPAY://WALLET/${wallet.accountNumber}/${wallet.displayName}`}
                        size={188}
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {wallet.displayName}
                        </p>
                        <p className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                          Wallet ID: {wallet.accountNumber} · {wallet.kycTier}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        Show this BanglaQR-compatible matrix to any TakaPay, bKash, or Nagad user to receive instant zero-fee transfers.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3.5 rounded-2xl bg-slate-950 text-white flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-rose-600/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                            <ScanLine className="w-5 h-5 text-rose-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{selectedMerchant.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                              {selectedMerchant.qrCodeId} · {selectedMerchant.cashbackPct}% Cashback
                            </div>
                          </div>
                        </div>
                        <QrCodeMatrix value={selectedMerchant.qrCodeId} size={64} />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Verified BanglaQR Merchants Near You
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {QR_MERCHANTS.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedMerchant(m);
                                setAmountStr(String(m.suggestedAmount));
                              }}
                              className={`min-h-[48px] p-2.5 rounded-xl border text-left transition-colors ${
                                selectedMerchant.id === m.id
                                  ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30'
                                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {m.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                {m.category} · <span className="text-emerald-600 dark:text-emerald-400">{m.cashbackPct}% Cashback</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* COMMON AMOUNT & REFERENCE INPUTS (Hidden only when viewing My Receive QR) */}
              {!(activeType === 'qr_payment' && qrTab === 'my_qr') && (
                <>
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Amount in BDT (৳)
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[500, 1000, 2000, 5000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setAmountStr(String(preset))}
                            className="px-2 py-1 text-[11px] font-mono tabular-nums font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 hover:text-rose-600 transition-colors"
                          >
                            ৳{preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={10}
                      max={500000}
                      step="any"
                      required
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      className="w-full min-h-[48px] px-4 py-2.5 text-xl font-bold font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Encrypted Reference Note (AES-256-GCM)
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      value={referenceNote}
                      onChange={(e) => setReferenceNote(e.target.value)}
                      placeholder="Optional memo encrypted end-to-end"
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                    />
                  </div>

                  {/* Live Fee & Cashback Summary Bar */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono tabular-nums">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Charge: </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        ৳{fee.toFixed(2)}
                      </span>
                      {cashback > 0 && (
                        <>
                          <span className="mx-2 text-slate-300 dark:text-slate-700">·</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            Cashback: +৳{cashback.toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">New Balance: </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        ৳{projectedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap shrink-0"
                  >
                    Proceed to Biometric & PIN Verification
                  </button>
                </>
              )}
            </form>
          ) : (
            /* STEP 2: BIOMETRIC PASSKEY + PIN + TAP-AND-HOLD CONFIRMATION */
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Counterparty</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {finalRecipientName} ({finalRecipientFull})
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">Amount & Charge</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    ৳{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} + ৳{fee.toFixed(2)} Fee
                  </span>
                </div>
                {cashback > 0 && (
                  <div className="flex items-center justify-between font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    <span>Instant Cashback Reward</span>
                    <span className="font-bold">+৳{cashback.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-mono tabular-nums pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Balance After Settlement</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    ৳{projectedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Biometric Hardware Passkey Trigger + MFS PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleBiometricVerify}
                  className={`min-h-[56px] p-3 rounded-xl border flex items-center gap-3 text-left transition-colors ${
                    biometricVerified
                      ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                      : 'border-slate-200 dark:border-slate-800 hover:border-rose-500 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      biometricVerified
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {biometricVerified ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Fingerprint className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      {biometricVerified ? 'Biometric Verified' : 'Scan Biometric Passkey'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                      {biometricVerified ? biometricSig : 'TouchID / FaceID / Passkey'}
                    </div>
                  </div>
                </button>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    5-Digit TakaPay PIN
                  </label>
                  <input
                    type="password"
                    maxLength={5}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="•••••"
                    className="w-full min-h-[44px] px-3.5 py-2 text-center tracking-[0.4em] font-mono font-bold text-base bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Payload encrypted with Web Crypto <strong className="font-mono">AES-256-GCM</strong> prior to Firestore ledger commit.
                </span>
              </div>

              {/* Iconic bKash / Nagad Tap-and-Hold or Instant Confirm Button */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={submitting}
                  onMouseDown={startHold}
                  onMouseUp={cancelHold}
                  onMouseLeave={cancelHold}
                  onTouchStart={startHold}
                  onTouchEnd={cancelHold}
                  onClick={triggerFinalExecution}
                  className="relative w-full min-h-[54px] rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm overflow-hidden shadow-md transition-transform active:scale-[0.99] select-none"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-rose-800/70 transition-all duration-75"
                    style={{ width: `${holdProgress}%` }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Fingerprint className="w-5 h-5" />
                    {submitting
                      ? 'Encrypting & Settling Ledger...'
                      : 'Tap & Hold (or Click) to Confirm Transaction'}
                  </span>
                </button>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 py-1"
                  >
                    ← Edit Details
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                    Zero-Trust Atomic Batch Commit
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
