import React from 'react';
import { useUIStore } from '@/store/uiStore';
import { kotApi } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Printer, RefreshCw, CheckCircle2 } from 'lucide-react';

export const KOTPreviewModal: React.FC = () => {
  const { isKOTModalOpen, closeKOTModal, kotPrintResult, addToast } = useUIStore();

  if (!kotPrintResult) return null;

  const { kot, formatted_text, is_new_items_printed, message } = kotPrintResult;

  const handleReprint = async () => {
    try {
      const res = await kotApi.reprintKOT(kot.id);
      addToast({
        type: 'success',
        title: 'KOT Sent to Printer',
        description: `KOT ${kot.kot_code} re-spooled to kitchen printer.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Print Error',
        description: err.message || 'Could not reprint KOT.',
      });
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
          <Button type="button" onClick={handleReprint} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reprint KOT</span>
          </Button>
          <Button type="button" onClick={closeKOTModal} variant="primary">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
