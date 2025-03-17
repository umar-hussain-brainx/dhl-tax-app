import { json } from "@remix-run/node";
import prisma from "../db.server";

export async function loader({ params }) {
  const { trackingId } = params;

  console.log('Looking up tracking ID:', trackingId);

  try {
    const order = await prisma.shippingRateWithTaxDuty.findFirst({
      where: {
        trackingId: {
          equals: trackingId.trim(),
          mode: 'insensitive' // Case-insensitive search
        }
      },
      select: {
        orderId: true,
        shopifyOrderId: true,
        fedexTaxAmount: true,
        fedexTotalAmount: true,
        trackingId: true
      }
    });

    console.log('Found order:', order);

    if (!order) {
      return json(null);
    }

    return json(order);
  } catch (error) {
    console.error('Error fetching order by tracking ID:', error);
    throw new Response('Error fetching order data', { status: 500 });
  }
} 