import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi, kotApi, billingApi, menuApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { formatINR, formatDateTime } from '@/lib/utils';
import { Order, OrderStatus, PaymentStatus, OrderType, Refund } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import {
  ReceiptText,
  Printer,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Clock,
  User,
  Phone,
  MapPin,
  UtensilsCrossed,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  FileText,
  CreditCard,
  PlusCircle,
  Calendar,
} from 'lucide-react';

export const OrdersView: React.FC = () => {
  const queryClient = useQueryClient();
  const { openSettlementModal, openReceiptModal, openKOTModal, setCurrentRoute, addToast } = useUIStore();
  const { loadExistingOrder } = useCartStore();

  // Filters state
  const [quickFilter, setQuickFilter] = useState<'all' | 'today' | 'active' | 'completed' | 'cancelled' | 'unpaid'>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Order for drawer/detail
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Dialog states
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation');
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmountINR, setRefundAmountINR] = useState<string>('');
  const [refundReason, setRefundReason] = useState('Customer dissatisfaction');
  const [refundPaymentMethod, setRefundPaymentMethod] = useState('cash');

  // Query orders with all active filters
  const { data: orders = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      'orders',
      quickFilter,
      searchTerm,
      orderTypeFilter,
      orderStatusFilter,
      paymentStatusFilter,
      startDate,
      endDate,
    ],
    queryFn: () =>
      ordersApi.listOrders({
        quick_filter: quickFilter !== 'all' ? quickFilter : undefined,
        search: searchTerm.trim() || undefined,
        order_type: orderTypeFilter !== 'all' ? orderTypeFilter : undefined,
        status: orderStatusFilter !== 'all' ? orderStatusFilter : undefined,
        payment_status: paymentStatusFilter !== 'all' ? paymentStatusFilter : undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
        limit: 150,
      }),
    refetchInterval: 6000,
  });

  // Query selected order in-depth (with KOTs & Invoice)
  const { data: orderDetail } = useQuery({
    queryKey: ['order-detail', selectedOrderId],
    queryFn: () => (selectedOrderId ? ordersApi.getOrder(selectedOrderId) : null),
    enabled: !!selectedOrderId,
  });

  // Statistics calculation for the header bar
  const stats = useMemo(() => {
    const totalCount = orders.length;
    const totalPaise = orders.reduce((acc, o) => acc + (o.status !== 'cancelled' ? o.total_paise : 0), 0);
    const paidPaise = orders.reduce((acc, o) => acc + (o.paid_amount_paise || 0), 0);
    const duePaise = orders.reduce(
      (acc, o) => acc + (o.status !== 'cancelled' ? (o.due_amount_paise ?? o.total_paise) : 0),
      0
    );
    const activeCount = orders.filter((o) => o.status === 'open' || o.status === 'active' || o.status === 'bill_generated').length;

    return { totalCount, totalPaise, paidPaise, duePaise, activeCount };
  }, [orders]);

  // Actions
  const handleOpenInPOS = async (order: Order) => {
    try {
      const allItems = await menuApi.listItems();
      loadExistingOrder(order, allItems);
      setCurrentRoute('pos');
      addToast({
        type: 'info',
        title: 'Order Loaded in POS',
        description: `Order ${order.order_code} is now active in the checkout cart.`,
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const handleGenerateBill = async (orderId: string) => {
    try {
      await billingApi.generateBill(orderId);
      addToast({
        type: 'success',
        title: 'Bill Generated',
        description: 'Invoice snapshot created and table marked for billing.',
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Billing Error', description: err.message });
    }
  };

  const handlePrintReceipt = async (orderId: string, format: '58mm' | '80mm' = '80mm') => {
    try {
      const res = await billingApi.getReceiptText(orderId, format);
      openReceiptModal(res.receipt_text, res.invoice_number, orderId);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Print Error', description: err.message });
    }
  };

  const handleViewA4Invoice = (orderId: string) => {
    const url = billingApi.getA4InvoiceUrl(orderId);
    window.open(url, '_blank', 'width=900,height=900');
  };

  const handleReprintKOT = async (kotId: string) => {
    try {
      const res = await kotApi.reprintKOT(kotId);
      openKOTModal(res);
    } catch (err: any) {
      addToast({ type: 'error', title: 'KOT Error', description: err.message });
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedOrderId) return;
    try {
      await ordersApi.cancelOrder(selectedOrderId, cancelReason);
      addToast({
        type: 'info',
        title: 'Order Cancelled',
        description: `Order successfully cancelled with audit reason.`,
      });
      setCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail', selectedOrderId] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Cancellation Error', description: err.message });
    }
  };

  const handleConfirmRefund = async () => {
    if (!selectedOrderId || !refundAmountINR) return;
    const amountPaise = Math.round(parseFloat(refundAmountINR) * 100);
    if (isNaN(amountPaise) || amountPaise <= 0) {
      addToast({ type: 'error', title: 'Invalid Amount', description: 'Please enter a valid refund amount.' });
      return;
    }
    try {
      await billingApi.refundOrder(selectedOrderId, {
        amount_paise: amountPaise,
        reason: refundReason,
        payment_method: refundPaymentMethod,
      });
      addToast({
        type: 'success',
        title: 'Refund Processed',
        description: `₹${refundAmountINR} refund recorded without deleting payment records.`,
      });
      setRefundModalOpen(false);
      setRefundAmountINR('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-detail', selectedOrderId] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Refund Error', description: err.message });
    }
  };

  const getOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm">COMPLETED</Badge>;
      case 'bill_generated':
        return <Badge variant="warning" size="sm">BILL PRINTED</Badge>;
      case 'active':
      case 'open':
        return <Badge variant="bhagwa" size="sm">ACTIVE / IN KITCHEN</Badge>;
      case 'cancelled':
        return <Badge variant="danger" size="sm">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return <Badge variant="success" size="sm">PAID</Badge>;
      case 'partially_paid':
        return <Badge variant="warning" size="sm">PARTIAL PAID</Badge>;
      case 'unpaid':
        return <Badge variant="danger" size="sm">UNPAID</Badge>;
      case 'refunded':
        return <Badge variant="neutral" size="sm">REFUNDED</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status || 'UNPAID'}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#202124]">Orders & Billing Registry</h2>
          <p className="text-xs text-[#6B7280]">
            Audit, inspect, bill, and manage restaurant orders across dine-in, takeaway, and delivery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 h-8 text-xs font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCurrentRoute('pos')}
            className="gap-1.5 h-8 text-xs font-semibold shadow-xs"
          >
            <PlusCircle className="h-4 w-4" />
            New Order in POS
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E8EAF0] bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">Total Listed</span>
          <span className="text-xl font-black text-[#202124] mt-0.5 block">{stats.totalCount} orders</span>
          <span className="text-[10px] text-[#6B7280]">Value: {formatINR(stats.totalPaise)}</span>
        </div>
        <div className="rounded-xl border border-[#E8EAF0] bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#16A34A] uppercase tracking-wider block">Total Collected</span>
          <span className="text-xl font-black text-[#16A34A] mt-0.5 block">{formatINR(stats.paidPaise)}</span>
          <span className="text-[10px] text-[#6B7280]">Settled payments</span>
        </div>
        <div className="rounded-xl border border-[#E8EAF0] bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#EA580C] uppercase tracking-wider block">Pending Due</span>
          <span className="text-xl font-black text-[#EA580C] mt-0.5 block">{formatINR(stats.duePaise)}</span>
          <span className="text-[10px] text-[#6B7280]">Awaiting settlement</span>
        </div>
        <div className="rounded-xl border border-[#E8EAF0] bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-semibold text-[#F07818] uppercase tracking-wider block">Active Open</span>
          <span className="text-xl font-black text-[#F07818] mt-0.5 block">{stats.activeCount} orders</span>
          <span className="text-[10px] text-[#6B7280]">Kitchen or uncompleted</span>
        </div>
      </div>

      {/* Quick Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'today', label: "Today's Orders" },
            { id: 'active', label: 'Active & Kitchen' },
            { id: 'unpaid', label: 'Unpaid / Partially Paid' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
            { id: 'all', label: 'All Time' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setQuickFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              quickFilter === tab.id
                ? 'bg-[#F07818] text-white shadow-xs'
                : 'bg-white text-[#4B5563] border border-[#E8EAF0] hover:border-[#D1D5DB]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Advanced Filter & Search Row */}
      <div className="rounded-xl border border-[#E8EAF0] bg-white p-3 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Search Input */}
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search order #, customer, phone, table..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] text-[#202124] placeholder-[#9CA3AF] focus:bg-white focus:border-[#F07818] focus:outline-none"
          />
        </div>

        {/* Order Type */}
        <div>
          <select
            value={orderTypeFilter}
            onChange={(e) => setOrderTypeFilter(e.target.value)}
            className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] text-[#202124] focus:bg-white focus:border-[#F07818] focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="dine_in">Dine-in</option>
            <option value="takeaway">Takeaway</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>

        {/* Order Status */}
        <div>
          <select
            value={orderStatusFilter}
            onChange={(e) => setOrderStatusFilter(e.target.value)}
            className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] text-[#202124] focus:bg-white focus:border-[#F07818] focus:outline-none"
          >
            <option value="all">All Order Statuses</option>
            <option value="active">Active (Open)</option>
            <option value="bill_generated">Bill Generated</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Payment Status */}
        <div>
          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="w-full py-1.5 px-2.5 text-xs rounded-lg border border-[#E8EAF0] bg-[#FAFAFB] text-[#202124] focus:bg-white focus:border-[#F07818] focus:outline-none"
          >
            <option value="all">All Payment Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid in Full</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        {/* Reset Filters */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setOrderTypeFilter('all');
              setOrderStatusFilter('all');
              setPaymentStatusFilter('all');
              setStartDate('');
              setEndDate('');
              setQuickFilter('today');
            }}
            className="w-full h-8 text-[11px]"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Main Content Area: Table Grid (left) + Order Drawer (right) */}
      {isLoading ? (
        <LoadingState message="Loading orders registry..." />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-10 w-10 text-[#F07818]" />}
          title="No orders found"
          description="There are no orders matching your selected filters."
          actionLabel="Open POS Cashier"
          onAction={() => setCurrentRoute('pos')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Orders Table (7 cols on large screens, or full width if none selected) */}
          <div className={`${selectedOrderId ? 'lg:col-span-7' : 'lg:col-span-12'} rounded-card border border-[#E8EAF0] bg-white shadow-card overflow-hidden transition-all`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFB] border-b border-[#E8EAF0] text-[#6B7280] font-semibold">
                  <tr>
                    <th className="py-3 px-3.5">Order</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Date / Time</th>
                    <th className="py-3 px-3 text-right">Items</th>
                    <th className="py-3 px-3 text-right">Grand Total</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-3 text-right">Due</th>
                    <th className="py-3 px-3 text-center">Payment</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAF0]">
                  {orders.map((ord) => {
                    const isSelected = selectedOrderId === ord.id;
                    const itemsCount = ord.items ? ord.items.reduce((sum, it) => sum + it.quantity, 0) : 0;
                    const dueAmt = ord.due_amount_paise ?? ord.total_paise;

                    return (
                      <tr
                        key={ord.id}
                        onClick={() => setSelectedOrderId(ord.id)}
                        className={`hover:bg-[#FFF8F2] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#FFF0E3]/70 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-3.5">
                          <span className="font-bold text-[#202124] block">{ord.order_code}</span>
                          {ord.customer_name && (
                            <span className="text-[11px] text-[#6B7280] block truncate max-w-[120px]">
                              {ord.customer_name}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-[#374151] block uppercase text-[11px]">
                            {ord.order_type.replace('_', ' ')}
                          </span>
                          {ord.table_number_snapshot && (
                            <span className="text-[11px] font-bold text-[#F07818] block">
                              Table {ord.table_number_snapshot}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#6B7280] text-[11px]">
                          {formatDateTime(ord.created_at)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-[#374151]">
                          {itemsCount}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#202124]">
                          {formatINR(ord.total_paise)}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-[#16A34A]">
                          {formatINR(ord.paid_amount_paise || 0)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#DC2626]">
                          {ord.status === 'cancelled' ? '—' : formatINR(dueAmt)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {getPaymentStatusBadge(ord.payment_status || (ord.status === 'completed' ? 'paid' : 'unpaid'))}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {getOrderStatusBadge(ord.status)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Details Drawer / Sidebar (5 cols) */}
          {selectedOrderId && orderDetail && (
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-[#F07818]/30 shadow-md">
                <CardHeader className="pb-3 border-b border-[#E8EAF0] bg-[#FAFAFB]">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{orderDetail.order_code}</CardTitle>
                        {getOrderStatusBadge(orderDetail.status)}
                        {getPaymentStatusBadge(orderDetail.payment_status)}
                      </div>
                      <p className="text-xs text-[#6B7280] mt-1 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(orderDetail.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOrderId(null)}
                      className="h-7 w-7 p-0 text-[#6B7280] hover:text-[#202124]"
                    >
                      ✕
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-5 text-xs">
                  {/* Meta Details: Type, Table, Customer */}
                  <div className="grid grid-cols-2 gap-3 bg-[#F9FAFB] p-3 rounded-lg border border-[#E8EAF0]">
                    <div>
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase block">Order Type</span>
                      <span className="font-bold text-[#202124] uppercase text-xs">
                        {orderDetail.order_type.replace('_', ' ')}
                      </span>
                      {orderDetail.table_number_snapshot && (
                        <span className="text-xs font-bold text-[#F07818] block mt-0.5">
                          Table {orderDetail.table_number_snapshot}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase block">Customer</span>
                      <span className="font-semibold text-[#202124] block">
                        {orderDetail.customer_name || 'Walk-in Customer'}
                      </span>
                      {orderDetail.customer_phone && (
                        <span className="text-[#6B7280] block text-[11px]">
                          📞 {orderDetail.customer_phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cancellation Reason if cancelled */}
                  {orderDetail.status === 'cancelled' && (
                    <div className="p-3 bg-[#FEF2F2] border border-[#FECDD3] rounded-lg">
                      <span className="font-bold text-[#991B1B] block">Order Cancelled</span>
                      <p className="text-[11px] text-[#B91C1C] mt-0.5">
                        Reason: {orderDetail.cancellation_reason || 'No reason provided'}
                      </p>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-[#374151] uppercase tracking-wider block">
                      Order Actions
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {/* Active Order Actions */}
                      {(orderDetail.status === 'open' || orderDetail.status === 'active' || orderDetail.status === 'bill_generated') && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenInPOS(orderDetail)}
                            className="gap-1.5 h-8 text-xs font-semibold shadow-xs"
                          >
                            <UtensilsCrossed className="h-3.5 w-3.5" />
                            Continue in POS
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openSettlementModal(orderDetail)}
                            className="gap-1.5 h-8 text-xs font-semibold bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] hover:bg-[#D1FAE5]"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Settle / Pay
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateBill(orderDetail.id)}
                            className="gap-1.5 h-8 text-xs font-semibold"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Generate Bill
                          </Button>
                        </>
                      )}

                      {/* Print Options */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintReceipt(orderDetail.id, '80mm')}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        80mm Thermal
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintReceipt(orderDetail.id, '58mm')}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        58mm Thermal
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewA4Invoice(orderDetail.id)}
                        className="gap-1.5 h-8 text-xs"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Print A4
                      </Button>

                      {/* Refund if paid */}
                      {(orderDetail.paid_amount_paise > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRefundAmountINR((orderDetail.paid_amount_paise / 100).toFixed(2));
                            setRefundModalOpen(true);
                          }}
                          className="gap-1.5 h-8 text-xs text-[#DC2626] border-[#FCA5A5] hover:bg-[#FEF2F2]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Issue Refund
                        </Button>
                      )}

                      {/* Cancel order if not completed */}
                      {orderDetail.status !== 'completed' && orderDetail.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelModalOpen(true)}
                          className="gap-1.5 h-8 text-xs text-[#DC2626] border-[#FCA5A5] hover:bg-[#FEF2F2]"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancel Order
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Ordered Items List */}
                  <div>
                    <span className="text-[11px] font-bold text-[#374151] uppercase tracking-wider block mb-2">
                      Items Breakdown ({orderDetail.items.length})
                    </span>
                    <div className="divide-y divide-[#E8EAF0] border border-[#E8EAF0] rounded-lg overflow-hidden bg-white">
                      {orderDetail.items.map((item) => (
                        <div key={item.id} className="p-2.5 flex items-start justify-between">
                          <div>
                            <div className="font-bold text-[#202124]">
                              {item.quantity}x {item.item_name}
                            </div>
                            {item.variant_name && (
                              <div className="text-[11px] text-[#C85A0A] font-medium">
                                Size: {item.variant_name}
                              </div>
                            )}
                            {item.addons && item.addons.length > 0 && (
                              <div className="text-[11px] text-[#6B7280]">
                                + {item.addons.map((a) => `${a.addon_name} (₹${a.price_paise / 100})`).join(', ')}
                              </div>
                            )}
                            {item.notes && (
                              <div className="text-[11px] text-[#EA580C] italic">
                                Note: {item.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[#202124] block">
                              {formatINR(item.line_total_paise)}
                            </span>
                            <span className="text-[10px] text-[#6B7280] block">
                              @{formatINR(item.unit_price_paise)} each
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-1.5">
                    <div className="flex justify-between text-[#64748B]">
                      <span>Subtotal:</span>
                      <span className="font-semibold text-[#1E293B]">{formatINR(orderDetail.subtotal_paise)}</span>
                    </div>
                    {orderDetail.discount_paise > 0 && (
                      <div className="flex justify-between text-[#DC2626]">
                        <span>Discount:</span>
                        <span className="font-semibold">-{formatINR(orderDetail.discount_paise)}</span>
                      </div>
                    )}
                    {orderDetail.cgst_paise > 0 && (
                      <div className="flex justify-between text-[#64748B]">
                        <span>CGST ({orderDetail.tax_rate_percent / 2}%):</span>
                        <span className="font-semibold text-[#1E293B]">{formatINR(orderDetail.cgst_paise)}</span>
                      </div>
                    )}
                    {orderDetail.sgst_paise > 0 && (
                      <div className="flex justify-between text-[#64748B]">
                        <span>SGST ({orderDetail.tax_rate_percent / 2}%):</span>
                        <span className="font-semibold text-[#1E293B]">{formatINR(orderDetail.sgst_paise)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-[#202124] pt-1.5 border-t border-[#CBD5E1]">
                      <span>Grand Total:</span>
                      <span className="text-[#F07818]">{formatINR(orderDetail.total_paise)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-[#16A34A] font-semibold">
                      <span>Paid Amount:</span>
                      <span>{formatINR(orderDetail.paid_amount_paise || 0)}</span>
                    </div>
                    {(orderDetail.due_amount_paise ?? orderDetail.total_paise) > 0 && orderDetail.status !== 'cancelled' && (
                      <div className="flex justify-between text-xs text-[#DC2626] font-bold">
                        <span>Balance Due:</span>
                        <span>{formatINR(orderDetail.due_amount_paise ?? orderDetail.total_paise)}</span>
                      </div>
                    )}
                  </div>

                  {/* KOT History */}
                  {orderDetail.kots && orderDetail.kots.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-[#374151] uppercase tracking-wider block mb-2">
                        KOT History ({orderDetail.kots.length})
                      </span>
                      <div className="space-y-2">
                        {orderDetail.kots.map((k) => (
                          <div
                            key={k.id}
                            className="p-2.5 rounded-lg border border-[#E8EAF0] bg-white flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-[#202124]">{k.kot_code}</span>
                              <span className="text-[11px] text-[#6B7280] block">
                                {formatDateTime(k.created_at)} • {k.items.length} items
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReprintKOT(k.id)}
                              className="h-7 text-[11px] px-2 gap-1"
                            >
                              <Printer className="h-3 w-3" />
                              Reprint
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payments & Invoices */}
                  {orderDetail.invoice && (
                    <div>
                      <span className="text-[11px] font-bold text-[#374151] uppercase tracking-wider block mb-2">
                        Invoice & Payments ({orderDetail.invoice.invoice_number})
                      </span>
                      {orderDetail.invoice.payments && orderDetail.invoice.payments.length > 0 ? (
                        <div className="space-y-1.5 border border-[#E8EAF0] rounded-lg p-2.5 bg-white">
                          {orderDetail.invoice.payments.map((p) => (
                            <div key={p.id} className="flex justify-between items-center text-xs">
                              <div>
                                <span className="font-bold text-[#202124] uppercase">{p.payment_method}</span>
                                {p.reference_number && (
                                  <span className="text-[10px] text-[#6B7280] block">
                                    Ref: {p.reference_number}
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-[#16A34A]">{formatINR(p.amount_paise)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#6B7280] italic">
                          No payments recorded yet for this invoice.
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#202124]">Cancel Order</h3>
                <p className="text-xs text-[#6B7280]">
                  This action is permanent and will release any occupied table.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#374151] block mb-1.5">
                Cancellation Reason (Required for audit log)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason e.g. Customer cancelled, duplicate entry..."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-[#E8EAF0] focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModalOpen(false)}
                className="text-xs"
              >
                Never mind
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmCancel}
                className="text-xs font-semibold"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#202124]">Issue Refund</h3>
                <p className="text-xs text-[#6B7280]">
                  Original payment records remain intact for financial auditing.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">
                  Refund Amount (₹ INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={refundAmountINR}
                  onChange={(e) => setRefundAmountINR(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[#E8EAF0] focus:border-[#F07818] focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">
                  Refund Method
                </label>
                <select
                  value={refundPaymentMethod}
                  onChange={(e) => setRefundPaymentMethod(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-[#E8EAF0] bg-white focus:border-[#F07818] focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="original">Original Method</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#374151] block mb-1">
                  Refund Reason
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Reason for refund..."
                  rows={2}
                  className="w-full text-xs p-2 rounded-lg border border-[#E8EAF0] focus:border-[#F07818] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefundModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmRefund}
                className="text-xs font-semibold"
              >
                Process Refund
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
