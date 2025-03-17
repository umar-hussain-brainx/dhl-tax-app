import { useState } from "react";
import Papa from "papaparse";
import {
  DropZone,
  LegacyCard,
  Button,
  DataTable,
  Text,
  ButtonGroup,
  Banner,
  Spinner
} from "@shopify/polaris";

export function CsvUploaderForDB({ onCsvData, isUploading }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const processFile = (file) => {
    setIsProcessing(true);
    setSelectedFile(file);
    setErrorMessage("");
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Papa Parse results:", results);
        setParsedData(results.data);
        setIsProcessing(false);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setErrorMessage("Error processing CSV file");
        setIsProcessing(false);
      }
    });
  };

  const handleDropZoneDrop = (_dropFiles, acceptedFiles, _rejectedFiles) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  };

  const handleUpload = () => {
    if (parsedData) {
      onCsvData(parsedData);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setParsedData(null);
    setErrorMessage("");
  };

  const fileUpload = selectedFile && (
    <div style={{ padding: '5px' }}>
      <Text variant="bodyMd" as="p">
        {selectedFile.name}
      </Text>
      <Text variant="bodySm" as="p" color="subdued">
        {parsedData ? `${parsedData.length} rows found` : 'Processing...'}
      </Text>
    </div>
  );

  // Prepare data for DataTable
  const getPreviewData = () => {
    if (!parsedData || parsedData.length === 0) return { headers: [], rows: [] };

    const headers = Object.keys(parsedData[0]).map(header => header);
    const rows = parsedData.slice(0, 5).map(row => 
      Object.values(row).map(value => value?.toString() || '')
    );

    return { headers, rows };
  };

  const { headers, rows } = getPreviewData();

  return (
    <LegacyCard sectioned>
      {errorMessage && (
        <Banner
          title="There was an issue with your file"
          status="critical"
          onDismiss={() => setErrorMessage("")}
        >
          <p>{errorMessage}</p>
        </Banner>
      )}

      <div style={{ padding: '20px' }}>
        <DropZone
          accept=".csv"
          errorOverlayText="File type must be .csv"
          type="file"
          onDrop={handleDropZoneDrop}
          variableHeight
          allowMultiple={false}
          disabled={isUploading}
        >
          {isProcessing || isUploading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Spinner size="small" />
              <Text variant="bodyMd" as="p">
                {isUploading ? "Uploading..." : "Processing file..."}
              </Text>
            </div>
          ) : (
            <div style={{ padding: '10px', textAlign: 'center' }}>
              {selectedFile ? fileUpload : (
                <DropZone.FileUpload actionHint="or drop file to upload" />
              )}
            </div>
          )}
        </DropZone>

        {selectedFile && parsedData && !isUploading && (
          <>
            <ButtonGroup>
              <Button onClick={handleRemoveFile}>Cancel</Button>
              <Button 
                primary 
                onClick={handleUpload}
                loading={isUploading}
                disabled={isUploading}
              >
                Upload CSV
              </Button>
            </ButtonGroup>

            <LegacyCard title="Preview">
              <DataTable
                columnContentTypes={headers.map(() => 'text')}
                headings={headers}
                rows={rows}
                truncate
              />
              {parsedData.length > 5 && (
                <div className="p-4 border-t text-center">
                  <Text variant="bodySm" as="p" color="subdued">
                    Showing first 5 rows of {parsedData.length} total rows
                  </Text>
                </div>
              )}
            </LegacyCard>
          </>
        )}
      </div>
    </LegacyCard>
  );
} 