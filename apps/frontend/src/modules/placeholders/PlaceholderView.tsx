import React from 'react';
import { NavRoute } from '@/store/uiStore';
import { Card, CardContent } from '@/components/ui/Card';
import { Users, Boxes, BarChart3, Sparkles } from 'lucide-react';

const PLACEHOLDER_DETAILS: Record<
  string,
  { title: string; subtitle: string; description: string; icon: React.ReactNode; features: string[] }
> = {
  customers: {
    title: 'Customer Relationship Management (CRM)',
    subtitle: 'Commercial Subscription Feature — Phase 2',
    description:
      'Customer loyalty points, order history, phone lookup during billing, VIP discounting, and WhatsApp marketing campaigns.',
    icon: <Users className="h-8 w-8 text-[#F07818]" />,
    features: [
      'Customer address directory for fast home delivery dispatch',
      'Loyalty points accumulation and redemption at POS cart',
      'Automatic birthday & anniversary discount rules',
      'Order history tracking with average customer spend metrics',
    ],
  },
  inventory: {
    title: 'Raw Material Inventory & Stock Control',
    subtitle: 'Commercial Subscription Feature — Phase 2',
    description:
      'Real-time recipe consumption, low-stock alerts, supplier purchase orders, and kitchen wastage tracking.',
    icon: <Boxes className="h-8 w-8 text-[#F07818]" />,
    features: [
      'Item recipe mapping (e.g., portions of paneer, cream, spices per dish)',
      'Automated stock deduction on KOT generation',
      'Low stock warning pills in POS menu card',
      'Purchase order creation and goods receipt verification',
    ],
  },
  reports: {
    title: 'Advanced Financial & GST Reports',
    subtitle: 'Commercial Subscription Feature — Phase 2',
    description:
      'GSTR-1 sales returns, profit & loss statements, item profitability analysis, and hourly peak load reports.',
    icon: <BarChart3 className="h-8 w-8 text-[#F07818]" />,
    features: [
      'Exportable GSTR-1 Excel / CSV files for direct filing',
      'Item-wise food cost vs margin analysis',
      'Cashier end-of-day register reconciliation (Z-Report)',
      'Staff sales performance and tip tracking',
    ],
  },
};

export const PlaceholderView: React.FC<{ route: NavRoute }> = ({ route }) => {
  const info = PLACEHOLDER_DETAILS[route] || {
    title: 'Upcoming Feature',
    subtitle: 'Phase 2 Module',
    description: 'This feature will be unlocked in upcoming commercial subscription releases.',
    icon: <Sparkles className="h-8 w-8 text-[#F07818]" />,
    features: [],
  };

  return (
    <div className="max-w-3xl space-y-6 py-6">
      <Card className="border-[#FFF0E3] bg-gradient-to-br from-white to-[#FFFBF8] shadow-card">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0E3] text-[#F07818] shadow-sm">
              {info.icon}
            </div>
            <div>
              <span className="rounded-full bg-[#FFF0E3] px-3 py-1 text-xs font-bold text-[#C85A0A]">
                {info.subtitle}
              </span>
              <h2 className="text-xl font-bold text-[#202124] mt-2">{info.title}</h2>
              <p className="text-xs text-[#6B7280] mt-1 max-w-xl">{info.description}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E8EAF0] bg-white p-5 space-y-3">
            <h4 className="text-xs font-bold text-[#202124] uppercase tracking-wider">
              Roadmap Capabilities in this Module:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#4B5563]">
              {info.features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#F07818] mt-1.5 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FAFAFB] border border-[#E8EAF0] text-xs text-[#6B7280]">
            <strong>Note:</strong> In this foundation phase, the core POS, kitchen order tickets (KOT),
            table management, real-time dashboard, and local SQLite billing workflows are fully functional
            and commercial-ready.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
