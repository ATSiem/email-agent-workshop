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
  
  // Set default date range (current week starting from Monday)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    
    // Get current day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const currentDay = start.getDay();
    
    // Calculate days to subtract to get to Monday
    // If today is Sunday (0), we need to go back 6 days to previous Monday
    // If today is Monday (1), we go back 0 days
    // If today is Tuesday (2), we go back 1 day, etc.
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
    
    // Set to the Monday of the current week
    start.setDate(start.getDate() - daysToSubtract);
    
    // Set to midnight on that day
    start.setHours(0, 0, 0, 0);
    
    setEndDate(formatDateForInput(end));
    setStartDate(formatDateForInput(start));
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
  
  async function handleGenerateReport(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      setIsGenerating(true);
      setGeneratedReport('');
      setReportHighlights([]);
      setError('');
      setEmailCount(0);
      setFromGraphApi(false);
      setShowFeedback(false);
      
      if (!selectedClientId) {
        throw new Error('Please select a client');
      }
      
      if (!startDate || !endDate) {
        throw new Error('Please select a date range');
      }
      
      // Get the authentication token
      const token = getUserAccessToken();
      console.log('ReportGenerator - Access token available:', !!token);
      
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }
      
      // Create a unique ID for this report
      const newReportId = crypto.randomUUID();
      
      // Record the start time for performance tracking
      const startTime = performance.now();
      
      console.log('ReportGenerator - Sending request to generate report');
      console.log('ReportGenerator - Request parameters:', {
        startDate,
        endDate,
        format: format,
        clientId: selectedClientId,
        saveName,
        examplePrompt,
        searchQuery,
        useVectorSearch,
        reportId: newReportId,
      });
      
      // Get user email from session storage for debugging
      const userEmail = typeof window !== 'undefined' ? sessionStorage.getItem('userEmail') : null;
      
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...(userEmail ? { 'X-User-Email': userEmail } : {})
        },
        body: JSON.stringify({
          startDate,
          endDate,
          format: format,
          clientId: selectedClientId,
          saveName,
          examplePrompt,
          searchQuery,
          useVectorSearch,
          reportId: newReportId,
        }),
      });
      
      const endTime = performance.now();
      const totalTime = Math.round(endTime - startTime);
      setGenerationTimeMs(totalTime);
      
      console.log('ReportGenerator - Response received with status:', response.status);
      
      // Handle 404 specifically (no emails found)
      if (response.status === 404) {
        throw new Error('No emails found for the selected client and date range.');
      }
      
      // Handle 401 specifically (authentication issues)
      if (response.status === 401) {
        throw new Error('Authentication required. Please sign in again.');
      }
      
      let data;
      try {
        const responseText = await response.text();
        try {
          data = JSON.parse(responseText);
          console.log('ReportGenerator - Response data:', data);
        } catch (parseError) {
          console.error('ReportGenerator - Failed to parse response as JSON:', responseText);
          throw new Error('Invalid response format from server');
        }
      } catch (responseError) {
        console.error('ReportGenerator - Error reading response:', responseError);
        throw new Error('Failed to read response from server');
      }
      
      if (!response.ok) {
        console.error('ReportGenerator - Error response:', data);
        throw new Error(data?.error || data?.message || `Failed to generate report (${response.status})`);
      }
      
      if (!data || !data.report) {
        console.error('ReportGenerator - Missing report data in response');
        throw new Error('Server returned an empty report');
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
      setError(err.message || 'An error occurred while generating the report');
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
      
      {generatedReport ? (
        <div className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4 dark:text-white">Generated Report</h3>
            
            <div className="prose dark:prose-invert max-w-none">
              <div dangerouslySetInnerHTML={{ __html: generatedReport.replace(/\n/g, '<br>') }} />
            </div>
            
            {/* Report metadata section removed */}
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => setGeneratedReport(null)}
              className="relative px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-md shadow-sm overflow-hidden group"
            >
              <span className="relative z-10">Generate Another Report</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 border-0 group-hover:border group-hover:border-white group-hover:border-opacity-30 rounded-md transition-all duration-300"></div>
              <div className="absolute inset-0 -translate-y-full group-hover:translate-y-0 bg-gradient-to-r from-blue-300/20 to-indigo-400/20 transition-transform duration-500"></div>
            </button>
            
            <button
              onClick={() => {
                // Copy to clipboard
                navigator.clipboard.writeText(generatedReport);
                setClipboardCopied(true);
                
                // Track clipboard copy in feedback data
                fetch('/api/feedback/action', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    reportId,
                    action: 'clipboard_copy',
                    timestamp: new Date().toISOString(),
                  }),
                }).catch(error => {
                  console.error('Error logging clipboard action:', error);
                });
                
                alert('Report copied to clipboard');
              }}
              className="relative px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 rounded-md shadow-sm overflow-hidden group"
            >
              <span className="relative z-10">Copy to Clipboard</span>
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 border-0 group-hover:border group-hover:border-white group-hover:border-opacity-30 rounded-md transition-all duration-300"></div>
              <div className="absolute inset-0 -translate-y-full group-hover:translate-y-0 bg-gradient-to-r from-green-300/20 to-emerald-400/20 transition-transform duration-500"></div>
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