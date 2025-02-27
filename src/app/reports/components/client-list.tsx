'use client';

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { getUserAccessToken } from '~/lib/auth/microsoft';

interface Client {
  id: string;
  name: string;
  domains: string[];
  emails: string[];
}

interface ClientListProps {
  onSelectClient: (clientId: string) => void;
  id?: string;
}

export function ClientList({ onSelectClient, id }: ClientListProps) {
  // Add a ref to expose methods to the parent
  const ref = useRef<HTMLDivElement>(null);
  
  // Expose the refresh method through DOM for parent access
  useEffect(() => {
    if (ref.current && id) {
      // Add refreshClients method to the DOM element
      (ref.current as any).refreshClients = fetchClients;
    }
  }, []);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  async function fetchClients() {
    try {
      setIsLoading(true);
      setError('');
      
      // Get the authentication token
      const token = getUserAccessToken();
      console.log('ClientList - Access token available:', !!token);
      
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }
      
      console.log('ClientList - Fetching clients');
      const response = await fetch('/api/clients', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        // Prevent caching issues
        cache: 'no-store'
      });
      console.log('ClientList - Response status:', response.status);
      
      const data = await response.json();
      console.log('ClientList - Response data:', data);
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to fetch clients');
      }
      
      setClients(data.clients || []);
    } catch (err) {
      console.error('ClientList - Error fetching clients:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }
  
  useEffect(() => {
    fetchClients();
  }, []);
  
  async function handleDeleteClient(clientId: string) {
    if (!confirm('Are you sure you want to delete this client? This will also delete any associated templates.')) {
      return;
    }
    
    try {
      // Get the authentication token
      const token = getUserAccessToken();
      console.log('ClientList - Access token available for delete:', !!token);
      
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }
      
      const response = await fetch(`/api/clients?id=${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        // Prevent caching issues
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete client');
      }
      
      // Refresh client list
      fetchClients();
    } catch (err) {
      console.error('ClientList - Error deleting client:', err);
      setError(err.message || 'An error occurred');
    }
  }
  
  if (isLoading) {
    return (
      <div ref={ref} id={id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4 dark:text-white">Your Clients</h2>
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">
          Loading clients...
        </div>
      </div>
    );
  }
  
  return (
    <div ref={ref} id={id} className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium dark:text-white">Your Clients</h2>
      </div>
      
      {error && (
        <div className="p-4 m-4 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {clients.length === 0 ? (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          No clients found. Add your first client to get started.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {clients.map((client) => (
            <li key={client.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">{client.name}</h3>
                  
                  {client.domains.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Domains: </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {client.domains.join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {client.emails.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Emails: </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {client.emails.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => onSelectClient(client.id)}
                    className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-md hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                  >
                    Generate Report
                  </button>
                  <button
                    onClick={() => handleDeleteClient(client.id)}
                    className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded-md hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}