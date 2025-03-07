'use client';

import React, { useState } from 'react';
import { getUserAccessToken } from '~/lib/auth/microsoft';
import { getUserEmail } from '~/lib/auth/microsoft';
import Link from 'next/link';

interface ClientFormProps {
  onClientAdded: () => void;
}

export function ClientForm({ onClientAdded }: ClientFormProps) {
  const [name, setName] = useState('');
  const [domains, setDomains] = useState('');
  const [emails, setEmails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [success, setSuccess] = useState(false);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setDebugInfo(null);
    setAuthError(false);
    setSuccess(false);
    
    try {
      setIsSubmitting(true);
      console.log('Client form submission started');
      
      // Validate inputs
      if (!name.trim()) {
        throw new Error('Client name is required');
      }
      
      // Parse domains and emails from comma-separated lists
      const domainList = domains.split(',')
        .map(d => d.trim().toLowerCase())
        .filter(d => d.length > 0);
        
      const emailList = emails.split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);
      
      console.log('Parsed inputs:', { name, domainList, emailList });
      
      // Validate at least one domain or email
      if (domainList.length === 0 && emailList.length === 0) {
        throw new Error('At least one domain or email is required');
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of emailList) {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }
      }
      
      // Get the authentication token
      const token = getUserAccessToken();
      console.log('Auth token retrieved:', token ? 'Present (not showing for security)' : 'Missing');
      
      if (!token) {
        setAuthError(true);
        throw new Error('Authentication required. Please sign in again.');
      }
      
      // Create the client
      console.log('Sending API request to create client');
      
      // Prepare request data
      const requestData = {
        name,
        domains: domainList,
        emails: emailList,
      };
      
      console.log('Request data:', JSON.stringify(requestData));
      
      try {
        // Get user email from session storage
        let userEmail = typeof window !== 'undefined' ? sessionStorage.getItem('userEmail') : null;
        
        // If not in session storage, try to get it from Graph API
        if (!userEmail) {
          console.log('User email not found in session storage, trying to get from Graph API');
          try {
            userEmail = await getUserEmail();
            console.log('User email from Graph API:', userEmail);
            
            // Store it in session storage for future use
            if (userEmail && typeof window !== 'undefined') {
              sessionStorage.setItem('userEmail', userEmail);
              console.log('Stored user email in session storage');
            }
          } catch (emailError) {
            console.error('Failed to get user email from Graph API:', emailError);
          }
        }
        
        // Log the user email for debugging
        console.log('User email for request:', userEmail);
        
        if (!userEmail) {
          console.warn('User email is missing from both session storage and Graph API');
        }
        
        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-User-Email': userEmail || '' // Always include the header even if empty
          },
          body: JSON.stringify(requestData),
          // Prevent caching
          cache: 'no-store'
        });
        
        console.log('API response status:', response.status);
        
        if (response.status === 401) {
          setAuthError(true);
          throw new Error('Authentication required. Please sign in again.');
        }
        
        let responseData;
        const responseText = await response.text();
        
        try {
          // Try to parse the response as JSON
          responseData = JSON.parse(responseText);
          console.log('Response data:', responseData);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', responseText);
          setDebugInfo(`Response was not valid JSON: ${responseText}`);
          responseData = { error: 'Invalid response format' };
        }
        
        if (!response.ok) {
          console.error('API error response:', responseData);
          
          // Collect detailed error information
          const errorDetails = [
            `Status: ${response.status}`,
            `Error: ${responseData.error || 'Unknown error'}`,
            `Message: ${responseData.message || 'No message provided'}`,
            responseData.details ? `Details: ${JSON.stringify(responseData.details)}` : ''
          ].filter(Boolean).join('\n');
          
          setDebugInfo(errorDetails);
          
          throw new Error(responseData.error || responseData.message || 'Failed to create client');
        }
        
        console.log('Client created successfully:', responseData);
        
        // Show success message
        setSuccess(true);
        
        // Reset form
        setName('');
        setDomains('');
        setEmails('');
        
        // Notify parent component with a small delay to ensure the API has time to process
        setTimeout(() => {
          console.log('Calling onClientAdded callback');
          onClientAdded();
        }, 500);
        
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      }
      
    } catch (err) {
      console.error('Client form error:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4 dark:text-white">Add New Client</h2>
      
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
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-md text-sm">
          Client added successfully!
        </div>
      )}
      
      {debugInfo && (
        <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-md text-sm whitespace-pre-wrap">
          <strong>Debug Info:</strong>
          <pre className="mt-1 text-xs">{debugInfo}</pre>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client Name *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="Acme Corporation"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="domains" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Domains (comma separated)
          </label>
          <input
            type="text"
            id="domains"
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="acme.com, acmecorp.net"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Email domains to match (e.g., &ldquo;acme.com&rdquo;)
          </p>
        </div>
        
        <div className="mb-4">
          <label htmlFor="emails" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Specific Emails (comma separated)
          </label>
          <input
            type="text"
            id="emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="john@example.com, jane@example.com"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Individual email addresses to match
          </p>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="relative px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-md shadow-sm overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10">{isSubmitting ? 'Adding...' : 'Add Client'}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 disabled:opacity-0"></div>
            <div className="absolute inset-0 border-0 group-hover:border group-hover:border-white group-hover:border-opacity-30 rounded-md transition-all duration-300"></div>
            <div className="absolute inset-0 -translate-y-full group-hover:translate-y-0 bg-gradient-to-r from-blue-300/20 to-indigo-400/20 transition-transform duration-500"></div>
          </button>
        </div>
      </form>
    </div>
  );
}