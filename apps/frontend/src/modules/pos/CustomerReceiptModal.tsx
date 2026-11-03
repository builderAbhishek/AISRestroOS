import React from 'react';
import { useUIStore } from '@/store/uiStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, CheckCircle } from 'lucide-react';

export const CustomerReceiptModal: React.FC = () => {
  const { isReceiptModalOpen, closeReceiptModal, receiptModalData, addToast } = useUIStore();

  if (!receiptModalData) return null;

  const { receiptText, invoiceNumber } = receiptModalData;

  const handlePrint = () => {
    // In desktop Electron or browser window, triggers window.print or thermal driver
    window.print();
    addToast({
      type: 'success',
      title: 'Receipt Sent to Thermal Printer',
      description: `Invoice ${invoiceNumber} printed successfully.`,
    });
  };

  return (
    <Modal
      isOpen={isReceiptModalOpen}
      onClose={closeReceiptModal}
      title={`Customer Tax Invoice (${invoiceNumber})`}
      description="Thermal 80mm / 58mm customer receipt generated"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Receipt Container */}
        <div className="rounded-xl border border-[#E8EAF0] bg-white p-5 text-[#202124] font-mono text-xs overflow-x-auto shadow-sm leading-relaxed border-dashed">
          <pre className="whitespace-pre-wrap">{receiptText}</pre>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E8EAF0]">
          <Button type="button" onClick={handlePrint} variant="primary" className="gap-2">
            <Printer className="h-4 w-4" />
            <span>Print Tax Receipt</span>
          </Button>
          <Button type="button" onClick={closeReceiptModal} variant="outline">
            Close & Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
};
