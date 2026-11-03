import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '@/store/uiStore';
import { kotApi, restaurantApi } from '@/services/api';
import { dispatchThermalPrint } from '@/services/printerService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export const KOTPreviewModal: React.FC = () => {
  const { isKOTModalOpen, closeKOTModal, kotPrintResult, addToast } = useUIStore();
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: restaurant } = useQuery({
    queryKey: ['restaurant'],
    queryFn: restaurantApi.getCurrent,
  });

  if (!kotPrintResult) return null;

  const { kot, formatted_text, is_new_items_printed, message } = kotPrintResult;

  const handleReprint = async () => {
    setIsPrinting(true);
    try {
      // 1. Mark status on existing KOT in backend (idempotent, never duplicates KOT/order/stock)
      const res = await kotApi.reprintKOT(kot.id);
      const textToPrint = res.formatted_text || formatted_text;

      // 2. Dispatch to physical / system printer via Electron IPC or print dialog
      const kotPrinter = restaurant?.settings?.kot_printer_name || undefined;
      const paperWidth = restaurant?.settings?.paper_width_mm || 80;

      const printResult = await dispatchThermalPrint({
        rawText: textToPrint,
        title: `KOT ${kot.kot_code}`,
        printerName: kotPrinter,
        widthMm: paperWidth,
        forceDialog: !kotPrinter, // Open system print dialog if no designated KOT printer configured
      });

      if (printResult.success) {
        addToast({
          type: 'success',
          title: 'KOT Sent to Printer',
          description: printResult.message || `KOT ${kot.kot_code} printed successfully.`,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Print Error',
          description: printResult.message || 'Could not reach kitchen printer. Check printer power & USB connection.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Reprint Failed',
        description: err.message || 'Could not complete KOT reprint.',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Modal
      isOpen={isKOTModalOpen}
      onClose={closeKOTModal}
      title={`Kitchen Order Ticket (${kot.kot_code})`}
      description={message}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Status banner */}
        <div className="flex items-center justify-between rounded-xl border border-[#16865B]/20 bg-[#EBF7F2] p-3 text-xs text-[#16865B]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold">
              {is_new_items_printed ? 'New Items Sent to Kitchen' : 'KOT Verified'}
            </span>
          </div>
          <Badge variant="success" size="sm">
            {kot.status.toUpperCase()}
          </Badge>
        </div>

        {/* Thermal Ticket Preview */}
        <div className="rounded-xl border border-[#E8EAF0] bg-[#202124] p-4 text-[#F7F8FA] font-mono text-xs overflow-x-auto shadow-inner leading-relaxed">
          <pre className="whitespace-pre-wrap">{formatted_text}</pre>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E8EAF0]">
          <Button
            type="button"
            onClick={handleReprint}
            disabled={isPrinting}
            variant="outline"
            size="sm"
            className="gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPrinting ? 'animate-spin' : ''}`} />
            <span>{isPrinting ? 'Printing...' : 'Reprint KOT'}</span>
          </Button>
          <Button type="button" onClick={closeKOTModal} variant="primary">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
