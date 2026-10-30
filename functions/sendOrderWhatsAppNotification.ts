/**
 * Firebase Cloud Functions (2nd Gen) — Automatic WhatsApp Order & Status Notification System
 * Triggers:
 *   1. onDocumentCreated('orders/{orderId}') -> Sends:
 *      - Admin Order Notification to +91 7507505064 (917507505064)
 *      - Customer Order Confirmation to Customer's WhatsApp Number
 *   2. onDocumentUpdated('orders/{orderId}') -> When status changes to 'confirmed', 'delivered' (Complete), or 'cancelled':
 *      - Sends Customer Order Status Update to Customer's WhatsApp Number
 *
 * Both messages include:
 *   Order ID, Customer Name, Product Name, Quantity, Price, Total Amount, Delivery Address, and Order Status.
 */

export interface OrderDocumentPayload {
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  itemsSummary: string;
  totalItemsCount: number;
  totalAmountInr: number;
  deliveryAddress: string;
  pinCode: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAddress?: string;
  paymentMethod: 'COD' | 'UPI';
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  whatsappNotificationStatus?: 'pending' | 'sending' | 'sent' | 'failed' | 'not_configured';
  whatsappNotificationError?: string;
  whatsappMessageId?: string;
  customerWhatsappStatus?: 'pending' | 'sending' | 'sent' | 'failed' | 'not_configured';
  customerWhatsappError?: string;
  customerWhatsappMessageId?: string;
  customerWhatsappLastEvent?: string;
}

const formatStatusLabel = (status: OrderDocumentPayload['status']): string => {
  if (status === 'confirmed') return 'Confirmed (कन्फ़र्म)';
  if (status === 'shipped') return 'Shipped (रवाना)';
  if (status === 'delivered') return 'Complete (पूरा हुआ)';
  if (status === 'cancelled') return 'Cancelled (रद्द)';
  return 'Pending (प्रतीक्षारत)';
};

async function postMetaWhatsAppText(
  toDigits: string,
  bodyText: string
): Promise<{
  status: 'sent' | 'failed' | 'not_configured';
  messageId?: string;
  error?: string;
}> {
  const accessToken = (process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID || '').trim();
  const apiVersion = (process.env.WHATSAPP_CLOUD_API_VERSION || 'v20.0').trim();

  if (!accessToken || !phoneNumberId) {
    return {
      status: 'not_configured',
      error:
        'Meta WhatsApp Business Cloud API credentials (WHATSAPP_CLOUD_API_ACCESS_TOKEN / WHATSAPP_CLOUD_API_PHONE_NUMBER_ID) are not configured on the server.',
    };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toDigits,
          type: 'text',
          text: {
            preview_url: false,
            body: bodyText,
          },
        }),
      }
    );

    const data = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };

    const wamid = data?.messages?.[0]?.id;
    if (!response.ok || !wamid) {
      return {
        status: 'failed',
        error: data?.error?.message || `HTTP ${response.status} from Meta WhatsApp Cloud API`,
      };
    }

    return {
      status: 'sent',
      messageId: wamid,
    };
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown WhatsApp Cloud API error',
    };
  }
}

export async function sendNewOrderDualWhatsAppNotifications(
  orderId: string,
  order: OrderDocumentPayload
) {
  const shortOrderId = `#${orderId.slice(0, 8).toUpperCase()}`;
  const addressText = `${order.gpsAddress || order.deliveryAddress} (PIN: ${order.pinCode})`;
  const statusLabel = formatStatusLabel(order.status || 'pending');
  const adminNumber = (process.env.ADMIN_WHATSAPP_NUMBER || '917507505064').replace(/\D/g, '');
  const rawCustDigits = (order.customerPhone || '').replace(/\D/g, '').replace(/^91/, '');
  const customerNumber = /^[6-9]\d{9}$/.test(rawCustDigits) ? `91${rawCustDigits}` : '';

  const commonDetails = [
    `📦 *Order ID:* ${shortOrderId} (${orderId})`,
    `👤 *Customer Name:* ${order.customerName}`,
    `📌 *Order Status:* ${statusLabel}`,
    '────────────────────',
    '🫖 *Product Details (Product Name, Quantity, Price):*',
    order.itemsSummary,
    '────────────────────',
    `💰 *Total Amount:* ₹${order.totalAmountInr} (${order.paymentMethod})`,
    `📍 *Delivery Address:* ${addressText}`,
  ].join('\n');

  const adminMessage = [
    '🌿 *CHAI ROS | GTC Tea — नया ऑर्डर (Admin Order Notification)* 🌿',
    `📞 *Customer Mobile:* ${order.customerPhone || '—'}`,
    commonDetails,
  ].join('\n');

  const customerMessage = [
    '🌿 *CHAI ROS | GTC Tea — ऑर्डर कन्फ़र्मेशन (Order Confirmation)* 🌿',
    `नमस्ते *${order.customerName}* जी, आपका ऑर्डर सफलतापूर्वक प्राप्त हो गया है!`,
    commonDetails,
  ].join('\n');

  const adminRes =
    order.whatsappNotificationStatus === 'sent' && order.whatsappMessageId
      ? { status: 'sent' as const, messageId: order.whatsappMessageId }
      : await postMetaWhatsAppText(adminNumber || '917507505064', adminMessage);

  const customerRes = !customerNumber
    ? { status: 'failed' as const, error: 'Customer valid 10-digit mobile number is missing.' }
    : order.customerWhatsappStatus === 'sent' &&
      order.customerWhatsappMessageId &&
      order.customerWhatsappLastEvent === 'order_placed'
    ? { status: 'sent' as const, messageId: order.customerWhatsappMessageId }
    : await postMetaWhatsAppText(customerNumber, customerMessage);

  return { adminRes, customerRes };
}

export async function sendCustomerOrderStatusWhatsAppUpdate(
  orderId: string,
  order: OrderDocumentPayload
) {
  const shortOrderId = `#${orderId.slice(0, 8).toUpperCase()}`;
  const addressText = `${order.gpsAddress || order.deliveryAddress} (PIN: ${order.pinCode})`;
  const statusLabel = formatStatusLabel(order.status);
  const rawCustDigits = (order.customerPhone || '').replace(/\D/g, '').replace(/^91/, '');
  const customerNumber = /^[6-9]\d{9}$/.test(rawCustDigits) ? `91${rawCustDigits}` : '';

  if (!customerNumber) {
    return {
      status: 'failed' as const,
      error: 'Customer valid 10-digit mobile number is missing.',
    };
  }

  const statusBody = [
    '🌿 *CHAI ROS | GTC Tea — ऑर्डर स्टेटस अपडेट (Order Status Update)* 🌿',
    `📦 *Order ID:* ${shortOrderId} (${orderId})`,
    `👤 *Customer Name:* ${order.customerName}`,
    `📌 *Order Status:* ${statusLabel}`,
    '────────────────────',
    '🫖 *Product Details (Product Name, Quantity, Price):*',
    order.itemsSummary,
    '────────────────────',
    `💰 *Total Amount:* ₹${order.totalAmountInr} (${order.paymentMethod})`,
    `📍 *Delivery Address:* ${addressText}`,
  ].join('\n');

  return postMetaWhatsAppText(customerNumber, statusBody);
}
