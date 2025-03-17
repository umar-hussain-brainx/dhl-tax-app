import React from 'react';
import { Spinner, Frame } from '@shopify/polaris';

const Loader = () => (
  <div style={{
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px'
  }}>
    <Spinner accessibilityLabel="Loading" size="large" />
    <p style={{ color: '#6d7175' }}>Loading...</p>
  </div>
);

export default Loader; 