export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'open' | 'active' | 'bill_generated' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
export type TableStatus = 'available' | 'occupied' | 'bill_generated' | 'reserved';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';
export type PaperFormat = '58mm' | '80mm' | 'a4';

export interface RestaurantSettings {
  id: string;
  restaurant_id: string;
  is_tax_enabled: boolean;
  is_tax_inclusive: boolean;
  tax_rate_percent: number;
  tax_type: string;
  order_types_json: string;
  kot_printer_name: string;
  bill_printer_name: string;
  paper_width_mm: number;
  receipt_printer_type?: string;
  default_print_format?: PaperFormat;
  invoice_prefix: string;
  kot_prefix: string;
  bill_footer_text: string;
  auto_cut_paper: boolean;
  created_at: string;
  updated_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  legal_name?: string;
  owner_name: string;
  phone: string;
  email?: string;
  address: string;
  logo_url?: string;
  currency: string;
  currency_symbol: string;
  language: string;
  gst_registered: boolean;
  gstin?: string;
  settings?: RestaurantSettings;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuVariant {
  id: string;
  item_id: string;
  name: string;
  price_paise: number;
  price_inr: number;
  is_default: boolean;
  is_available: boolean;
}

export interface Addon {
  id: string;
  addon_group_id: string;
  name: string;
  price_paise: number;
  price_inr: number;
  is_available: boolean;
}

export interface AddonGroup {
  id: string;
  name: string;
  min_selection: number;
  max_selection: number;
  is_required: boolean;
  addons: Addon[];
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  item_code?: string;
  description?: string;
  base_price_paise: number;
  base_price_inr: number;
  is_veg: boolean;
  item_type: 'veg' | 'non_veg' | 'egg';
  is_available: boolean;
  is_recommended: boolean;
  is_bestseller: boolean;
  is_tax_inclusive?: boolean | null;
  tax_rate_override_percent?: number | null;
  preparation_time_minutes?: number | null;
  has_variants: boolean;
  image_url?: string;
  sort_order: number;
  variants: MenuVariant[];
  addon_groups: AddonGroup[];
  created_at: string;
  updated_at: string;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  capacity: number;
  section: string;
  status: TableStatus;
  current_order_id?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;

  // Active order snapshots
  current_order_code?: string;
  current_order_total_paise?: number;
  current_order_total_inr?: number;
  current_order_paid_paise?: number;
  current_order_due_paise?: number;
  current_order_due_inr?: number;
  current_order_created_at?: string;
}

export interface TableStats {
  total_tables: number;
  available_tables: number;
  occupied_tables: number;
  bill_pending_tables: number;
}

export interface OrderItemAddon {
  id?: string;
  addon_id?: string;
  addon_name: string;
  price_paise: number;
  price_inr?: number;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  menu_item_id: string;
  variant_id?: string;
  item_name: string;
  variant_name?: string;
  unit_price_paise: number;
  unit_price_inr?: number;
  quantity: number;
  line_total_paise: number;
  line_total_inr?: number;
  notes?: string;
  kot_status?: string;
  printed_quantity?: number;
  addons: OrderItemAddon[];
  created_at?: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  order_number: number;
  order_code: string;
  order_type: OrderType;
  table_id?: string;
  table_number_snapshot?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  paid_amount_paise: number;
  paid_amount_inr: number;
  due_amount_paise: number;
  due_amount_inr: number;
  subtotal_paise: number;
  subtotal_inr: number;
  discount_type?: 'percentage' | 'amount';
  discount_value: number;
  discount_paise: number;
  discount_inr: number;
  tax_rate_percent: number;
  tax_type: string;
  is_tax_inclusive: boolean;
  taxable_amount_paise: number;
  taxable_amount_inr: number;
  cgst_paise: number;
  cgst_inr: number;
  sgst_paise: number;
  sgst_inr: number;
  igst_paise: number;
  igst_inr: number;
  tax_paise: number;
  tax_inr: number;
  total_paise: number;
  total_inr: number;
  notes?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  items: OrderItem[];
  kots?: KOT[];
  invoice?: Invoice;
  created_at: string;
  updated_at: string;
}

export interface KOTItem {
  id: string;
  order_item_id: string;
  item_name: string;
  variant_name?: string;
  addons_summary?: string;
  quantity: number;
  notes?: string;
}

export interface KOT {
  id: string;
  order_id: string;
  kot_number: number;
  kot_code: string;
  status: string;
  printer_name?: string;
  created_at: string;
  items: KOTItem[];
}

export interface KOTPrintResult {
  kot: KOT;
  formatted_text: string;
  is_new_items_printed: boolean;
  printer_status: string;
  message: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount_paise: number;
  amount_inr: number;
  tendered_amount_paise?: number;
  change_due_paise?: number;
  change_due_inr?: number;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface Refund {
  id: string;
  invoice_id: string;
  order_id: string;
  amount_paise: number;
  amount_inr: number;
  reason: string;
  payment_method: string;
  reference_number?: string;
  created_at: string;
}

export interface PrintJob {
  id: string;
  restaurant_id: string;
  order_id?: string;
  invoice_id?: string;
  job_type: string;
  printer_name?: string;
  paper_format: PaperFormat;
  status: string;
  content_preview?: string;
  error_message?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  order_id: string;
  invoice_number: string;
  subtotal_paise: number;
  subtotal_inr: number;
  discount_paise: number;
  discount_inr: number;
  taxable_amount_paise: number;
  taxable_amount_inr: number;
  tax_rate_percent: number;
  tax_type: string;
  is_tax_inclusive: boolean;
  cgst_paise: number;
  cgst_inr: number;
  sgst_paise: number;
  sgst_inr: number;
  igst_paise: number;
  igst_inr: number;
  total_tax_paise: number;
  total_tax_inr: number;
  grand_total_paise: number;
  grand_total_inr: number;
  rounded_paise: number;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'cancelled';
  paid_amount_paise: number;
  paid_amount_inr: number;
  due_amount_paise: number;
  due_amount_inr: number;
  payments: Payment[];
  refunds: Refund[];
  created_at: string;
}

export interface SettlementResponse {
  invoice: Invoice;
  order_id: string;
  order_status: string;
  receipt_text: string;
  message: string;
}

export interface BillCalculation {
  subtotal_paise: number;
  subtotal_inr: number;
  discount_paise: number;
  discount_inr: number;
  taxable_amount_paise: number;
  taxable_amount_inr: number;
  cgst_paise: number;
  cgst_inr: number;
  sgst_paise: number;
  sgst_inr: number;
  igst_paise: number;
  igst_inr: number;
  total_tax_paise: number;
  total_tax_inr: number;
  grand_total_paise: number;
  grand_total_inr: number;
  tax_rate_percent: number;
  tax_type: string;
  is_tax_inclusive: boolean;
}

export interface DashboardKPICards {
  total_sales_paise: number;
  total_sales_inr: number;
  total_orders_count: number;
  average_order_value_paise: number;
  average_order_value_inr: number;
  pending_amount_paise: number;
  pending_amount_inr: number;
  completed_orders_count: number;
  active_orders_count: number;
}

export interface SalesTrendPoint {
  label: string;
  sales_paise: number;
  sales_inr: number;
  orders_count: number;
}

export interface DistributionSlice {
  name: string;
  count: number;
  amount_paise: number;
  amount_inr: number;
  percentage: number;
}

export interface TopSellingItem {
  menu_item_id: string;
  item_name: string;
  quantity_sold: number;
  revenue_paise: number;
  revenue_inr: number;
}

export interface RecentOrderSummary {
  id: string;
  order_code: string;
  order_type: string;
  table_number?: string;
  status: string;
  total_paise: number;
  total_inr: number;
  created_at_iso: string;
  customer_name?: string;
}

export interface PaymentSummaryItem {
  payment_method: string;
  count: number;
  total_paise: number;
  total_inr: number;
}

export interface DashboardMetrics {
  date_filter: string;
  start_date_iso: string;
  end_date_iso: string;
  kpis: DashboardKPICards;
  sales_trend: SalesTrendPoint[];
  order_type_distribution: DistributionSlice[];
  payment_distribution: DistributionSlice[];
  top_selling_items: TopSellingItem[];
  recent_orders: RecentOrderSummary[];
  payment_summary: PaymentSummaryItem[];
}

// --- INVENTORY TYPES ---
export interface InventoryCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  id: string;
  restaurant_id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  gst_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  name: string;
  sku?: string;
  category_id?: string;
  category_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  reorder_level: number;
  cost_per_unit_paise: number;
  stock_value_paise: number;
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseItem {
  id: string;
  inventory_item_id: string;
  item_name?: string;
  quantity: number;
  unit: string;
  unit_cost_paise: number;
  total_cost_paise: number;
}

export interface SupplierPayment {
  id: string;
  amount_paise: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  created_at?: string;
}

export interface Purchase {
  id: string;
  restaurant_id: string;
  purchase_number: string;
  supplier_id?: string;
  supplier_name?: string;
  invoice_number?: string;
  purchase_date?: string;
  status: 'draft' | 'received' | 'cancelled';
  subtotal_paise: number;
  tax_paise: number;
  total_cost_paise: number;
  paid_amount_paise: number;
  due_amount_paise: number;
  notes?: string;
  items: PurchaseItem[];
  payments: SupplierPayment[];
  created_at?: string;
}

export interface RecipeIngredient {
  id: string;
  inventory_item_id: string;
  inventory_item_name?: string;
  quantity: number;
  unit: string;
  cost_per_unit_paise: number;
  total_cost_paise: number;
}

export interface Recipe {
  id: string;
  restaurant_id: string;
  menu_item_id: string;
  menu_item_name?: string;
  variant_id?: string;
  variant_name?: string;
  notes?: string;
  ingredients: RecipeIngredient[];
  total_cost_paise: number;
  created_at?: string;
}

export interface WastageRecord {
  id: string;
  inventory_item_id: string;
  item_name?: string;
  quantity: number;
  unit?: string;
  cost_paise: number;
  reason: string;
  notes?: string;
  created_at?: string;
}

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  item_name?: string;
  movement_type: string;
  quantity_change: number;
  quantity_after: number;
  unit?: string;
  unit_cost_paise: number;
  total_cost_paise: number;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  created_at?: string;
}

export interface InventoryDashboardData {
  total_items: number;
  total_stock_value_paise: number;
  low_stock_count: number;
  out_of_stock_count: number;
  today_purchases_paise: number;
  today_consumption_paise: number;
  today_wastage_paise: number;
  low_stock_items: InventoryItem[];
  recent_movements: StockMovement[];
  top_consumed_ingredients: {
    name: string;
    unit: string;
    quantity: number;
    cost_paise: number;
  }[];
}

// --- REPORTS & ANALYTICS TYPES ---
export interface ExecutiveOverview {
  start_date: string;
  end_date: string;
  total_orders_count: number;
  cancelled_orders_count: number;
  gross_sales_paise: number;
  discount_paise: number;
  net_sales_paise: number;
  tax_paise: number;
  grand_total_paise: number;
  aov_paise: number;
  payments_collected_paise: number;
  refunds_issued_paise: number;
  outstanding_dues_paise: number;
  sales_growth_pct: number;
  orders_growth_pct: number;
}

export interface ReportSalesTrendPoint {
  date: string;
  orders_count: number;
  gross_sales_paise: number;
  discount_paise: number;
  net_sales_paise: number;
  tax_paise: number;
  grand_total_paise: number;
}

export interface ItemWiseSale {
  menu_item_id: string;
  item_name: string;
  variant_id?: string;
  variant_name?: string;
  quantity_sold: number;
  total_sales_paise: number;
}

export interface CategoryWiseSale {
  category_name: string;
  quantity_sold: number;
  total_sales_paise: number;
  percentage: number;
}

export interface OrderTypeSale {
  order_type: string;
  label: string;
  orders_count: number;
  net_sales_paise: number;
  grand_total_paise: number;
  percentage: number;
}

export interface PaymentBreakdownItem {
  method: string;
  label: string;
  count: number;
  amount_paise: number;
  percentage: number;
}

export interface PaymentMethodReport {
  total_collected_paise: number;
  payment_count: number;
  breakdown: PaymentBreakdownItem[];
}

export interface TaxInvoiceEntry {
  invoice_number: string;
  created_at?: string;
  taxable_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_tax_paise: number;
  grand_total_paise: number;
  status: string;
}

export interface TaxReportData {
  taxable_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_tax_paise: number;
  grand_total_paise: number;
  invoices_count: number;
  invoices: TaxInvoiceEntry[];
}

export interface InventoryAnalyticsData {
  total_items_count: number;
  total_stock_value_paise: number;
  low_stock_count: number;
  low_stock_items: any[];
  purchases_cost_paise: number;
  consumption_cost_paise: number;
  wastage_cost_paise: number;
  wastage_records: any[];
}

export interface ProfitabilityData {
  net_sales_paise: number;
  cogs_paise: number;
  gross_profit_paise: number;
  gross_margin_pct: number;
  recipe_coverage_pct: number;
  disclaimer: string;
}
