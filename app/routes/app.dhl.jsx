import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Banner,
} from "@shopify/polaris";
import { ShippingRatesTable } from "../components/ShippingRatesTable";
import { CsvUploader } from "../components/CsvUploader";
import { useState } from "react";
import prisma from "../db.server";

export async function loader() {
  const shippingRates = await prisma.shippingRateWithTaxDuty.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });

  return json({ shippingRates });
}

export default function Index() {
  const { shippingRates } = useLoaderData();
  const [comparisonResults, setComparisonResults] = useState(null);

  const handleUploadComplete = (results) => {
    setComparisonResults(results);
  };

  return (
    <Page title="Shipping Rates, Tax & Duty">
      <Layout>
        <Layout.Section>
          <Card>
            
              <div style={{ marginBottom: '20px' }}>
                <CsvUploader onUpload={handleUploadComplete} />
              </div>
              {comparisonResults && (
                <Banner
                  title="Comparison Results"
                  status={comparisonResults.discrepancies.length > 0 ? "warning" : "success"}
                >
                  <p>Matches: {comparisonResults.matches.length}</p>
                  <p>Discrepancies: {comparisonResults.discrepancies.length}</p>
                  <p>Not Found: {comparisonResults.notFound.length}</p>
                </Banner>
              )}
           
          </Card>

          <div style={{ marginTop: '20px' }}>
            <Card>
              <ShippingRatesTable 
                rates={shippingRates} 
                comparisonResults={comparisonResults}
              />
            </Card>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
