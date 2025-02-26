'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export function SyncButton({ refreshCallback }: { refreshCallback?: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  // Use a useEffect to avoid hydration mismatch with Date.now()
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSync() {
    try {
      setIsLoading(true);
      setMessage('Processing...');

      try {
        // Use a timeout to ensure we don't wait forever
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        // Make the fetch request with abort controller and include the token from session storage
        const msGraphToken = sessionStorage.getItem('msGraphToken');
        
        const response = await fetch('/api/sync', {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Authorization': msGraphToken ? `Bearer ${msGraphToken}` : ''
          }
        });
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        
        // Handle non-OK responses
        if (!response.ok) {
          let errorDetail = '';
          try {
            const errorBody = await response.json();
            errorDetail = errorBody.message || errorBody.error || '';
            console.error('API error details:', errorBody);
          } catch (e) {
            const text = await response.text();
            errorDetail = text || `Status: ${response.status}`;
          }
          
          throw new Error(`Server error: ${errorDetail}`);
        }
        
        // Try to parse the JSON response
        let data;
        try {
          data = await response.json();
          console.log('Sync API response:', data);
        } catch (jsonError) {
          throw new Error('Invalid response from server (not JSON)');
        }

        // Handle success or error in the response
        if (data.success) {
          setMessage(data.message || 'Emails synced successfully');
          
          // Schedule a refresh after a short delay
          setTimeout(() => {
            setMessage('');
            // Refresh data
            if (refreshCallback) {
              refreshCallback();
            }
          }, 1500);
          
        } else {
          // Show error from API
          const errorMsg = data.message || `Error: ${data.error || 'Unknown error'}`;
          console.error('API reported error:', data);
          setMessage(errorMsg);
          
          // Clear error after delay (no refresh)
          setTimeout(() => setMessage(''), 5000);
        }
      } catch (fetchError) {
        // Handle network or other errors
        console.error('Sync operation failed:', fetchError);
        
        if (fetchError.name === 'AbortError') {
          setMessage('Request timed out. The server took too long to respond.');
        } else {
          setMessage(`Error: ${fetchError.message || 'Could not connect to server'}`);
        }
        
        // Clear error message after delay
        setTimeout(() => setMessage(''), 5000);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Only render the button after client-side hydration
  if (!mounted) return null;
  
  return (
    <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2">
      {message && (
        <div className="bg-secondary text-secondary-foreground rounded-md p-2 text-sm">
          {message}
        </div>
      )}
      <button
        onClick={handleSync}
        disabled={isLoading}
        className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/50 rounded-full p-3 shadow-md transition-colors"
        title="Sync emails"
      >
        <RefreshCw className={`h-6 w-6 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}