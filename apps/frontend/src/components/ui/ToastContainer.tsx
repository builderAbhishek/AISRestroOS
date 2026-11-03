import React from 'react';
import { useUIStore, ToastMessage } from '@/store/uiStore';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-[#16865B] shrink-0" />,
    error: <AlertCircle className="h-5 w-5 text-[#D94343] shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-[#D98A16] shrink-0" />,
    info: <Info className="h-5 w-5 text-[#2563EB] shrink-0" />,
  };

  const borders = {
    success: 'border-l-4 border-l-[#16865B]',
    error: 'border-l-4 border-l-[#D94343]',
    warning: 'border-l-4 border-l-[#D98A16]',
    info: 'border-l-4 border-l-[#2563EB]',
  };

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start justify-between gap-3 rounded-xl bg-white p-4 shadow-modal border border-[#E8EAF0] animate-in slide-in-from-right-5 duration-200',
        borders[toast.type]
      )}
    >
      <div className="flex items-start gap-3">
        {icons[toast.type]}
        <div>
          <h4 className="text-sm font-semibold text-[#202124]">{toast.title}</h4>
          {toast.description && (
            <p className="mt-0.5 text-xs text-[#6B7280]">{toast.description}</p>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="rounded-md p-1 text-[#9CA3AF] hover:text-[#202124] hover:bg-[#F3F4F6] transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
