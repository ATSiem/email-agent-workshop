'use client';

import React, { useState } from 'react';
import { getUserAccessToken } from '~/lib/auth/microsoft';

interface ClientFormProps {
  onClientAdded: () => void;
}

export function ClientForm({ onClientAdded }: ClientFormProps) {
  const [name, setName] = useState('');
  const [domains, setDomains] = useState('');
  const [emails, setEmails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Function to normalize domain format
  const normalizeDomain = (domain: string): string => {
    // Remove @ prefix if present
    let normalizedDomain = domain.startsWith('@') ? domain.substring(1) : domain;
    
    // Ensure domain has at least one dot (unless it's a simple name like 'localhost')
    if (!normalizedDomain.includes('.') && normalizedDomain !== 'localhost') {
      // If no dot, assume it's a TLD and add .com (e.g., "acme" becomes "acme.com")
      normalizedDomain = `${normalizedDomain}.com`;
    }
    
    return normalizedDomain.toLowerCase();
  };
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    try {
      setIsSubmitting(true);
      
      // Validate inputs
      if (!name.trim()) {
        throw new Error('Client name is required');
      }
      
      // Parse domains and emails from comma-separated lists
      const rawDomainList = domains.split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0);
      
      // Normalize domain formats
      const domainList = rawDomainList.map(normalizeDomain);
        
      const emailList = emails.split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);
      
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
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }
      
      // Create the client
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          domains: domainList,
          emails: emailList,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create client');
      }
      
      // Show success message
      setSuccessMessage(`Client "${name}" added successfully!`);
      
      // Reset form
      setName('');
      setDomains('');
      setEmails('');
      
      // Notify parent component
      onClientAdded();
      
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-medium mb-4 dark:text-white">Add New Client</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-md text-sm">
          {successMessage}
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
            Email domains to match (e.g., &ldquo;acme.com&rdquo;). You can enter with or without @ prefix.
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {isSubmitting ? 'Adding...' : 'Add Client'}
          </button>
        </div>
      </form>
    </div>
  );
}