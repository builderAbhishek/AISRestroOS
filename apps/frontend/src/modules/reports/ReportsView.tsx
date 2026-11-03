import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Percent,
  Receipt,
  Boxes,
  PieChart,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { reportsApi } from '@/services/api';

type DateRangeType = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';
type ReportTab =
  | 'overview'
  | 'sales'
  | 'items'
  | 'categories'
  | 'order_types'
  | 'payments'
  | 'taxes'
  | 'inventory'
  | 'profitability';

export const ReportsView: React.FC = () => {
  const [rangeType, setRangeType] = useState<DateRangeType>('today');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Queries
  const { data: overview, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['reportsOverview', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getOverview(rangeType, customStart, customEnd),
  });

  const { data: salesTrend = [] } = useQuery({
    queryKey: ['reportsSalesTrend', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getSalesTrend(rangeType, customStart, customEnd),
  });

  const { data: itemSales = [] } = useQuery({
    queryKey: ['reportsItemSales', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getItemSales(rangeType, customStart, customEnd),
  });

  const { data: categorySales = [] } = useQuery({
    queryKey: ['reportsCategorySales', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getCategorySales(rangeType, customStart, customEnd),
  });

  const { data: orderTypes = [] } = useQuery({
    queryKey: ['reportsOrderTypes', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getOrderTypes(rangeType, customStart, customEnd),
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['reportsPaymentMethods', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getPaymentMethods(rangeType, customStart, customEnd),
  });

  const { data: taxData } = useQuery({
    queryKey: ['reportsTaxes', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getTaxes(rangeType, customStart, customEnd),
  });

  const { data: inventoryData } = useQuery({
    queryKey: ['reportsInventory', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getInventory(rangeType, customStart, customEnd),
  });

  const { data: profitability } = useQuery({
    queryKey: ['reportsProfitability', rangeType, customStart, customEnd],
    queryFn: () => reportsApi.getProfitability(rangeType, customStart, customEnd),
  });

  const handleExportCsv = (reportType: string) => {
    const url = reportsApi.getExportCsvUrl(reportType, rangeType, customStart, customEnd);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Header & Date Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-[#E8EAED] gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#202124] flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-[#F07818]" />
            Reports & Business Analytics
          </h1>
          <p className="text-xs text-[#5F6368]">
            Real financial statements, tax reporting, item profitability & period comparisons
          </p>
        </div>

        {/* Date Filter & Export Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-[#E8EAED] rounded-lg p-1 text-xs">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'last_month', label: 'Last Month' },
                { id: 'custom', label: 'Custom' },
              ] as { id: DateRangeType; label: string }[]
            ).map((d) => (
              <button
                key={d.id}
                onClick={() => setRangeType(d.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  rangeType === d.id
                    ? 'bg-[#F07818] text-white font-bold shadow-xs'
                    : 'text-[#5F6368] hover:text-[#202124]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {rangeType === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="p-1 rounded-lg border border-[#E8EAED] bg-white text-xs"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="p-1 rounded-lg border border-[#E8EAED] bg-white text-xs"
              />
            </div>
          )}

          <button
            onClick={() => handleExportCsv(activeTab === 'overview' ? 'sales' : activeTab)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E8EAED] bg-white hover:bg-[#F1F3F4] text-[#3C4043] flex items-center gap-1.5 shadow-sm transition"
            title="Download CSV"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E8EAED] bg-white hover:bg-[#F1F3F4] text-[#3C4043] flex items-center gap-1.5 shadow-sm transition print:hidden"
            title="Print Report"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            Print
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-[#E8EAED] gap-2 overflow-x-auto text-xs font-medium text-[#5F6368] print:hidden">
        {[
          { id: 'overview', label: 'Executive Overview' },
          { id: 'sales', label: 'Sales Trend' },
          { id: 'items', label: 'Item-wise Sales' },
          { id: 'categories', label: 'Category Sales' },
          { id: 'order_types', label: 'Order Types' },
          { id: 'payments', label: 'Payment Collections' },
          { id: 'taxes', label: 'GST & Tax Report' },
          { id: 'inventory', label: 'Inventory Valuation' },
          { id: 'profitability', label: 'Profitability & COGS' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ReportTab)}
              className={`px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[#F07818] text-[#F07818] font-bold'
                  : 'border-transparent hover:text-[#202124] hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
        {/* EXECUTIVE KPI SUMMARY CARDS (Visible on Overview or always accessible) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
            <span className="text-[11px] font-semibold text-[#5F6368]">Net Sales (Excl. Tax)</span>
            <div className="text-xl font-bold text-[#202124] mt-1">
              ₹{((overview?.net_sales_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            {overview && (
              <div className="flex items-center gap-1 text-[10px] mt-1 font-semibold">
                {overview.sales_growth_pct >= 0 ? (
                  <span className="text-emerald-600 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-0.5" /> +{overview.sales_growth_pct}%
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center">
                    <TrendingDown className="w-3 h-3 mr-0.5" /> {overview.sales_growth_pct}%
                  </span>
                )}
                <span className="text-gray-400 font-normal">vs prev</span>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
            <span className="text-[11px] font-semibold text-[#5F6368]">Total Orders</span>
            <div className="text-xl font-bold text-[#202124] mt-1">
              {overview?.total_orders_count || 0}
            </div>
            {overview && (
              <div className="flex items-center gap-1 text-[10px] mt-1 font-semibold">
                {overview.orders_growth_pct >= 0 ? (
                  <span className="text-emerald-600 flex items-center">
                    <TrendingUp className="w-3 h-3 mr-0.5" /> +{overview.orders_growth_pct}%
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center">
                    <TrendingDown className="w-3 h-3 mr-0.5" /> {overview.orders_growth_pct}%
                  </span>
                )}
                <span className="text-gray-400 font-normal">vs prev</span>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
            <span className="text-[11px] font-semibold text-[#5F6368]">Total Taxes (GST)</span>
            <div className="text-xl font-bold text-gray-900 mt-1">
              ₹{((overview?.tax_paise || 0) / 100).toFixed(2)}
            </div>
            <span className="text-[10px] text-gray-500">CGST + SGST</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
            <span className="text-[11px] font-semibold text-[#5F6368]">Avg Order Value</span>
            <div className="text-xl font-bold text-[#202124] mt-1">
              ₹{((overview?.aov_paise || 0) / 100).toFixed(2)}
            </div>
            <span className="text-[10px] text-gray-500">Per settled order</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
            <span className="text-[11px] font-semibold text-[#5F6368]">Payments Collected</span>
            <div className="text-xl font-bold text-emerald-700 mt-1">
              ₹{((overview?.payments_collected_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-600">From payment records</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
            <span className="text-[11px] font-semibold text-[#5F6368]">Outstanding Dues</span>
            <div className="text-xl font-bold text-red-600 mt-1">
              ₹{((overview?.outstanding_dues_paise || 0) / 100).toFixed(2)}
            </div>
            <span className="text-[10px] text-red-500">Unsettled on bills</span>
          </div>
        </div>

        {/* 1. OVERVIEW TAB: Graphs & Summary */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Sales vs Collections & Order Types */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Trend Table / Mini View */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-[#E8EAED] p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
                  <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#F07818]" />
                    Sales Trend in Period
                  </h3>
                  <button
                    onClick={() => setActiveTab('sales')}
                    className="text-xs text-[#F07818] font-semibold hover:underline"
                  >
                    View Details
                  </button>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F9FA] text-[#5F6368] font-semibold">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-center">Orders</th>
                        <th className="py-2 px-3 text-right">Net Sales</th>
                        <th className="py-2 px-3 text-right">Tax</th>
                        <th className="py-2 px-3 text-right">Grand Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EAED]">
                      {salesTrend.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-gray-500">
                            No sales recorded in this interval.
                          </td>
                        </tr>
                      ) : (
                        salesTrend.slice(0, 7).map((row) => (
                          <tr key={row.date} className="hover:bg-[#F8F9FA]">
                            <td className="py-2 px-3 font-medium text-[#202124]">{row.date}</td>
                            <td className="py-2 px-3 text-center font-bold text-gray-700">
                              {row.orders_count}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">
                              ₹{(row.net_sales_paise / 100).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-gray-500">
                              ₹{(row.tax_paise / 100).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[#F07818]">
                              ₹{(row.grand_total_paise / 100).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Types Contribution */}
              <div className="bg-white rounded-xl border border-[#E8EAED] p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
                  <h3 className="text-sm font-bold text-[#202124] flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-blue-600" />
                    Order Type Share
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {orderTypes.map((ot) => (
                    <div key={ot.order_type} className="space-y-1 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="text-[#202124]">{ot.label}</span>
                        <span className="font-bold text-gray-700">
                          {ot.percentage}% ({ot.orders_count} orders)
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#F07818] h-2 rounded-full"
                          style={{ width: `${Math.min(100, ot.percentage)}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-gray-400 font-mono">
                        ₹{(ot.grand_total_paise / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Items & Category Highlights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Items */}
              <div className="bg-white rounded-xl border border-[#E8EAED] p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
                  <h3 className="text-sm font-bold text-[#202124]">Top Selling Items</h3>
                  <button
                    onClick={() => setActiveTab('items')}
                    className="text-xs text-[#F07818] font-semibold hover:underline"
                  >
                    View All Items
                  </button>
                </div>
                <div className="divide-y divide-[#E8EAED] mt-2">
                  {itemSales.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#202124]">
                          #{idx + 1} {item.item_name}
                        </div>
                        {item.variant_name && (
                          <div className="text-[10px] text-[#F07818]">Variant: {item.variant_name}</div>
                        )}
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-[#202124]">{item.quantity_sold} sold</span>
                        <div className="text-[11px] text-emerald-700 font-bold">
                          ₹{(item.total_sales_paise / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Contribution */}
              <div className="bg-white rounded-xl border border-[#E8EAED] p-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
                  <h3 className="text-sm font-bold text-[#202124]">Revenue by Category</h3>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className="text-xs text-[#F07818] font-semibold hover:underline"
                  >
                    View Categories
                  </button>
                </div>
                <div className="divide-y divide-[#E8EAED] mt-2">
                  {categorySales.map((cat, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-[#202124]">{cat.category_name}</div>
                        <div className="text-[11px] text-gray-500">{cat.quantity_sold} units sold</div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-[#F07818]">{cat.percentage}%</span>
                        <div className="text-[11px] text-gray-800 font-bold">
                          ₹{(cat.total_sales_paise / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. SALES TREND TAB */}
        {activeTab === 'sales' && (
          <div className="space-y-4 bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
              <h2 className="text-base font-bold text-[#202124]">Detailed Sales & Revenue Breakdown</h2>
              <button
                onClick={() => handleExportCsv('sales')}
                className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[#5F6368] font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Orders Count</th>
                  <th className="py-3 px-4 text-right">Gross Sales</th>
                  <th className="py-3 px-4 text-right">Discounts</th>
                  <th className="py-3 px-4 text-right">Net Taxable Sales</th>
                  <th className="py-3 px-4 text-right">GST / Tax</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED]">
                {salesTrend.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No sales data available for this date filter.
                    </td>
                  </tr>
                ) : (
                  salesTrend.map((row) => (
                    <tr key={row.date} className="hover:bg-[#F8F9FA]">
                      <td className="py-3 px-4 font-semibold text-[#202124]">{row.date}</td>
                      <td className="py-3 px-4 text-center font-bold text-gray-800">{row.orders_count}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
                        ₹{(row.gross_sales_paise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-600">
                        -₹{(row.discount_paise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        ₹{(row.net_sales_paise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-600">
                        ₹{(row.tax_paise / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#F07818]">
                        ₹{(row.grand_total_paise / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. ITEM-WISE SALES TAB */}
        {activeTab === 'items' && (
          <div className="space-y-4 bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
              <h2 className="text-base font-bold text-[#202124]">Item-wise Sales Performance</h2>
              <button
                onClick={() => handleExportCsv('items')}
                className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[#5F6368] font-semibold">
                <tr>
                  <th className="py-3 px-4">Menu Item</th>
                  <th className="py-3 px-4">Variant</th>
                  <th className="py-3 px-4 text-center">Quantity Sold</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED]">
                {itemSales.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#F8F9FA]">
                    <td className="py-3 px-4 font-semibold text-[#202124]">{item.item_name}</td>
                    <td className="py-3 px-4 text-gray-500 font-medium">{item.variant_name || 'Standard'}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900 font-mono">
                      {item.quantity_sold}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      ₹{(item.total_sales_paise / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. CATEGORIES TAB */}
        {activeTab === 'categories' && (
          <div className="space-y-4 bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
              <h2 className="text-base font-bold text-[#202124]">Category Sales Distribution</h2>
              <button
                onClick={() => handleExportCsv('categories')}
                className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8F9FA] text-[#5F6368] font-semibold">
                <tr>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Items Sold</th>
                  <th className="py-3 px-4 text-right">Revenue (₹)</th>
                  <th className="py-3 px-4 text-right">% Revenue Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED]">
                {categorySales.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-[#F8F9FA]">
                    <td className="py-3 px-4 font-bold text-[#202124]">{cat.category_name}</td>
                    <td className="py-3 px-4 text-center font-mono text-gray-700">{cat.quantity_sold}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#202124]">
                      ₹{(cat.total_sales_paise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#F07818]">
                      {cat.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. ORDER TYPES TAB */}
        {activeTab === 'order_types' && (
          <div className="space-y-4 bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
            <h2 className="text-base font-bold text-[#202124] pb-3 border-b border-[#E8EAED]">
              Order Type Sales Analysis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {orderTypes.map((ot) => (
                <div key={ot.order_type} className="p-4 rounded-xl border border-[#E8EAED] bg-white shadow-xs">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{ot.label}</div>
                  <div className="text-xl font-bold text-[#202124] mt-1 font-mono">
                    ₹{(ot.grand_total_paise / 100).toFixed(2)}
                  </div>
                  <div className="mt-2 text-xs text-gray-600 flex justify-between">
                    <span>Orders: {ot.orders_count}</span>
                    <span className="font-bold text-[#F07818]">{ot.percentage}% of sales</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. PAYMENT METHODS TAB */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {paymentMethods?.breakdown.map((pm) => (
                <div key={pm.method} className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                  <div className="text-xs text-gray-500 font-medium uppercase">{pm.label}</div>
                  <div className="text-xl font-bold text-[#202124] mt-1 font-mono">
                    ₹{(pm.amount_paise / 100).toFixed(2)}
                  </div>
                  <div className="mt-2 text-xs flex justify-between text-gray-600">
                    <span>{pm.count} transactions</span>
                    <span className="font-bold text-emerald-700">{pm.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
              <h3 className="text-sm font-bold text-[#202124] mb-2">Payment Integrity & Audit</h3>
              <p className="text-xs text-gray-500">
                All collections above originate from immutable transaction records in the Payment table,
                supporting split payments, cash tender, and online UPI verification.
              </p>
            </div>
          </div>
        )}

        {/* 7. GST & TAX REPORT TAB */}
        {activeTab === 'taxes' && (
          <div className="space-y-4 bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8EAED]">
              <div>
                <h2 className="text-base font-bold text-[#202124]">GST & Tax Statement (Audit Ready)</h2>
                <p className="text-xs text-[#5F6368]">
                  Immutable figures extracted directly from finalized invoice records
                </p>
              </div>
              <button
                onClick={() => handleExportCsv('taxes')}
                className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
              >
                <Download className="w-4 h-4" /> Export Tax CSV
              </button>
            </div>

            {/* Tax Overview cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-[11px] text-gray-500 font-medium">Taxable Base</span>
                <div className="text-lg font-bold font-mono text-gray-900 mt-1">
                  ₹{((taxData?.taxable_amount_paise || 0) / 100).toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-[11px] text-gray-500 font-medium">CGST (2.5%)</span>
                <div className="text-lg font-bold font-mono text-gray-900 mt-1">
                  ₹{((taxData?.cgst_paise || 0) / 100).toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-[11px] text-gray-500 font-medium">SGST (2.5%)</span>
                <div className="text-lg font-bold font-mono text-gray-900 mt-1">
                  ₹{((taxData?.sgst_paise || 0) / 100).toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[11px] text-amber-800 font-medium">Total GST Collected</span>
                <div className="text-lg font-bold font-mono text-amber-900 mt-1">
                  ₹{((taxData?.total_tax_paise || 0) / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Invoices table */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] text-[#5F6368] font-semibold border-b border-[#E8EAED]">
                  <tr>
                    <th className="py-2.5 px-3">Invoice Number</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Taxable</th>
                    <th className="py-2.5 px-3 text-right">CGST</th>
                    <th className="py-2.5 px-3 text-right">SGST</th>
                    <th className="py-2.5 px-3 text-right">Total Tax</th>
                    <th className="py-2.5 px-3 text-right">Invoice Total</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED]">
                  {(!taxData?.invoices || taxData.invoices.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-gray-500">
                        No taxable invoices in this period.
                      </td>
                    </tr>
                  ) : (
                    taxData.invoices.map((inv) => (
                      <tr key={inv.invoice_number} className="hover:bg-[#F8F9FA]">
                        <td className="py-2 px-3 font-mono font-bold text-[#202124]">{inv.invoice_number}</td>
                        <td className="py-2 px-3 text-gray-500">
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-medium">
                          ₹{(inv.taxable_amount_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-600">
                          ₹{(inv.cgst_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-600">
                          ₹{(inv.sgst_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-gray-800">
                          ₹{(inv.total_tax_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                          ₹{(inv.grand_total_paise / 100).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. INVENTORY ANALYTICS TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Total Inventory Items</span>
                <div className="text-2xl font-bold text-[#202124] mt-1">
                  {inventoryData?.total_items_count || 0}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Current Stock Valuation</span>
                <div className="text-2xl font-bold text-emerald-700 font-mono mt-1">
                  ₹{((inventoryData?.total_stock_value_paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Ingredients Consumed (COGS)</span>
                <div className="text-2xl font-bold text-blue-700 font-mono mt-1">
                  ₹{((inventoryData?.consumption_cost_paise || 0) / 100).toFixed(2)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E8EAED] shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Recorded Wastage Loss</span>
                <div className="text-2xl font-bold text-red-600 font-mono mt-1">
                  ₹{((inventoryData?.wastage_cost_paise || 0) / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Low stock table */}
            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm p-4">
              <h3 className="text-sm font-bold text-[#202124] mb-3">Items Requiring Reorder</h3>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F9FA] text-[#5F6368] font-semibold border-b border-[#E8EAED]">
                  <tr>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Reorder Level</th>
                    <th className="py-2.5 px-3 text-right">Cost Per Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED]">
                  {(!inventoryData?.low_stock_items || inventoryData.low_stock_items.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        All item stocks are above reorder thresholds.
                      </td>
                    </tr>
                  ) : (
                    inventoryData.low_stock_items.map((it: any) => (
                      <tr key={it.id} className="hover:bg-[#F8F9FA]">
                        <td className="py-2 px-3 font-semibold text-[#202124]">{it.name}</td>
                        <td className="py-2 px-3 text-gray-500 font-mono">{it.sku || '—'}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                          {it.current_stock} {it.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-600">
                          {it.reorder_level} {it.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          ₹{(it.cost_per_unit_paise / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 9. PROFITABILITY & COGS TAB */}
        {activeTab === 'profitability' && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-white rounded-xl border border-[#E8EAED] shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E8EAED]">
                <div>
                  <h2 className="text-lg font-bold text-[#202124]">Gross Profit & Ingredient Cost Analysis</h2>
                  <p className="text-xs text-[#5F6368]">
                    Calculated from recipe ingredient consumption movements against net restaurant sales
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-gray-500 block">Recipe Mapping Coverage</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {profitability?.recipe_coverage_pct || 0}% Mapped
                  </span>
                </div>
              </div>

              {/* Profit Equation Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-xs text-gray-500 font-medium">Net Sales</span>
                  <div className="text-xl font-bold font-mono text-gray-900 mt-1">
                    ₹{((profitability?.net_sales_paise || 0) / 100).toFixed(2)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <span className="text-xs text-red-700 font-medium">Ingredient COGS (-)</span>
                  <div className="text-xl font-bold font-mono text-red-800 mt-1">
                    ₹{((profitability?.cogs_paise || 0) / 100).toFixed(2)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs text-emerald-700 font-medium">Gross Profit (=)</span>
                  <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
                    ₹{((profitability?.gross_profit_paise || 0) / 100).toFixed(2)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                  <span className="text-xs text-orange-700 font-medium">Gross Margin %</span>
                  <div className="text-xl font-bold font-mono text-[#F07818] mt-1">
                    {profitability?.gross_margin_pct || 0}%
                  </div>
                </div>
              </div>

              {/* Notice */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
                <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Transparent Reporting Notice: </span>
                  {profitability?.disclaimer ||
                    'Gross profit reflects Net Sales minus ingredient COGS for mapped recipes. Fixed operational overheads (rent, salaries, electricity) are not deducted.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
