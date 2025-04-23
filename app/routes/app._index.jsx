import { json } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, Banner, Spinner } from "@shopify/polaris";
import { ShippingRatesTable } from "../components/ShippingRatesTable";
import prisma from "../db.server";
import { CsvUploader } from "../components/CsvUploader";
import { useState, useEffect } from "react";
import Loader from '../components/Loader';

export async function loader() {
  try {
    const shippingRates = await prisma.shippingRateWithTaxDuty.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    return json({ shippingRates, error: null });
  } catch (error) {
    console.error("Database error:", error);
    return json({ 
      shippingRates: [], 
      error: null  // Changed from error message to null
    });
  }
}

export default function Index() {
  const { shippingRates, error } = useLoaderData();
  const navigation = useNavigation();
  const [hasError, setHasError] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [rates, setRates] = useState(shippingRates || []); // Initialize with loader data
  const [isLoading, setIsLoading] = useState(false); // Changed from true to false
  const [selectedDateRange, setSelectedDateRange] = useState(() => {
    const today = new Date();
    const endDate = new Date(today);
    
    // Change this from 30 days to 7 days
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7); // Changed from 30 to 7 for one week
    
    return {
      start: startDate,
      end: endDate,
    };
  });

  const fetchRates = async (page, dateRange) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "100",
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString()
      });

      const response = await fetch(`/api/shipping-rates?${params}`);
      const data = await response.json();
      
      setRates(data.rates);
      setTotalItems(data.total);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error fetching rates:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage, dateRange) => {
    fetchRates(newPage, dateRange);
  };

  // Fetch initial data
  useEffect(() => {
    const today = new Date();
    const initialDateRange = {
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7), // One week ago
      end: today
    };
    fetchRates(1, initialDateRange);
  }, []);

  function processDateFilter(startDate, endDate) {
    // Parse and validate start date
    const parsedStartDate = parseCustomDate(startDate);
    if (!parsedStartDate) {
      console.error("Invalid start date:", startDate);
      setHasError(true);
      return;
    }

    // Parse and validate end date
    const parsedEndDate = parseCustomDate(endDate);
    if (!parsedEndDate) {
      console.error("Invalid end date:", endDate);
      setHasError(true);
      return;
    }

    // Check if dates are the same
    if (parsedStartDate.toISOString().split('T')[0] === parsedEndDate.toISOString().split('T')[0]) {
      console.error("Start date and end date cannot be the same");
      setHasError(true);
      return;
    }

    // Ensure start date is before end date
    if (parsedStartDate > parsedEndDate) {
      console.error("Start date must be before end date");
      setHasError(true);
      return;
    }

    setHasError(false);
    // Use the dates in your logic, e.g., querying the database
    const results = fetchDataBetweenDates(parsedStartDate, parsedEndDate);
    console.log("Filtered results:", results);
  }

  function parseCustomDate(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  }

  function fetchDataBetweenDates(startDate, endDate) {
    // Example function to fetch data between two dates
    // Replace with actual database query logic
    return [];
  }

  // Show loader during navigation
  if (navigation.state === "loading") {
    return <Loader />;
  }

  return (
    <Page fullWidth style={{ maxWidth: '90%' }}>
      <ui-title-bar title="Shipping Rates with Tax & Duty"></ui-title-bar>
      <Layout>
        <Layout.Section>
          {(hasError || error) && (
            <Banner status="critical" onDismiss={() => setHasError(false)}>
              <p>{error || "Something went wrong loading the data. Please refresh the page."}</p>
            </Banner>
          )}
          <Card>
            <CsvUploader 
              onError={() => setHasError(true)}
            />
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <ShippingRatesTable
              rates={rates}
              currentPage={currentPage}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
