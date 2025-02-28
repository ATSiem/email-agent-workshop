'use client';

import { useEffect, useState } from 'react';

/**
 * This component initializes the background processing system via API call
 * This approach avoids importing Node.js modules directly on the client
 */
export function BackgroundProcessorInit() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only initialize once
    if (!initialized) {
      console.log('Client - Requesting background processor initialization');
      
      // Call the initialization API
      fetch('/api/system/init')
        .then(response => response.json())
        .then(data => {
          console.log('Client - Background processor initialization response:', data);
          setInitialized(true);
        })
        .catch(err => {
          console.error('Client - Error initializing background processor:', err);
          setError(String(err));
        });
    }
  }, [initialized]);

  // This component doesn't render anything visible
  return null;
}