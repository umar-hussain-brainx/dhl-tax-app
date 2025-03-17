import {
  Button,
  Banner,
  Spinner,
  Text,
  ButtonGroup,
  Modal,
  DataTable,
  SkeletonBodyText,
  DropZone,
  Box,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import Papa from "papaparse";

// Define the component as a function declaration
function CsvUploader({ onUpload, onError }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isComponentReady, setIsComponentReady] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileObject, setFileObject] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const CHUNK_SIZE = 1000; // Number of rows to process at once

  // Add useEffect to handle component initialization with retry logic
  useEffect(() => {
    let mounted = true;
    let timeoutId = null;
    const maxRetries = 3;
    const backoffDelay = (attempt) => Math.min(1000 * Math.pow(2, attempt), 8000);
    
    const initializeComponent = async () => {
      try {
        // Add more robust initialization check
        const healthCheck = await fetch('/api/health-check').catch(() => ({ ok: false }));
        if (!healthCheck.ok) {
          throw new Error('Service unavailable');
        }

        // Simulate network delay only in development
        if (process.env.NODE_ENV === 'development') {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (!mounted) return;

        setIsComponentReady(true);
      } catch (error) {
        console.error('Error initializing component:', error);
        if (mounted && retryCount < maxRetries) {
          setRetryCount(prev => prev + 1);
          // Use exponential backoff for retries
          timeoutId = setTimeout(initializeComponent, backoffDelay(retryCount));
        } else if (mounted) {
          setError('Failed to initialize import section. Please refresh the page or try again later.');
          onError?.(error); // Pass error to parent
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeComponent();

    // Enhanced cleanup function
    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [retryCount, onError]);

  const processChunk = async (chunk, totalChunks, chunkIndex) => {
    try {
      const response = await fetch("/api/upload-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: chunk,
          isLastChunk: chunkIndex === totalChunks - 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update progress
      setProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100));

    } catch (error) {
      console.error("Error uploading chunk:", error);
      throw error;
    }
  };

  const handleDrop = async (files) => {
    setIsUploading(true);
    setProgress(0);

    try {
      const file = files[0];
      
      // Parse CSV file in chunks
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        chunk: async (results, parser) => {
          parser.pause(); // Pause parsing while we process this chunk
          
          const rows = results.data;
          const chunks = [];
          
          // Split rows into chunks
          for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            chunks.push(rows.slice(i, i + CHUNK_SIZE));
          }

          // Process each chunk sequentially
          for (let i = 0; i < chunks.length; i++) {
            await processChunk(chunks[i], chunks.length, i);
          }

          parser.resume(); // Resume parsing
        },
        complete: () => {
          setIsUploading(false);
          setProgress(100);
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
          onError();
          setIsUploading(false);
        },
      });

    } catch (error) {
      console.error("Error processing file:", error);
      onError();
      setIsUploading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!fileObject) return;
    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      
      const readFilePromise = new Promise((resolve, reject) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
      });

      reader.readAsText(fileObject);
      
      const text = await readFilePromise;
      const rows = text.split('\n').map(row => row.split(','));
      const headers = rows[0].map(h => h.trim());

      // Find tracking ID column
      const trackingIdIndex = headers.findIndex(header => 
        header === 'Express or Ground Tracking ID' || 
        header === 'Tracking ID'
      );

      if (trackingIdIndex === -1) {
        setError('Could not find tracking ID column in CSV');
        setIsLoading(false);
        return;
      }

      // Find all Tracking ID Charge Description columns
      const chargeDescIndexes = headers.reduce((acc, header, index) => {
        if (header === 'Tracking ID Charge Description') {
          acc.push(index);
        }
        return acc;
      }, []);

      if (chargeDescIndexes.length === 0) {
        setError('Could not find any Tracking ID Charge Description columns in CSV');
        setIsLoading(false);
        return;
      }

      console.log('Headers:', headers);
      console.log('Tracking ID column index:', trackingIdIndex);
      console.log('Charge Description column indexes:', chargeDescIndexes);

      // Process data rows (skip header)
      const dataRows = rows.slice(1).filter(row => row.length > 1);
      
      // Group rows by tracking ID and collect their charge descriptions
      const trackingIdGroups = new Map();
      
      for (const row of dataRows) {
        const trackingId = row[trackingIdIndex]?.trim();
        if (!trackingId) continue;

        // Check all charge description columns for this row
        const chargeDescs = chargeDescIndexes
          .map(index => row[index]?.trim())
          .filter(desc => desc); // Remove empty descriptions

        if (!trackingIdGroups.has(trackingId)) {
          trackingIdGroups.set(trackingId, new Set());
        }
        
        // Add all charge descriptions for this tracking ID
        chargeDescs.forEach(desc => {
          trackingIdGroups.get(trackingId).add(desc);
        });
      }

      // Filter for tracking IDs that have both Original VAT and Customs Duty
      const validTrackingIds = new Set();
      for (const [trackingId, chargeDescs] of trackingIdGroups) {
        if (chargeDescs.has('Original VAT') && chargeDescs.has('Customs Duty')) {
          validTrackingIds.add(trackingId);
        }
      }

      console.log('Valid Tracking IDs:', validTrackingIds);

      const results = [];
      // Process only valid tracking IDs
      for (const trackingId of validTrackingIds) {
        try {
          const response = await fetch(`/api/orders/tracking/${trackingId}`);
          const dbRecord = await response.json();
          
          console.log('DB Record for tracking ID:', trackingId, dbRecord);

          // Find the corresponding row data
          const rowData = dataRows.find(row => row[trackingIdIndex]?.trim() === trackingId);
          
          // Get the VAT and Duty amounts
          let vatAmount = '0';
          let dutyAmount = '0';

          // For each charge description column
          chargeDescIndexes.forEach((descIndex, i) => {
            const desc = rowData[descIndex]?.trim();
            const amountIndex = descIndex + 1; // Amount column is right after description
            if (desc === 'Original VAT') {
              vatAmount = rowData[amountIndex]?.trim() || '0';
            } else if (desc === 'Customs Duty') {
              dutyAmount = rowData[amountIndex]?.trim() || '0';
            }
          });

          results.push({
            trackingId,
            csvData: {
              netChargeAmount: rowData[headers.indexOf('Net Charge Amount')]?.trim() || '0',
              vatAmount,
              dutyAmount
            },
            dbRecord: dbRecord || null,
            status: dbRecord ? 'Found' : 'Not Found'
          });
        } catch (error) {
          console.error('Error fetching data for tracking ID:', trackingId, error);
        }
      }

      const comparisonData = {
        matches: results.filter(r => r.status === 'Found'),
        notFound: results.filter(r => r.status === 'Not Found'),
        discrepancies: []
      };

      console.log('Comparison Results:', comparisonData);
      setComparisonResults(comparisonData);
      setShowModal(true);
    } catch (err) {
      setError('Failed to process file. Please try again.');
      console.error('Processing error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file.name);
        setFileObject(file);
      }
    };
    input.click();
  };

  const handleExportCSV = () => {
    if (!comparisonResults) return;

    // Prepare CSV data
    const csvRows = [
      // Headers
      ['Tracking ID', 'CSV Net Charge', 'DB FedEx Tax', 'Status'],
      // Data rows
      ...comparisonResults.matches.map(match => [
        match.trackingId,
        match.csvData.netChargeAmount,
        match.dbRecord?.fedexTaxAmount || 'N/A',
        match.status
      ]),
      // Add not found records
      ...comparisonResults.notFound.map(record => [
        record.trackingId,
        record.csvData.netChargeAmount,
        'N/A',
        'N/A',
        'Not Found'
      ])
    ];

    // Convert to CSV string
    const csvContent = csvRows
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'fedex-comparison-results.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderComparisonModal = () => {
    if (!comparisonResults) return null;

    const rows = comparisonResults.matches.map(match => [
      match.trackingId,
      match.csvData.netChargeAmount || 'N/A',
      match.dbRecord?.fedexTaxAmount || 'N/A',
      match.status
    ]);

    return (
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="CSV Comparison Results"
        primaryAction={{
          content: 'Close',
          onAction: () => setShowModal(false),
        }}
        secondaryActions={[
          {
            content: 'Export Results',
            onAction: handleExportCSV,
            disabled: !comparisonResults || (
              comparisonResults.matches.length === 0 && 
              comparisonResults.notFound.length === 0
            )
          }
        ]}
      >
        <Modal.Section>
          <DataTable
            columnContentTypes={[
              'text',
              'numeric',
              'numeric',
              'text',
            ]}
            headings={[
              'Tracking ID',
              'CSV Net Charge',
              'DB FedEx Tax',
              'Status'
            ]}
            rows={rows}
          />
          <div style={{ marginTop: '16px' }}>
            <Text>Total Matches: {comparisonResults.matches.length}</Text>
            <Text>Not Found in DB: {comparisonResults.notFound.length}</Text>
          </div>
        </Modal.Section>
      </Modal>
    );
  };

  // Show loading state while component initializes
  if (isLoading || !isComponentReady) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
        <SkeletonBodyText lines={3} />
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Spinner accessibilityLabel="Loading" size="small" />
          <Text variant="bodyMd" as="p" color="subdued">
            {retryCount > 0 ? `Retrying initialization (${retryCount}/${3})...` : 'Initializing import section...'}
          </Text>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <Banner status="critical" onDismiss={() => setError(null)}>
          <p>{error}</p>
          <div style={{ marginTop: '8px' }}>
            <Button onClick={() => {
              setError(null);
              setRetryCount(0);
              setIsLoading(true);
            }}>
              Retry
            </Button>
          </div>
        </Banner>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#f6f6f7', borderRadius: '8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <Text variant="headingMd" as="h2">Import FedEx CSV Data</Text>
        <Text variant="bodyMd" as="p" color="subdued">
          Upload your FedEx CSV file to compare with existing records
        </Text>
      </div>

      {error && (
        <div style={{ marginBottom: '16px' }}>
          <Banner status="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        </div>
      )}

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px',
        marginBottom: '16px' 
      }}>
        <ButtonGroup>
          <Button
            onClick={handleFileSelect}
            disabled={isLoading}
          >
            Browse Files
          </Button>
          {selectedFile && (
            <Button disabled monochrome>
              {selectedFile}
            </Button>
          )}
          {selectedFile && !isLoading && (
            <Button
              primary
              onClick={handleFileUpload}
            >
              Compare CSV
            </Button>
          )}
        </ButtonGroup>

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size="small" />
            <Text>Processing...</Text>
          </div>
        )}
      </div>

      <div style={{ marginTop: '8px' }}>
        <Text variant="bodyMd" as="p" color="subdued">
          Supported format: CSV files exported from FedEx
        </Text>
      </div>

      {renderComparisonModal()}
    </div>
  );
}

// Export the component
export { CsvUploader }; 