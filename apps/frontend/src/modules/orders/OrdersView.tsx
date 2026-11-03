import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersApi, kotApi, billingApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { formatINR, formatDateTime } from '@/lib/utils';
import { Order } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import {
  ReceiptText,
  Printer,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  UtensilsCrossed,
} from 'lucide-react';

export const OrdersView: React.FC = () => {
  const queryClient = useQueryClient();
  const { openSettlementModal, openReceiptModal, openKOTModal, setCurrentRoute, addToast } = useUIStore();
  const { loadExistingOrder } = useCartStore();

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () =>
      ordersApi.listOrders({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      }),
    refetchInterval: 5000,
  });

  const handleReprintReceipt = async (orderId: string) => {
    try {
      const res = await billingApi.getReceiptText(orderId);
      openReceiptModal(res.receipt_text, res.invoice_number);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      await ordersApi.cancelOrder(orderId);
      addToast({ type: 'info', title: 'Order Cancelled', description: 'Order cancelled successfully.' });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Filter Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202124]">Orders & KOT Audit</h2>
          <p className="text-xs text-[#6B7280]">
            Complete history of active kitchen orders, completed invoices and settled bills
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center rounded-xl border border-[#E8EAF0] bg-white p-1 shadow-2xs">
          {(
            [
              { id: 'all', label: 'All Orders' },
              { id: 'active', label: 'Active Kitchen / Tables' },
              { id: 'completed', label: 'Settled & Completed' },
              { id: 'cancelled', label: 'Cancelled' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-[#F07818] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading orders registry..." />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-8 w-8 text-[#F07818]" />}
          title="No orders found"
          description="There are no orders matching this filter."
          actionLabel="Create Order on POS"
          onAction={() => setCurrentRoute('pos')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Orders Table List (2 columns) */}
          <div className="lg:col-span-2 rounded-card border border-[#E8EAF0] bg-white shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAFAFB] border-b border-[#E8EAF0] text-[#6B7280] font-semibold">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Type / Table</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAF0]">
                  {orders.map((order) => {
                    const isSelected = selectedOrder?.id === order.id;

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className={`hover:bg-[#FFF8F2] transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#FFF0E3]/60' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-[#202124]">
                          {order.order_code}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#202124]">
                            {order.order_type.replace('_', ' ').toUpperCase()}
                          </span>
                          {order.table_number_snapshot && (
                            <span className="text-[#6B7280] block text-[11px]">
                              Table {order.table_number_snapshot}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#6B7280]">
                          {order.customer_name || 'Walk-in'}
                        </td>
                        <td className="py-3 px-4 text-[#9CA3AF]">
                          {formatDateTime(order.created_at)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#202124]">
                          {formatINR(order.total_paise)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            size="sm"
                            variant={
                              order.status === 'completed'
                                ? 'success'
                                : order.status === 'active'
                                ? 'bhagwa'
                                : 'danger'
                            }
                          >
                            {order.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {order.status === 'active' && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => openSettlementModal(order)}
                                className="h-7 text-[11px] px-2.5"
                              >
                                Settle
                              </Button>
                            )}
                            {order.status === 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReprintReceipt(order.id)}
                                className="h-7 text-[11px] px-2 gap-1"
                              >
                                <Printer className="h-3 w-3" />
                                <span>Receipt</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Order Detail Sidebar (1 column) */}
          <div className="space-y-4">
            {selectedOrder ? (
              <Card>
                <CardHeader className="pb-3 border-b border-[#E8EAF0]">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedOrder.order_code}</CardTitle>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {formatDateTime(selectedOrder.created_at)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        selectedOrder.status === 'completed'
                          ? 'success'
                          : selectedOrder.status === 'active'
                          ? 'bhagwa'
                          : 'danger'
                      }
                    >
                      {selectedOrder.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Items list */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-[#202124] uppercase tracking-wider">
                      Ordered Items
                    </p>
                    <div className="divide-y divide-[#E8EAF0] text-xs">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="py-2 flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-[#202124]">
                              {item.quantity}x {item.item_name}
                            </p>
                            {item.variant_name && (
                              <p className="text-[11px] text-[#C85A0A]">
                                Portion: {item.variant_name}
                              </p>
                            )}
                            {item.addons.length > 0 && (
                              <p className="text-[10px] text-[#6B7280]">
                                + {item.addons.map((a) => a.addon_name).join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="font-bold text-[#202124]">
                            {formatINR(item.line_total_paise)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="rounded-xl border border-[#E8EAF0] bg-[#FAFAFB] p-3 text-xs space-y-1">
                    <div className="flex justify-between text-[#6B7280]">
                      <span>Subtotal</span>
                      <span className="font-semibold text-[#202124]">
                        {formatINR(selectedOrder.subtotal_paise)}
                      </span>
                    </div>
                    {selectedOrder.discount_paise > 0 && (
                      <div className="flex justify-between text-[#D94343]">
                        <span>Discount</span>
                        <span>-{formatINR(selectedOrder.discount_paise)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#6B7280]">
                      <span>GST ({selectedOrder.tax_rate_percent}%)</span>
                      <span className="font-semibold text-[#202124]">
                        +{formatINR(selectedOrder.tax_paise)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1 border-t border-[#E8EAF0] text-sm">
                      <span className="font-bold text-[#202124]">Total</span>
                      <span className="font-extrabold text-[#F07818]">
                        {formatINR(selectedOrder.total_paise)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    {selectedOrder.status === 'active' && (
                      <>
                        <Button
                          onClick={() => openSettlementModal(selectedOrder)}
                          variant="primary"
                          className="w-full text-xs font-bold"
                        >
                          Settle Order & Print Receipt
                        </Button>
                        <Button
                          onClick={() => handleCancel(selectedOrder.id)}
                          variant="outline"
                          className="w-full text-xs text-[#D94343] hover:bg-[#FDECEC]"
                        >
                          Cancel Order
                        </Button>
                      </>
                    )}
                    {selectedOrder.status === 'completed' && (
                      <Button
                        onClick={() => handleReprintReceipt(selectedOrder.id)}
                        variant="outline"
                        className="w-full text-xs gap-1.5"
                      >
                        <Printer className="h-4 w-4" />
                        <span>View / Reprint Tax Invoice</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-[#6B7280] text-xs">
                  Select an order from the list to inspect itemized details, KOT history, and
                  reprint receipts.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
