import {
  Restaurant,
  RestaurantSettings,
  MenuCategory,
  MenuItem,
  AddonGroup,
  RestaurantTable,
  Order,
  KOT,
  KOTPrintResult,
  SettlementResponse,
  BillCalculation,
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
  listTables: (section?: string) => {
    const qs = section ? `?section=${encodeURIComponent(section)}` : '';
    return request<RestaurantTable[]>(`/tables${qs}`);
  },
  createTable: (data: { table_number: string; capacity?: number; section?: string }) =>
    request<RestaurantTable>('/tables', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTable: (id: string, data: Partial<RestaurantTable>) =>
    request<RestaurantTable>(`/tables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTable: (id: string) =>
    request<void>(`/tables/${id}`, { method: 'DELETE' }),
  getActiveOrder: (tableId: string) =>
    request<Order | null>(`/tables/${tableId}/active-order`),
};

export const ordersApi = {
  listOrders: (params?: { status?: string; order_type?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.order_type) searchParams.append('order_type', params.order_type);
    if (params?.limit) searchParams.append('limit', String(params.limit));
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
  cancelOrder: (id: string) =>
    request<Order>(`/orders/${id}/cancel`, { method: 'POST' }),
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
  settleOrder: (orderId: string, data: { payments: any[]; discount_type?: string; discount_value?: number }) =>
    request<SettlementResponse>(`/orders/${orderId}/settle`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getReceiptText: (orderId: string) =>
    request<{ receipt_text: string; invoice_number: string }>(`/orders/${orderId}/receipt`),
};

export const dashboardApi = {
  getMetrics: (dateFilter: string = 'today') =>
    request<DashboardMetrics>(`/dashboard/metrics?date_filter=${dateFilter}`),
};
