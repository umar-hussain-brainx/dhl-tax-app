import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getOrderData } from "../utilities/helpers";
import fs from 'fs';
import path from 'path';
const __dirname = path.resolve();

let dhlTokenCache = {
    token: null,
    expiresAt: null,
  };
  
  const DHL_API_CLIENT_ID = "YXBJOGFQOW5POG9XMms6TSM5dEdAMnJSQDF0UCM4bQ==";
  const DHL_API_BASE_URL = 'https://express.api.dhl.com/mydhlapi/test/landed-cost';


  export async function getDhlRates(shipmentDetails) {
    try {
     console.log("Fetching DHL Running");
      const response = await fetch(DHL_API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${DHL_API_CLIENT_ID}`,  // Using the API key directly
        },
        body: JSON.stringify(shipmentDetails),
      });
  
      const ratesData = await response.json();
      if (!response.ok) {
        console.error("DHL API Errors:", ratesData);
        // write shipmentdetails to a file
        const errorLogPath = path.join(__dirname, 'dhl-error-logs.txt');
        fs.appendFileSync(errorLogPath, JSON.stringify(shipmentDetails) + '\n');
        throw new Error(`DHL API error: ${ratesData.error?.message || "Unknown error"}`);
      }
      return ratesData;
    } catch (error) {
      console.error("Error fetching DHL rates:", error);
      throw error;
    }
  }
  
  export async function getDhlLandedCost(payload) {
    try {
      console.log("DHLPAYLOAD ",payload.line_items);
      const shipmentDetails = {
        customerDetails: {
          shipperDetails: {
            postalCode: payload.shipping_address.zip || "",
            cityName: payload.shipping_address.city || "",
            countryCode: payload.shipping_address.country_code || "",
          },
          receiverDetails: {
            postalCode: payload.shipping_address.zip || "",
            cityName: payload.shipping_address.city || "",
            countryCode: payload.shipping_address.country_code || "",
          },
        },
        accounts: [
          {
            typeCode: "shipper",
            number: "849272242", // Use your actual shipper number
          },
        ],
        productCode: payload.shipping_address.country_code === payload.billing_address.country_code ? "N" : "P", // Static value if required
        unitOfMeasurement: "metric", // Ensure this is correct (use "imperial" if necessary)
        currencyCode: payload.currency, // Dynamic value from the payload
        isCustomsDeclarable: true, // Static value (or dynamic if needed)
        isDTPRequested: true, // Static value (or dynamic if needed)
        isInsuranceRequested: true, // Static value (or dynamic if needed)
        getCostBreakdown: true, // Static value
        charges: [
          {
            typeCode: "insurance",
            amount: payload.insurance_amount || 0, // Dynamic or default to 0
            currencyCode: payload.currency,
          },
        ],
        shipmentPurpose: "personal", // Static value or dynamic if needed
        transportationMode: "air", // Static value or dynamic if needed
        merchantSelectedCarrierName: "DHL", // Static value
        packages: payload.line_items.map(item => ({
          typeCode: "3BX", // Replace with dynamic package type if needed
          weight: item.grams ? item.grams / 1000 : 0,// Dynamic value based on order item weight
          dimensions: {
            length: item.length || 1, // Dynamic value from item
            width: item.width || 1, // Dynamic value from item
            height: item.height || 1, // Dynamic value from item
          },
        })),
        items: payload.line_items.map((item,index) => ({
          number: index + 1,
          name: item.name,
          description: item.description,
          manufacturerCountry: "US", // Adjust if needed (static or dynamic)
          partNumber: item.partNumber,
          quantity: item.quantity,
          quantityType: "prt", // Static value, adjust if necessary
          unitPrice:Number(item.price),
          unitPriceCurrencyCode: payload.currency, // Dynamic value
          customsValue: item.customsValue || 0, // Dynamic or default to 0
          customsValueCurrencyCode: item.customsValueCurrencyCode || payload.currency, // Dynamic value or default to currency
          commodityCode: item.commodityCode || "6109.10.0010", // Dynamic or static value
          weight: item.weight,
          weightUnitOfMeasurement: "metric", // Ensure unit of measurement is correct
          category: item.category || "201", // Dynamic or static value
          brand: item.brand,
          goodsCharacteristics: item.goodsCharacteristics || [{
            typeCode: "IMPORTER",
            value: "Registered",
          }],
          additionalQuantityDefinitions: item.additionalQuantityDefinitions || [{
            typeCode: "DPR",
            amount: item.quantity || 1,
          }],
          estimatedTariffRateType: "highest_rate", // Static or adjust if needed
        })),
        getTariffFormula: true, // Static value
        getQuotationID: false, // Static value
      };

      console.log("DHL SHIPMENT DETAILS", shipmentDetails);
      // write to input.json file
      const inputPath = path.join(__dirname, 'input.json');
      fs.writeFileSync(inputPath, JSON.stringify(shipmentDetails, null, 2));
  
      const dhlRates = await getDhlRates(shipmentDetails);
      console.log("DHL Rates:", JSON.stringify(dhlRates, null, 2));
  
      // Extracting tax and duty from DHL's response
      const dhlTotalAmount = dhlRates.products[0].totalPrice[0].price || 0;
      const dhlDutyAmount = dhlRates.products[0].detailedPriceBreakdown[0].breakdown.find((item) => item.typeCode === 'DUTY')?.price || 0;
      const dhlTaxAmount = dhlRates.products[0].detailedPriceBreakdown[0].breakdown.find((item) => item.typeCode === 'TAX')?.price || 0;
  
      return {
        dhlTotalAmount,
        dhlTaxAmount,
        dhlDutyAmount,
        dhlCurrency: payload.currency,
        dhlServiceType: "DHL",
        dhlResponse: dhlRates,
      };
    } catch (error) {
      console.error("Error getting DHL landed cost:", error);
      return {
        dhlTotalAmount: 0,
        dhlTaxAmount: 0,
        dhlDutyAmount: 0,
        dhlCurrency: payload.currency,
        dhlServiceType: "DHL",
        error: error.message,
      };
    }
  }
  
  
  
  export async function saveDhlShippingData(payload, dhlData) {
    try {
      if (!payload || !dhlData) {
        console.error("Missing payload or DHL data");
        return null;
      }
  
      const shippingRateData = {
        orderId: `${payload.order_number.toString()}-${crypto.randomUUID()}`,
        shopifyOrderId: payload.order_number.toString(),
        dhlTotalAmount: dhlData.dhlTotalAmount || 0,
        dhlCurrency: dhlData.dhlCurrency || payload.currency,
        dhlServiceType: dhlData.dhlServiceType || "DHL",
        dhlTaxAmount: dhlData.dhlTaxAmount || 0,
        dhlTaxCurrency: dhlData.dhlCurrency || payload.currency,
        status: "CREATED",
      };
  
      const result = await db.shippingRateWithTaxDuty.create({ data: shippingRateData });
      console.log("DHL shipping data saved to database:", result);
      return result;
    } catch (error) {
      console.error("Error saving DHL shipping data:", error);
      return null;
    }
  }
  