import React, { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { billingApi } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, ExternalLink, Copy, Check, FileText } from 'lucide-react';

export const CustomerReceiptModal: React.FC = () => {
  const { isReceiptModalOpen, closeReceiptModal, receiptModalData, addToast } = useUIStore();
  const [selectedFormat, setSelectedFormat] = useState<'80mm' | '58mm'>('80mm');
  const [currentReceiptText, setCurrentReceiptText] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoadingFormat, setIsLoadingFormat] = useState(false);

  React.useEffect(() => {
    if (receiptModalData?.receiptText) {
      setCurrentReceiptText(receiptModalData.receiptText);
    }
  }, [receiptModalData]);

  if (!receiptModalData) return null;

  const { invoiceNumber, orderId } = receiptModalData;

  const handleFormatChange = async (format: '80mm' | '58mm') => {
    setSelectedFormat(format);
    if (orderId) {
      setIsLoadingFormat(true);
      try {
        const res = await billingApi.getReceiptText(orderId, format);
        setCurrentReceiptText(res.receipt_text);
      } catch (err: any) {
        addToast({ type: 'error', title: 'Error', description: err.message });
      } finally {
        setIsLoadingFormat(false);
      }
    }
  };

  const handlePrintThermal = () => {
    // Open print window with thermal layout
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt ${invoiceNumber}</title>
          <style>
            @page {
              margin: 0;
              size: ${selectedFormat === '58mm' ? '58mm' : '80mm'} auto;
            }
            body {
              font-family: "Courier New", Courier, monospace;
              font-size: ${selectedFormat === '58mm' ? '10px' : '12px'};
              line-height: 1.25;
              padding: 6px;
              margin: 0;
              color: black;
              background: white;
            }
            pre {
              margin: 0;
              white-space: pre-wrap;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <pre>${currentReceiptText}</pre>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }

    addToast({
      type: 'success',
      title: 'Sent to Thermal Printer',
      description: `Invoice ${invoiceNumber} (${selectedFormat}) dispatched.`,
    });
  };

  const handleOpenA4Invoice = () => {
    if (orderId) {
      const url = billingApi.getA4InvoiceUrl(orderId);
      window.open(url, '_blank', 'width=900,height=900');
    } else {
      addToast({ type: 'info', title: 'A4 View', description: 'Available from Orders registry.' });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(currentReceiptText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    addToast({ type: 'info', title: 'Copied', description: 'Receipt text copied to clipboard.' });
  };

  return (
    <Modal
      isOpen={isReceiptModalOpen}
      onClose={closeReceiptModal}
      title={`Customer Tax Invoice (${invoiceNumber})`}
      description="Print thermal customer receipt (58mm / 80mm) or standard A4 invoice"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Format Selector Pills */}
        <div className="flex items-center justify-between pb-1 border-b border-[#E8EAF0]">
          <div className="flex items-center gap-1.5 bg-[#F3F4F6] p-1 rounded-lg">
            <button
              type="button"
              onClick={() => handleFormatChange('80mm')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                selectedFormat === '80mm'
                  ? 'bg-white text-[#202124] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              80mm Thermal (Standard)
            </button>
            <button
              type="button"
              onClick={() => handleFormatChange('58mm')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                selectedFormat === '58mm'
                  ? 'bg-white text-[#202124] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#202124]'
              }`}
            >
              58mm Thermal (Compact)
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs px-2 gap-1"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
        </div>

        {/* Thermal Receipt Preview Paper Roll */}
        <div className="relative rounded-xl border border-[#E8EAF0] bg-[#FFFDF9] p-5 text-[#202124] font-mono text-xs overflow-x-auto shadow-inner leading-relaxed border-dashed max-h-[420px] overflow-y-auto">
          {isLoadingFormat ? (
            <div className="py-12 text-center text-[#6B7280]">Formatting receipt...</div>
          ) : (
            <pre className="whitespace-pre-wrap">{currentReceiptText}</pre>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#E8EAF0]">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrintThermal}
              variant="primary"
              className="gap-2 text-xs font-bold"
            >
              <Printer className="h-4 w-4" />
              <span>Print {selectedFormat} Thermal</span>
            </Button>

            {orderId && (
              <Button
                type="button"
                onClick={handleOpenA4Invoice}
                variant="outline"
                className="gap-1.5 text-xs font-semibold"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Print A4</span>
              </Button>
            )}
          </div>

          <Button type="button" onClick={closeReceiptModal} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
