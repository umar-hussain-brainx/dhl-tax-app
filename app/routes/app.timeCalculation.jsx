import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import { useState, useEffect, Suspense, lazy } from "react";
import {
  Page,
  Layout,
  LegacyCard,
  Text,
  Banner,
  DataTable,
  ButtonGroup,
  Button
} from "@shopify/polaris";
import { CsvUploaderForDB } from "../components/CsvUploaderForDB";
import prisma from "../db.server";

// Dynamically import the BarChart component
const BarChart = lazy(() => import("@shopify/polaris-viz").then(module => ({ default: module.BarChart })));

function parseCustomDate(dateString) {
  if (!dateString) return null;
  
  // Ensure the date string is in the expected format
  if (dateString.length !== 8) {
    console.error("Invalid date format:", dateString);
    return null;
  }

  // Extract year, month, and day from YYYYMMDD format
  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);
  
  // Create date in YYYY-MM-DD format
  const formattedDate = `${year}-${month}-${day}`;
  const date = new Date(formattedDate);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.error("Invalid date:", dateString);
    return null;
  }

  return date;
}

// Function to calculate average time by country
async function calculateAverageTimeByCountry() {
  try {
    const records = await prisma.transitTime.findMany({
      select: {
        invoiceDate: true,
        podDeliveryDate: true,
        recipientCountry: true
      }
    });

    console.log("Fetched records:", records); // Debug log

    if (records.length === 0) {
      return { message: "No data available to calculate average times." };
    }

    const countryTimes = {};

    records.forEach(record => {
      const { invoiceDate, podDeliveryDate, recipientCountry } = record;
      const timeDifference = (new Date(invoiceDate) - new Date(podDeliveryDate)) / (1000 * 60 * 60 * 24);

      if (!countryTimes[recipientCountry]) {
        countryTimes[recipientCountry] = [];
      }
      countryTimes[recipientCountry].push(timeDifference);
    });

    const averageTimes = Object.entries(countryTimes).map(([country, times]) => {
      const averageTime = times.reduce((acc, time) => acc + time, 0) / times.length;
      return { country, averageTime: averageTime.toFixed(2) };
    });

    console.log("Calculated average times:", averageTimes); // Debug log

    return { averageTimes };
  } catch (error) {
    console.error("Error calculating average times:", error);
    return { message: "Error calculating average times." };
  }
}

// Loader function to fetch data on page load
export async function loader() {
  const averageTimes = await calculateAverageTimeByCountry();
  return json(averageTimes);
}

export async function action({ request }) {
  const formData = await request.formData();
  
  try {
    const csvData = JSON.parse(formData.get("csvData"));
    console.log("Parsed CSV Data First Row:", csvData[0]); // Log first row to check format

    if (!Array.isArray(csvData) || csvData.length === 0) {
      throw new Error("Invalid or empty CSV data");
    }

    // Validate the first row to ensure all required fields exist
    const requiredFields = [
      'Invoice Date',
      'Invoice Number',
      'Shipment Date',
      'POD Delivery Date',
      'POD Delivery Time',
      'Recipient Country/Territory',
      'Express or Ground Tracking ID'
    ];

    const firstRow = csvData[0];
    const missingFields = requiredFields.filter(field => !firstRow.hasOwnProperty(field));
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Process one row at a time
    const uniqueEntries = [];
    let skippedDueToExistence = 0;

    for (const row of csvData) {
      try {
        // Log raw date values
        console.log("Raw date values:", {
          invoiceDate: row['Invoice Date'],
          shipmentDate: row['Shipment Date'],
          podDeliveryDate: row['POD Delivery Date']
        });

        // Convert dates and prepare data
        const invoiceDate = parseCustomDate(row['Invoice Date']);
        const shipmentDate = parseCustomDate(row['Shipment Date']);
        const podDeliveryDate = parseCustomDate(row['POD Delivery Date']);

        // Log parsed dates
        console.log("Parsed dates:", {
          invoiceDate,
          shipmentDate,
          podDeliveryDate
        });

        // Validate dates
        if (!invoiceDate || !shipmentDate || !podDeliveryDate) {
          console.error("Invalid dates for row:", row);
          continue;
        }

        const trackingId = row['Express or Ground Tracking ID']?.toString().trim() || '';

        // Check if the record already exists
        const existingRecord = await prisma.transitTime.findFirst({
          where: { trackingId }
        });

        if (existingRecord) {
          console.log(`Record with tracking ID ${trackingId} already exists. Skipping.`);
          skippedDueToExistence++;
          continue;
        }

        const data = {
          invoiceDate: new Date(invoiceDate),
          invoiceNumber: row['Invoice Number']?.toString().trim() || '',
          shipmentDate: new Date(shipmentDate),
          podDeliveryDate: new Date(podDeliveryDate),
          podDeliveryTime: row['POD Delivery Time']?.toString().trim() || '',
          recipientCountry: row['Recipient Country/Territory']?.toString().trim() || '',
          trackingId,
          serviceType: row['Service Type']?.toString().trim() || 'Express'
        };

        // Add the data to the unique entries array
        uniqueEntries.push(data);
      } catch (rowError) {
        console.error("Error processing row:", {
          row,
          error: rowError.message,
          stack: rowError.stack
        });
      }
    }

    if (uniqueEntries.length > 0) {
      // Insert all unique entries at once
      const savedRecords = await prisma.transitTime.createMany({
        data: uniqueEntries
      });

      console.log(`Successfully saved ${savedRecords.count} records.`);
    }

    if (uniqueEntries.length === 0) {
      if (skippedDueToExistence > 0) {
        throw new Error(`All records were skipped because they already exist in the database.`);
      } else {
        throw new Error("No records were saved. Please check the CSV format and try again.");
      }
    }

    return json({ 
      success: true, 
      message: `Successfully uploaded ${uniqueEntries.length} out of ${csvData.length} records`,
      savedCount: uniqueEntries.length
    });

  } catch (error) {
    console.error("Action error:", {
      message: error.message,
      stack: error.stack
    });
    
    return json({ 
      success: false, 
      error: error.message || "Failed to save data. Please check the CSV format and try again." 
    }, { status: 400 });
  }
}

export default function TimeCalculation() {
  const submit = useSubmit();
  const actionData = useActionData();
  const loaderData = useLoaderData();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [averageTimes, setAverageTimes] = useState(loaderData.averageTimes || []);
  const [averageTimesMessage, setAverageTimesMessage] = useState(loaderData.message || "");

  console.log("Loader data", loaderData); // Debug log

  // Prepare data for the chart
  const chartData = averageTimes.map(({ country, averageTime }) => ({
    name: country,
    data: [{ key: country, value: parseFloat(averageTime) }]
  }));

  // Handle action response
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        setSuccess(actionData.message);
        setError("");
        // Optionally refetch or update average times here if needed
      } else {
        setError(actionData.error);
        setSuccess("");
      }
      setIsUploading(false);
    }
  }, [actionData]);

  const handleCsvData = async (data) => {
    try {
      setIsUploading(true);
      setError("");
      setSuccess("");

      if (!data || data.length === 0) {
        setError("No data found in CSV file");
        setIsUploading(false);
        return;
      }

      submit(
        { csvData: JSON.stringify(data) },
        { method: "post" }
      );
    } catch (err) {
      console.error("Error handling CSV data:", err);
      setError("Error processing CSV file: " + err.message);
      setIsUploading(false);
    }
  };

  return (
    <Page
      title="Transit Time Data Upload"
      subtitle="Upload your CSV file to track transit times and analyze delivery performance"
    >
      <Layout>
        <Layout.Section>
          <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {error && (
              <Banner
                title="There was an issue uploading your file"
                status="critical"
                onDismiss={() => setError("")}
                style={{ marginBottom: '20px' }}
              >
                <p>{error}</p>
              </Banner>
            )}

            {success && (
              <Banner
                title="Upload Successful"
                status="success"
                onDismiss={() => setSuccess("")}
                style={{ marginBottom: '20px' }}
              >
                <p>{success}</p>
              </Banner>
            )}

            <CsvUploaderForDB 
              onCsvData={handleCsvData} 
              isUploading={isUploading}
              style={{ marginBottom: '20px' }}
            />

            <LegacyCard sectioned>
              <Text variant="headingMd" as="h2" style={{ marginBottom: '20px' }}>Average Time by Country</Text>
              <div style={{ padding: '10px' }}>
                {averageTimes.length > 0 ? (
                  <>
                    <DataTable
                      columnContentTypes={['text', 'numeric']}
                      headings={['Country', 'Average Time (days)']}
                      rows={averageTimes.map(({ country, averageTime }) => [country, averageTime])}
                      footerContent={`Total countries: ${averageTimes.length}`}
                      style={{ marginBottom: '20px' }}
                    />
                    <Suspense fallback={<div>Loading chart...</div>}>
                      <BarChart
                        data={chartData}
                        xAxisOptions={{ labelFormatter: (value) => value }}
                        yAxisOptions={{ labelFormatter: (value) => `${value} days` }}
                        height={300}
                      />
                    </Suspense>
                  </>
                ) : (
                  <Text variant="bodyMd" as="p" color="subdued">
                    {averageTimesMessage}
                  </Text>
                )}
              </div>
            </LegacyCard>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
