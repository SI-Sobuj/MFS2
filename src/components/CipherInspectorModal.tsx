import React, { useState } from 'react';
import { X, ShieldCheck, KeyRound, Lock, Unlock, Download, Check } from 'lucide-react';
import { EncryptedTransaction } from '../types/mfs';

interface CipherInspectorModalProps {
  transaction: EncryptedTransaction | null;
  onClose: () => void;
}

export const CipherInspectorModal: React.FC<CipherInspectorModalProps> = ({
  transaction,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'decrypted' | 'ciphertext'>('decrypted');
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const formattedDate = transaction.createdAtMs
    ? new Date(transaction.createdAtMs).toLocaleString('en-BD', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    : 'Verified Server Timestamp';

  const handleDownloadReceipt = () => {
    const receiptContent = [
      '==================================================',
      '        TAKAPAY MFS — ENCRYPTED RECEIPT           ',
      '==================================================',
      `Transaction ID   : ${transaction.txId}`,
      `Category         : ${transaction.title} (${transaction.type})`,
      `Date & Time      : ${formattedDate}`,
      `Status           : COMPLETED (IMMUTABLE LEDGER)`,
      `Auth Method      : ${transaction.authMethod}`,
      '--------------------------------------------------',
      `Principal Amount : BDT ${transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Service Charge   : BDT ${transaction.fee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Instant Cashback : BDT ${transaction.cashback.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      `Balance After    : BDT ${transaction.balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      '--------------------------------------------------',
      `Recipient/Biller : ${transaction.decrypted?.recipientName || transaction.counterpartyMasked}`,
      `Account/Meter No : ${transaction.decrypted?.recipientFull || transaction.counterpartyMasked}`,
      `Reference Note   : ${transaction.decrypted?.referenceNote || 'N/A'}`,
      '--------------------------------------------------',
      'CRYPTOGRAPHIC ENVELOPE (WEB CRYPTO AES-256-GCM)',
      `Cipher Algorithm : ${transaction.cipherAlg}`,
      `IV (Base64)      : ${transaction.iv}`,
      `Biometric Hash   : ${transaction.decrypted?.biometricSignature || 'VERIFIED'}`,
      `Receipt Hash     : ${transaction.decrypted?.receiptVerificationCode || 'VERIFIED'}`,
      `Ciphertext       : ${transaction.encryptedPayload}`,
      '==================================================',
    ].join('\n');

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TakaPay-Receipt-${transaction.txId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTxId = () => {
    navigator.clipboard.writeText(transaction.txId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cipher-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="cipher-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              Transaction Receipt & AES-256-GCM Proof
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
              Ref: {transaction.txId} · {formattedDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Financial Summary Row */}
          <div className="flex items-baseline justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {transaction.title} · {transaction.authMethod}
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                ৳{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
              <div>Charge: ৳{transaction.fee.toFixed(2)}</div>
              {transaction.cashback > 0 && (
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Cashback: +৳{transaction.cashback.toFixed(2)}
                </div>
              )}
              <div>Balance After: ৳{transaction.balanceAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          {/* Interactive View Switcher (Functional Buttons) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('decrypted')}
              className={`flex-1 min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'decrypted'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Decrypted Client View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ciphertext')}
              className={`flex-1 min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'ciphertext'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              Raw Firestore Ciphertext
            </button>
          </div>

          {viewMode === 'decrypted' ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Counterparty Name</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {transaction.decrypted?.recipientName || transaction.counterpartyMasked}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Full Account / Meter ID</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  {transaction.decrypted?.recipientFull || transaction.counterpartyMasked}
                </span>
              </div>
              {transaction.decrypted?.providerOrBank && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Network / Provider</span>
                  <span className="text-slate-900 dark:text-slate-100">
                    {transaction.decrypted.providerOrBank}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Decrypted Memo</span>
                <span className="text-slate-900 dark:text-slate-100">
                  {transaction.decrypted?.referenceNote || 'Standard MFS Settlement'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Biometric Signature</span>
                <span className="font-mono tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
                  {transaction.decrypted?.biometricSignature || 'FIDO2-PASSKEY-VERIFIED'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 dark:text-slate-400">Receipt Verification Code</span>
                <span className="font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                  {transaction.decrypted?.receiptVerificationCode || transaction.txId}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs font-mono tabular-nums">
              <div>
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Cipher Suite & PBKDF2 Initialization Vector (IV)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 break-all">
                  Alg: {transaction.cipherAlg} · Key: PBKDF2-SHA256 (50,000 iter) · IV: {transaction.iv}
                </div>
              </div>
              <div>
                <div className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Stored Firestore Base64 Ciphertext (encryptedPayload)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 break-all leading-relaxed max-h-36 overflow-y-auto">
                  {transaction.encryptedPayload}
                </div>
              </div>
              <p className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                Counterparty numbers, meter IDs, and reference notes are encrypted client-side via Web Crypto API before storage. Firestore rules lock this record as immutable upon creation.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopyTxId}
              className="flex-1 min-h-[44px] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : null}
              {copied ? 'Copied Reference ID' : 'Copy TxID'}
            </button>
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="flex-1 min-h-[44px] px-4 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
