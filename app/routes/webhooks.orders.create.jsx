import { authenticate } from "../shopify.server";
import db from "../db.server";
import fs from "fs";
import path from "path";
import {getDhlLandedCost} from '../utilities/dhl-helper'
import { getOrderData } from "../utilities/helpers";
import { getUpsLandedCost } from "../utilities/ups-helper";
let tokenCache = {
  token: null,
  expiresAt: null,
};

const ACCOUNT_NUMBER = 852853727;
const API_KEY = "l77228426b774f472ea41ca63d8150ca12";
const API_SECRET = "d8c592ffd63d47419ce71dbe8895ed7e";

// Function to get a valid token
async function getValidToken() {
  // Check if we have a cached token that's still valid (with 5 min buffer)
  const now = Date.now();
  if (
    tokenCache.token &&
    tokenCache.expiresAt &&
    tokenCache.expiresAt > now + 300000
  ) {
    return tokenCache.token;
  }

  // If not, request a new token
  const tokenResponse = await fetch(
    "https://apis.fedex.com/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: API_KEY,
        client_secret: API_SECRET,
      }),
    },
  );

  const tokenData = await tokenResponse.json();

  // Cache the new token with expiry
  tokenCache = {
    token: tokenData.access_token,
    expiresAt: now + tokenData.expires_in * 1000, // convert seconds to milliseconds
  };

  return tokenCache.token;
}

async function getFedExRates(accessToken, shipmentDetails) {
  try {
    // console.log("fetching fedex rates");
    const response = await fetch(
      "https://apis.fedex.com/rate/v1/rates/quotes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          accountNumber: {
            value: ACCOUNT_NUMBER.toString(),
          },
          rateRequestControlParameters: {
            returnTransitTimes: true,
            servicesNeededOnRateFailure: true,
            variableOptions: "FREIGHT_GUARANTEE",
            rateSortOrder: "SERVICENAMETRADITIONAL",
          },
          requestedShipment: {
            rateRequestType: ["ACCOUNT"], // Added this line
            shipper: {
              address: {
                postalCode: shipmentDetails.originPostalCode,
                countryCode: shipmentDetails.originCountry,
              },
            },
            recipient: {
              address: {
                postalCode: shipmentDetails.destinationPostalCode,
                countryCode: shipmentDetails.destinationCountry,
              },
            },
            customsClearanceDetail: shipmentDetails.customsClearanceDetail,
            edtRequestType: "ALL",
            pickupType: "USE_SCHEDULED_PICKUP",
            requestedPackageLineItems: [
              {
                packagingType: "YOUR_PACKAGING",
                weight: {
                  units: "KG", // Changed from KG to LB
                  value: shipmentDetails.weight, // Convert KG to LB
                },
              },
            ],
          },
        }),
      },
    );
    const ratesData = await response.json();

    if (!response.ok) {
      console.error("FedEx API Error:", ratesData);
      throw new Error(
        `FedEx API error: ${ratesData.errors?.[0]?.message || "Unknown error"}`,
      );
    }

    return ratesData;
  } catch (error) {
    console.error("Error fetching FedEx rates:", error);
    throw error;
  }
}

async function createShippingRateWithTaxDuty(prisma, shippingRateData) {
  try {
    const newRecord = await prisma.shippingRateWithTaxDuty.create({
      data: {
        ...shippingRateData,
        status: shippingRateData.status || "PENDING",
      },
    });

    return newRecord;
  } catch (error) {
    console.error("Error creating shipping rate record:", error);
    throw error;
  }
}

async function savePayloadToDB(prisma, order_number, shopifyPayload, fedexPayload) {
  try {
    // console.log('Starting savePayloadToDB...');
    // console.log('Order number:', order_number);
    // console.log('Prisma instance:', !!prisma); // Check if prisma is defined

    // Basic validation
    if (!order_number || !shopifyPayload || !fedexPayload) {
      throw new Error("Missing required payload data");
    }

    // Prepare the data object
    const data = {
      orderNumber: order_number,
      shopifyPayload: JSON.stringify(shopifyPayload), // Ensure JSON serialization
      fedexPayload: JSON.stringify(fedexPayload)      // Ensure JSON serialization
    };
    
    // console.log('Attempting to create record with data:', data);

    const newRecord = await prisma.orderPayload.create({ // Note: Changed to lowercase 'orderPayload'
      data
    });

    // console.log('Successfully created record:', newRecord);
    return newRecord;
  } catch (error) {
    console.error("Error saving order payload to database:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    throw error;
  }
}

function getFedExRateByServiceType(rates, preferredServiceTypes) {
  // Ensure preferredServiceTypes is an array
  const serviceTypes = Array.isArray(preferredServiceTypes)
    ? preferredServiceTypes
    : [preferredServiceTypes];

  // Find first matching rate from preferred service types
  for (const serviceType of serviceTypes) {
    const matchingRate = rates.output.rateReplyDetails.find(
      (rate) => rate.serviceType === serviceType,
    );
    if (matchingRate) return matchingRate;
  }

  // If no preferred service type found, return lowest cost rate as fallback
  return rates.output.rateReplyDetails.reduce((lowest, current) => {
    const currentRate =
      current.ratedShipmentDetails[0].totalNetChargeWithDutiesAndTaxes;
    const lowestRate =
      lowest.ratedShipmentDetails[0].totalNetChargeWithDutiesAndTaxes;
    return currentRate < lowestRate ? current : lowest;
  });
}

export const action = async ({ request }) => {
  // return a 200 response immediately
  // return new Response(null, { status: 200 });
  const { topic, shop, session, payload, admin } = await authenticate.webhook(request);

  // console.log("Webhook received for shop:", shop);
  // console.log("Shipping service:", payload.shipping_lines[0]?.title);
  if (!admin) return null;

  const locationData = await getOrderData(payload.admin_graphql_api_id, admin);
  console.log('location data', locationData);
  const dhlData = await getDhlLandedCost(payload) 
  // write dhlData to a file
  const dhlDataPath = path.join(process.cwd(), "dhl-data.json");
  fs.writeFileSync(dhlDataPath, JSON.stringify(dhlData, null, 2));
  console.log("✅ DHL API Response received:", JSON.stringify(dhlData, null, 2));
  

  const filePath = path.join(process.cwd(), "webhook-payload.json");
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  const {
    admin_graphql_api_id,
    current_total_tax,
    currency,
    tax_lines,
    order_number,
    shipping_address,
    fulfillments,
    total_weight,
    line_items,
    shipping_lines,
  } = payload;

  const serviceTitle = shipping_lines[0].title;
  // console.log("Processing order with service:", serviceTitle);

  const orderQuery = await admin.graphql(
    `#graphql
      query orderDetails($id: ID!) {
        order(id: $id) {
          id
          fulfillmentOrders(first: 1) {
            edges {
              node {
                assignedLocation {
                  countryCode
                  zip
                  location {
                    id
                    address {
                      address1
                      address2
                      city
                      country
                      zip
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: admin_graphql_api_id,
      },
    },
  );

  const { data } = await orderQuery.json();
  console.log("order data", data, payload.order_number, payload.admin_graphql_api_id);
  const order = data.order.fulfillmentOrders.edges[0].node;
  // console.log("order", order);

  const { zip, countryCode } = order.assignedLocation;
  // console.log("location", { zip, countryCode });

  const accessToken = await getValidToken();
  // console.log("accessToken: ", accessToken);

  const tokenPath = path.join(process.cwd(), "webhook-token.json");
  fs.writeFileSync(tokenPath, JSON.stringify(accessToken, null, 2));

  const shipmentDetails = {
    // destination
    destinationPostalCode: shipping_address.zip || "",
    destinationCountry: shipping_address.country_code,

    // origin
    originPostalCode: zip,
    originCountry: countryCode,

    // weight in kilos
    weight: total_weight ? total_weight / 1000 : 0.1,

    customsClearanceDetail: {
      dutiesPayment: {
        paymentType: "SENDER",
        payor: {
					responsibleParty: {
						accountNumber: {
							value: "852853727"
						}
					}
				}
      },
      commodities: line_items.map(({ name, duties, quantity, price }) => {
        return {
          name:name,
          description: name,
          countryOfManufacture: countryCode,
          quantity: quantity,
          quantityUnits: "EA",
          unitPrice: {
            amount: parseFloat(price) - 10,
            currency: payload.currency,
          },
          customsValue: {
            amount: parseFloat(price) - 10,
            currency: payload.currency,
          },
          harmonizedCode: "940370000000",
        };
      }),
      commercialInvoice: {
				termsOfSale: "DDP",
				shipmentPurpose: "SOLD"
			}
    },
  };

  const shipmentFilePath = path.join(process.cwd(), "shipmentDetails.json");
  fs.writeFileSync(shipmentFilePath, JSON.stringify(shipmentDetails, null, 2));

  // console.log("shipping details", shipmentDetails);

  const rates = await getFedExRates(accessToken, shipmentDetails);
  // console.log("FedEx Rates:", rates);

  let upsData = {
    grandTotal: 0,
    totalDutyandTax: 0
  };

  // Only call UPS API if shipping country is not US
  if (payload.shipping_address.country_code !== "US") {
    try {
      upsData = await getUpsLandedCost(payload);
      // Ensure we have numeric values, not null
      upsData.grandTotal = upsData.grandTotal || 0;
      upsData.totalDutyandTax = upsData.totalDutyandTax || 0;
      console.log("✅ UPS data retrieved for international shipment");
    } catch (error) {
      console.error("❌ Error getting UPS data:", error.message);
      // Ensure we have zeros in case of error
      upsData = {
        grandTotal: 0,
        totalDutyandTax: 0
      };
    }
  } else {
    console.log("📍 US domestic shipment - skipping UPS API call");
  }

  const ratePath = path.join(process.cwd(), "webhook-rates.json");
  fs.writeFileSync(ratePath, JSON.stringify(rates, null, 2));

  try {
    // const preferredServices = ["FEDEX_GROUND", "INTERNATIONAL_ECONOMY"];
    const preferredServices = [serviceTitle.toUpperCase()];

    const selectedRate = getFedExRateByServiceType(rates, preferredServices);
    const rateDetails = selectedRate.ratedShipmentDetails[0];

    const shippingRateData = {
      // orderId: payload.id.toString(),
      orderId: `${payload.order_number.toString()}-${crypto.randomUUID()}`,
      shopifyOrderId: payload.order_number.toString(),

      // FedEx Rate Information
      fedexTotalAmount: rateDetails.totalNetChargeWithDutiesAndTaxes || rateDetails.totalNetCharge,
      fedexCurrency: rateDetails.currency,
      fedexServiceType: selectedRate.serviceType,
      fedexTransitTime: null,
      fedexRateId: rates.transactionId,

      // FedEx Tax Information
      fedexTaxAmount:
      rateDetails.totalDutiesAndTaxes || 0,
      fedexTaxCurrency: rateDetails.currency,
      fedexTaxType: "VAT",
      fedexTaxDescription: "Value Added Tax",

      // FedEx Duty Information
      fedexDutyAmount:
        rateDetails.ancillaryFeesAndTaxes?.find(
          (fee) => fee.type === "CLEARANCE_ENTRY_FEE",
        )?.amount || 0,
      fedexDutyCurrency: rateDetails.currency,
      fedexDutyDescription: "Import Duties and Taxes",

      // Shopify Tax Information
      shopifyTaxAmount: parseFloat(payload.current_total_tax),
      shopifyTaxCurrency: payload.currency,
      shopifyTaxLines: JSON.stringify(payload.tax_lines),

      // Shopify Duty Information
      shopifyDutyAmount:
        Number(payload.current_total_duties_set?.shop_money.amount) || 0,
      shopifyDutyCurrency: payload.currency,
      shopifyDutyDescription: "Import Duties and Taxes",

      // add dhl data
      dhlTaxAmount: dhlData.dhlTaxAmount,
      dhlDutyAmount: dhlData.dhlDutyAmount,
      dhlCurrency: dhlData.dhlCurrency,

      // add ups data
      upsTotalAmount: Number(upsData.grandTotal || 0),
      upsTaxDutyAmount: Number(upsData.totalDutyandTax || 0),

      status: "CREATED",
    };

    const newShippingRate = await createShippingRateWithTaxDuty(
      db,
      shippingRateData,
    );

    console.log("✅ New shipping rate created:", newShippingRate);

    // await savePayloadToDB(db, payload.order_number.toString(), payload, rates);


      // console.log("🚚 DHL shipment detected for order:", payload.order_number);
      
      // try {
      //   console.log("Calling DHL API for order:", payload.order_number);

      //   // Update the existing record
      //   const updatedShippingRate = await db.shippingRateWithTaxDuty.create({
      //     data: {
      //       ...shippingRateData,
      //       dhlTaxAmount: parseFloat(dhlData.dhlTaxAmount) || 0,
      //       dhlDutyAmount: parseFloat(dhlData.dhlDutyAmount) || 0,
      //       dhlCurrency: dhlData.dhlCurrency || ""
      //     }
      //   });
        
      //   console.log("✅ Updated record with DHL data:", updatedShippingRate);
      // } catch (error) {
      //   console.error("❌ Error processing DHL data:", error);
      //   console.error("Error details:", {
      //     message: error.message,
      //     response: error.response?.data,
      //     stack: error.stack
      //   });
      // }
   
  } catch (error) {
    console.error("Failed to process shipping data:", error);
  }

  return data;
};
