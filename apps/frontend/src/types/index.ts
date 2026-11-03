export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'active' | 'completed' | 'cancelled';
export type TableStatus = 'available' | 'occupied' | 'reserved';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';

export interface RestaurantSettings {
  id: string;
  restaurant_id: string;
  tax_rate_percent: number;
  tax_type: string;
  order_types_json: string;
  kot_printer_name: string;
  bill_printer_name: string;
  paper_width_mm: number;
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
  is_available: boolean;
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
  created_at: string;
  updated_at: string;
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
  subtotal_paise: number;
  subtotal_inr: number;
  discount_type?: 'percentage' | 'amount';
  discount_value: number;
  discount_paise: number;
  discount_inr: number;
  tax_rate_percent: number;
  cgst_paise: number;
  cgst_inr: number;
  sgst_paise: number;
  sgst_inr: number;
  tax_paise: number;
  tax_inr: number;
  total_paise: number;
  total_inr: number;
  notes?: string;
  items: OrderItem[];
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

export interface Invoice {
  id: string;
  order_id: string;
  invoice_number: string;
  subtotal_paise: number;
  subtotal_inr: number;
  discount_paise: number;
  discount_inr: number;
  cgst_paise: number;
  cgst_inr: number;
  sgst_paise: number;
  sgst_inr: number;
  total_tax_paise: number;
  total_tax_inr: number;
  grand_total_paise: number;
  grand_total_inr: number;
  rounded_paise: number;
  status: 'unpaid' | 'partially_paid' | 'paid';
  paid_amount_paise: number;
  paid_amount_inr: number;
  due_amount_paise: number;
  due_amount_inr: number;
  payments: Payment[];
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
  cgst_paise: number;
  cgst_inr: number;
  sgst_paise: number;
  sgst_inr: number;
  total_tax_paise: number;
  total_tax_inr: number;
  grand_total_paise: number;
  grand_total_inr: number;
  tax_rate_percent: number;
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
