import { OrderService } from '../services/OrderService';
import { ShopifyService } from '../services/ShopifyService';
import { FedexService } from '../services/FedexService';
import { Shopify } from '@shopify/shopify-api';

export class OrderController {
  private orderService = new OrderService();
  private shopifyService: ShopifyService;
  private fedexService = new FedexService();

  constructor(shopify: Shopify) {
    this.shopifyService = new ShopifyService(shopify);
  }

  async handleOrderCreation(orderId: string) {
    try {
      // Fetch order data from Shopify
      const shopifyData = await this.shopifyService.getOrderData(orderId);

      // Prepare data for FedEx API
      const fedexRequestData = this.prepareFedexRequestData(shopifyData);

      // Fetch rates from FedEx
      const fedexData = await this.fedexService.getRates(fedexRequestData);

      // Save the combined data to the database
      await this.orderService.saveOrderData({
        orderId,
        shopifyOrderId: orderId,
        fedex: fedexData,
        shopify: shopifyData
      });
    } catch (error) {
      console.error(`Error handling order creation for order ID ${orderId}:`, error);
      throw new Error('Failed to handle order creation');
    }
  }

  private prepareFedexRequestData(shopifyData: any) {
    // Extract necessary data from Shopify order to prepare FedEx request
    return {
      origin: {
        postalCode: shopifyData.originPostalCode,
        countryCode: shopifyData.originCountryCode
      },
      destination: {
        postalCode: shopifyData.destinationPostalCode,
        countryCode: shopifyData.destinationCountryCode
      },
      package: {
        weight: shopifyData.packageWeight,
        dimensions: {
          length: shopifyData.packageLength,
          width: shopifyData.packageWidth,
          height: shopifyData.packageHeight
        }
      }
    };
  }
} 