/**
 * AISRestroOS Thermal & ESC/POS Printing Service
 * Bridges React UI with Electron IPC printing and browser print fallbacks.
 */

export function buildReceiptHtml(rawText: string, title: string = 'Ticket', widthMm: number = 80): string {
  const is58mm = widthMm <= 58;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      margin: 0;
      size: ${is58mm ? '58mm' : '80mm'} auto;
    }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: ${is58mm ? '10px' : '12px'};
      line-height: 1.25;
      padding: 6px;
      margin: 0;
      color: #000;
      background: #fff;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
      font-family: inherit;
    }
  </style>
</head>
<body>
  <pre>${rawText}</pre>
</body>
</html>`;
}

export interface PrintOptions {
  rawText: string;
  title?: string;
  printerName?: string;
  widthMm?: number;
  forceDialog?: boolean;
}

export async function dispatchThermalPrint({
  rawText,
  title = 'Kitchen Order Ticket',
  printerName,
  widthMm = 80,
  forceDialog = false,
}: PrintOptions): Promise<{ success: boolean; message: string }> {
  const html = buildReceiptHtml(rawText, title, widthMm);

  // 1. Electron IPC print handler (packaged Windows application)
  if (typeof window !== 'undefined' && window.electronAPI?.printHtml) {
    try {
      const silent = !forceDialog && Boolean(printerName && printerName.trim());
      const res = await window.electronAPI.printHtml({
        html,
        printerName: silent ? printerName : undefined,
        silent,
        widthMm,
      });

      if (res.success) {
        return {
          success: true,
          message: silent
            ? `Dispatched directly to "${printerName}".`
            : 'Ticket printed successfully via print dialog.',
        };
      }

      if (res.failureReason === 'cancelled') {
        return {
          success: false,
          message: 'Printing cancelled by user.',
        };
      }

      // If silent print failed (e.g. printer offline / disconnected), fall back to opening dialog
      if (silent) {
        const dialogRes = await window.electronAPI.printHtml({
          html,
          silent: false,
          widthMm,
        });
        if (dialogRes.success) {
          return {
            success: true,
            message: `Printer "${printerName}" was unreachable; printed via print dialog.`,
          };
        }
      }

      return {
        success: false,
        message: res.failureReason || `Printer "${printerName || 'default'}" is unavailable. Please check cable or network status.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Electron printer dispatch error.',
      };
    }
  }

  // 2. Web browser fallback (development environment)
  if (typeof window !== 'undefined') {
    try {
      const printWindow = window.open('', '_blank', 'width=450,height=600');
      if (printWindow) {
        printWindow.document.write(`
          ${html}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        `);
        printWindow.document.close();
        return { success: true, message: 'Print dialog opened in window.' };
      } else {
        window.print();
        return { success: true, message: 'Dispatched to browser print.' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Browser print failed.' };
    }
  }

  return { success: false, message: 'No print environment detected.' };
}
