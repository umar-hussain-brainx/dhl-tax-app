import { prisma } from '../../app/db.server';
import { Decimal } from '@prisma/client/runtime/library';

export class OrderService {
  async saveOrderData(data: {
    orderId: string;
    shopifyOrderId: string;
    trackingId?: string;
    fedex: {
      totalAmount: number;
      currency: string;
      serviceType: string;
      transitTime?: string;
      rateId: string;
      tax?: {
        amount: number;
        currency: string;
        taxType?: string;
        description?: string;
      };
      duty?: {
        amount: number;
        currency: string;
        description?: string;
      };
    };
    shopify: {
      tax: {
        amount: number;
        currency: string;
        taxLines?: Array<{
          title: string;
          rate: number;
          price: number;
        }>;
      };
      duty: {
        amount: number;
        currency: string;
        description?: string;
      };
    };
    status?: string;
  }) {
    return prisma.shippingRateWithTaxDuty.create({
      data: {
        orderId: data.orderId,
        shopifyOrderId: data.shopifyOrderId,
        trackingId: data.trackingId,
        
        // FedEx Rate
        fedexTotalAmount: new Decimal(data.fedex.totalAmount),
        fedexCurrency: data.fedex.currency,
        fedexServiceType: data.fedex.serviceType,
        fedexTransitTime: data.fedex.transitTime,
        fedexRateId: data.fedex.rateId,
        
        // FedEx Tax
        fedexTaxAmount: new Decimal(data.fedex.tax?.amount || 0),
        fedexTaxCurrency: data.fedex.tax?.currency || data.fedex.currency,
        fedexTaxType: data.fedex.tax?.taxType,
        fedexTaxDescription: data.fedex.tax?.description,
        
        // FedEx Duty
        fedexDutyAmount: new Decimal(data.fedex.duty?.amount || 0),
        fedexDutyCurrency: data.fedex.duty?.currency || data.fedex.currency,
        fedexDutyDescription: data.fedex.duty?.description,
        
        // Shopify Tax
        shopifyTaxAmount: new Decimal(data.shopify.tax.amount),
        shopifyTaxCurrency: data.shopify.tax.currency,
        shopifyTaxLines: data.shopify.tax.taxLines ? JSON.stringify(data.shopify.tax.taxLines) : null,
        
        // Shopify Duty
        shopifyDutyAmount: new Decimal(data.shopify.duty.amount),
        shopifyDutyCurrency: data.shopify.duty.currency,
        shopifyDutyDescription: data.shopify.duty.description,
        status: data.status || 'PENDING'
      }
    });
  }

  async updateTrackingId(shopifyOrderId: string, trackingId: string) {
    try {
      const order = await prisma.shippingRateWithTaxDuty.update({
        where: {
          shopifyOrderId: shopifyOrderId.toString()
        },
        data: {
          trackingId: trackingId,
          status: 'DISPATCHED',
          updatedAt: new Date()
        }
      });
      return order;
    } catch (error) {
      console.error('Error updating tracking ID:', error);
      throw error;
    }
  }

  async updateOrder(id: string, orderData: any) {
    try {
      const order = await prisma.shippingRateWithTaxDuty.update({
        where: { id },
        data: {
          ...orderData,
          updatedAt: new Date()
        }
      });
      return order;
    } catch (error) {
      console.error('Error updating order:', error);
      throw error;
    }
  }
} 