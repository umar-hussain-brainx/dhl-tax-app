import axios from 'axios'
import {getOrderData} from './helpers'
export async function getDhlCost(shopifyPayload, locationData){
    console.log('🚀 Starting DHL cost calculation for order:', shopifyPayload.order_number);
    
    try {
      console.log('locationData', locationData);
      const {assignedLocation} = locationData;
        // Use shipping address from the webhook payload
        const shipperDetails = {
            postalCode: assignedLocation.zip,
            cityName: assignedLocation.location?.address?.city || "",
            countryCode: assignedLocation.countryCode
        };

        const receiverDetails = {
            postalCode: shopifyPayload.shipping_address.zip,
            cityName: shopifyPayload.shipping_address.city,
            countryCode: shopifyPayload.shipping_address.country_code
        };

        console.log('📍 Location details:', { shipperDetails, receiverDetails });

        const customerDetails = {shipperDetails, receiverDetails};
        const currencyCode = shopifyPayload.currency;

        // Map line items from the webhook payload
        const lineItems = shopifyPayload.line_items.map(item => ({
            number: item.id,
            name: item.name,
            description: item.title,
            manufacturerCountry: "US",
            partNumber: item.sku || "12345555",
            quantity: item.quantity,
            quantityType: "prt",
            unitPrice: parseFloat(item.price),
            unitPriceCurrencyCode: currencyCode,
            customsValue: parseFloat(item.price),
            customsValueCurrencyCode: currencyCode,
            commodityCode: "640391",
            weight: item.grams / 1000,
            weightUnitOfMeasurement: "metric",
            category: "201",
            brand: item.vendor || "SHOE 1",
            goodsCharacteristics: [
              {
                "typeCode": "IMPORTER",
                "value": "Registered"
              }
            ],
            additionalQuantityDefinitions: [
              {
                "typeCode": "DPR",
                "amount": item.quantity
              }
            ],
            estimatedTariffRateType: "highest_rate"
        }));

        const totalWeight = shopifyPayload.total_weight ? shopifyPayload.total_weight / 1000 : 0.1;

        let data = JSON.stringify({
            customerDetails,
            accounts: [
                {
                    "typeCode": "shipper",
                    "number": "123456789"
                }
            ],
            productCode: "P",
            localProductCode: "P",
            unitOfMeasurement: "metric",
            currencyCode,
            isCustomsDeclarable: true,
            isDTPRequested: true,
            isInsuranceRequested: false,
            getCostBreakdown: true,
            charges: [
                {
                    "typeCode": "insurance",
                    "amount": 10,
                    "currencyCode": currencyCode
                }
            ],
            shipmentPurpose: "personal",
            transportationMode: "air",
            merchantSelectedCarrierName: "DHL",
            packages: [
                {
                    "typeCode": "3BX",
                    "weight": totalWeight,
                    "dimensions": {
                        "length": 25,
                        "width": 35,
                        "height": 15
                    }
                }
            ],
            items: lineItems,
            getTariffFormula: true,
            getQuotationID: false
        });

        console.log('📤 Sending request to DHL API with data:', data);

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://api-mock.dhl.com/mydhlapi/landed-cost',
            headers: { 
                'content-type': 'application/json', 
                'Message-Reference': 'd0e7832e-5c98-11ea-bc55-0242ac13', 
                'Message-Reference-Date': 'Thu, 6 Feb 2025 07:28:00 GMT', 
                'Plugin-Name': 'SOME_STRING_VALUE', 
                'Plugin-Version': 'SOME_STRING_VALUE', 
                'Shipping-System-Platform-Name': 'SOME_STRING_VALUE', 
                'Shipping-System-Platform-Version': 'SOME_STRING_VALUE', 
                'Webstore-Platform-Name': 'SOME_STRING_VALUE', 
                'Webstore-Platform-Version': 'SOME_STRING_VALUE', 
                'x-version': '2.12.0', 
                'Authorization': 'Basic ZGVtby1rZXk6ZGVtby1zZWNyZXQ'
            },
            data: data
        };

        const response = await axios.request(config);
        console.log('📥 Raw DHL API response:', JSON.stringify(response.data, null, 2));

        // Extract data from the first product
        const product = response.data.products?.[0];
        
        if (!product) {
            console.warn('⚠️ No product data in DHL response');
            return {
                dhlTotalAmount: 0,
                dhlCurrency: shopifyPayload.currency,
                dhlTaxAmount: 0,
                dhlDutyAmount: 0,
                shopifyOrderId: shopifyPayload.order_number.toString(),
                status: "NO_PRODUCT_DATA"
            };
        }
        
        // Extract duty and tax from items breakdown
        let taxAmount = 0;
        let dutyAmount = 0;

        product?.items?.forEach(item => {
            item.breakdown?.forEach(breakdown => {
                if (breakdown.typeCode === 'DUTY') {
                    dutyAmount = breakdown.price || 0;
                    
                    // Get tax from priceBreakdown if available
                    const taxBreakdown = breakdown.priceBreakdown?.find(pb => pb.typeCode === 'TAX');
                    if (taxBreakdown) {
                        taxAmount = taxBreakdown.price || 0;
                    }
                }
            });
        });

        const dhlData = {
            dhlTotalAmount: product?.totalPrice?.[0]?.price || 0,
            dhlCurrency: product?.totalPrice?.[0]?.priceCurrency || shopifyPayload.currency,
            dhlTaxAmount: taxAmount,
            dhlDutyAmount: dutyAmount,
            shopifyOrderId: shopifyPayload.order_number.toString(),
            status: "RECEIVED"
        };
        
        console.log('✅ Processed DHL data:', dhlData);
        return dhlData;
    } catch (error) {
        console.error('❌ DHL API Error:', {
            message: error.message,
            response: error.response?.data,
            stack: error.stack
        });
        throw error;
    }
}

// Add this function for testing
export async function testDhlIntegration() {
    const testPayload = {
        order_number: "TEST123",
        currency: "USD",
        shipping_address: {
            zip: "90210",
            city: "Beverly Hills",
            country_code: "US"
        },
        line_items: [{
            id: 1,
            name: "Test Product",
            title: "Test Product",
            quantity: 1,
            price: "100.00",
            grams: 500,
            vendor: "Test Vendor"
        }],
        total_weight: 500
    };

    try {
        const result = await getDhlCost(testPayload);
        console.log("Test DHL Integration Result:", result);
        return result;
    } catch (error) {
        console.error("Test DHL Integration Error:", error);
        throw error;
    }
}