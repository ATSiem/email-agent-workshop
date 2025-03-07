'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getUserAccessToken } from '~/lib/auth/microsoft';
import { ReportFeedback } from '~/components/report-feedback';

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
  const [searchQuery, setSearchQuery] = useState('');
  
  // Default report format
  const defaultFormat = `## Communication Report: {client_name} - {date_range}

### Summary
{summary}

### Key Topics Discussed
{key_topics}

### Significant Strategy Changes
{strategy_changes}

### Current Strategy vs Previous Approaches
{strategy_comparison}

### Key Technologies
{key_technologies}

### Action Items
{action_items}

### Next Steps
{next_steps}

### Open Questions
{open_questions}`;
  
  const [format, setFormat] = useState(defaultFormat);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saveName, setSaveName] = useState('');
  const [examplePrompt, setExamplePrompt] = useState('');
  const [useVectorSearch, setUseVectorSearch] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);
  const [reportHighlights, setReportHighlights] = useState<string[]>([]);
  const [emailCount, setEmailCount] = useState(0);
  const [fromGraphApi, setFromGraphApi] = useState(false);
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [error, setError] = useState('');
  
  // Feedback-related states
  const [showFeedback, setShowFeedback] = useState(false);
  const [reportId, setReportId] = useState<string>('');
  const [generationTimeMs, setGenerationTimeMs] = useState<number>(0);
  const [clipboardCopied, setClipboardCopied] = useState(false);
  
  // Add new state variables for email processing
  const [isProcessingEmails, setIsProcessingEmails] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{
    taskId?: string;
    progress: number;
    totalEmails: number;
    processedEmails: number;
    isComplete: boolean;
  } | null>(null);
  
  // Set default date range (current week starting from Monday)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    
    // Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const currentDay = start.getDay();
    
    // Calculate days to subtract to get to Monday
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
    start.setDate(start.getDate() - daysToSubtract);
    
    // Set time to start of day for start date and end of day for end date
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Format dates for input fields
    setStartDate(formatDateForInput(start));
    setEndDate(formatDateForInput(end));
  }, []);
  
  // Graph API notice has been removed
  
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
      setClientEmails([]);
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
        
        // Get client details to set emails
        const selectedClient = clients.find(c => c.id === selectedClientId);
        if (selectedClient && selectedClient.emails) {
          console.log('ReportGenerator - Setting client emails:', selectedClient.emails);
          setClientEmails(selectedClient.emails);
        } else {
          setClientEmails([]);
        }
      } catch (err) {
        console.error('ReportGenerator - Error fetching templates:', err);
        setError(err.message || 'An error occurred loading templates');
      }
    }
    
    fetchTemplates();
  }, [selectedClientId, clients]);
  
  // Load template when selected
  useEffect(() => {
    if (!selectedTemplateId) {
      // Reset to default format when no template is selected
      setFormat(defaultFormat);
      setExamplePrompt("");
      return;
    }
    
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
        
        // Set example prompt if available
        if (template.example_prompt) {
          setExamplePrompt(template.example_prompt);
        } else {
          setExamplePrompt("");
        }
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
  
  // Add a new function to start email processing
  async function handleProcessEmails() {
    if (!selectedClientId || !startDate || !endDate) {
      setError('Please select a client and date range');
      return;
    }
    
    setError('');
    setIsProcessingEmails(true);
    setProcessingStatus({
      progress: 0,
      totalEmails: 0,
      processedEmails: 0,
      isComplete: false
    });
    
    try {
      const token = getUserAccessToken();
      
      if (!token) {
        setError('Authentication required. Please sign in again.');
        setIsProcessingEmails(false);
        return;
      }
      
      // Call the process-emails API to start background processing
      const response = await fetch('/api/system/process-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          startDate,
          endDate,
          maxResults: 1000 // Allow processing more emails in the background
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process emails');
      }
      
      const data = await response.json();
      console.log('Email processing started:', data);
      
      // Start polling for status updates
      if (data.taskId) {
        pollProcessingStatus(data.taskId);
      }
    } catch (err) {
      console.error('Error processing emails:', err);
      setError(err.message || 'An error occurred while processing emails');
      setIsProcessingEmails(false);
    }
  }
  
  async function pollProcessingStatus(taskId: string) {
    try {
      const token = getUserAccessToken();
      
      if (!token) {
        setError('Authentication required. Please sign in again.');
        setIsProcessingEmails(false);
        return;
      }
      
      const response = await fetch(`/api/system/process-status?taskId=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get processing status');
      }
      
      const data = await response.json();
      console.log('Processing status:', data);
      
      if (data.found) {
        setProcessingStatus({
          taskId,
          progress: data.progress,
          totalEmails: data.totalEmails,
          processedEmails: data.processedEmails,
          isComplete: data.isComplete
        });
        
        // Continue polling if not complete
        if (!data.isComplete && !data.isFailed) {
          setTimeout(() => pollProcessingStatus(taskId), 2000);
        } else {
          setIsProcessingEmails(false);
          
          if (data.isFailed) {
            setError(`Email processing failed: ${data.error || 'Unknown error'}`);
          }
        }
      } else {
        setIsProcessingEmails(false);
        setError('Email processing task not found');
      }
    } catch (err) {
      console.error('Error polling status:', err);
      setError(err.message || 'An error occurred while checking processing status');
      setIsProcessingEmails(false);
    }
  }
  
  // Modify the existing handleGenerateReport function
  async function handleGenerateReport(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedClientId || !selectedTemplateId || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }
    
    setError('');
    setIsGenerating(true);
    setGeneratedReport(null);
    setReportHighlights([]);
    setEmailCount(0);
    setFromGraphApi(false);
    
    const startTime = Date.now();
    
    try {
      const token = getUserAccessToken();
      
      if (!token) {
        setError('Authentication required. Please sign in again.');
        setIsGenerating(false);
        return;
      }
      
      // Get the selected client
      const client = clients.find(c => c.id === selectedClientId);
      
      if (!client) {
        setError('Selected client not found');
        setIsGenerating(false);
        return;
      }
      
      // Prepare request body
      const requestBody = {
        clientId: selectedClientId,
        templateId: selectedTemplateId,
        startDate,
        endDate,
        format,
        saveName: saveName || `${client.name} Report - ${startDate} to ${endDate}`,
        examplePrompt,
        useVectorSearch,
        searchQuery,
        skipGraphApi: isProcessingEmails || processingStatus?.isComplete // Skip Graph API if we've processed emails
      };
      
      console.log('Generating report with params:', requestBody);
      
      // Call the summarize API
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }
      
      const endTime = Date.now();
      const totalTime = Math.round(endTime - startTime);
      setGenerationTimeMs(totalTime);
      
      let data;
      let responseText;
      
      try {
        responseText = await response.text();
        try {
          data = JSON.parse(responseText);
          console.log('ReportGenerator - Response data:', data);
        } catch (parseError) {
          console.error('ReportGenerator - Failed to parse response as JSON:', responseText);
          throw new Error('Invalid response format from server. Please try again or contact support.');
        }
      } catch (responseError) {
        console.error('ReportGenerator - Error reading response:', responseError);
        throw new Error('Failed to read response from server. Please try again or contact support.');
      }
      
      if (!data || !data.report) {
        console.error('ReportGenerator - Missing report data in response');
        throw new Error('Server returned an empty report. Please try again.');
      }
      
      console.log('ReportGenerator - Generated report data:', data);
      setGeneratedReport(data.report);
      setReportHighlights(data.highlights || []);
      setEmailCount(data.emailCount || 0);
      
      // Check if any emails came from Graph API
      if (data.fromGraphApi) {
        console.log('Report includes emails from Microsoft Graph API');
        setFromGraphApi(true);
      } else {
        setFromGraphApi(false);
      }
      
      // Show feedback prompt after 10 seconds to allow user to read the report
      setTimeout(() => {
        setShowFeedback(true);
      }, 10000);
      
      // Notify parent component if callback provided
      if (onReportGenerated) {
        onReportGenerated();
      }
    } catch (err) {
      console.error('ReportGenerator - Error generating report:', err);
      
      // Provide more helpful error messages
      let errorMessage = err.message || 'An error occurred while generating the report';
      
      // Add suggestions for common errors
      if (errorMessage.includes('Failed to read response from server')) {
        errorMessage += '\n\nThis could be due to a timeout or server error. Try:\n' +
                        '1. Selecting a smaller date range\n' +
                        '2. Using a simpler report template\n' +
                        '3. Trying again in a few minutes';
      } else if (errorMessage.includes('OpenAI API')) {
        errorMessage += '\n\nThere may be an issue with the OpenAI API. Please contact the administrator.';
      } else if (errorMessage.includes('timed out')) {
        errorMessage += '\n\nTry selecting a smaller date range or using a simpler report template.';
      }
      
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-medium mb-6 dark:text-white">Generate Client Report</h2>
      
      {/* Feedback popup when shown */}
      {showFeedback && generatedReport && (
        <ReportFeedback
          reportId={reportId}
          clientId={selectedClientId}
          onClose={() => setShowFeedback(false)}
          reportParameters={{
            startDate,
            endDate,
            vectorSearchUsed: useVectorSearch,
            searchQuery: searchQuery || undefined,
            emailCount,
          }}
        />
      )}
      
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {selectedClientId && (
        <form onSubmit={handleGenerateReport} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="client" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                id="client"
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value || null)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                required
              >
                <option value="">Select a client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Template
              </label>
              <select
                id="templateId"
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={!selectedClientId}
              >
                <option value="">Default</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                required
              />
            </div>
          </div>
          
          <div className="mt-4">
            <button
              type="button"
              onClick={handleProcessEmails}
              disabled={isProcessingEmails || !selectedClientId || !startDate || !endDate}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessingEmails ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Emails...
                </>
              ) : processingStatus?.isComplete ? (
                <>
                  <svg className="h-4 w-4 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Emails Processed
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Process Emails
                </>
              )}
            </button>
            
            {/* Processing Status */}
            {isProcessingEmails && processingStatus && (
              <div className="mt-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Processing {processingStatus.processedEmails} of {processingStatus.totalEmails || '?'} emails ({processingStatus.progress}%)
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1 dark:bg-gray-700">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${processingStatus.progress}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            {processingStatus?.isComplete && (
              <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                Successfully processed {processingStatus.processedEmails} emails. You can now generate a report without timeouts.
              </div>
            )}
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
                  <li>{'{client_name}'} - Client&apos;s name</li>
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
          
          <div className="space-y-4">
            <div>
              <label htmlFor="examplePrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Example/Instructions (Optional)
              </label>
              <textarea
                id="examplePrompt"
                value={examplePrompt}
                onChange={(e) => setExamplePrompt(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Provide examples or specific instructions for how to identify strategy changes or what to focus on in communications"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add examples of what you&apos;re looking for or specific instructions to enhance report quality
              </p>
            </div>

            <div>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-3">
                  <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Search Filter (Optional)
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer group relative">
                    <input
                      type="checkbox"
                      checked={useVectorSearch}
                      onChange={(e) => setUseVectorSearch(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Use AI search</span>
                    <div className="absolute bottom-full left-0 mb-2 w-72 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10">
                      AI search uses advanced technology to find related concepts, not just exact keyword matches. For example, searching for "pricing" could find discussions about "cost", "budget", or "financial considerations".
                    </div>
                  </label>
                </div>
                <input
                  type="text"
                  id="searchQuery"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder={useVectorSearch ? "Enter search terms (AI will find related concepts)" : "Enter keywords to filter emails"}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {useVectorSearch 
                    ? "AI search finds semantically related emails, even without exact keyword matches (e.g., searching for 'pricing' will find 'budget', 'cost', etc.)"
                    : "Standard search finds emails containing your exact keywords. Enable AI search for more comprehensive results."}
                </p>
              </div>
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
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isGenerating}
              className="relative px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-md shadow-sm overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10">{isGenerating ? 'Processing emails & generating report...' : 'Generate Report'}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 disabled:opacity-0"></div>
              <div className="absolute inset-0 border-0 group-hover:border group-hover:border-white group-hover:border-opacity-30 rounded-md transition-all duration-300"></div>
              <div className="absolute inset-0 -translate-y-full group-hover:translate-y-0 bg-gradient-to-r from-blue-300/20 to-indigo-400/20 transition-transform duration-500"></div>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}