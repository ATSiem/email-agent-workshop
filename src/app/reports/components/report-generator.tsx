'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUserAccessToken } from '~/lib/auth/microsoft';

interface Client {
  id: string;
  name: string;
  domains: string[];
  emails: string[];
}

interface Template {
  id: string;
  name: string;
  format: string;
  client_id: string | null;
}

interface ReportGeneratorProps {
  initialClientId?: string | null;
  onReportGenerated?: () => void;
}

export function ReportGenerator({ initialClientId, onReportGenerated }: ReportGeneratorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(initialClientId || null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  const [format, setFormat] = useState(`## Communication Report: {client_name} - {date_range}

### Summary
{summary}

### Key Topics Discussed
{key_topics}

### Key Technologies
{key_technologies}

### Action Items
{action_items}

### Next Steps
{next_steps}

### Open Questions
{open_questions}

<!-- 
Pro tip: You can create your own custom placeholders like {key_technologies}, {project_status}, 
{stakeholders}, {decision_summary}, etc. The AI will understand what content to generate!
This comment won't appear in the final report. 
-->`);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saveName, setSaveName] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [reportHighlights, setReportHighlights] = useState<string[]>([]);
  const [emailCount, setEmailCount] = useState(0);
  const [error, setError] = useState('');
  
  // Set default date range (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setEndDate(formatDateForInput(end));
    setStartDate(formatDateForInput(start));
  }, []);
  
  // Fetch clients
  useEffect(() => {
    async function fetchClients() {
      try {
        // Get the authentication token
        const token = getUserAccessToken();
        console.log('ReportGenerator - Access token available:', !!token);
        
        if (!token) {
          throw new Error('Authentication required. Please sign in again.');
        }
        
        const response = await fetch('/api/clients', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || data.error || 'Failed to fetch clients');
        }
        
        const data = await response.json();
        console.log('ReportGenerator - Clients data:', data);
        setClients(data.clients || []);
      } catch (err) {
        console.error('ReportGenerator - Error fetching clients:', err);
        setError(err.message || 'An error occurred loading clients');
      }
    }
    
    fetchClients();
  }, []);
  
  // Fetch templates when client changes
  useEffect(() => {
    if (!selectedClientId) {
      setTemplates([]);
      return;
    }
    
    async function fetchTemplates() {
      try {
        // Get the authentication token
        const token = getUserAccessToken();
        
        if (!token) {
          throw new Error('Authentication required. Please sign in again.');
        }
        
        const response = await fetch(`/api/templates?clientId=${selectedClientId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || data.error || 'Failed to fetch templates');
        }
        
        const data = await response.json();
        console.log('ReportGenerator - Templates data:', data);
        setTemplates(data.templates || []);
      } catch (err) {
        console.error('ReportGenerator - Error fetching templates:', err);
        setError(err.message || 'An error occurred loading templates');
      }
    }
    
    fetchTemplates();
  }, [selectedClientId]);
  
  // Load template when selected
  useEffect(() => {
    if (!selectedTemplateId) return;
    
    async function fetchTemplate() {
      try {
        // Get the authentication token
        const token = getUserAccessToken();
        
        if (!token) {
          throw new Error('Authentication required. Please sign in again.');
        }
        
        const response = await fetch(`/api/templates?id=${selectedTemplateId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || data.error || 'Failed to fetch template');
        }
        
        const template = await response.json();
        console.log('ReportGenerator - Template data:', template);
        setFormat(template.format);
        setSaveName(""); // Clear the save name field instead of adding "- Copy"
      } catch (err) {
        console.error('ReportGenerator - Error fetching template:', err);
        setError(err.message || 'An error occurred loading the template');
      }
    }
    
    fetchTemplate();
  }, [selectedTemplateId]);
  
  function formatDateForInput(date: Date): string {
    return date.toISOString().substring(0, 10);
  }
  
  async function handleGenerateReport(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setGeneratedReport(null);
    
    try {
      if (!selectedClientId) {
        throw new Error('Please select a client');
      }
      
      if (!startDate || !endDate) {
        throw new Error('Please specify a date range');
      }
      
      if (!format.trim()) {
        throw new Error('Please provide a report format');
      }
      
      setIsGenerating(true);
      
      // Get client details
      const client = clients.find(c => c.id === selectedClientId);
      
      if (!client) {
        throw new Error('Selected client not found');
      }
      
      // Get the authentication token
      const token = getUserAccessToken();
      console.log('ReportGenerator - Access token available for summarize:', !!token);
      
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }
      
      // Generate the report
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          startDate,
          endDate,
          format,
          clientId: selectedClientId,
          saveName: saveName || "",
        }),
      });
      
      const data = await response.json();
      console.log('ReportGenerator - Response received with status:', response.status);
      
      if (!response.ok) {
        console.error('ReportGenerator - Error response:', data);
        throw new Error(data.error || data.message || 'Failed to generate report');
      }
      console.log('ReportGenerator - Generated report data:', data);
      setGeneratedReport(data.report);
      setReportHighlights(data.highlights || []);
      setEmailCount(data.emailCount || 0);
      
      if (onReportGenerated) {
        onReportGenerated();
      }
    } catch (err) {
      console.error('ReportGenerator - Error generating report:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-medium mb-6 dark:text-white">Generate Client Report</h2>
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {generatedReport ? (
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4 dark:text-white">Generated Report</h3>
            
            <div className="prose dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: generatedReport.replace(/\n/g, '<br>') }} />
            </div>
            
            {reportHighlights.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-2 dark:text-white">Key Highlights:</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {reportHighlights.map((highlight, index) => (
                    <li key={index} className="text-gray-700 dark:text-gray-300">{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Generated from {emailCount} email{emailCount !== 1 ? 's' : ''} between {new Date(startDate).toLocaleDateString()} and {new Date(endDate).toLocaleDateString()}
            </div>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => setGeneratedReport(null)}
              className="px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Generate Another Report
            </button>
            
            <button
              onClick={() => {
                // Copy to clipboard
                navigator.clipboard.writeText(generatedReport);
                alert('Report copied to clipboard');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Copy to Clipboard
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerateReport} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Client *
              </label>
              <select
                id="clientId"
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              
              {clients.length === 0 && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  No clients available. <Link href="/reports" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">Add a client</Link> first.
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Template (Optional)
              </label>
              <select
                id="templateId"
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={!selectedClientId || templates.length === 0}
              >
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date *
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Report Format *
            </label>
            <textarea
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm font-mono dark:bg-gray-700 dark:text-white"
              placeholder="Enter your report format with placeholders like {summary}, {action_items}, etc."
              required
            />
            
            <details className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 font-medium">
              Use placeholders like {'{client_name}'}, {'{date_range}'}, {'{summary}'}, {'{key_topics}'}, {'{action_items}'}, {'{next_steps}'} in your format.
              </summary>
              <div className="pl-4 pt-2">
                <p className="mb-1">Common placeholders include:</p>
                <ul className="list-disc pl-5 space-y-1 mt-1">
                  <li>{'{client_name}'} - Client's name</li>
                  <li>{'{date_range}'} - Period covered by the report</li>
                  <li>{'{summary}'} - Overall communication summary</li>
                  <li>{'{key_topics}'} - Main topics discussed</li>
                  <li>{'{action_items}'} - Tasks to be completed</li>
                  <li>{'{next_steps}'} - Upcoming actions</li>
                </ul>
                <p className="mt-2"><strong>Pro tip:</strong> You can create your own custom placeholders like {'{key_technologies}'}, {'{project_status}'}, {'{stakeholders}'}, {'{open_questions}'}, etc. The AI will understand what content to generate!</p>
              </div>
            </details>
          </div>
          
          <div>
            <label htmlFor="saveName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Save As Template (Optional)
            </label>
            <input
              type="text"
              id="saveName"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Template name"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              If provided, this format will be saved for future use
            </p>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}