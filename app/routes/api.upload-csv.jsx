import { json } from "@remix-run/node";
import prisma from "../db.server";

export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { data, isLastChunk } = await request.json();

    // Process the chunk of data
    await prisma.$transaction(async (prisma) => {
      for (const row of data) {
        await prisma.shippingRateWithTaxDuty.create({
          data: {
            shopifyOrderId: row["Order Number"],
            fedexTotalAmount: parseFloat(row["FedEx Total"] || 0),
            fedexTaxAmount: parseFloat(row["FedEx Tax"] || 0),
            fedexDutyAmount: parseFloat(row["FedEx Duty"] || 0),
            shopifyTaxAmount: parseFloat(row["Shopify Tax"] || 0),
            shopifyDutyAmount: parseFloat(row["Shopify Duty"] || 0),
            dhlTaxAmount: parseFloat(row["DHL Tax"] || 0),
            dhlDutyAmount: parseFloat(row["DHL Duty"] || 0),
            status: row["Status"] || "pending",
            trackingId: row["Tracking ID"],
            // Add any other fields you need
          },
        });
      }
    });

    return json({ success: true });
  } catch (error) {
    console.error("Error processing CSV chunk:", error);
    return json({ error: "Failed to process CSV data" }, { status: 500 });
  }
} 