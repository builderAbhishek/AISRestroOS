export const BHAGWA_PALETTE = {
  primary: '#F07818',
  primaryDark: '#C85A0A',
  primaryLight: '#FFF0E3',
  background: '#F7F8FA',
  surface: '#FFFFFF',
  textPrimary: '#202124',
  textSecondary: '#6B7280',
  border: '#E8EAF0',
  success: '#16865B',
  warning: '#D98A16',
  danger: '#D94343',
} as const;

export const APP_CONFIG = {
  name: 'AISRestroOS',
  defaultCurrency: 'INR',
  currencySymbol: '₹',
  defaultTaxRatePercent: 5.0,
  defaultPaperWidthMm: 80,
  defaultBusyTimeoutMs: 5000,
} as const;
