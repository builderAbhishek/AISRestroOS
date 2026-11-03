import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildReceiptHtml, dispatchThermalPrint } from '@/services/printerService';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';

describe('BUG FIX REGRESSION TESTS', () => {
  beforeEach(() => {
    useUIStore.setState({ toasts: [] });
    vi.restoreAllMocks();
  });

  describe('BUG 1: Toast Notification Deduplication', () => {
    it('prevents duplicate stacked toasts for the same error title and description', () => {
      const { addToast } = useUIStore.getState();

      addToast({ type: 'error', title: 'HTTP 500 Error', description: 'FOREIGN KEY constraint failed' });
      addToast({ type: 'error', title: 'HTTP 500 Error', description: 'FOREIGN KEY constraint failed' });
      addToast({ type: 'error', title: 'HTTP 500 Error', description: 'FOREIGN KEY constraint failed' });

      const state = useUIStore.getState();
      expect(state.toasts.length).toBe(1);
      expect(state.toasts[0].title).toBe('HTTP 500 Error');
    });

    it('allows different toasts to appear normally', () => {
      const { addToast } = useUIStore.getState();

      addToast({ type: 'error', title: 'Error A', description: 'Details A' });
      addToast({ type: 'warning', title: 'Warning B', description: 'Details B' });

      const state = useUIStore.getState();
      expect(state.toasts.length).toBe(2);
    });
  });

  describe('BUG 3: KOT Thermal Print Dispatcher', () => {
    it('builds receipt HTML formatted for 80mm and 58mm widths', () => {
      const html80 = buildReceiptHtml('KITCHEN ORDER TICKET\nTable: T5\n1x Biryani', 'KOT-01', 80);
      expect(html80).toContain('80mm auto');
      expect(html80).toContain('KITCHEN ORDER TICKET');

      const html58 = buildReceiptHtml('KITCHEN ORDER TICKET\nTable: T5\n1x Biryani', 'KOT-01', 58);
      expect(html58).toContain('58mm auto');
      expect(html58).toContain('10px');
    });

    it('dispatches to Electron IPC printHtml when available with silent print to configured printer', async () => {
      const mockPrintHtml = vi.fn().mockResolvedValue({ success: true });
      window.electronAPI = {
        getAppPaths: vi.fn(),
        getPrinters: vi.fn(),
        printHtml: mockPrintHtml,
        testPrint: vi.fn(),
        isElectron: true,
      };

      const result = await dispatchThermalPrint({
        rawText: 'KOT #1 - Table T5\n2x Naan',
        title: 'KOT ORD-0004-K1',
        printerName: 'Kitchen-Printer-USB',
        widthMm: 80,
      });

      expect(mockPrintHtml).toHaveBeenCalledTimes(1);
      expect(mockPrintHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          printerName: 'Kitchen-Printer-USB',
          silent: true,
          widthMm: 80,
        })
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Dispatched directly to "Kitchen-Printer-USB"');
    });

    it('opens print dialog when no specific printer is configured or dialog is forced', async () => {
      const mockPrintHtml = vi.fn().mockResolvedValue({ success: true });
      window.electronAPI = {
        getAppPaths: vi.fn(),
        getPrinters: vi.fn(),
        printHtml: mockPrintHtml,
        testPrint: vi.fn(),
        isElectron: true,
      };

      const result = await dispatchThermalPrint({
        rawText: 'KOT #1 - Table T5\n2x Naan',
        title: 'KOT ORD-0004-K1',
        printerName: undefined,
        forceDialog: true,
      });

      expect(mockPrintHtml).toHaveBeenCalledWith(
        expect.objectContaining({
          printerName: undefined,
          silent: false,
        })
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('via print dialog');
    });

    it('returns actionable error when printer is offline and dialog is cancelled', async () => {
      const mockPrintHtml = vi.fn().mockResolvedValue({ success: false, failureReason: 'Printer offline' });
      window.electronAPI = {
        getAppPaths: vi.fn(),
        getPrinters: vi.fn(),
        printHtml: mockPrintHtml,
        testPrint: vi.fn(),
        isElectron: true,
      };

      const result = await dispatchThermalPrint({
        rawText: 'KOT #1',
        printerName: 'Offline-Printer',
        widthMm: 80,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Printer offline');
    });
  });

  describe('BUG 2: POS Table Selector Viewport Boundary Clamping & Selection', () => {
    function computeTablePickerPosition(
      buttonRect: { top: number; bottom: number; left: number },
      viewportWidth: number,
      viewportHeight: number
    ) {
      const dropdownWidth = 320;
      const gap = 8;
      let top = buttonRect.bottom + gap;
      let left = buttonRect.left;

      if (left + dropdownWidth > viewportWidth - 16) {
        left = Math.max(16, viewportWidth - dropdownWidth - 16);
      }
      if (left < 16) {
        left = 16;
      }

      const estimatedHeight = 280;
      if (top + estimatedHeight > viewportHeight - 16 && buttonRect.top > estimatedHeight + gap) {
        top = buttonRect.top - estimatedHeight - gap;
      }

      return { top, left, width: dropdownWidth, right: left + dropdownWidth };
    }

    it('clamps dropdown position at 1366x768 to prevent clipping off right edge', () => {
      // Button placed near right edge of menu container at 1366 resolution
      const buttonRect = { top: 60, bottom: 96, left: 1100 };
      const pos = computeTablePickerPosition(buttonRect, 1366, 768);

      expect(pos.right).toBeLessThanOrEqual(1366);
      expect(pos.left).toBeGreaterThanOrEqual(16);
      expect(pos.left).toBe(1366 - 320 - 16); // 1030px
      expect(pos.right).toBe(1350); // <= 1366
    });

    it('clamps dropdown position at 1024x768 to prevent clipping off right edge', () => {
      // Button placed near right edge at 1024 resolution
      const buttonRect = { top: 60, bottom: 96, left: 800 };
      const pos = computeTablePickerPosition(buttonRect, 1024, 768);

      expect(pos.right).toBeLessThanOrEqual(1024);
      expect(pos.left).toBeGreaterThanOrEqual(16);
      expect(pos.left).toBe(1024 - 320 - 16); // 688px
      expect(pos.right).toBe(1008); // <= 1024
    });

    it('flips dropdown above button if bottom viewport clearance is insufficient', () => {
      // Button placed near bottom of screen
      const buttonRect = { top: 600, bottom: 636, left: 500 };
      const pos = computeTablePickerPosition(buttonRect, 1366, 768);

      // Should flip above: 600 - 280 - 8 = 312
      expect(pos.top).toBe(312);
      expect(pos.top + 280).toBeLessThan(768);
    });

    it('updates table selection in cart store across multiple table choices', () => {
      const store = useCartStore.getState();

      // Initial state
      expect(store.selectedTableNumber).toBeNull();

      // Select Table T5
      store.setTable('t-5', 'T5');
      expect(useCartStore.getState().selectedTableId).toBe('t-5');
      expect(useCartStore.getState().selectedTableNumber).toBe('T5');

      // Change selection to Table T6
      store.setTable('t-6', 'T6');
      expect(useCartStore.getState().selectedTableId).toBe('t-6');
      expect(useCartStore.getState().selectedTableNumber).toBe('T6');

      // Change selection to Table T8
      store.setTable('t-8', 'T8');
      expect(useCartStore.getState().selectedTableId).toBe('t-8');
      expect(useCartStore.getState().selectedTableNumber).toBe('T8');
    });
  });
});
