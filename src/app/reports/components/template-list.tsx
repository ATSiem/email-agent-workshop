'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon } from 'lucide-react';
import { useAuth } from '~/components/auth-provider';

interface Template {
  id: string;
  name: string;
  format: string;
  client_id: string | null;
  client_name: string | null;
  example_prompt?: string | null;
  expanded?: boolean;
}

interface TemplateListProps {
  onSelectTemplate: (templateId: string) => void;
}

export function TemplateList({ onSelectTemplate }: TemplateListProps) {
  const { isAuthenticated } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  async function fetchTemplates() {
    try {
      setIsLoading(true);
      setError('');
      
      // Get token from sessionStorage for authentication
      const token = sessionStorage.getItem('msGraphToken');
      
      const response = await fetch('/api/templates', {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in first.');
        }
        throw new Error('Failed to fetch templates');
      }
      
      const data = await response.json();
      
      // Log the full response for debugging
      console.log('Templates API response:', data);
      
      // More robust handling of different response formats
      let templatesData = [];
      
      if (data.templates && Array.isArray(data.templates)) {
        // Standard format with templates property
        templatesData = data.templates;
      } else if (Array.isArray(data)) {
        // Direct array format
        templatesData = data;
      } else {
        console.error('Unexpected response format:', data);
        throw new Error('Invalid response format from server');
      }
      
      // Validate that we have the expected fields in each template
      if (templatesData.length > 0) {
        const requiredFields = ['id', 'name', 'format'];
        const firstTemplate = templatesData[0];
        
        const missingFields = requiredFields.filter(field => !(field in firstTemplate));
        if (missingFields.length > 0) {
          console.error(`Templates missing required fields: ${missingFields.join(', ')}`, firstTemplate);
          throw new Error('Invalid template data: missing required fields');
        }
      }
      
      // Initialize all templates with expanded=false
      const templatesWithState = templatesData.map((template: Template) => ({
        ...template,
        expanded: false
      }));
      
      setTemplates(templatesWithState);
      // Clear any error if we successfully fetched (even if the array is empty)
      setError('');
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }
  
  useEffect(() => {
    if (isAuthenticated) {
      fetchTemplates();
    } else {
      setIsLoading(false);
      setError('Please sign in to view templates');
    }
  }, [isAuthenticated]);
  
  // Toggle template expanded state
  function toggleTemplate(id: string) {
    setTemplates(templates.map(template => 
      template.id === id 
        ? { ...template, expanded: !template.expanded } 
        : template
    ));
  }
  
  async function handleDeleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      // Get token from sessionStorage for authentication
      const token = sessionStorage.getItem('msGraphToken');
      
      const response = await fetch(`/api/templates?id=${templateId}`, {
        method: 'DELETE',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required. Please sign in first.');
        }
        throw new Error('Failed to delete template');
      }
      
      // Refresh template list
      fetchTemplates();
    } catch (err) {
      setError(err.message || 'An error occurred');
    }
  }
  
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4 dark:text-white">Your Report Templates</h2>
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">
          Loading templates...
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium dark:text-white">Report Templates</h2>
      </div>
      
      {error && !isLoading && (
        <div className="p-4 m-4 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {!isLoading && templates.length === 0 && !error && (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          No templates found. Create a template when generating a report.
        </div>
      )}
      
      {!isLoading && templates.length > 0 && (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {templates.map((template) => (
            <li key={template.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex-1 flex items-start cursor-pointer"
                      onClick={() => toggleTemplate(template.id)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTemplate(template.id);
                        }}
                        className="mr-2 text-gray-600 p-1 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 flex-shrink-0"
                      >
                        {template.expanded ? (
                          <ChevronDownIcon className="h-5 w-5" />
                        ) : (
                          <ChevronUpIcon className="h-5 w-5" />
                        )}
                      </button>
                      
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{template.name}</h3>
                        
                        {template.client_name && (
                          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Client: {template.client_name}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => onSelectTemplate(template.id)}
                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-md hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded-md hover:bg-red-100 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  {/* Accordion content */}
                  <div className={`overflow-hidden transition-all duration-300 ${
                    template.expanded ? 'max-h-96 mt-4' : 'max-h-0'
                  }`}>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-sm font-mono text-gray-700 dark:text-gray-300 overflow-hidden whitespace-pre-wrap">
                      <h4 className="font-semibold text-xs text-gray-500 dark:text-gray-400 mb-2">TEMPLATE FORMAT:</h4>
                      {template.format}
                      
                      {template.example_prompt && (
                        <>
                          <h4 className="font-semibold text-xs text-gray-500 dark:text-gray-400 mt-4 mb-2">EXAMPLES/INSTRUCTIONS:</h4>
                          <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 p-2 rounded-md">
                            {template.example_prompt}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* No preview when collapsed */}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}