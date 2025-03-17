import { authenticate } from "../shopify.server";
import db from "../db.server";
import { OrderService } from "../services/OrderService";
export const action = async ({ request }) => {
  return new Response(null, { status: 200 });
  const { payload } = await authenticate.webhook(request);
  console.log('Webhook payload:', {
    order_number: payload.order_number,
    tracking_number: payload.fulfillments?.[0]?.tracking_number
  });
   console.log('order_data_json',payload);
  try {
    // Check if the order has fulfillments with tracking
    // if (payload.fulfillments && payload.fulfillments.length > 0) {
      // const fulfillment = payload.fulfillments[0]; // Get the first fulfillment
      // if (fulfillment.tracking_number) {
        const orderService = new OrderService();
        await orderService.updateTrackingId(
          payload.order_number.toString(),
          payload.fulfillments[0].tracking_number
        );
        console.log(`✅ Updated tracking ID for order ${payload.order_number}`);
      // }
    // }
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error processing order update webhook:", error);
    return new Response(null, { status: 500 });
  }
}; 