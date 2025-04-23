import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { fetchDhlData } from "../utilities/dhl-helper"; // Assuming you create this helper

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  // Extract order data from the request
  const { orderId, orderData } = await request.json();
  
  try {
    // Fetch DHL data using the helper function
    const dhlResponse = await fetchDhlData(orderData);
    console.log("DHL Response:", dhlResponse); // Log the response for debugging
    
    // Extract the required data from the response
    let dutyTaxPaid = null;
    let totalTaxes = null;
    let dhlCurrency = "USD"; // Default currency
    
    if (dhlResponse.products && dhlResponse.products.length > 0) {
      const product = dhlResponse.products[0];
      
      if (product.detailedPriceBreakdown && product.detailedPriceBreakdown.length > 0) {
        const breakdown = product.detailedPriceBreakdown[0].breakdown;
        
        if (breakdown && Array.isArray(breakdown)) {
          dutyTaxPaid = breakdown.find(item => item.name === "Duty Tax Paid");
          totalTaxes = breakdown.find(item => item.name === "TOTAL TAXES");
          
          // Set currency from the response if available
          if (totalTaxes && totalTaxes.priceCurrency) {
            dhlCurrency = totalTaxes.priceCurrency;
          }
        }
      }
    }
    
    // Log extracted data
    console.log("Extracted Data:", { dutyTaxPaid, totalTaxes, dhlCurrency });
    
    // Find or create the ShippingRateWithTaxDuty record
    const existingRecord = await prisma.shippingRateWithTaxDuty.findUnique({
      where: {
        orderId: orderId
      }
    });
    
    if (existingRecord) {
      // Update existing record with DHL data
      await prisma.shippingRateWithTaxDuty.update({
        where: {
          orderId: orderId
        },
        data: {
          dhlTaxAmount: totalTaxes ? parseFloat(totalTaxes.price) : null,
          dhlDutyAmount: dutyTaxPaid ? parseFloat(dutyTaxPaid.price) : null,
          dhlCurrency: dhlCurrency,
          updatedAt: new Date()
        }
      });
      console.log("Updated existing record for orderId:", orderId);
    } else {
      // Create a new record with DHL data
      await prisma.shippingRateWithTaxDuty.create({
        data: {
          orderId: orderId,
          shopifyOrderId: orderData.id || orderId,
          dhlTaxAmount: totalTaxes ? parseFloat(totalTaxes.price) : null,
          dhlDutyAmount: dutyTaxPaid ? parseFloat(dutyTaxPaid.price) : null,
          dhlCurrency: dhlCurrency,
          status: "COMPLETED",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log("Created new record for orderId:", orderId);
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        dutyTaxPaid,
        totalTaxes,
        dhlCurrency
      }
    }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
    
  } catch (error) {
    console.error("DHL API Error:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}