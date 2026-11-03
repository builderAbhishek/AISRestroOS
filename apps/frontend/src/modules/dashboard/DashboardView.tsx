import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { formatINR, formatDateTime } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/EmptyState';
import {
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
  PlusCircle,
  Calendar,
  Utensils,
  CreditCard,
  QrCode,
  Banknote,
  Receipt,
  ArrowUpRight,
  Flame,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { setCurrentRoute, openSettlementModal } = useUIStore();
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-metrics', dateFilter],
    queryFn: () => dashboardApi.getMetrics(dateFilter),
    refetchInterval: 10000, // Refresh automatically every 10s
  });

  if (isLoading) {
    return <LoadingState message="Calculating real-time dashboard analytics..." />;
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Could not load dashboard metrics"
        message={error instanceof Error ? error.message : 'Unknown error'}
        onRetry={() => refetch()}
      />
    );
  }

  const { kpis, sales_trend, order_type_distribution, payment_distribution, top_selling_items, recent_orders, payment_summary } = data;
  const isZeroOrders = kpis.total_orders_count === 0 && kpis.pending_amount_paise === 0;

  // Max sales calculation for responsive chart scaling
  const maxTrendSales = Math.max(...sales_trend.map((p) => p.sales_paise), 10000);

  return (
    <div className="space-y-6 pb-8">
      {/* Top Filter & Actions Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202124]">Performance Overview</h2>
          <p className="text-xs text-[#6B7280]">
            Financial summaries aggregated directly from local offline SQLite database
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {/* Date Filter Buttons */}
          <div className="flex items-center rounded-xl border border-[#E8EAF0] bg-white p-1 shadow-2xs">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: '7 Days' },
                { id: '30days', label: '30 Days' },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setDateFilter(filter.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  dateFilter === filter.id
                    ? 'bg-[#F07818] text-white shadow-xs'
                    : 'text-[#6B7280] hover:text-[#202124] hover:bg-[#F7F8FA]'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <Button
            onClick={() => setCurrentRoute('pos')}
            size="md"
            variant="primary"
            className="gap-2 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">New POS Order</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <Card className="hover:border-[#F07818]/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                {dateFilter === 'today' ? "Today's Sales" : 'Total Sales'}
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-[#202124]">
                {formatINR(kpis.total_sales_paise)}
              </h3>
              <p className="mt-1 text-xs text-[#16865B] flex items-center gap-1 font-medium">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{kpis.completed_orders_count} completed orders</span>
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0E3] text-[#F07818]">
              <IndianRupee className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card className="hover:border-[#F07818]/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Total Orders
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-[#202124]">
                {kpis.total_orders_count}
              </h3>
              <p className="mt-1 text-xs text-[#6B7280]">
                {kpis.active_orders_count} active open right now
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF7F2] text-[#16865B]">
              <ShoppingBag className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Average Order Value */}
        <Card className="hover:border-[#F07818]/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Average Order Value
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-[#202124]">
                {formatINR(kpis.average_order_value_paise)}
              </h3>
              <p className="mt-1 text-xs text-[#6B7280]">Per settled receipt</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FEF6EB] text-[#D98A16]">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Pending / Unpaid Amount */}
        <Card className="hover:border-[#F07818]/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Pending / Unpaid
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-[#D94343]">
                {formatINR(kpis.pending_amount_paise)}
              </h3>
              <p className="mt-1 text-xs text-[#D94343] font-medium">In active kitchen/tables</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDECEC] text-[#D94343]">
              <AlertCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isZeroOrders ? (
        <EmptyState
          icon={<Flame className="h-8 w-8 text-[#F07818]" />}
          title="No transactions recorded for this period"
          description="Your restaurant is all set! Start placing orders on the POS to see live sales trends, top items, and payment distribution."
          actionLabel="Open POS Billing"
          onAction={() => setCurrentRoute('pos')}
          className="my-8 py-16"
        />
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Trend Chart (2 columns) */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Sales Trend</CardTitle>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    {dateFilter === 'today'
                      ? 'Hourly sales distribution'
                      : 'Daily sales volume over selected period'}
                  </p>
                </div>
                <Badge variant="bhagwa">{formatINR(kpis.total_sales_paise)}</Badge>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-56 w-full flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 px-2">
                  {sales_trend.map((point, idx) => {
                    const heightPercent =
                      point.sales_paise > 0
                        ? Math.max(8, Math.min(100, Math.round((point.sales_paise / maxTrendSales) * 100)))
                        : 3;

                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                      >
                        {/* Hover Tooltip */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#202124] text-white text-[10px] rounded px-2 py-1 pointer-events-none whitespace-nowrap z-30 shadow-md">
                          <p className="font-semibold">{point.label}</p>
                          <p>{formatINR(point.sales_paise)} ({point.orders_count} orders)</p>
                        </div>

                        {/* Bar */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            point.sales_paise > 0
                              ? 'bg-gradient-to-t from-[#C85A0A] to-[#F07818] group-hover:brightness-110 shadow-xs'
                              : 'bg-[#F0F2F6]'
                          }`}
                        />
                        <span className="text-[10px] text-[#9CA3AF] truncate w-full text-center">
                          {point.label.split(':')[0] || point.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Order Types & Payment Breakdown (1 column) */}
            <div className="space-y-6">
              {/* Order Type Distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Order Types</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order_type_distribution.map((type) => (
                    <div key={type.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#202124]">{type.name}</span>
                        <span className="font-semibold text-[#6B7280]">
                          {type.count} orders ({type.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
                        <div
                          className="h-full bg-[#F07818] rounded-full transition-all"
                          style={{ width: `${type.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Payment Methods Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Payment Methods</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {payment_summary.map((pm) => (
                    <div
                      key={pm.payment_method}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#FAFAFB] border border-[#E8EAF0] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {pm.payment_method === 'UPI' && <QrCode className="h-4 w-4 text-[#2563EB]" />}
                        {pm.payment_method === 'Cash' && <Banknote className="h-4 w-4 text-[#16865B]" />}
                        {pm.payment_method === 'Card' && <CreditCard className="h-4 w-4 text-[#D98A16]" />}
                        {pm.payment_method === 'Other' && <Receipt className="h-4 w-4 text-[#6B7280]" />}
                        <span className="font-semibold text-[#202124]">{pm.payment_method}</span>
                      </div>
                      <span className="font-bold text-[#202124]">{formatINR(pm.total_paise)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Lower Grid: Top Selling Items & Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>Top Selling Items</CardTitle>
                <span className="text-xs text-[#6B7280]">By volume</span>
              </CardHeader>
              <CardContent>
                {top_selling_items.length === 0 ? (
                  <p className="text-xs text-[#6B7280] py-4 text-center">No settled items yet.</p>
                ) : (
                  <div className="divide-y divide-[#E8EAF0]">
                    {top_selling_items.map((item, idx) => (
                      <div key={item.menu_item_id} className="py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF0E3] text-[11px] font-bold text-[#F07818]">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-[#202124]">{item.item_name}</p>
                            <p className="text-[11px] text-[#6B7280]">{item.quantity_sold} portions sold</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#202124]">
                          {formatINR(item.revenue_paise)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>Recent Orders</CardTitle>
                <Button onClick={() => setCurrentRoute('orders')} size="sm" variant="ghost" className="text-xs h-7">
                  View All &rarr;
                </Button>
              </CardHeader>
              <CardContent>
                {recent_orders.length === 0 ? (
                  <p className="text-xs text-[#6B7280] py-4 text-center">No recent orders.</p>
                ) : (
                  <div className="divide-y divide-[#E8EAF0]">
                    {recent_orders.map((o) => (
                      <div key={o.id} className="py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#202124]">{o.order_code}</span>
                              <Badge
                                size="sm"
                                variant={
                                  o.status === 'completed'
                                    ? 'success'
                                    : o.status === 'active'
                                    ? 'bhagwa'
                                    : 'danger'
                                }
                              >
                                {o.status.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-[#6B7280] mt-0.5">
                              {o.order_type.replace('_', ' ').toUpperCase()} {o.table_number ? `• Table ${o.table_number}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[#202124]">{formatINR(o.total_paise)}</p>
                          <p className="text-[10px] text-[#9CA3AF]">{formatDateTime(o.created_at_iso)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
