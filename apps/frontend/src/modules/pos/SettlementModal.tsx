import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { billingApi } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatINR } from '@/lib/utils';
import { PaymentMethod } from '@/types';
import {
  Banknote,
  QrCode,
  CreditCard,
  CheckCircle2,
  Receipt,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export const SettlementModal: React.FC = () => {
  const {
    isSettlementModalOpen,
    closeSettlementModal,
    orderForSettlement,
    openReceiptModal,
    addToast,
  } = useUIStore();
  const { clearCart } = useCartStore();
  const queryClient = useQueryClient();

  const order = orderForSettlement;

  const [activePaymentMode, setActivePaymentMode] = useState<'single' | 'split'>('single');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [paymentAmountINR, setPaymentAmountINR] = useState<string>('');
  const [tenderedAmountINR, setTenderedAmountINR] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');

  // Discount states
  const [discountType, setDiscountType] = useState<'percentage' | 'amount' | null>(
    order?.discount_type || null
  );
  const [discountValue, setDiscountValue] = useState<number>(order?.discount_value || 0);

  // Split payment list
  const [splitPayments, setSplitPayments] = useState<
    Array<{ method: PaymentMethod; amountINR: number; reference?: string }>
  >([
    { method: 'upi', amountINR: 0 },
    { method: 'cash', amountINR: 0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch verified bill calculation from backend
  const { data: billCalc } = useQuery({
    queryKey: ['bill-calc', order?.id, discountType, discountValue],
    queryFn: () =>
      billingApi.calculateBill(order!.id, {
        discount_type: discountType || undefined,
        discount_value: discountValue,
      }),
    enabled: !!order,
  });

  const grandTotalPaise = billCalc ? billCalc.grand_total_paise : order?.total_paise || 0;
  const grandTotalINR = grandTotalPaise / 100.0;
  const previouslyPaidPaise = order?.paid_amount_paise || 0;
  const remainingDuePaise = Math.max(0, grandTotalPaise - previouslyPaidPaise);
  const remainingDueINR = remainingDuePaise / 100.0;

  useEffect(() => {
    if (remainingDueINR > 0) {
      if (!isPartialPayment) {
        setPaymentAmountINR(remainingDueINR.toFixed(2));
      }
      setTenderedAmountINR(remainingDueINR.toFixed(2));
    }
  }, [remainingDueINR, isPartialPayment]);

  if (!order) return null;

  const currentPayPaise = Math.round((parseFloat(paymentAmountINR) || remainingDueINR) * 100);
  const balanceAfterThisPayPaise = Math.max(0, remainingDuePaise - currentPayPaise);

  const tenderedPaise = Math.round((parseFloat(tenderedAmountINR) || currentPayPaise / 100.0) * 100);
  const changeDuePaise = selectedMethod === 'cash' ? Math.max(0, tenderedPaise - currentPayPaise) : 0;

  const handleSettle = async () => {
    setIsSubmitting(true);
    try {
      if (currentPayPaise <= 0) {
        addToast({
          type: 'error',
          title: 'Invalid Payment Amount',
          description: 'Payment amount must be greater than ₹0.',
        });
        setIsSubmitting(false);
        return;
      }

      if (currentPayPaise > remainingDuePaise) {
        addToast({
          type: 'error',
          title: 'Overpayment Blocked',
          description: `Payment (₹${(currentPayPaise / 100).toFixed(2)}) cannot exceed remaining due (₹${remainingDueINR.toFixed(2)}).`,
        });
        setIsSubmitting(false);
        return;
      }

      let paymentsPayload = [];

      if (activePaymentMode === 'single') {
        paymentsPayload.push({
          payment_method: selectedMethod,
          amount_paise: currentPayPaise,
          tendered_amount_paise: selectedMethod === 'cash' ? tenderedPaise : currentPayPaise,
          reference_number: referenceNumber.trim() || undefined,
        });
      } else {
        const totalSplitPaise = splitPayments.reduce(
          (sum, sp) => sum + Math.round((sp.amountINR || 0) * 100),
          0
        );
        if (totalSplitPaise !== currentPayPaise) {
          addToast({
            type: 'error',
            title: 'Split Mismatch',
            description: `Split total (₹${(totalSplitPaise / 100).toFixed(2)}) must exactly equal target payment (₹${(currentPayPaise / 100).toFixed(2)}).`,
          });
          setIsSubmitting(false);
          return;
        }

        paymentsPayload = splitPayments
          .filter((sp) => sp.amountINR > 0)
          .map((sp) => ({
            payment_method: sp.method,
            amount_paise: Math.round(sp.amountINR * 100),
            reference_number: sp.reference || undefined,
          }));
      }

      const result = await billingApi.settleOrder(order.id, {
        payments: paymentsPayload,
        discount_type: discountType || undefined,
        discount_value: discountValue,
      });

      addToast({
        type: 'success',
        title: result.order_status === 'completed' ? 'Order Settled Full!' : 'Partial Payment Recorded',
        description: result.message,
      });

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });

      clearCart();
      closeSettlementModal();

      // Open print receipt modal with formatted customer text
      openReceiptModal(result.receipt_text, result.invoice.invoice_number, order.id);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Settlement Failed',
        description: err.message || 'Could not process order settlement.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isSettlementModalOpen}
      onClose={closeSettlementModal}
      title={`Bill Settlement — ${order.order_code}`}
      description={`Customer: ${order.customer_name || 'Walk-in'} • Type: ${order.order_type.toUpperCase()} ${
        order.table_number_snapshot ? `• Table ${order.table_number_snapshot}` : ''
      }`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Invoice Summary Breakdown */}
        <div className="rounded-xl border border-[#E8EAF0] bg-[#FAFAFB] p-3.5 space-y-2 text-xs">
          <div className="flex justify-between text-[#6B7280]">
            <span>Items Subtotal</span>
            <span className="font-semibold text-[#202124]">
              {formatINR(billCalc?.subtotal_paise || order.subtotal_paise)}
            </span>
          </div>

          {/* Discount Selector */}
          <div className="flex items-center justify-between py-1 border-y border-[#E8EAF0]">
            <span className="text-[#6B7280]">Discount</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDiscountType(null);
                  setDiscountValue(0);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                  !discountType ? 'bg-[#F07818] text-white' : 'bg-white border text-[#6B7280]'
                }`}
              >
                None
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType('percentage');
                  setDiscountValue(5);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                  discountType === 'percentage' && discountValue === 5
                    ? 'bg-[#F07818] text-white'
                    : 'bg-white border text-[#6B7280]'
                }`}
              >
                5%
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscountType('percentage');
                  setDiscountValue(10);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                  discountType === 'percentage' && discountValue === 10
                    ? 'bg-[#F07818] text-white'
                    : 'bg-white border text-[#6B7280]'
                }`}
              >
                10%
              </button>
              <span className="font-bold text-[#DC2626] ml-2">
                -{formatINR(billCalc?.discount_paise || 0)}
              </span>
            </div>
          </div>

          <div className="flex justify-between text-[#6B7280]">
            <span>GST ({order.tax_rate_percent}%)</span>
            <span className="font-semibold text-[#202124]">
              +{formatINR(billCalc?.total_tax_paise || order.tax_paise)}
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-1.5 border-t border-[#E8EAF0] text-sm">
            <span className="font-bold text-[#202124]">Grand Total</span>
            <span className="text-lg font-black text-[#202124]">
              {formatINR(grandTotalPaise)}
            </span>
          </div>

          {previouslyPaidPaise > 0 && (
            <div className="flex justify-between text-xs text-[#16A34A] font-medium">
              <span>Previously Paid:</span>
              <span>{formatINR(previouslyPaidPaise)}</span>
            </div>
          )}

          <div className="flex justify-between items-baseline pt-1 border-t border-[#CBD5E1] text-sm">
            <span className="font-bold text-[#EA580C]">Remaining Due</span>
            <span className="text-xl font-black text-[#F07818]">
              {formatINR(remainingDuePaise)}
            </span>
          </div>
        </div>

        {/* Partial Payment Option */}
        <div className="p-3 bg-white rounded-xl border border-[#E8EAF0] space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#202124] flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPartialPayment}
                onChange={(e) => {
                  setIsPartialPayment(e.target.checked);
                  if (!e.target.checked) {
                    setPaymentAmountINR(remainingDueINR.toFixed(2));
                  }
                }}
                className="h-4 w-4 rounded text-[#F07818] focus:ring-[#F07818]"
              />
              Accept Partial Payment
            </label>
            <span className="text-[11px] text-[#6B7280]">
              {isPartialPayment ? 'Custom amount entry enabled' : 'Settling full due amount'}
            </span>
          </div>

          {isPartialPayment && (
            <div className="pt-2 grid grid-cols-2 gap-3 border-t border-[#E8EAF0]">
              <div>
                <label className="text-[11px] font-semibold text-[#374151] block mb-1">
                  Payment Amount to Collect (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={remainingDueINR}
                  value={paymentAmountINR}
                  onChange={(e) => setPaymentAmountINR(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[#E8EAF0] focus:border-[#F07818] focus:outline-none font-bold"
                />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#6B7280] block mb-1">
                  Balance Remaining After This
                </span>
                <span className="text-sm font-bold text-[#DC2626] block pt-1.5">
                  {formatINR(balanceAfterThisPayPaise)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Mode Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#202124] uppercase tracking-wider">
              Payment Method
            </label>
            <div className="flex gap-1 bg-[#F3F4F6] p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setActivePaymentMode('single')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activePaymentMode === 'single'
                    ? 'bg-white text-[#202124] shadow-2xs'
                    : 'text-[#6B7280]'
                }`}
              >
                Single Method
              </button>
              <button
                type="button"
                onClick={() => {
                  setActivePaymentMode('split');
                  setSplitPayments([
                    { method: 'upi', amountINR: Math.round(currentPayPaise / 200) },
                    { method: 'cash', amountINR: (currentPayPaise / 100) - Math.round(currentPayPaise / 200) },
                  ]);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activePaymentMode === 'split'
                    ? 'bg-white text-[#202124] shadow-2xs'
                    : 'text-[#6B7280]'
                }`}
              >
                Split / Multi-Pay
              </button>
            </div>
          </div>

          {activePaymentMode === 'single' ? (
            <div className="space-y-3">
              {/* Payment Method Pills */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
                  { id: 'upi', label: 'UPI / QR', icon: <QrCode className="h-4 w-4" /> },
                  { id: 'card', label: 'Card / POS', icon: <CreditCard className="h-4 w-4" /> },
                  { id: 'other', label: 'Other', icon: <Receipt className="h-4 w-4" /> },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethod(m.id as PaymentMethod)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border font-semibold text-xs transition-all cursor-pointer ${
                      selectedMethod === m.id
                        ? 'border-[#F07818] bg-[#FFF0E3] text-[#C85A0A] shadow-xs'
                        : 'border-[#E8EAF0] bg-white text-[#6B7280] hover:bg-[#F7F8FA]'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Cash Tendered & Change Due */}
              {selectedMethod === 'cash' && (
                <div className="rounded-xl border border-[#E8EAF0] p-3.5 bg-white space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Input
                        label="Cash Given by Customer (₹)"
                        type="number"
                        value={tenderedAmountINR}
                        onChange={(e) => setTenderedAmountINR(e.target.value)}
                        placeholder={(currentPayPaise / 100).toString()}
                      />
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-[#6B7280]">Change to Return</span>
                      <p className="text-lg font-bold text-[#16865B] mt-0.5">
                        {formatINR(changeDuePaise)}
                      </p>
                    </div>
                  </div>

                  {/* Quick Tender Chips */}
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[11px] text-[#6B7280]">Quick Notes:</span>
                    {[
                      { label: 'Exact', val: currentPayPaise / 100 },
                      { label: '+₹100', val: Math.ceil((currentPayPaise / 100) / 100) * 100 },
                      { label: '+₹500', val: Math.ceil((currentPayPaise / 100) / 500) * 500 },
                      { label: '₹1000', val: 1000 },
                      { label: '₹2000', val: 2000 },
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTenderedAmountINR(chip.val.toString())}
                        className="px-2 py-0.5 rounded-md border border-[#E8EAF0] bg-[#FAFAFB] text-[11px] font-medium text-[#202124] hover:bg-[#FFF0E3] hover:border-[#F07818] cursor-pointer"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reference / UTR for UPI or Card */}
              {selectedMethod !== 'cash' && (
                <Input
                  label="Reference Number / UTR / Auth Code (Optional)"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. UPI Ref / Transaction ID"
                />
              )}
            </div>
          ) : (
            /* Split Payment UI */
            <div className="space-y-2.5 rounded-xl border border-[#E8EAF0] p-3.5 bg-white">
              <div className="flex justify-between text-xs text-[#6B7280] pb-1">
                <span>Split Rows</span>
                <span>Target Payment: <strong>₹{(currentPayPaise / 100).toFixed(2)}</strong></span>
              </div>
              {splitPayments.map((sp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={sp.method}
                    onChange={(e) => {
                      const updated = [...splitPayments];
                      updated[idx].method = e.target.value as PaymentMethod;
                      setSplitPayments(updated);
                    }}
                    className="h-9 rounded-md border border-[#E8EAF0] bg-white px-2.5 text-xs font-semibold text-[#202124]"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>

                  <Input
                    type="number"
                    value={sp.amountINR || ''}
                    onChange={(e) => {
                      const updated = [...splitPayments];
                      updated[idx].amountINR = parseFloat(e.target.value) || 0;
                      setSplitPayments(updated);
                    }}
                    placeholder="Amount in ₹"
                  />

                  {splitPayments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSplitPayments(splitPayments.filter((_, i) => i !== idx))}
                      className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                onClick={() =>
                  setSplitPayments([...splitPayments, { method: 'cash', amountINR: 0 }])
                }
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Split Row</span>
              </Button>
            </div>
          )}
        </div>

        {/* Settlement Submit Action */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E8EAF0]">
          <Button type="button" onClick={closeSettlementModal} variant="outline" size="sm">
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSettle}
            variant="success"
            isLoading={isSubmitting}
            className="px-5 gap-2 text-xs font-bold shadow-md shadow-[#16865B]/20"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {balanceAfterThisPayPaise === 0
                ? `Complete Settle • ${formatINR(currentPayPaise)}`
                : `Record Partial • ${formatINR(currentPayPaise)}`}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
