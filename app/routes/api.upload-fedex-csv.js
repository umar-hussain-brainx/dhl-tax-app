import { json } from "@remix-run/node";
import { parse } from 'csv-parse/sync';
import prisma from "../db.server";

export async function action({ request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const comparisonResults = await compareFedExData(records);

    return json({ 
      success: true, 
      results: comparisonResults,
      summary: {
        totalRecords: records.length,
        processedRecords: comparisonResults.matches.length + comparisonResults.discrepancies.length,
        notFound: comparisonResults.notFound.length
      }
    });
  } catch (error) {
    console.error("CSV processing error:", error);
    return json({ 
      success: false, 
      error: "Failed to process CSV file. Please ensure it's a valid FedEx export file." 
    }, { status: 500 });
  }
}

async function compareFedExData(csvRecords) {
  const results = {
    matches: [],
    discrepancies: [],
    notFound: []
  };

  for (const record of csvRecords) {
    try {
      const trackingId = record['Tracking ID'] || record['Tracking Number'] || record.trackingId || record.tracking_id;
      const orderNumber = record.orderNumber || record['Order Number'] || record['Shopify Order ID'];

      if (!orderNumber) {
        console.error('No order number found in record:', record);
        continue;
      }

      // Try to find the corresponding record in the database
      const dbRecord = await prisma.shippingRateWithTaxDuty.findFirst({
        where: {
          shopifyOrderId: orderNumber.toString()
        }
      });

      if (!dbRecord) {
        results.notFound.push({
          orderNumber,
          trackingId,
          csvData: record
        });
        continue;
      }

      // Compare the values
      const discrepancies = [];
      const fedexTax = parseFloat(record.tax || record['Tax Amount'] || '0');
      const fedexDuty = parseFloat(record.duty || record['Duty Amount'] || '0');

      if (Math.abs(fedexTax - dbRecord.fedexTaxAmount) > 0.01) {
        discrepancies.push({
          field: 'tax',
          csv: fedexTax,
          db: dbRecord.fedexTaxAmount
        });
      }

      if (Math.abs(fedexDuty - dbRecord.fedexDutyAmount) > 0.01) {
        discrepancies.push({
          field: 'duty',
          csv: fedexDuty,
          db: dbRecord.fedexDutyAmount
        });
      }

      if (discrepancies.length > 0) {
        results.discrepancies.push({
          orderNumber,
          trackingId,
          dbRecord,
          csvData: record,
          discrepancies
        });
      } else {
        results.matches.push({
          orderNumber,
          trackingId,
          dbRecord,
          csvData: record
        });
      }
    } catch (error) {
      console.error('Error processing record:', record, error);
    }
  }

  return results;
} 