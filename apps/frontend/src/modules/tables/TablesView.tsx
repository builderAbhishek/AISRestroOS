import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tablesApi, ordersApi } from '@/services/api';
import { useUIStore } from '@/store/uiStore';
import { useCartStore } from '@/store/cartStore';
import { formatINR } from '@/lib/utils';
import { RestaurantTable } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import {
  Grid3X3,
  Plus,
  Armchair,
  Users,
  UtensilsCrossed,
  Receipt,
  Trash2,
} from 'lucide-react';

export const TablesView: React.FC = () => {
  const queryClient = useQueryClient();
  const { setCurrentRoute, openSettlementModal, addToast } = useUIStore();
  const { setOrderType, setTable, loadExistingOrder } = useCartStore();

  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');
  const [section, setSection] = useState('Ground Floor');

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => tablesApi.listTables(),
    refetchInterval: 5000,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => tablesApi.listTables(),
  });

  // Group tables by section
  const sections = Array.from(new Set(tables.map((t) => t.section || 'Main Hall')));

  const handleOpenTableInPOS = async (table: RestaurantTable) => {
    setOrderType('dine_in');
    setTable(table.id, table.table_number);

    if (table.status === 'occupied' && table.current_order_id) {
      try {
        const order = await ordersApi.getOrder(table.current_order_id);
        const allItems = await (await fetch('/api/v1/menu/items')).json();
        loadExistingOrder(order, allItems);
        addToast({
          type: 'info',
          title: `Resumed Table ${table.table_number}`,
          description: `Loaded active order ${order.order_code}.`,
        });
      } catch (err: any) {
        addToast({ type: 'error', title: 'Error', description: err.message });
      }
    }

    setCurrentRoute('pos');
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) return;

    try {
      await tablesApi.createTable({
        table_number: tableNumber.trim(),
        capacity: parseInt(capacity) || 4,
        section: section.trim() || 'Main Hall',
      });
      addToast({ type: 'success', title: 'Table Added', description: `Table ${tableNumber} created.` });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      setIsAddTableOpen(false);
      setTableNumber('');
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const handleDeleteTable = async (table: RestaurantTable, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete table ${table.table_number}?`)) return;
    try {
      await tablesApi.deleteTable(table.id);
      addToast({ type: 'info', title: 'Deleted', description: 'Table removed.' });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', description: err.message });
    }
  };

  const availableCount = tables.filter((t) => t.status === 'available').length;
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;

  return (
    <div className="space-y-6 pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#202124]">Table Layout & Floor Plan</h2>
          <p className="text-xs text-[#6B7280]">
            Monitor active dining tables, occupancy status and quick bill settlements
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#EBF7F2] text-[#16865B] border border-[#16865B]/20">
              <span className="h-2 w-2 rounded-full bg-[#16865B]" />
              {availableCount} Available
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF0E3] text-[#C85A0A] border border-[#F07818]/30">
              <span className="h-2 w-2 rounded-full bg-[#F07818]" />
              {occupiedCount} Occupied
            </span>
          </div>

          <Button
            onClick={() => setIsAddTableOpen(true)}
            size="sm"
            variant="primary"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add Table</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading tables..." />
      ) : tables.length === 0 ? (
        <EmptyState
          title="No dining tables added"
          description="Create your first dining table to accept Dine-in orders on POS."
          actionLabel="Add Table"
          onAction={() => setIsAddTableOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {sections.map((secName) => {
            const secTables = tables.filter((t) => (t.section || 'Main Hall') === secName);

            return (
              <div key={secName} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#E8EAF0] pb-2">
                  <Armchair className="h-4 w-4 text-[#F07818]" />
                  <h3 className="text-sm font-bold text-[#202124]">{secName}</h3>
                  <span className="text-xs text-[#6B7280]">({secTables.length} tables)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {secTables.map((table) => {
                    const isOccupied = table.status === 'occupied';

                    return (
                      <div
                        key={table.id}
                        onClick={() => handleOpenTableInPOS(table)}
                        className={`group relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                          isOccupied
                            ? 'border-[#F07818] bg-[#FFF8F2] shadow-sm'
                            : 'border-[#E8EAF0] bg-white hover:border-[#16865B] hover:shadow-card'
                        }`}
                      >
                        {/* Top info */}
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-base font-extrabold text-[#202124]">
                              {table.table_number}
                            </span>
                            <p className="text-[10px] text-[#6B7280] flex items-center gap-1 mt-0.5">
                              <Users className="h-3 w-3" />
                              <span>{table.capacity} seats</span>
                            </p>
                          </div>

                          <Badge
                            size="sm"
                            variant={isOccupied ? 'bhagwa' : 'success'}
                          >
                            {isOccupied ? 'OCCUPIED' : 'FREE'}
                          </Badge>
                        </div>

                        {/* Status label / Quick action */}
                        <div className="mt-4 pt-2 border-t border-[#F0F2F6] flex items-center justify-between text-xs">
                          <span
                            className={`font-semibold ${
                              isOccupied ? 'text-[#C85A0A]' : 'text-[#16865B]'
                            }`}
                          >
                            {isOccupied ? 'Open Order' : 'Start Order'}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteTable(table, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[#D94343] hover:bg-[#FDECEC] rounded transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Table Modal */}
      <Modal
        isOpen={isAddTableOpen}
        onClose={() => setIsAddTableOpen(false)}
        title="Add Restaurant Table"
        description="Configure table number, seating capacity and section"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateTable} className="space-y-4">
          <Input
            label="Table Number / Name *"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            placeholder="e.g. T1, T2, Garden-1"
            required
          />
          <Input
            label="Seating Capacity *"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g. 4"
            required
          />
          <Input
            label="Floor / Section *"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="e.g. Ground Floor, First Floor, Garden"
            required
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8EAF0]">
            <Button type="button" onClick={() => setIsAddTableOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Table
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
