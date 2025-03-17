import { authenticate } from "../shopify.server";
import { OrderService } from "../services/OrderService";

export const action = async ({ request }) => {
  return new Response(null, { status: 200 });
  const { payload } = await authenticate.webhook(request);
  console.log('Fulfillment Create Webhook payload:', {
    order_id: payload.order_id,
    tracking_number: payload.tracking_number,
    tracking_numbers: payload.tracking_numbers,
  });

  try {
    if (payload.tracking_number || (payload.tracking_numbers && payload.tracking_numbers.length > 0)) {
      const trackingNumber = payload.tracking_number || payload.tracking_numbers[0];
      const orderService = new OrderService();
      
      await orderService.updateTrackingId(
        payload.order_id.toString(),
        trackingNumber
      );
      
      console.log(`✅ Added tracking ID ${trackingNumber} for order ${payload.order_id}`);
    }
    
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error processing fulfillment create webhook:", error);
    return new Response(null, { status: 500 });
  }
}; 