import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getOrderData } from "../utilities/helpers";

let tokenCache = {
  token: null,
  expiresAt: null,
};

const UPS_API_CLIENT_ID = "l9LFTKdx3bKrdwV7f6byJJ3hGy81sJDBFgQCkp4QActsAz76";
const UPS_API_CLIENT_SECRET = "1CviqQ4wwMGAs8S59DmZAzPhh9GJGmGdqX6jmnxUAwPv5gsTUlZGZtl4Lq7IYrx8";

export async function getUpsToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 300000) {
    return tokenCache.token;
  }

  const tokenResponse = await fetch("https://onlinetools.ups.com/security/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${UPS_API_CLIENT_ID}:${UPS_API_CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  const tokenData = await tokenResponse.json();
  tokenCache = {
    token: tokenData.access_token,
    expiresAt: now + tokenData.expires_in * 1000,
  };

  return tokenCache.token;
}

export async function getUpsRates(accessToken, shipmentDetails) {
  try {
    console.log("Fetching UPS rates...", shipmentDetails, accessToken);
    const response = await fetch("https://onlinetools.ups.com/api/landedcost/v1/quotes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "transactionSrc": "production",
      },
      body: JSON.stringify(shipmentDetails),
    });

    const ratesData = await response.json();
    if (!response.ok) {
      console.error("UPS API Errors:", ratesData, ratesData.error?.errors);
      throw new Error(`UPS API error: ${ratesData.error?.message || "Unknown error"}`);
    }
    return ratesData;
  } catch (error) {
    console.error("Error fetching UPS rates:", error);
    throw error;
  }
}

export async function getUpsLandedCost(payload, locationData) {
  try {
    const upsAccessToken = await getUpsToken();
    console.log("UPS Access Token obtained", upsAccessToken,payload.shipping_address);

    const shipmentDetails = {
      currencyCode: payload.currency,
      transID: payload.order_number.toString(),
      allowPartialLandedCostResult: false,
      shipment: {
        id: `ShipmentID-${payload.order_number}`,
        importCountryCode: payload.shipping_address.country_code,
        exportCountryCode: 'US',
        shipmentItems: payload.line_items.map((item, index) => ({
          commodityId: `${index + 1}`,
          priceEach: item.price,
          hsCode: "940370000000",
          quantity: item.quantity,
          UOM: "Each",
          originCountryCode: 'US',
          commodityCurrencyCode: payload.currency,
          description: item.name,
        })),
        shipmentType: "Sale",
      },
    };

    const upsRates = await getUpsRates(upsAccessToken, shipmentDetails);
    console.log("UPS Rates:", JSON.stringify(upsRates, null, 2));

    return {
      totalDutyandTax: upsRates.shipment.totalDutyandTax,
      grandTotal: upsRates.shipment.grandTotal,
    };

    // Extract the relevant data from the UPS response
    const upsTotalAmount = upsRates.totalCost || 0;
    const upsTaxAndDutyAmount = upsRates.dutiesAndTaxes || 0;
    const upsCurrency = upsRates.currencyCode || payload.currency;

    return {
      upsTotalAmount,
      upsTaxAndDutyAmount,
      upsCurrency,
      upsServiceType: "UPS",
      upsResponse: upsRates
    };
  } catch (error) {
    console.error("Error getting UPS landed cost:", error);
    return {
      upsTotalAmount: 0,
      upsTaxAndDutyAmount: 0,
      upsCurrency: payload.currency,
      upsServiceType: "UPS",
      error: error.message
    };
  }
}

export async function saveUpsShippingData(payload, upsData) {
  try {
    // Make sure payload and upsData are not null
    if (!payload || !upsData) {
      console.error("Missing payload or UPS data");
      return null;
    }
    
    const shippingRateData = {
      orderId: `${payload.order_number.toString()}-${crypto.randomUUID()}`,
      shopifyOrderId: payload.order_number.toString(),
      upsTotalAmount: upsData.upsTotalAmount || 0,
      upsCurrency: upsData.upsCurrency || payload.currency,
      upsServiceType: upsData.upsServiceType || "UPS",
      upsTaxAmount: upsData.upsTaxAndDutyAmount || 0,
      upsTaxCurrency: upsData.upsCurrency || payload.currency,
      status: "CREATED",
    };

    const result = await db.shippingRateWithTaxDuty.create({ data: shippingRateData });
    console.log("UPS shipping data saved to database:", result);
    return result;
  } catch (error) {
    console.error("Error saving UPS shipping data:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack
    });
    // Return null instead of throwing to prevent the webhook from failing
    return null;
  }
}

