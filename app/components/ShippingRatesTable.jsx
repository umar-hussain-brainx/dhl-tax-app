import { DataTable, DatePicker, Button, Box, Popover, ButtonGroup, Card, Text, Select } from "@shopify/polaris";
import { useState, useEffect, useCallback } from "react";

// Add this at the top of the file, outside the component
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function ShippingRatesTable({ onPageChange, totalItems, currentPage: externalPage, rates, comparisonResults, isLoading }) {
  const [{ month, year }, setDate] = useState(() => {
    const today = new Date();
    return {
      month: today.getMonth(),
      year: today.getFullYear(),
    };
  });
  
  const [selectedDates, setSelectedDates] = useState(() => {
    const today = new Date();
    const endDate = new Date(today);
    
    // Change the default range from one month to one week
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7); // Changed from 30 to 7
    
    return {
      start: startDate,
      end: endDate,
    };
  });
  const [datePopoverActive, setDatePopoverActive] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  const statusOptions = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' }
  ];

  const rowsPerPage = 100; // Set limit to 100 items per page
  const currentPage = externalPage || 1;

  // Filter rates based on selected date range
  const filteredRates = rates.filter((rate) => {
    const rateDate = new Date(rate.createdAt);
    return rateDate >= selectedDates.start && rateDate <= selectedDates.end;
  });

  // Handle date selection
  const handleDateChange = ({ start, end }) => {
    setSelectedDates({ start, end });
    setDatePopoverActive(false);
    onPageChange(1, { start, end, status: selectedStatus });
  };

  // Handle month navigation
  const handleMonthChange = (month, year) => {
    setDate({ month, year });
  };

  // Handle status change
  const handleStatusChange = (value) => {
    setSelectedStatus(value);
    onPageChange(1, { ...selectedDates, status: value });
  };

  // Handle export
  const handleExport = () => {
    const csvData = filteredRates.map((rate) => ({
      'Order Number': rate.shopifyOrderId,
      'FedEx Total': rate.fedexTotalAmount,
      'FedEx Tax': rate.fedexTaxAmount,
      'FedEx Duty': rate.fedexDutyAmount,
      'Shopify Tax': rate.shopifyTaxAmount,
      'Shopify Duty': rate.shopifyDutyAmount,
      'DHL Tax': rate.dhlTaxAmount,
      'DHL Duty': rate.dhlDutyAmount,
      'UPS Total Amount': rate.upsTotalAmount,
      'UPS Tax Duty': rate.upsTaxDutyAmount,
      'Status': rate.status,
      'Created At': dateFormatter.format(new Date(rate.createdAt)),
      'Tracking ID': rate.trackingId || 'N/A'
    }));

    const csvString = [
      Object.keys(csvData[0]),
      ...csvData.map(row => Object.values(row))
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipping-rates-${selectedDates.start.toISOString().split('T')[0]}-to-${selectedDates.end.toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Add this log to see what data we're receiving
  // console.log("📊 Rendering shipping rates table with data:", rates);

  const getRowContent = (rate) => {
    console.log("rate", rate);
    const baseContent = [
      rate.shopifyOrderId,
      `${rate.fedexTotalAmount} ${rate.fedexCurrency}`,
      `${rate.fedexTaxAmount} ${rate.fedexTaxCurrency}`,
      `${rate.fedexDutyAmount} ${rate.fedexDutyCurrency}`,
      `${rate.shopifyTaxAmount} ${rate.shopifyTaxCurrency}`,
      `${rate.shopifyDutyAmount} ${rate.shopifyDutyCurrency}`,
      rate.dhlTaxAmount ? `${rate.dhlTaxAmount} ${rate.dhlCurrency}` : '-',
      rate.dhlDutyAmount ? `${rate.dhlDutyAmount} ${rate.dhlCurrency}` : '-',
      rate.upsTotalAmount ? `${rate.upsTotalAmount}` : '-',
      rate.upsTaxDutyAmount ? `${rate.upsTaxDutyAmount}` : '-',
      rate.status,
      dateFormatter.format(new Date(rate.createdAt)),
      rate.trackingId || 'N/A',
    ];

    // Add comparison styling if available
    if (comparisonResults) {
      const discrepancy = comparisonResults.discrepancies.find(
        d => d.orderNumber === rate.shopifyOrderId
      );
      if (discrepancy) {
        return baseContent.map(content => ({
          content,
          style: { backgroundColor: 'rgba(255, 235, 235, 0.4)' }
        }));
      }
    }

    return baseContent;
  };

  // Handle pagination
  const handleNext = () => {
    onPageChange(currentPage + 1, { ...selectedDates, status: selectedStatus });
  };

  const handlePrevious = () => {
    onPageChange(currentPage - 1, { ...selectedDates, status: selectedStatus });
  };

  // Calculate pagination values
  const hasNext = (currentPage * rowsPerPage) < totalItems;
  const hasPrevious = currentPage > 1;

  // Update the date display in the button
  const formatDateRange = () => {
    return `${dateFormatter.format(selectedDates.start)} - ${dateFormatter.format(selectedDates.end)}`;
  };

  // Handle reset filters
  const handleResetFilters = () => {
    const resetDateRange = {
      start: new Date(0),
      end: new Date(),
    };
    setSelectedDates(resetDateRange);
    setSelectedStatus('all');
    setDate({
      month: new Date().getMonth(),
      year: new Date().getFullYear(),
    });
    onPageChange(1, { ...resetDateRange, status: 'all' });
  };

  // Add UPS columns to the table headers
  const headers = [
    { label: "Order #", key: "shopifyOrderId" },
    { label: "Shopify Tax", key: "shopifyTaxAmount" },
    { label: "Shopify Duty", key: "shopifyDutyAmount" },
    { label: "FedEx Tax", key: "fedexTaxAmount" },
    { label: "FedEx Duty", key: "fedexDutyAmount" },
    { label: "DHL Tax", key: "dhlTaxAmount" },
    { label: "DHL Duty", key: "dhlDutyAmount" },
    { label: "UPS Total", key: "upsTotalAmount" },
    { label: "UPS Tax & Duty", key: "upsTaxDutyAmount" },
    { label: "Status", key: "status" },
    { label: "Actions", key: "actions" },
  ];

  // Update the default selected range option
  const [selectedRangeOption, setSelectedRangeOption] = useState('last7Days'); // Changed from 'last30Days'
  
  const handleRangeChange = useCallback((value) => {
    setSelectedRangeOption(value);
    
    const today = new Date();
    const endDate = new Date(today);
    let startDate = new Date(today);
    
    // Update the date calculation based on the selected range
    switch (value) {
      case 'last7Days':
        startDate.setDate(today.getDate() - 7);
        break;
      case 'last30Days':
        startDate.setDate(today.getDate() - 30);
        break;
      // Other cases...
    }
    
    setSelectedDates({
      start: startDate,
      end: endDate,
    });
  }, []);

  return (
    <>
      <Card>
        <Box padding="4">
          <Box paddingBottom="3">
            <Text variant="headingMd" as="h3">Filters</Text>
          </Box>
          
          <Box>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '12px', alignItems: 'start' }}>
              {/* Date Range Filter */}
              <Box>
                <Text variant="bodyMd" as="p" color="subdued">Date Range</Text>
                <Box paddingTop="2">
                  <Popover
                    active={datePopoverActive}
                    activator={
                      <Button 
                        onClick={() => setDatePopoverActive(!datePopoverActive)}
                        fullWidth
                      >
                        {formatDateRange()}
                      </Button>
                    }
                    onClose={() => setDatePopoverActive(false)}
                  >
                    <DatePicker
                      month={month}
                      year={year}
                      onChange={handleDateChange}
                      onMonthChange={handleMonthChange}
                      selected={{
                        start: selectedDates.start,
                        end: selectedDates.end,
                      }}
                      allowRange
                    />
                  </Popover>
                </Box>
              </Box>

              {/* Action Buttons */}
              <Box>
                <Text variant="bodyMd" as="p" color="subdued">Actions</Text>
                <Box paddingTop="2">
                  <ButtonGroup>
                    <Button onClick={handleResetFilters}>Reset Filters</Button>
                    <Button primary onClick={handleExport}>
                      Export
                    </Button>
                  </ButtonGroup>
                </Box>
              </Box>
            </div>
          </Box>
        </Box>
      </Card>
      <div style={{margin: '15px'}}></div>
      <Box paddingTop="4" marginTop="5">
        <Card>
          <DataTable
            columnContentTypes={[
              "text",
              "numeric",
              "numeric",
              "numeric",
              "numeric",
              "numeric",
              "numeric",
              "numeric",
              "numeric",
              "numeric",
              "text",
              "text",
              "text",
            ]}
            headings={[
              "Shopify Order No",
              "FedEx Total",
              "FedEx Tax",
              "FedEx Duty",
              "Shopify Tax",
              "Shopify Duty",
              "DHL Tax",
              "DHL Duty",
              "UPS Total",
              "UPS Tax&Duty",
              "Status",
              "Created At",
              "Tracking ID",
            ]}
            rows={rates.map(rate => getRowContent(rate))}
            footerContent={`Showing ${((currentPage - 1) * 100) + 1}-${Math.min(
              currentPage * 100,
              totalItems
            )} of ${totalItems} rates`}
            pagination={{
              hasNext: (currentPage * 100) < totalItems,
              hasPrevious: currentPage > 1,
              onNext: () => onPageChange(currentPage + 1, { ...selectedDates, status: selectedStatus }),
              onPrevious: () => onPageChange(currentPage - 1, { ...selectedDates, status: selectedStatus }),
            }}
          />
        </Card>
      </Box>
    </>
  );
}
