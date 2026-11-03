import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { formatINR, formatINRNumber } from '../lib/utils';

describe('UI Primitives and Helpers', () => {
  it('formats currency in Indian Rupees format correctly', () => {
    // 25000 paise = ₹250.00
    const formatted = formatINR(25000);
    expect(formatted).toContain('250.00');

    // 10000000 paise = ₹1,00,000.00
    const formattedLakh = formatINRNumber(10000000);
    expect(formattedLakh).toBe('1,00,000.00');
  });

  it('renders primary Bhagwa Button with appropriate styles', () => {
    render(<Button variant="primary">Add & Print KOT</Button>);
    const btn = screen.getByRole('button', { name: /Add & Print KOT/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-[#F07818]');
  });

  it('renders loading state inside Button when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByText(/Processing.../i)).toBeInTheDocument();
  });

  it('renders Badge with variants', () => {
    render(<Badge variant="bhagwa">DINE IN</Badge>);
    const badge = screen.getByText('DINE IN');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-[#FFF0E3]');
  });

  it('renders EmptyState with title and action button', () => {
    const handleAction = () => {};
    render(
      <EmptyState
        title="No Orders Yet"
        description="Start your first order on POS."
        actionLabel="Open POS"
        onAction={handleAction}
      />
    );
    expect(screen.getByText('No Orders Yet')).toBeInTheDocument();
    expect(screen.getByText('Start your first order on POS.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open POS/i })).toBeInTheDocument();
  });
});
