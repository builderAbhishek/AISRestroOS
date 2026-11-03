import React, { useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { billingApi } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatINR, formatINRNumber } from '@/lib/utils';
import { PaymentMethod } from '@/types';
import {
  Banknote,
  QrCode,
  CreditCard,
  Layers,
  CheckCircle2,
  Receipt,
  Plus,
  Trash2,
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
  const { data: billCalc, refetch: refetchBill } = useQuery({
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

  useEffect(() => {
    if (grandTotalINR > 0 && (!tenderedAmountINR || parseFloat(tenderedAmountINR) < grandTotalINR)) {
      setTenderedAmountINR(grandTotalINR.toString());
    }
  }, [grandTotalINR]);

  if (!order) return null;

  const tenderedPaise = Math.round((parseFloat(tenderedAmountINR) || grandTotalINR) * 100);
  const changeDuePaise = Math.max(0, tenderedPaise - grandTotalPaise);

  const handleSettle = async () => {
    setIsSubmitting(true);
    try {
      let paymentsPayload = [];

      if (activePaymentMode === 'single') {
        paymentsPayload.push({
          payment_method: selectedMethod,
          amount_paise: grandTotalPaise,
          tendered_amount_paise: selectedMethod === 'cash' ? tenderedPaise : grandTotalPaise,
          reference_number: referenceNumber.trim() || undefined,
        });
      } else {
        const totalSplitPaise = splitPayments.reduce(
          (sum, sp) => sum + Math.round((sp.amountINR || 0) * 100),
          0
        );
        if (totalSplitPaise < grandTotalPaise) {
          addToast({
            type: 'error',
            title: 'Incomplete Split Payment',
            description: `Split total (₹${totalSplitPaise / 100}) does not cover grand total (₹${grandTotalINR}).`,
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
        title: 'Order Settled Successfully!',
        description: `Order ${order.order_code} marked completed. Receipt generated.`,
      });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });

      clearCart();
      closeSettlementModal();

      // Open print receipt modal
      openReceiptModal(result.receipt_text, result.invoice.invoice_number);
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
      <div className="space-y-5">
        {/* Invoice Summary Breakdown */}
        <div className="rounded-xl border border-[#E8EAF0] bg-[#FAFAFB] p-4 space-y-2 text-xs">
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
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
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
                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  discountType === 'percentage' && discountValue === 10
                    ? 'bg-[#F07818] text-white'
                    : 'bg-white border text-[#6B7280]'
                }`}
              >
                10%
              </button>
              <span className="font-bold text-[#D94343] ml-2">
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

          <div className="flex justify-between items-baseline pt-2 border-t border-[#E8EAF0] text-sm">
            <span className="font-bold text-[#202124]">Grand Total</span>
            <span className="text-xl font-extrabold text-[#F07818]">
              {formatINR(grandTotalPaise)}
            </span>
          </div>
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
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activePaymentMode === 'single'
                    ? 'bg-white text-[#202124] shadow-2xs'
                    : 'text-[#6B7280]'
                }`}
              >
                Single Method
              </button>
              <button
                type="button"
                onClick={() => setActivePaymentMode('split')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
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
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border font-semibold text-xs transition-all cursor-pointer ${
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
                <div className="rounded-xl border border-[#E8EAF0] p-4 bg-white space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Input
                        label="Cash Tendered by Customer (₹)"
                        type="number"
                        value={tenderedAmountINR}
                        onChange={(e) => setTenderedAmountINR(e.target.value)}
                        placeholder={grandTotalINR.toString()}
                      />
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-[#6B7280]">Change Return Due</span>
                      <p className="text-lg font-bold text-[#16865B] mt-1">
                        {formatINR(changeDuePaise)}
                      </p>
                    </div>
                  </div>

                  {/* Quick Tender Chips */}
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[11px] text-[#6B7280]">Exact / Notes:</span>
                    {[
                      { label: 'Exact', val: grandTotalINR },
                      { label: '+₹100', val: Math.ceil(grandTotalINR / 100) * 100 },
                      { label: '+₹500', val: Math.ceil(grandTotalINR / 500) * 500 },
                      { label: '₹1000', val: 1000 },
                      { label: '₹2000', val: 2000 },
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTenderedAmountINR(chip.val.toString())}
                        className="px-2 py-0.5 rounded-md border border-[#E8EAF0] bg-[#FAFAFB] text-[11px] font-medium text-[#202124] hover:bg-[#FFF0E3] hover:border-[#F07818]"
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
            <div className="space-y-3 rounded-xl border border-[#E8EAF0] p-4 bg-white">
              {splitPayments.map((sp, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={sp.method}
                    onChange={(e) => {
                      const updated = [...splitPayments];
                      updated[idx].method = e.target.value as PaymentMethod;
                      setSplitPayments(updated);
                    }}
                    className="h-10 rounded-btn border border-[#E8EAF0] bg-white px-3 text-xs font-semibold text-[#202124]"
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
                      className="p-2 text-[#D94343] hover:bg-[#FDECEC] rounded-lg"
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
                <span>Add Another Split Row</span>
              </Button>
            </div>
          )}
        </div>

        {/* Settlement Submit Action */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E8EAF0]">
          <Button type="button" onClick={closeSettlementModal} variant="outline">
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSettle}
            variant="success"
            isLoading={isSubmitting}
            className="px-6 gap-2 text-sm font-bold shadow-md shadow-[#16865B]/20"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Complete & Print Receipt • {formatINR(grandTotalPaise)}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
