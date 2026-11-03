from typing import Optional
from app.models.billing import Invoice
from app.models.order import Order
from app.models.restaurant import Restaurant, RestaurantSettings


def format_a4_invoice_html(
    invoice: Invoice,
    order: Order,
    restaurant: Restaurant,
    settings: Optional[RestaurantSettings] = None,
) -> str:
    """
    Renders a standard, professional, printable A4 HTML invoice.
    Can be loaded directly in an iframe, popup, or browser tab and printed via window.print().
    """
    date_str = invoice.created_at.strftime("%d %b %Y, %I:%M %p")
    tax_rate = getattr(invoice, "tax_rate_percent", 0.0) or 0.0
    is_inclusive = getattr(invoice, "is_tax_inclusive", False)
    tax_type = getattr(invoice, "tax_type", "CGST_SGST")
    footer_text = settings.bill_footer_text if settings and settings.bill_footer_text else "Thank you for dining with us! Please visit again."

    items_html = ""
    for idx, item in enumerate(order.items, start=1):
        variant_str = f" <span style='color: #64748b;'>({item.variant_name})</span>" if item.variant_name else ""
        addons_html = ""
        if item.addons:
            addons_list = [f"+ {a.addon_name} (₹{a.price_paise / 100:.2f})" for a in item.addons]
            addons_html = f"<div style='font-size: 11px; color: #64748b; margin-top: 2px;'>{', '.join(addons_list)}</div>"
        
        notes_html = f"<div style='font-size: 11px; color: #ea580c; font-style: italic; margin-top: 1px;'>Note: {item.notes}</div>" if item.notes else ""

        items_html += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 8px; text-align: center; color: #64748b;">{idx}</td>
            <td style="padding: 10px 8px;">
                <div style="font-weight: 500; color: #1e293b;">{item.item_name}{variant_str}</div>
                {addons_html}
                {notes_html}
            </td>
            <td style="padding: 10px 8px; text-align: right; color: #334155;">₹{item.unit_price_paise / 100:.2f}</td>
            <td style="padding: 10px 8px; text-align: center; font-weight: 500; color: #1e293b;">{item.quantity}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #0f172a;">₹{item.line_total_paise / 100:.2f}</td>
        </tr>
        """

    # Tax rows
    tax_rows = ""
    tax_label_suffix = " (Inclusive)" if is_inclusive else ""
    if (getattr(invoice, "cgst_paise", 0) > 0 or getattr(invoice, "sgst_paise", 0) > 0) and tax_rate > 0:
        half_rate = tax_rate / 2.0
        tax_rows += f"""
        <tr>
            <td style="padding: 4px 0; color: #64748b;">CGST ({half_rate:.1f}%){tax_label_suffix}:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 500; color: #1e293b;">₹{invoice.cgst_paise / 100:.2f}</td>
        </tr>
        <tr>
            <td style="padding: 4px 0; color: #64748b;">SGST ({half_rate:.1f}%){tax_label_suffix}:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 500; color: #1e293b;">₹{invoice.sgst_paise / 100:.2f}</td>
        </tr>
        """
    elif getattr(invoice, "igst_paise", 0) > 0 and tax_rate > 0:
        tax_rows += f"""
        <tr>
            <td style="padding: 4px 0; color: #64748b;">IGST ({tax_rate:.1f}%){tax_label_suffix}:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 500; color: #1e293b;">₹{invoice.igst_paise / 100:.2f}</td>
        </tr>
        """
    elif invoice.total_tax_paise > 0:
        tax_rows += f"""
        <tr>
            <td style="padding: 4px 0; color: #64748b;">Tax ({tax_rate:.1f}%){tax_label_suffix}:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 500; color: #1e293b;">₹{invoice.total_tax_paise / 100:.2f}</td>
        </tr>
        """

    # Payments summary rows
    payments_html = ""
    if invoice.payments:
        p_items = []
        for p in invoice.payments:
            change_txt = f" (Tendered: ₹{p.tendered_amount_paise / 100:.2f}, Change: ₹{p.change_due_paise / 100:.2f})" if p.change_due_paise and p.change_due_paise > 0 else ""
            ref_txt = f" [Ref: {p.reference_number}]" if p.reference_number else ""
            p_items.append(f"<li style='margin-bottom: 4px;'><strong>{p.payment_method.upper()}</strong>: ₹{p.amount_paise / 100:.2f}{change_txt}{ref_txt}</li>")
        payments_html = f"""
        <div style="margin-top: 15px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="font-weight: 600; font-size: 13px; color: #334155; margin-bottom: 6px;">Payment Breakdown:</div>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569;">
                {''.join(p_items)}
            </ul>
        </div>
        """

    refunds_html = ""
    if invoice.refunds:
        r_items = []
        for r in invoice.refunds:
            r_items.append(f"<li style='margin-bottom: 4px;'><strong>₹{r.amount_paise / 100:.2f}</strong> via {r.payment_method.upper()} — Reason: {r.reason}</li>")
        refunds_html = f"""
        <div style="margin-top: 10px; padding: 12px; background: #fff1f2; border-radius: 6px; border: 1px solid #fecdd3;">
            <div style="font-weight: 600; font-size: 13px; color: #9f1239; margin-bottom: 6px;">Refunds Issued:</div>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #be123c;">
                {''.join(r_items)}
            </ul>
        </div>
        """

    customer_info = ""
    if order.customer_name or order.customer_phone or order.customer_address:
        cust_lines = []
        if order.customer_name:
            cust_lines.append(f"<strong>Name:</strong> {order.customer_name}")
        if order.customer_phone:
            cust_lines.append(f"<strong>Phone:</strong> {order.customer_phone}")
        if order.customer_address:
            cust_lines.append(f"<strong>Address:</strong> {order.customer_address}")
        customer_info = f"""
        <div style="margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #F07818; font-size: 13px; color: #334155;">
            <div style="font-weight: 600; color: #0f172a; margin-bottom: 4px;">Customer Details:</div>
            {'<br/>'.join(cust_lines)}
        </div>
        """

    status_badge_color = "#16a34a" if invoice.status == "paid" else ("#ea580c" if invoice.status == "partially_paid" else "#dc2626")
    status_text = invoice.status.replace("_", " ").upper()

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice {invoice.invoice_number}</title>
    <style>
        @page {{
            size: A4 portrait;
            margin: 15mm;
        }}
        @media print {{
            body {{
                margin: 0;
                padding: 0;
                background: #ffffff;
                color: #0f172a;
            }}
            .no-print {{
                display: none !important;
            }}
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f1f5f9;
            margin: 0;
            padding: 24px;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.5;
        }}
        .invoice-container {{
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }}
        .print-btn {{
            background: #F07818;
            color: white;
            border: none;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
        }}
        .print-btn:hover {{
            background: #d96208;
        }}
    </style>
</head>
<body>
    <div class="no-print" style="max-width: 800px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
        <button class="print-btn" onclick="window.print()">
            🖨️ Print Invoice (A4)
        </button>
        <div style="font-size: 12px; color: #64748b;">Press Ctrl+P or click the button to print</div>
    </div>

    <div class="invoice-container">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #F07818; padding-bottom: 20px; margin-bottom: 24px;">
            <div>
                <h1 style="margin: 0 0 6px 0; font-size: 26px; color: #0f172a; font-weight: 700;">{restaurant.name}</h1>
                {f'<div style="color: #64748b; font-size: 14px; margin-bottom: 4px;">{restaurant.legal_name}</div>' if restaurant.legal_name and restaurant.legal_name != restaurant.name else ''}
                <div style="color: #475569; font-size: 13px; max-width: 380px;">{restaurant.address}</div>
                <div style="color: #475569; font-size: 13px; margin-top: 4px;">Phone: <strong>{restaurant.phone}</strong></div>
                {f'<div style="color: #475569; font-size: 13px;">GSTIN: <strong>{restaurant.gstin}</strong></div>' if restaurant.gst_registered and restaurant.gstin else ''}
            </div>
            <div style="text-align: right;">
                <div style="font-size: 22px; font-weight: 800; color: #F07818; letter-spacing: 0.5px;">TAX INVOICE</div>
                <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px;">{invoice.invoice_number}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Order: <strong>{order.order_code}</strong></div>
                <div style="font-size: 12px; color: #64748b;">Date: {date_str}</div>
                <div style="margin-top: 8px;">
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: {status_badge_color}15; color: {status_badge_color}; border: 1px solid {status_badge_color};">
                        {status_text}
                    </span>
                </div>
            </div>
        </div>

        <!-- Meta Details: Type, Table, Customer -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px; background: #f8fafc; padding: 12px 16px; border-radius: 6px;">
            <div>
                <span style="color: #64748b; font-size: 12px;">ORDER TYPE:</span>
                <span style="font-weight: 600; color: #0f172a; margin-left: 6px;">{order.order_type.replace('_', ' ').upper()}</span>
            </div>
            {f'<div><span style="color: #64748b; font-size: 12px;">TABLE:</span><span style="font-weight: 600; color: #0f172a; margin-left: 6px;">{order.table_number_snapshot}</span></div>' if order.table_number_snapshot else ''}
            <div>
                <span style="color: #64748b; font-size: 12px;">PAYMENT STATUS:</span>
                <span style="font-weight: 600; color: {status_badge_color}; margin-left: 6px;">{order.payment_status.upper()}</span>
            </div>
        </div>

        {customer_info}

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
                <tr style="background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; font-size: 12px; color: #475569;">
                    <th style="padding: 10px 8px; text-align: center; width: 40px;">#</th>
                    <th style="padding: 10px 8px; text-align: left;">Item Description</th>
                    <th style="padding: 10px 8px; text-align: right; width: 100px;">Price</th>
                    <th style="padding: 10px 8px; text-align: center; width: 60px;">Qty</th>
                    <th style="padding: 10px 8px; text-align: right; width: 110px;">Total</th>
                </tr>
            </thead>
            <tbody>
                {items_html}
            </tbody>
        </table>

        <!-- Totals & Payment Section -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px;">
            <div style="width: 50%;">
                {payments_html}
                {refunds_html}
            </div>

            <div style="width: 44%;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr>
                        <td style="padding: 6px 0; color: #64748b;">Subtotal:</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #1e293b;">₹{invoice.subtotal_paise / 100:.2f}</td>
                    </tr>
                    {f'''
                    <tr>
                        <td style="padding: 6px 0; color: #dc2626;">Discount:</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #dc2626;">-₹{invoice.discount_paise / 100:.2f}</td>
                    </tr>
                    ''' if invoice.discount_paise > 0 else ''}
                    {f'''
                    <tr>
                        <td style="padding: 6px 0; color: #64748b;">Taxable Amount:</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #1e293b;">₹{invoice.taxable_amount_paise / 100:.2f}</td>
                    </tr>
                    ''' if invoice.taxable_amount_paise and invoice.taxable_amount_paise != invoice.subtotal_paise else ''}
                    {tax_rows}
                    <tr style="border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;">
                        <td style="padding: 10px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Grand Total:</td>
                        <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: 800; color: #F07818;">₹{invoice.grand_total_paise / 100:.2f}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #16a34a; font-weight: 600;">Paid Amount:</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #16a34a;">₹{invoice.paid_amount_paise / 100:.2f}</td>
                    </tr>
                    {f'''
                    <tr>
                        <td style="padding: 6px 0; color: #dc2626; font-weight: 600;">Due Amount:</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #dc2626;">₹{invoice.due_amount_paise / 100:.2f}</td>
                    </tr>
                    ''' if invoice.due_amount_paise > 0 else ''}
                </table>
            </div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #64748b; font-size: 12px;">
            <p style="margin: 0 0 6px 0; font-weight: 500; color: #334155;">{footer_text}</p>
            <p style="margin: 0; font-size: 11px;">AISRestroOS Commercial Offline-First Restaurant Operating System</p>
        </div>
    </div>
</body>
</html>
"""
    return html
