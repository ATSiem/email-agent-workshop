'use client';

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef, useCallback } from 'react';
import { getUserAccessToken } from '~/lib/auth/microsoft';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  domains: string[];
  emails: string[];
}

interface ClientListProps {
  onSelectClient: (clientId: string) => void;
}

export const ClientList = forwardRef<{ refreshClients: () => Promise<void> }, ClientListProps>(
  function ClientList({ onSelectClient }, ref) {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [authError, setAuthError] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
    
    // Function to fetch clients
    const fetchClients = useCallback(async () => {
      // Set a minimum time between refreshes to prevent excessive API calls
      const now = Date.now();
      const minRefreshInterval = 1000; // 1 second
      
      if (now - lastRefreshTime < minRefreshInterval && clients.length > 0) {
        console.log('ClientList - Skipping refresh, too soon since last refresh');
        return;
      }
      
      setLoading(true);
      setError(null);
      setAuthError(false);
      setLastRefreshTime(now);
      
      try {
        console.log('ClientList - Fetching clients');
        
        // Get the authentication token
        const token = getUserAccessToken();
        console.log('ClientList - Access token available:', !!token);
        
        if (!token) {
          setAuthError(true);
          throw new Error('Authentication required. Please sign in again.');
        }
        
        // Get user email from session storage for debugging
        const userEmail = typeof window !== 'undefined' ? sessionStorage.getItem('userEmail') : null;
        if (userEmail) {
          console.log('Adding user email to API request:', userEmail);
        }
        
        // Fetch clients from API
        const response = await fetch('/api/clients', {
          headers: {
            'Authorization': `Bearer ${token}`,
            ...(userEmail ? { 'X-User-Email': userEmail } : {})
          },
          // Add cache busting parameter to prevent caching
          cache: 'no-store'
        });
        
        console.log('ClientList - Response status:', response.status);
        
        if (response.status === 401) {
          setAuthError(true);
          throw new Error('Authentication required. Please sign in again.');
        }
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('ClientList - Error response:', errorData);
          throw new Error(errorData.error || 'Failed to fetch clients');
        }
        
        const data = await response.json();
        console.log('ClientList - Response data:', data);
        
        // Store clients in state and also in localStorage as a backup
        const clientsData = data.clients || [];
        setClients(clientsData);
        
        // Save to localStorage as a backup
        if (typeof window !== 'undefined' && clientsData.length > 0) {
          try {
            localStorage.setItem('cachedClients', JSON.stringify(clientsData));
            console.log('ClientList - Saved clients to localStorage');
          } catch (storageError) {
            console.error('ClientList - Error saving to localStorage:', storageError);
          }
        }
      } catch (err) {
        console.error('ClientList - Error fetching clients:', err);
        setError(err.message || 'An error occurred while fetching clients');
        
        // Try to load clients from localStorage if available
        if (typeof window !== 'undefined') {
          try {
            const cachedClients = localStorage.getItem('cachedClients');
            if (cachedClients) {
              const parsedClients = JSON.parse(cachedClients);
              console.log('ClientList - Loaded clients from localStorage:', parsedClients);
              setClients(parsedClients);
            }
          } catch (storageError) {
            console.error('ClientList - Error loading from localStorage:', storageError);
          }
        }
      } finally {
        setLoading(false);
      }
    }, [clients.length, lastRefreshTime]);
    
    // Expose refreshClients method to parent components
    useImperativeHandle(ref, () => ({
      refreshClients: fetchClients
    }), [fetchClients]);
    
    // Load cached clients on mount before fetching from API
    useEffect(() => {
      // Try to load clients from localStorage first for immediate display
      if (typeof window !== 'undefined') {
        try {
          const cachedClients = localStorage.getItem('cachedClients');
          if (cachedClients) {
            const parsedClients = JSON.parse(cachedClients);
            console.log('ClientList - Initial load from localStorage:', parsedClients);
            setClients(parsedClients);
          }
        } catch (storageError) {
          console.error('ClientList - Error loading from localStorage:', storageError);
        }
      }
      
      // Then fetch from API
      fetchClients();
    }, [fetchClients]);
    
    // Handle client selection
    const handleSelectClient = (clientId: string) => {
      onSelectClient(clientId);
    };
    
    // Handle client deletion
    const handleDeleteClient = async (clientId: string) => {
      if (!window.confirm('Are you sure you want to delete this client?')) {
        return;
      }
      
      try {
        const token = getUserAccessToken();
        if (!token) {
          setAuthError(true);
          throw new Error('Authentication required. Please sign in again.');
        }
        
        const response = await fetch(`/api/clients/${clientId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete client');
        }
        
        // Refresh the client list after deletion
        fetchClients();
      } catch (err) {
        console.error('Error deleting client:', err);
        setError(err.message || 'An error occurred while deleting the client');
      }
    };
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium dark:text-white">Your Clients</h2>
        </div>
        
        {authError && (
          <div className="mb-4 p-4 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-md">
            <p className="font-medium">Authentication Required</p>
            <p className="text-sm mt-1">Your session may have expired. Please <Link href="/" className="underline">sign in again</Link> to continue.</p>
          </div>
        )}
        
        {error && !authError && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-sm">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="animate-pulse text-gray-500 dark:text-gray-400">Loading clients...</div>
          </div>
        ) : clients.length === 0 ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            <p>No clients found.</p>
            <p className="text-sm mt-2">Add your first client using the form.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {clients.map((client) => (
              <div key={client.id} className="py-3">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                  <div className="flex-grow max-w-full md:max-w-[70%]">
                    <h3 className="font-medium dark:text-white">{client.name}</h3>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {client.domains && client.domains.length > 0 && (
                        <div className="mb-1">
                          <span className="font-medium">Domains:</span> {client.domains.join(', ')}
                        </div>
                      )}
                      {client.emails && client.emails.length > 0 && (
                        <div className="break-words">
                          <span className="font-medium">Emails:</span> {client.emails.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-3 self-end md:self-start shrink-0">
                    <button
                      onClick={() => {
                        handleSelectClient(client.id);
                        // Navigate directly to generate report view
                        window.dispatchEvent(new CustomEvent('navigate-to-generate', { detail: { clientId: client.id } }));
                      }}
                      className="relative px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-md shadow-sm overflow-hidden group min-w-[130px] text-center"
                    >
                      <span className="relative z-10">Generate Report</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="absolute inset-0 border-0 group-hover:border group-hover:border-white group-hover:border-opacity-30 rounded-md transition-all duration-300"></div>
                      <div className="absolute inset-0 -translate-y-full group-hover:translate-y-0 bg-gradient-to-r from-green-300/20 to-emerald-400/20 transition-transform duration-500"></div>
                    </button>
                    <button
                      onClick={() => handleDeleteClient(client.id)}
                      className="relative px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-md shadow-sm overflow-hidden group min-w-[80px] text-center"
                    >
                      <span className="relative z-10">Delete</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="absolute inset-0 border-0 group-hover:border group-hover:border-white group-hover:border-opacity-30 rounded-md transition-all duration-300"></div>
                      <div className="absolute inset-0 -translate-y-full group-hover:translate-y-0 bg-gradient-to-r from-red-300/20 to-rose-400/20 transition-transform duration-500"></div>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
);