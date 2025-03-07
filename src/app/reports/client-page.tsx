'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '~/components/auth-provider';
import { LoginButton } from '~/components/login-button';
import { ClientForm } from './components/client-form';
import { ReportGenerator } from './components/report-generator';
import { ClientList } from './components/client-list';
import { TemplateList } from './components/template-list';
import Link from 'next/link';
import { ThemeToggle } from '~/components/theme-provider';
import { getUserAccessToken } from '~/lib/auth/microsoft';

// Use the environment variable set at build time
const VERSION_TOKEN = process.env.VERSION_TOKEN || 'dev-build-local';

export function ClientPage() {
  const [activeView, setActiveView] = useState('clients'); // 'clients', 'templates', 'generate'
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clients, setClients] = useState([]);
  const clientListRef = useRef(null);
  
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();

  // Add event listener for navigation from client list
  useEffect(() => {
    const handleNavigateToGenerate = (event) => {
      const { clientId } = event.detail;
      setSelectedClientId(clientId);
      setActiveView('generate');
    };

    window.addEventListener('navigate-to-generate', handleNavigateToGenerate);
    
    return () => {
      window.removeEventListener('navigate-to-generate', handleNavigateToGenerate);
    };
  }, []);

  // Function to refresh the client list
  const refreshClientList = useCallback(() => {
    if (clientListRef.current && clientListRef.current.refreshClients) {
      console.log('Refreshing client list');
      clientListRef.current.refreshClients();
    } else {
      console.log('Client list ref not available for refresh');
    }
  }, []);

  // Fetch clients when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchClients();
    }
  }, [isAuthenticated]);

  // Fetch clients and select the first one if none is selected
  const fetchClients = async () => {
    try {
      const token = getUserAccessToken();
      
      const response = await fetch('/api/clients', {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
        
        // If we're switching to generate view and no client is selected, select the first one
        if (activeView === 'generate' && !selectedClientId && data.clients && data.clients.length > 0) {
          setSelectedClientId(data.clients[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  // When switching to generate view, fetch clients and select one if needed
  // When switching to clients view, refresh the client list
  useEffect(() => {
    if (activeView === 'generate' && isAuthenticated && !selectedClientId) {
      fetchClients();
    }
    
    // Refresh client list when switching to clients view
    if (activeView === 'clients' && isAuthenticated) {
      refreshClientList();
    }
  }, [activeView, isAuthenticated, selectedClientId, refreshClientList]);

  return (
    <div className="mx-auto mt-10 max-w-screen-lg">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">
            <span className="mr-2" role="img" aria-label="document">📊</span>
            Client Reports
            <div className="text-[8px] opacity-30 font-normal pl-1">{VERSION_TOKEN}</div>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {/* Dark mode toggle */}
          <ThemeToggle />
          
          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-200 transition-colors"
              >
                Settings
              </Link>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {user?.name || user?.username || 'Signed in'}
              </span>
              <button
                onClick={logout}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
      
      {!isAuthenticated ? (
        <div className="bg-blue-50 dark:bg-blue-950 p-8 rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Sign in to generate client reports</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            This feature requires you to authenticate with Microsoft to access your emails.
            Your data remains private and is only stored on your local device.
          </p>
          <div className="flex flex-col gap-4 items-center">
            <LoginButton />
          </div>
        </div>
      ) : (
        <>
          {/* Navigation tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveView('clients')}
                className={`py-2 px-3 text-sm font-medium border-b-2 ${
                  activeView === 'clients'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Clients
              </button>
              <button
                onClick={() => setActiveView('templates')}
                className={`py-2 px-3 text-sm font-medium border-b-2 ${
                  activeView === 'templates'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => setActiveView('generate')}
                className={`py-2 px-3 text-sm font-medium border-b-2 ${
                  activeView === 'generate'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Generate Report
              </button>
            </nav>
          </div>
          
          {/* Main content area */}
          <div className="min-h-[500px]">
            {activeView === 'clients' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <ClientForm 
                    onClientAdded={() => {
                      // Refresh the list when a client is added
                      refreshClientList();
                    }} 
                  />
                </div>
                <div className="md:col-span-2">
                  <ClientList 
                    ref={clientListRef}
                    onSelectClient={(clientId) => {
                      setSelectedClientId(clientId);
                      setActiveView('generate');
                    }} 
                  />
                </div>
              </div>
            )}
            
            {activeView === 'templates' && (
              <div className="grid grid-cols-1 gap-6">
                <TemplateList
                  onSelectTemplate={(templateId) => {
                    // Handle template selection
                    setActiveView('generate');
                  }}
                />
              </div>
            )}
            
            {activeView === 'generate' && (
              <>
                {!selectedClientId && clients.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-xl font-medium mb-6 dark:text-white">Generate Client Report</h2>
                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                      <p>No clients found. Please add a client first.</p>
                      <button
                        onClick={() => setActiveView('clients')}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      >
                        Go to Clients
                      </button>
                    </div>
                  </div>
                ) : (
                  <ReportGenerator 
                    initialClientId={selectedClientId}
                    onReportGenerated={() => {
                      // Handle report generation success
                    }}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}