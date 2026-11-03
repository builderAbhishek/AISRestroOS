import {
  Restaurant,
  RestaurantSettings,
  MenuCategory,
  MenuItem,
  AddonGroup,
  RestaurantTable,
  TableStats,
  Order,
  KOT,
  KOTPrintResult,
  SettlementResponse,
  BillCalculation,
  Invoice,
  Refund,
  PrintJob,
  DashboardMetrics,
} from '@/types';

const BASE_URL = '/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail = 'An unexpected error occurred';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error || errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = `Request failed with status ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const restaurantApi = {
  getCurrent: () => request<Restaurant>('/restaurant/current'),
  setup: (data: any) =>
    request<Restaurant>('/restaurant/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProfile: (data: Partial<Restaurant>) =>
    request<Restaurant>('/restaurant/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateSettings: (data: Partial<RestaurantSettings>) =>
    request<RestaurantSettings>('/restaurant/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  seedSampleData: () =>
    request<{ message: string }>('/restaurant/seed-sample-data', {
      method: 'POST',
    }),
};

export const menuApi = {
  listCategories: () => request<MenuCategory[]>('/menu/categories'),
  createCategory: (data: { name: string; description?: string; sort_order?: number }) =>
    request<MenuCategory>('/menu/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCategory: (id: string, data: Partial<MenuCategory>) =>
    request<MenuCategory>(`/menu/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string) =>
    request<void>(`/menu/categories/${id}`, { method: 'DELETE' }),
  reorderCategories: (items: { id: string; sort_order: number }[]) =>
    request<MenuCategory[]>('/menu/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  listItems: (params?: {
    category_id?: string;
    search?: string;
    is_veg?: boolean;
    item_type?: 'veg' | 'non_veg' | 'egg';
    available_only?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.category_id) searchParams.append('category_id', params.category_id);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.item_type) searchParams.append('item_type', params.item_type);
    else if (params?.is_veg !== undefined) searchParams.append('is_veg', String(params.is_veg));
    if (params?.available_only !== undefined) searchParams.append('available_only', String(params.available_only));
    const qs = searchParams.toString();
    return request<MenuItem[]>(`/menu/items${qs ? `?${qs}` : ''}`);
  },
  createItem: (data: any) =>
    request<MenuItem>('/menu/items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateItem: (id: string, data: any) =>
    request<MenuItem>(`/menu/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  duplicateItem: (id: string) =>
    request<MenuItem>(`/menu/items/${id}/duplicate`, {
      method: 'POST',
    }),
  deleteItem: (id: string) =>
    request<void>(`/menu/items/${id}`, { method: 'DELETE' }),
  toggleAvailability: (id: string) =>
    request<MenuItem>(`/menu/items/${id}/toggle-availability`, { method: 'PATCH' }),

  listAddonGroups: () => request<AddonGroup[]>('/menu/addon-groups'),
  createAddonGroup: (data: any) =>
    request<AddonGroup>('/menu/addon-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteAddonGroup: (id: string) =>
    request<void>(`/menu/addon-groups/${id}`, { method: 'DELETE' }),
};

export const tablesApi = {
  getStats: () => request<TableStats>('/tables/stats'),
  listTables: (section?: string) => {
    const qs = section ? `?section=${encodeURIComponent(section)}` : '';
    return request<RestaurantTable[]>(`/tables${qs}`);
  },
  createTable: (data: { table_number: string; capacity?: number; section?: string; display_order?: number }) =>
    request<RestaurantTable>('/tables', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTable: (id: string, data: Partial<RestaurantTable>) =>
    request<RestaurantTable>(`/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  toggleActive: (id: string) =>
    request<RestaurantTable>(`/tables/${id}/toggle-active`, { method: 'PATCH' }),
  transferTable: (sourceTableId: string, targetTableId: string) =>
    request<RestaurantTable>(`/tables/${sourceTableId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ target_table_id: targetTableId }),
    }),
  deleteTable: (id: string) =>
    request<void>(`/tables/${id}`, { method: 'DELETE' }),
  getActiveOrder: (tableId: string) =>
    request<Order | null>(`/tables/${tableId}/active-order`),
};

export const ordersApi = {
  listOrders: (params?: {
    search?: string;
    table_number?: string;
    order_type?: string;
    status?: string;
    payment_status?: string;
    start_date?: string;
    end_date?: string;
    quick_filter?: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.table_number) searchParams.append('table_number', params.table_number);
    if (params?.order_type) searchParams.append('order_type', params.order_type);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.payment_status) searchParams.append('payment_status', params.payment_status);
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.quick_filter) searchParams.append('quick_filter', params.quick_filter);
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.offset) searchParams.append('offset', String(params.offset));
    const qs = searchParams.toString();
    return request<Order[]>(`/orders${qs ? `?${qs}` : ''}`);
  },
  getOrder: (id: string) => request<Order>(`/orders/${id}`),
  createOrder: (data: any) =>
    request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateOrderItems: (id: string, data: any) =>
    request<Order>(`/orders/${id}/items`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  cancelOrder: (id: string, reason?: string) =>
    request<Order>(`/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Cancelled by operator' }),
    }),
};

export const kotApi = {
  addAndPrintKOT: (orderId: string) =>
    request<KOTPrintResult>(`/orders/${orderId}/kot`, { method: 'POST' }),
  generateKOT: (orderId: string) =>
    request<KOTPrintResult>(`/orders/${orderId}/kot`, { method: 'POST' }),
  listKOTs: (orderId: string) =>
    request<KOT[]>(`/orders/${orderId}/kots`),
  reprintKOT: (kotId: string) =>
    request<KOTPrintResult>(`/orders/kot/${kotId}/reprint`),
};

export const billingApi = {
  calculateBill: (orderId: string, params?: { discount_type?: string; discount_value?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.discount_type) searchParams.append('discount_type', params.discount_type);
    if (params?.discount_value !== undefined) searchParams.append('discount_value', String(params.discount_value));
    const qs = searchParams.toString();
    return request<BillCalculation>(`/orders/${orderId}/calculate-bill${qs ? `?${qs}` : ''}`);
  },
  generateBill: (orderId: string, params?: { discount_type?: string; discount_value?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.discount_type) searchParams.append('discount_type', params.discount_type);
    if (params?.discount_value !== undefined) searchParams.append('discount_value', String(params.discount_value));
    const qs = searchParams.toString();
    return request<Invoice>(`/orders/${orderId}/generate-bill${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
  },
  getInvoice: (orderId: string) =>
    request<Invoice>(`/orders/${orderId}/invoice`),
  getA4InvoiceUrl: (orderId: string) => `/api/v1/orders/${orderId}/invoice/a4`,
  settleOrder: (orderId: string, data: { payments: any[]; discount_type?: string; discount_value?: number }) =>
    request<SettlementResponse>(`/orders/${orderId}/settle`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  refundOrder: (orderId: string, data: { amount_paise: number; reason: string; payment_method?: string; reference_number?: string }) =>
    request<Refund>(`/orders/${orderId}/refund`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getReceiptText: (orderId: string, format: '58mm' | '80mm' = '80mm') =>
    request<{ receipt_text: string; invoice_number: string; format: string }>(
      `/orders/${orderId}/receipt?format=${format}`
    ),
};

export const printingApi = {
  testPrint: (data: { printer_name?: string; paper_format: string }) =>
    request<{ status: string; message: string; receipt_text: string }>(
      '/printing/test-print',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  listJobs: (limit: number = 20) =>
    request<PrintJob[]>(`/printing/jobs?limit=${limit}`),
};

export const dashboardApi = {
  getMetrics: (dateFilter: string = 'today') =>
    request<DashboardMetrics>(`/dashboard/metrics?date_filter=${dateFilter}`),
};
