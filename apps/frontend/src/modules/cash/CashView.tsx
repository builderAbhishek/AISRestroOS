import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { cashApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { CashRegisterShift, CashTransaction, Expense } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/EmptyState';
import {
  Banknote,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingDown,
  TrendingUp,
  Plus,
  Minus,
  Lock,
  Unlock,
  Eye,
  Calendar,
  Filter,
} from 'lucide-react';

type CashTab = 'overview' | 'shifts' | 'expenses' | 'ledger';

export const CashView: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useUIStore();
  const [activeTab, setActiveTab] = useState<CashTab>('overview');

  // Queries
  const { data: activeShift, isLoading: isActiveShiftLoading } = useQuery({
    queryKey: ['activeCashShift'],
    queryFn: cashApi.getActiveShift,
  });

  const { data: shifts = [], isLoading: isShiftsLoading } = useQuery({
    queryKey: ['cashShifts'],
    queryFn: () => cashApi.listShifts(50, 0),
  });

  const { data: expenses = [], isLoading: isExpensesLoading } = useQuery({
    queryKey: ['cashExpenses'],
    queryFn: () => cashApi.listExpenses(),
  });

  // Modal States
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCashInModal, setShowCashInModal] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<CashRegisterShift | null>(null);

  // Form Fields
  const [openingFloatInr, setOpeningFloatInr] = useState(2000);
  const [operatorName, setOperatorName] = useState('Cashier');
  const [openingNotes, setOpeningNotes] = useState('');

  const [actualCashInr, setActualCashInr] = useState(0);
  const [closingNotes, setClosingNotes] = useState('');
  const [closingOperator, setClosingOperator] = useState('');

  const [cashInAmountInr, setCashInAmountInr] = useState(500);
  const [cashInReason, setCashInReason] = useState('FLOAT_ADDITION');
  const [cashInNotes, setCashInNotes] = useState('');

  const [cashOutAmountInr, setCashOutAmountInr] = useState(500);
  const [cashOutReason, setCashOutReason] = useState('BANK_DEPOSIT');
  const [cashOutNotes, setCashOutNotes] = useState('');

  const [expCategory, setExpCategory] = useState('Kitchen Supplies');
  const [expAmountInr, setExpAmountInr] = useState(250);
  const [expPaymentMethod, setExpPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'other'>('cash');
  const [expDescription, setExpDescription] = useState('');
  const [expRecipient, setExpRecipient] = useState('');
  const [expRefNumber, setExpRefNumber] = useState('');

  // Expenses Filter
  const [expenseMethodFilter, setExpenseMethodFilter] = useState('all');

  const notify = (title: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', description?: string) => {
    addToast({ title, type, description });
  };

  // Mutations
  const openShiftMutation = useMutation({
    mutationFn: (data: any) => cashApi.openShift(data),
    onSuccess: (shift) => {
      queryClient.invalidateQueries({ queryKey: ['activeCashShift'] });
      queryClient.invalidateQueries({ queryKey: ['cashShifts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowOpenModal(false);
      notify('Cash Register Opened', 'success', `Shift #${shift.shift_number} opened with float ₹${(shift.opening_cash_paise / 100).toFixed(2)}`);
    },
    onError: (err: any) => notify('Failed to Open Shift', 'error', err.message),
  });

  const closeShiftMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => cashApi.closeShift(id, data),
    onSuccess: (shift) => {
      queryClient.invalidateQueries({ queryKey: ['activeCashShift'] });
      queryClient.invalidateQueries({ queryKey: ['cashShifts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowCloseModal(false);
      notify(
        'Shift Closed & Reconciled',
        'success',
        `Variance: ₹${((shift.variance_paise || 0) / 100).toFixed(2)}`
      );
    },
    onError: (err: any) => notify('Failed to Close Shift', 'error', err.message),
  });

  const cashInMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => cashApi.cashIn(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeCashShift'] });
      queryClient.invalidateQueries({ queryKey: ['cashShifts'] });
      setShowCashInModal(false);
      notify('Cash In Recorded', 'success', `Added ₹${cashInAmountInr.toFixed(2)} to drawer.`);
    },
    onError: (err: any) => notify('Cash In Failed', 'error', err.message),
  });

  const cashOutMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => cashApi.cashOut(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeCashShift'] });
      queryClient.invalidateQueries({ queryKey: ['cashShifts'] });
      setShowCashOutModal(false);
      notify('Cash Out Recorded', 'success', `Withdrawn ₹${cashOutAmountInr.toFixed(2)} from drawer.`);
    },
    onError: (err: any) => notify('Cash Out Failed', 'error', err.message),
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: any) => cashApi.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeCashShift'] });
      queryClient.invalidateQueries({ queryKey: ['cashExpenses'] });
      setShowExpenseModal(false);
      setExpDescription('');
      setExpRecipient('');
      setExpRefNumber('');
      notify('Expense Recorded', 'success', `Logged ₹${expAmountInr.toFixed(2)} (${expPaymentMethod.toUpperCase()})`);
    },
    onError: (err: any) => notify('Failed to Record Expense', 'error', err.message),
  });

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    openShiftMutation.mutate({
      opening_cash_paise: Math.round(openingFloatInr * 100),
      operator_name: operatorName.trim() || 'Cashier',
      opening_notes: openingNotes.trim() || undefined,
    });
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    closeShiftMutation.mutate({
      id: activeShift.id,
      data: {
        actual_closing_cash_paise: Math.round(actualCashInr * 100),
        closing_notes: closingNotes.trim() || undefined,
        closing_operator_name: closingOperator.trim() || undefined,
      },
    });
  };

  const handleCashIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    cashInMutation.mutate({
      id: activeShift.id,
      data: {
        amount_paise: Math.round(cashInAmountInr * 100),
        category: cashInReason,
        notes: cashInNotes.trim() || undefined,
        operator_name: operatorName.trim() || 'Cashier',
      },
    });
  };

  const handleCashOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    cashOutMutation.mutate({
      id: activeShift.id,
      data: {
        amount_paise: Math.round(cashOutAmountInr * 100),
        category: cashOutReason,
        notes: cashOutNotes.trim() || undefined,
        operator_name: operatorName.trim() || 'Cashier',
      },
    });
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    createExpenseMutation.mutate({
      category: expCategory,
      amount_paise: Math.round(expAmountInr * 100),
      payment_method: expPaymentMethod,
      description: expDescription.trim(),
      recipient: expRecipient.trim() || undefined,
      reference_number: expRefNumber.trim() || undefined,
    });
  };

  // Expected cash in active drawer
  const expectedInr = activeShift ? activeShift.current_expected_cash_paise / 100 : 0;
  const variancePreviewInr = actualCashInr - expectedInr;

  // Filtered expenses
  const filteredExpenses = expenses.filter(
    (e) => expenseMethodFilter === 'all' || e.payment_method === expenseMethodFilter
  );

  return (
    <div className="space-y-5 pb-16 max-w-7xl mx-auto">
      {/* Top Header & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E8EAF0]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202124] flex items-center gap-2">
            <Banknote className="h-6 w-6 text-[#F07818]" />
            Cash Register & Drawer Management
          </h2>
          <p className="text-xs text-[#6B7280]">
            Track opening floats, real-time cash sales, drawer cash in/out, operational expenses, and shift closing reconciliations
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeShift ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCashInModal(true)}
                className="text-xs flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-600" /> Cash In
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCashOutModal(true)}
                className="text-xs flex items-center gap-1.5"
              >
                <Minus className="h-3.5 w-3.5 text-amber-600" /> Cash Out
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowExpenseModal(true)}
                className="text-xs flex items-center gap-1.5"
              >
                <Receipt className="h-3.5 w-3.5 text-purple-600" /> Add Expense
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setActualCashInr(expectedInr);
                  setShowCloseModal(true);
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs flex items-center gap-1.5"
              >
                <Lock className="h-3.5 w-3.5" /> Close Shift
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowOpenModal(true)}
              className="bg-[#F07818] hover:bg-[#D9660E] text-white text-xs flex items-center gap-1.5"
            >
              <Unlock className="h-3.5 w-3.5" /> Open Cash Register
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards: Live Drawer Balance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-[#E8EAF0] shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">Shift Status</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${activeShift ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}
            />
            <span className="text-sm font-extrabold text-[#202124]">
              {activeShift ? `Shift #${activeShift.shift_number}` : 'Closed'}
            </span>
          </div>
          <span className="text-[10px] text-[#6B7280] mt-0.5 block">
            {activeShift ? `Op: ${activeShift.operator_name}` : 'No active drawer'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FFF0E3] border border-[#F07818]/30 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#F07818] block">Current Drawer Cash</span>
          <span className="text-base font-extrabold text-[#F07818] mt-1 block">
            ₹{expectedInr.toFixed(2)}
          </span>
          <span className="text-[10px] text-[#6B7280] mt-0.5 block">Physical expected in till</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#E8EAF0] shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] block">Opening Float</span>
          <span className="text-sm font-bold text-[#202124] mt-1 block">
            ₹{((activeShift?.opening_cash_paise || 0) / 100).toFixed(2)}
          </span>
          <span className="text-[10px] text-[#6B7280] mt-0.5 block">Shift start amount</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#E8EAF0] shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Cash Sales</span>
          <span className="text-sm font-bold text-emerald-700 mt-1 block">
            +₹{((activeShift?.cash_sales_paise || 0) / 100).toFixed(2)}
          </span>
          <span className="text-[10px] text-[#6B7280] mt-0.5 block">From settled POS orders</span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#E8EAF0] shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Net Float Adjust</span>
          <span className="text-sm font-bold text-blue-700 mt-1 block">
            ₹{(((activeShift?.cash_in_paise || 0) - (activeShift?.cash_out_paise || 0)) / 100).toFixed(2)}
          </span>
          <span className="text-[10px] text-[#6B7280] mt-0.5 block">
            In: ₹{((activeShift?.cash_in_paise || 0) / 100).toFixed(0)} | Out: ₹{((activeShift?.cash_out_paise || 0) / 100).toFixed(0)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#E8EAF0] shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Cash Expenses</span>
          <span className="text-sm font-bold text-amber-700 mt-1 block">
            -₹{((activeShift?.cash_expenses_paise || 0) / 100).toFixed(2)}
          </span>
          <span className="text-[10px] text-[#6B7280] mt-0.5 block">Deducted from drawer</span>
        </div>
      </div>

      {/* Warning when Register is closed */}
      {!activeShift && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <strong>The Cash Register is currently closed.</strong>
              <p className="text-[11px] text-amber-800">
                Opening a register shift allows POS cash payments to increment the physical till balance and links all financial cash movements for shift reconciliation.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowOpenModal(true)}
            className="bg-[#F07818] hover:bg-[#D9660E] text-white shrink-0 text-xs"
          >
            Open Register Now
          </Button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#E8EAF0] gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'border-[#F07818] text-[#F07818]'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <Banknote className="h-4 w-4" /> Active Drawer Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shifts')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
            activeTab === 'shifts'
              ? 'border-[#F07818] text-[#F07818]'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <History className="h-4 w-4" /> Shift History ({shifts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer ${
            activeTab === 'expenses'
              ? 'border-[#F07818] text-[#F07818]'
              : 'border-transparent text-[#6B7280] hover:text-[#202124]'
          }`}
        >
          <Receipt className="h-4 w-4" /> Operational Expenses ({expenses.length})
        </button>
      </div>

      {/* Sub-Tab 1: Active Drawer Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Shift Breakdown Card */}
            <div className="lg:col-span-7 space-y-4">
              <Card>
                <CardHeader className="border-b border-[#E8EAF0] pb-3">
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span>Active Shift Financial Reconciliation Formula</span>
                    {activeShift && (
                      <span className="text-xs font-normal text-[#6B7280]">
                        Opened: {new Date(activeShift.opened_at).toLocaleTimeString()}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-gray-100">
                    <span className="text-[#6B7280]">1. Opening Cash Float:</span>
                    <strong className="text-[#202124]">
                      ₹{((activeShift?.opening_cash_paise || 0) / 100).toFixed(2)}
                    </strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100 text-emerald-700">
                    <span>2. (+) Cash Sales (POS Orders):</span>
                    <strong>+₹{((activeShift?.cash_sales_paise || 0) / 100).toFixed(2)}</strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100 text-blue-700">
                    <span>3. (+) Cash In (Floats/Deposits):</span>
                    <strong>+₹{((activeShift?.cash_in_paise || 0) / 100).toFixed(2)}</strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100 text-red-600">
                    <span>4. (-) Cash Out (Withdrawals/Bank):</span>
                    <strong>-₹{((activeShift?.cash_out_paise || 0) / 100).toFixed(2)}</strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100 text-amber-700">
                    <span>5. (-) Cash Expenses:</span>
                    <strong>-₹{((activeShift?.cash_expenses_paise || 0) / 100).toFixed(2)}</strong>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-gray-100 text-red-600">
                    <span>6. (-) Cash Refunds:</span>
                    <strong>-₹{((activeShift?.cash_refunds_paise || 0) / 100).toFixed(2)}</strong>
                  </div>

                  <div className="flex justify-between pt-2 text-sm font-extrabold text-[#F07818] bg-[#FFF0E3] p-2.5 rounded-lg border border-[#F07818]/30">
                    <span>(=) Expected Cash in Till:</span>
                    <span>₹{expectedInr.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions & Notes */}
            <div className="lg:col-span-5 space-y-4">
              <Card>
                <CardHeader className="border-b border-[#E8EAF0] pb-3">
                  <CardTitle className="text-sm font-bold">Shift Information & Notes</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3 text-xs">
                  {activeShift ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280]">Current Operator:</span>
                        <strong className="text-[#202124]">{activeShift.operator_name}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#6B7280]">Shift Start Timestamp:</span>
                        <span className="text-[#202124]">
                          {new Date(activeShift.opened_at).toLocaleString()}
                        </span>
                      </div>
                      {activeShift.opening_notes && (
                        <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                          <span className="text-[10px] text-[#6B7280] block font-bold">Opening Notes:</span>
                          <p className="text-xs text-[#202124] mt-0.5">{activeShift.opening_notes}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-[#6B7280]">
                      No active shift. Open the cash register before processing transactions to ensure proper financial tracking.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Shift History */}
      {activeTab === 'shifts' && (
        <Card>
          <CardHeader className="border-b border-[#E8EAF0] pb-3">
            <CardTitle className="text-sm font-bold">Closed & Historical Shift Records</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {isShiftsLoading ? (
              <LoadingState message="Loading shift history..." />
            ) : shifts.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B7280]">No shifts recorded yet.</div>
            ) : (
              <div className="overflow-x-auto border border-[#E8EAF0] rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F8FA] border-b border-[#E8EAF0] text-[#6B7280] font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Shift #</th>
                      <th className="py-2.5 px-3">Operator</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Opened</th>
                      <th className="py-2.5 px-3">Closed</th>
                      <th className="py-2.5 px-3 text-right">Float</th>
                      <th className="py-2.5 px-3 text-right">Sales</th>
                      <th className="py-2.5 px-3 text-right">Expected</th>
                      <th className="py-2.5 px-3 text-right">Actual</th>
                      <th className="py-2.5 px-3 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAF0]">
                    {shifts.map((s) => {
                      const variance = s.variance_paise || 0;
                      return (
                        <tr key={s.id} className="hover:bg-[#F7F8FA]/60">
                          <td className="py-2.5 px-3 font-bold text-[#202124]">#{s.shift_number}</td>
                          <td className="py-2.5 px-3 text-[#202124]">{s.operator_name}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant={s.status === 'open' ? 'success' : 'neutral'} size="sm">
                              {s.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280]">
                            {new Date(s.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 text-[#6B7280]">
                            {s.closed_at
                              ? new Date(s.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#202124]">
                            ₹{(s.opening_cash_paise / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">
                            ₹{(s.cash_sales_paise / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-[#202124]">
                            ₹{((s.expected_closing_cash_paise ?? s.current_expected_cash_paise) / 100).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#202124]">
                            {s.actual_closing_cash_paise !== null && s.actual_closing_cash_paise !== undefined
                              ? `₹${(s.actual_closing_cash_paise / 100).toFixed(2)}`
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold">
                            {s.status === 'closed' ? (
                              <span
                                className={
                                  variance === 0
                                    ? 'text-emerald-700'
                                    : variance > 0
                                    ? 'text-blue-700'
                                    : 'text-red-600'
                                }
                              >
                                {variance > 0 ? '+' : ''}₹{(variance / 100).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[#9AA0A6]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sub-Tab 3: Operational Expenses */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#6B7280]">Filter Method:</span>
              <select
                value={expenseMethodFilter}
                onChange={(e) => setExpenseMethodFilter(e.target.value)}
                className="rounded-lg border border-[#E8EAF0] bg-white px-3 py-1.5 text-xs text-[#202124]"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash Expenses Only</option>
                <option value="upi">UPI / Online Expenses</option>
                <option value="card">Card Expenses</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={cashApi.getExpensesCsvUrl({ payment_method: expenseMethodFilter !== 'all' ? expenseMethodFilter : undefined })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8EAF0] bg-white text-xs font-semibold text-[#202124] hover:bg-gray-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#F07818]" /> Export Expenses CSV
              </a>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowExpenseModal(true)}
                className="bg-[#F07818] hover:bg-[#D9660E] text-white text-xs flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Expense
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              {isExpensesLoading ? (
                <LoadingState message="Loading expenses records..." />
              ) : filteredExpenses.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7280]">No expense entries found.</div>
              ) : (
                <div className="overflow-x-auto border border-[#E8EAF0] rounded-xl bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F8FA] border-b border-[#E8EAF0] text-[#6B7280] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Recipient / Vendor</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EAF0]">
                      {filteredExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-[#F7F8FA]/60">
                          <td className="py-2.5 px-3 text-[#6B7280]">
                            {new Date(exp.expense_date).toLocaleDateString()}{' '}
                            {new Date(exp.expense_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#202124]">{exp.category}</td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={exp.payment_method === 'cash' ? 'warning' : 'neutral'}
                              size="sm"
                            >
                              {exp.payment_method.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-[#4B5563] max-w-xs truncate">{exp.description}</td>
                          <td className="py-2.5 px-3 text-[#6B7280]">{exp.recipient || '-'}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-[#202124]">
                            ₹{(exp.amount_paise / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Open Cash Shift */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleOpenShift}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-[#E8EAF0] pb-3">
              <Unlock className="h-5 w-5 text-[#F07818]" />
              <h3 className="text-base font-bold text-[#202124]">Open Cash Register / Shift</h3>
            </div>

            <div className="space-y-3">
              <Input
                label="Opening Cash Float (₹) *"
                type="number"
                min="0"
                step="1"
                value={openingFloatInr}
                onChange={(e) => setOpeningFloatInr(Number(e.target.value))}
                required
              />

              <Input
                label="Operator / Cashier Name *"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                required
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#202124]">Opening Notes (Optional)</label>
                <textarea
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="e.g. Counted ₹2,000 in notes and coins at shift handover"
                  className="w-full rounded-lg border border-[#E8EAF0] p-2 text-xs focus:border-[#F07818] focus:outline-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
              <Button type="button" variant="outline" onClick={() => setShowOpenModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={openShiftMutation.isPending}
                className="bg-[#F07818] hover:bg-[#D9660E] text-white"
              >
                {openShiftMutation.isPending ? 'Opening...' : 'Confirm & Open Shift'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Close Shift & Reconcile */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleCloseShift}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-[#E8EAF0] pb-3">
              <Lock className="h-5 w-5 text-red-600" />
              <h3 className="text-base font-bold text-[#202124]">
                Reconcile & Close Shift #{activeShift.shift_number}
              </h3>
            </div>

            {/* Reconciliation Breakdown */}
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Opening Float:</span>
                <span>₹{((activeShift.opening_cash_paise || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>(+) Cash Sales:</span>
                <span>+₹{((activeShift.cash_sales_paise || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>(+) Cash In:</span>
                <span>+₹{((activeShift.cash_in_paise || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>(-) Cash Out:</span>
                <span>-₹{((activeShift.cash_out_paise || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>(-) Cash Expenses:</span>
                <span>-₹{((activeShift.cash_expenses_paise || 0) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200 text-[#202124]">
                <span>Expected Drawer Total:</span>
                <span>₹{expectedInr.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                label="Actual Counted Cash in Till (₹) *"
                type="number"
                min="0"
                step="1"
                value={actualCashInr}
                onChange={(e) => setActualCashInr(Number(e.target.value))}
                required
              />

              {/* Variance Indicator */}
              <div
                className={`p-3 rounded-lg border text-xs font-bold flex justify-between ${
                  variancePreviewInr === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : variancePreviewInr > 0
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                <span>Reconciliation Variance:</span>
                <span>
                  {variancePreviewInr === 0
                    ? 'Balanced (₹0.00)'
                    : variancePreviewInr > 0
                    ? `Overage: +₹${variancePreviewInr.toFixed(2)}`
                    : `Shortage: -₹${Math.abs(variancePreviewInr).toFixed(2)}`}
                </span>
              </div>

              <Input
                label="Supervisor / Closing Operator"
                value={closingOperator}
                onChange={(e) => setClosingOperator(e.target.value)}
                placeholder="Leave blank to use current cashier name"
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#202124]">Closing Remarks (Optional)</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Explain any drawer discrepancy or coin shortages..."
                  className="w-full rounded-lg border border-[#E8EAF0] p-2 text-xs focus:border-[#F07818] focus:outline-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
              <Button type="button" variant="outline" onClick={() => setShowCloseModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={closeShiftMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {closeShiftMutation.isPending ? 'Closing...' : 'Confirm & Close Shift'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Cash In */}
      {showCashInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleCashIn}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-[#E8EAF0] pb-3">
              <Plus className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-bold text-[#202124]">Cash In (Add Cash to Drawer)</h3>
            </div>

            <div className="space-y-3">
              <Input
                label="Amount (₹) *"
                type="number"
                min="1"
                step="1"
                value={cashInAmountInr}
                onChange={(e) => setCashInAmountInr(Number(e.target.value))}
                required
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#202124]">Category / Reason</label>
                <select
                  value={cashInReason}
                  onChange={(e) => setCashInReason(e.target.value)}
                  className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs"
                >
                  <option value="FLOAT_ADDITION">Float Addition (More change/coins)</option>
                  <option value="PETTY_CASH_TOPUP">Petty Cash Top-up</option>
                  <option value="OWNER_DEPOSIT">Owner / Management Deposit</option>
                  <option value="OTHER">Other Cash Entry</option>
                </select>
              </div>

              <Input
                label="Notes (Optional)"
                value={cashInNotes}
                onChange={(e) => setCashInNotes(e.target.value)}
                placeholder="Reason or denomination breakdown"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
              <Button type="button" variant="outline" onClick={() => setShowCashInModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={cashInMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {cashInMutation.isPending ? 'Saving...' : 'Add Cash'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Cash Out */}
      {showCashOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleCashOut}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-[#E8EAF0] pb-3">
              <Minus className="h-5 w-5 text-amber-600" />
              <h3 className="text-base font-bold text-[#202124]">Cash Out (Withdraw Cash from Drawer)</h3>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-[#6B7280]">
                Maximum withdrawable cash: <strong>₹{expectedInr.toFixed(2)}</strong>
              </div>

              <Input
                label="Amount (₹) *"
                type="number"
                min="1"
                max={expectedInr}
                step="1"
                value={cashOutAmountInr}
                onChange={(e) => setCashOutAmountInr(Number(e.target.value))}
                required
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#202124]">Category / Reason</label>
                <select
                  value={cashOutReason}
                  onChange={(e) => setCashOutReason(e.target.value)}
                  className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs"
                >
                  <option value="BANK_DEPOSIT">Bank Safe Deposit</option>
                  <option value="OWNER_WITHDRAWAL">Owner / Manager Withdrawal</option>
                  <option value="VENDOR_PAYMENT">Vendor Direct Settlement</option>
                  <option value="OTHER">Other Cash Out</option>
                </select>
              </div>

              <Input
                label="Notes (Optional)"
                value={cashOutNotes}
                onChange={(e) => setCashOutNotes(e.target.value)}
                placeholder="Reason or receipt reference"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
              <Button type="button" variant="outline" onClick={() => setShowCashOutModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={cashOutMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {cashOutMutation.isPending ? 'Saving...' : 'Withdraw Cash'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add Expense */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleCreateExpense}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-[#E8EAF0] pb-3">
              <Receipt className="h-5 w-5 text-purple-600" />
              <h3 className="text-base font-bold text-[#202124]">Record Operational Expense</h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#202124]">Category *</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs"
                  >
                    <option value="Kitchen Supplies">Kitchen Supplies</option>
                    <option value="Groceries & Dairy">Groceries & Dairy</option>
                    <option value="Utilities & Bills">Utilities & Bills (Gas/Power)</option>
                    <option value="Maintenance">Maintenance & Repairs</option>
                    <option value="Packaging & Bags">Packaging & Bags</option>
                    <option value="Staff Welfare">Staff Welfare / Tea</option>
                    <option value="Marketing">Marketing & Promotion</option>
                    <option value="Other">Other Expense</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#202124]">Payment Mode *</label>
                  <select
                    value={expPaymentMethod}
                    onChange={(e) => setExpPaymentMethod(e.target.value as any)}
                    className="w-full rounded-lg border border-[#E8EAF0] bg-white px-3 py-2 text-xs"
                  >
                    <option value="cash">Cash (Deducts from Till)</option>
                    <option value="upi">UPI (GPay / PhonePe / QR)</option>
                    <option value="card">Card Payment</option>
                    <option value="other">Bank Transfer / Other</option>
                  </select>
                </div>
              </div>

              <Input
                label="Amount (₹) *"
                type="number"
                min="1"
                step="1"
                value={expAmountInr}
                onChange={(e) => setExpAmountInr(Number(e.target.value))}
                required
              />

              <Input
                label="Description / Purpose *"
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                placeholder="e.g. Purchased 5 kg fresh paneer and milk"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Vendor / Recipient"
                  value={expRecipient}
                  onChange={(e) => setExpRecipient(e.target.value)}
                  placeholder="e.g. Dairy Mart"
                />
                <Input
                  label="Receipt / Bill #"
                  value={expRefNumber}
                  onChange={(e) => setExpRefNumber(e.target.value)}
                  placeholder="e.g. BILL-492"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
              <Button type="button" variant="outline" onClick={() => setShowExpenseModal(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createExpenseMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {createExpenseMutation.isPending ? 'Saving...' : 'Record Expense'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
