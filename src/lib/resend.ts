import { Resend } from 'resend';
import { STATUS_LABELS } from '@/lib/constants';
import type { OrderWithItems, StoreConfig } from '@/lib/types';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderConfirmationEmail(
  order: OrderWithItems,
  storeConfig: StoreConfig,
): Promise<void> {
  if (!order.customerEmail) return;
  try {
    await resend.emails.send({
      from: `${storeConfig.name} <noreply@socialforge.io>`,
      to: order.customerEmail,
      subject: `Order Confirmed — #${order.orderNumber}`,
      html: buildOrderConfirmationHtml(order, storeConfig),
    });
  } catch (err) {
    console.error('Order confirmation email failed:', err);
  }
}

export async function sendOrderStatusEmail(
  order: OrderWithItems,
  storeConfig: StoreConfig,
): Promise<void> {
  if (!order.customerEmail) return;
  const statusLabel = STATUS_LABELS[order.fulfillmentStatus] ?? order.fulfillmentStatus;
  try {
    await resend.emails.send({
      from: `${storeConfig.name} <noreply@socialforge.io>`,
      to: order.customerEmail,
      subject: `Your Order #${order.orderNumber} — ${statusLabel}`,
      html: buildStatusUpdateHtml(order, storeConfig, statusLabel),
    });
  } catch (err) {
    console.error('Order status email failed:', err);
  }
}

export async function sendBusinessOwnerNotification(
  businessEmail: string,
  subject: string,
  body: string,
): Promise<void> {
  try {
    await resend.emails.send({
      from: 'SocialForge <noreply@socialforge.io>',
      to: businessEmail,
      subject,
      html: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
    });
  } catch (err) {
    console.error('Business owner notification email failed:', err);
  }
}

// ─────────────────────────────────────────────
// HTML BUILDERS
// ─────────────────────────────────────────────

function buildOrderConfirmationHtml(order: OrderWithItems, storeConfig: StoreConfig): string {
  const accentColor = storeConfig.accentColor ?? '#7c3aed';
  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e5e2;">
          ${
            item.imageUrl
              ? `<img src="${item.imageUrl}" alt="${item.productName}" width="56" height="75"
                   style="border-radius:6px;object-fit:cover;vertical-align:middle;margin-right:12px;" />`
              : ''
          }
          <span style="font-weight:500;color:#1c1c1a;">${item.productName}</span>
          ${item.variantLabel ? `<span style="color:#6b6b66;font-size:13px;"> — ${item.variantLabel}</span>` : ''}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e5e5e2;text-align:center;color:#6b6b66;">
          ×${item.quantity}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e5e5e2;text-align:right;font-weight:500;color:#1c1c1a;">
          ৳${(Number(item.price) * item.quantity).toLocaleString()}
        </td>
      </tr>
    `,
    )
    .join('');

  const paymentInstructions = buildPaymentInstructions(order, storeConfig);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:system-ui,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:${accentColor};padding:32px 40px;">
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:13px;text-transform:uppercase;letter-spacing:0.08em;">Order Confirmed</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">${storeConfig.name}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="margin:0 0 4px;color:#6b6b66;font-size:13px;">Order number</p>
      <p style="margin:0 0 24px;color:#1c1c1a;font-size:20px;font-weight:700;">#${order.orderNumber}</p>

      <p style="margin:0 0 16px;color:#1c1c1a;">Hi ${order.customerName}, thank you for your order! We've received it and will be in touch soon.</p>

      <!-- Items -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e2;margin-bottom:16px;">
        ${itemRows}
      </table>

      <!-- Totals -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td style="color:#6b6b66;padding:4px 0;">Subtotal</td>
          <td style="text-align:right;color:#1c1c1a;">৳${Number(order.subtotal).toLocaleString()}</td>
        </tr>
        <tr>
          <td style="color:#6b6b66;padding:4px 0;">Delivery</td>
          <td style="text-align:right;color:#1c1c1a;">
            ${Number(order.deliveryCharge) === 0 ? 'Free' : `৳${Number(order.deliveryCharge).toLocaleString()}`}
          </td>
        </tr>
        <tr>
          <td style="color:#1c1c1a;font-weight:700;padding:12px 0 4px;border-top:1px solid #e5e5e2;">Total</td>
          <td style="text-align:right;color:${accentColor};font-weight:700;font-size:18px;padding:12px 0 4px;border-top:1px solid #e5e5e2;">
            ৳${Number(order.total).toLocaleString()}
          </td>
        </tr>
      </table>

      <!-- Delivery Info -->
      <div style="background:#fafaf9;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-weight:600;color:#1c1c1a;font-size:14px;">Delivery Address</p>
        <p style="margin:0;color:#6b6b66;font-size:14px;line-height:1.5;">${order.deliveryAddress}</p>
      </div>

      ${paymentInstructions}
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:1px solid #e5e5e2;text-align:center;">
      <p style="margin:0;color:#a8a8a3;font-size:12px;">
        Questions? Reply to this email or contact ${storeConfig.name}.
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildStatusUpdateHtml(
  order: OrderWithItems,
  storeConfig: StoreConfig,
  statusLabel: string,
): string {
  const accentColor = storeConfig.accentColor ?? '#7c3aed';

  const statusMessages: Record<string, string> = {
    Confirmed: 'Great news! Your order has been confirmed and is being prepared.',
    Processing: 'Your order is currently being processed and packed.',
    Shipped: 'Your order is on its way! Expect delivery soon.',
    Delivered: 'Your order has been delivered. We hope you love it!',
    Cancelled: 'Your order has been cancelled. If you have questions, please contact us.',
  };

  const message = statusMessages[statusLabel] ?? `Your order status has been updated to ${statusLabel}.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:system-ui,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:${accentColor};padding:32px 40px;">
      <p style="margin:0;color:rgba(255,255,255,0.85);font-size:13px;text-transform:uppercase;letter-spacing:0.08em;">Order Update</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;font-weight:700;">${statusLabel}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="margin:0 0 4px;color:#6b6b66;font-size:13px;">Order number</p>
      <p style="margin:0 0 24px;color:#1c1c1a;font-size:20px;font-weight:700;">#${order.orderNumber}</p>

      <p style="margin:0 0 24px;color:#1c1c1a;line-height:1.6;">
        Hi ${order.customerName}, ${message}
      </p>

      <!-- Status Badge -->
      <div style="text-align:center;margin-bottom:32px;">
        <span style="display:inline-block;background:${accentColor}1a;color:${accentColor};font-weight:600;font-size:14px;padding:8px 20px;border-radius:999px;">
          ${statusLabel}
        </span>
      </div>

      <!-- Order Summary -->
      <div style="background:#fafaf9;border-radius:8px;padding:16px;">
        <p style="margin:0 0 12px;font-weight:600;color:#1c1c1a;font-size:14px;">Order Summary</p>
        ${order.items
          .map(
            (item) => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
            <span style="color:#6b6b66;">
              ${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ''} ×${item.quantity}
            </span>
            <span style="color:#1c1c1a;font-weight:500;">৳${(Number(item.price) * item.quantity).toLocaleString()}</span>
          </div>
        `,
          )
          .join('')}
        <div style="display:flex;justify-content:space-between;padding:12px 0 0;border-top:1px solid #e5e5e2;margin-top:8px;font-weight:700;">
          <span style="color:#1c1c1a;">Total</span>
          <span style="color:${accentColor};">৳${Number(order.total).toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:1px solid #e5e5e2;text-align:center;">
      <p style="margin:0;color:#a8a8a3;font-size:12px;">
        Questions? Contact ${storeConfig.name} for support.
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildPaymentInstructions(order: OrderWithItems, storeConfig: StoreConfig): string {
  const method = order.paymentMethod;

  if (method === 'BKASH' && storeConfig.config.bkashNumber) {
    return `
      <div style="background:#fff8f0;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-weight:600;color:#1c1c1a;font-size:14px;">bKash Payment Instructions</p>
        <p style="margin:0 0 4px;color:#6b6b66;font-size:14px;">Send payment to: <strong style="color:#1c1c1a;">${storeConfig.config.bkashNumber}</strong></p>
        <p style="margin:0 0 4px;color:#6b6b66;font-size:14px;">Amount: <strong style="color:#1c1c1a;">৳${Number(order.total).toLocaleString()}</strong></p>
        <p style="margin:0 0 4px;color:#6b6b66;font-size:14px;">Reference: <strong style="color:#1c1c1a;">#${order.orderNumber}</strong></p>
        ${storeConfig.config.bkashInstructions ? `<p style="margin:8px 0 0;color:#6b6b66;font-size:13px;">${storeConfig.config.bkashInstructions}</p>` : ''}
      </div>
    `;
  }

  if (method === 'NAGAD' && storeConfig.config.nagadNumber) {
    return `
      <div style="background:#fff8f0;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-weight:600;color:#1c1c1a;font-size:14px;">Nagad Payment Instructions</p>
        <p style="margin:0 0 4px;color:#6b6b66;font-size:14px;">Send payment to: <strong style="color:#1c1c1a;">${storeConfig.config.nagadNumber}</strong></p>
        <p style="margin:0 0 4px;color:#6b6b66;font-size:14px;">Amount: <strong style="color:#1c1c1a;">৳${Number(order.total).toLocaleString()}</strong></p>
        <p style="margin:0 0 4px;color:#6b6b66;font-size:14px;">Reference: <strong style="color:#1c1c1a;">#${order.orderNumber}</strong></p>
        ${storeConfig.config.nagadInstructions ? `<p style="margin:8px 0 0;color:#6b6b66;font-size:13px;">${storeConfig.config.nagadInstructions}</p>` : ''}
      </div>
    `;
  }

  if (method === 'COD') {
    return `
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-weight:600;color:#1c1c1a;font-size:14px;">Cash on Delivery</p>
        <p style="margin:0;color:#6b6b66;font-size:14px;">Please have <strong style="color:#1c1c1a;">৳${Number(order.total).toLocaleString()}</strong> ready when your order arrives.</p>
      </div>
    `;
  }

  if (method === 'STRIPE' && order.transactionId) {
    return `
      <div style="background:#f0f9ff;border-left:4px solid #0ea5e9;border-radius:0 8px 8px 0;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-weight:600;color:#1c1c1a;font-size:14px;">Payment Received</p>
        <p style="margin:0;color:#6b6b66;font-size:14px;">Card payment of <strong style="color:#1c1c1a;">৳${Number(order.total).toLocaleString()}</strong> confirmed.</p>
      </div>
    `;
  }

  return '';
}