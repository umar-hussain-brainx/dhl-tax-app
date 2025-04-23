import { useState } from "react";
import { Button, Card, Text, Banner } from "@shopify/polaris";

export function DhlLandedCost({ orderId, orderData }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const calculateLandedCost = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/dhl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          orderData,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to calculate landed cost");
      }
      
      setResult(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Card.Section>
        <Text variant="headingMd">DHL Landed Cost Calculator</Text>
        <Text>Calculate import duties and taxes for international shipments</Text>
      </Card.Section>
      
      <Card.Section>
        <Button 
          primary 
          loading={loading} 
          onClick={calculateLandedCost}
        >
          Calculate Landed Cost
        </Button>
      </Card.Section>
      
      {error && (
        <Card.Section>
          <Banner status="critical">{error}</Banner>
        </Card.Section>
      )}
      
      {result && (
        <Card.Section>
          <Text variant="headingMd">Results</Text>
          
          {result.dutyTaxPaid && (
            <div style={{ marginTop: "1rem" }}>
              <Text variant="headingSm">Duty Tax Paid</Text>
              <Text>{result.dutyTaxPaid.price} {result.dutyTaxPaid.priceCurrency}</Text>
            </div>
          )}
          
          {result.totalTaxes && (
            <div style={{ marginTop: "1rem" }}>
              <Text variant="headingSm">Total Taxes</Text>
              <Text>{result.totalTaxes.price} {result.totalTaxes.priceCurrency}</Text>
            </div>
          )}
        </Card.Section>
      )}
    </Card>
  );
} 