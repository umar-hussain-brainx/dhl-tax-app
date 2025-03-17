import { Shopify } from '@shopify/shopify-api';

export class ShopifyService {
  constructor(private shopify: Shopify) {}

  async getOrderData(orderId: string) {
    const order = await this.shopify.rest.Order.find(orderId);
    const tax = {
      amount: order.total_tax,
      currency: order.currency,
      taxLines: order.tax_lines
    };
    const duty = {
      amount: order.total_duties_set.shop_money.amount,
      currency: order.currency,
      description: 'Shopify Duty'
    };
    return { tax, duty };
  }
} 