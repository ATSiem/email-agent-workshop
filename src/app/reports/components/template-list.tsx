'use client';

import React, { useState, useEffect } from 'react';

interface Template {
  id: string;
  name: string;
  format: string;
  client_id: string | null;
  client_name: string | null;
}

interface TemplateListProps {
  onSelectTemplate: (templateId: string) => void;
}

export function TemplateList({ onSelectTemplate }: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  async function fetchTemplates() {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch('/api/templates');
      
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }
  
  useEffect(() => {
    fetchTemplates();
  }, []);
  
  async function handleDeleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/templates?id=${templateId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
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
      
      {error && (
        <div className="p-4 m-4 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-sm">
          {error}
        </div>
      )}
      
      {templates.length === 0 ? (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          No templates found. Create a template when generating a report.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {templates.map((template) => (
            <li key={template.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">{template.name}</h3>
                  
                  {template.client_name && (
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Client: {template.client_name}
                    </div>
                  )}
                  
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-sm font-mono text-gray-700 dark:text-gray-300 overflow-hidden overflow-ellipsis whitespace-pre-wrap max-h-24">
                    {template.format}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}