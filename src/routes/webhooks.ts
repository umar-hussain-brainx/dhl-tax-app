import { json } from "@remix-run/node";
import { OrderController } from "../controllers/OrderController";
import { Shopify } from '@shopify/shopify-api';

export async function action({ request }) {
  const payload = await request.json();
  const orderId = payload.id; // Extract the order ID from the webhook payload

  const shopify = new Shopify({
    apiKey: 'your-api-key',
    apiSecretKey: 'your-secret-key',
    scopes: ['read_orders', 'write_orders'],
    hostName: 'your-app-hostname',
    apiVersion: '2023-01',
    isEmbeddedApp: true,
    sessionStorage: new Shopify.Session.MemorySessionStorage(),
  });

  const orderController = new OrderController(shopify);
  await orderController.handleOrderCreation(orderId);

  return json({ success: true });
} 