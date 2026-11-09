import React, { useState } from 'react';
import { PiggyBank, Plus, ArrowUpRight, ArrowDownLeft, TrendingUp, AlertCircle } from 'lucide-react';
import { SavingsGoal, UserWallet } from '../types/mfs';

const SAVINGS_VAULT_IMAGE = '/src/assets/images/mfs_savings_vault_1794245926472.jpg';

interface SavingsDpsSectionProps {
  wallet: UserWallet;
  goals: SavingsGoal[];
  onCreateGoal: (input: {
    name: string;
    schemeType: 'Islamic Mudarabah DPS' | 'Fixed Term Savings' | 'Micro Vault';
    targetAmount: number;
    monthlyInstallment: number;
    profitRate: number;
    maturityDate: string;
    initialDeposit: number;
  }) => Promise<void>;
  onMutateGoalBalance: (
    goal: SavingsGoal,
    amount: number,
    direction: 'deposit' | 'withdraw'
  ) => Promise<void>;
}

export const SavingsDpsSection: React.FC<SavingsDpsSectionProps> = ({
  wallet,
  goals,
  onCreateGoal,
  onMutateGoalBalance,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('Hajj & Family Future DPS');
  const [schemeType, setSchemeType] = useState<
    'Islamic Mudarabah DPS' | 'Fixed Term Savings' | 'Micro Vault'
  >('Islamic Mudarabah DPS');
  const [targetAmount, setTargetAmount] = useState('120000');
  const [monthlyInstallment, setMonthlyInstallment] = useState('2500');
  const [initialDeposit, setInitialDeposit] = useState('2500');
  const [maturityDate, setMaturityDate] = useState('2028-12-31');
  const [customTransferAmounts, setCustomTransferAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vaultImgError, setVaultImgError] = useState(false);

  const profitRate =
    schemeType === 'Islamic Mudarabah DPS'
      ? 9.25
      : schemeType === 'Fixed Term Savings'
      ? 9.75
      : 7.5;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const target = Number(targetAmount) || 0;
    const installment = Number(monthlyInstallment) || 0;
    const initDep = Number(initialDeposit) || 0;

    if (target < 500 || installment < 100) {
      setErrorMsg('Target must be at least ৳500 and monthly installment at least ৳100.');
      return;
    }
    if (initDep > wallet.balance) {
      setErrorMsg('Initial deposit exceeds your available liquid MFS balance.');
      return;
    }

    setBusyId('create');
    try {
      await onCreateGoal({
        name: name.trim() || 'Savings Vault',
        schemeType,
        targetAmount: target,
        monthlyInstallment: installment,
        profitRate,
        maturityDate,
        initialDeposit: initDep,
      });
      setShowCreateForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not open savings scheme.');
    } finally {
      setBusyId(null);
    }
  };

  const handleGoalAction = async (
    goal: SavingsGoal,
    direction: 'deposit' | 'withdraw'
  ) => {
    setErrorMsg(null);
    const rawVal = customTransferAmounts[goal.goalId] ?? String(goal.monthlyInstallment);
    const amt = Number(rawVal) || 0;
    if (amt <= 0) {
      setErrorMsg('Enter a valid amount greater than ৳0.');
      return;
    }
    if (direction === 'deposit' && amt > wallet.balance) {
      setErrorMsg(`Insufficient liquid wallet balance (৳${wallet.balance.toFixed(2)}).`);
      return;
    }
    if (direction === 'withdraw' && amt > goal.currentAmount) {
      setErrorMsg(`Cannot withdraw more than current goal balance (৳${goal.currentAmount.toFixed(2)}).`);
      return;
    }

    setBusyId(goal.goalId);
    try {
      await onMutateGoalBalance(goal, amt, direction);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Savings transfer failed.');
    } finally {
      setBusyId(null);
    }
  };

  const projectedAnnualYield = goals.reduce(
    (acc, g) => acc + (g.currentAmount * g.profitRate) / 100,
    0
  );

  return (
    <section className="space-y-6">
      {/* Top Banner Split */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
              Real-Time Automated DPS & Mudarabah Savings Vaults
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Grow Your MFS Balance Up to 9.75% Annual Profit
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Open instant weekly or monthly savings schemes backed by partner financial institutions. Deposit or encash anytime with zero hidden charges and biometric protection.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-6 font-mono tabular-nums">
              <div>
                <div className="text-xs font-sans text-slate-500 dark:text-slate-400">
                  Total Saved Balance
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  ৳{wallet.savingsBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-xs font-sans text-slate-500 dark:text-slate-400">
                  Est. Annual Profit
                </div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  +৳{projectedAnnualYield.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              {showCreateForm ? 'Close Scheme Builder' : 'Open New DPS / Vault'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 relative min-h-[180px] bg-slate-100 dark:bg-slate-800">
          {!vaultImgError ? (
            <img
              src={SAVINGS_VAULT_IMAGE}
              alt="Emerald glass MFS savings vault"
              referrerPolicy="no-referrer"
              onError={() => setVaultImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-emerald-900 to-slate-900 text-white">
              <PiggyBank className="w-10 h-10 text-emerald-400 mb-2" />
              <span className="text-xs font-semibold">Protected MFS DPS Vault</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex items-end p-4">
            <div className="text-white text-xs">
              <div className="font-semibold">IDLC · BRAC Bank · Islami Bank Partnered</div>
              <div className="text-white/80 font-mono tabular-nums mt-0.5">
                Instant Liquidity · Zero Early Encashment Penalty
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Create New DPS / Savings Goal Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Configure New Real-Time DPS or Micro Savings Vault
            </h3>
            <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
              Yield: {profitRate}% p.a.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                'Islamic Mudarabah DPS',
                'Fixed Term Savings',
                'Micro Vault',
              ] as const
            ).map((scheme) => (
              <button
                key={scheme}
                type="button"
                onClick={() => setSchemeType(scheme)}
                className={`min-h-[48px] p-3 rounded-xl border text-left transition-colors ${
                  schemeType === scheme
                    ? 'border-rose-600 bg-rose-50/60 dark:bg-rose-950/30'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{scheme}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {scheme === 'Islamic Mudarabah DPS'
                    ? '9.25% Halal Profit Share'
                    : scheme === 'Fixed Term Savings'
                    ? '9.75% Guaranteed Return'
                    : '7.50% Flexible Daily Access'}
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Goal Title
              </label>
              <input
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Maturity (৳)
              </label>
              <input
                type="number"
                min={500}
                max={10000000}
                required
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Monthly Installment (৳)
              </label>
              <input
                type="number"
                min={100}
                max={500000}
                required
                value={monthlyInstallment}
                onChange={(e) => setMonthlyInstallment(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Initial Deposit Now (৳)
              </label>
              <input
                type="number"
                min={0}
                max={500000}
                required
                value={initialDeposit}
                onChange={(e) => setInitialDeposit(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Maturity Date: <span className="font-mono">{maturityDate}</span> · Deducted from liquid balance
            </div>
            <button
              type="submit"
              disabled={busyId === 'create'}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              {busyId === 'create' ? 'Opening DPS Vault...' : 'Confirm & Activate Scheme'}
            </button>
          </div>
        </form>
      )}

      {/* Active Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal) => {
          const pct = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          const amountInputVal =
            customTransferAmounts[goal.goalId] ?? String(goal.monthlyInstallment);
          const isCompleted = goal.status === 'completed';

          return (
            <div
              key={goal.goalId}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {goal.schemeType} · {goal.profitRate}% Profit · Maturing {goal.maturityDate}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {goal.name}
                    </h3>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                      ৳{goal.currentAmount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      of ৳{goal.targetAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {pct}% Funded
                    </span>
                    <span>Installment: ৳{goal.monthlyInstallment.toLocaleString('en-IN')}/mo</span>
                  </div>
                </div>
              </div>

              {/* Real-time Deposit / Withdraw Controls */}
              {!isCompleted ? (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[110px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                      ৳
                    </span>
                    <input
                      type="number"
                      min={50}
                      max={500000}
                      value={amountInputVal}
                      onChange={(e) =>
                        setCustomTransferAmounts((prev) => ({
                          ...prev,
                          [goal.goalId]: e.target.value,
                        }))
                      }
                      aria-label={`Transfer amount for ${goal.name}`}
                      className="w-full min-h-[44px] pl-7 pr-3 py-2 text-xs font-mono tabular-nums font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busyId === goal.goalId}
                    onClick={() => handleGoalAction(goal, 'deposit')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Add Installment
                  </button>
                  <button
                    type="button"
                    disabled={busyId === goal.goalId || goal.currentAmount <= 0}
                    onClick={() => handleGoalAction(goal, 'withdraw')}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Encash
                  </button>
                </div>
              ) : (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  Target Maturity Reached · Locked in Completed State
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
