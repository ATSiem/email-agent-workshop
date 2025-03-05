'use client';

import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getUserAccessToken } from '~/lib/auth/microsoft';

interface ReportFeedbackProps {
  reportId: string;        // Unique ID for the generated report
  clientId: string | null; // Client the report was generated for
  onClose: () => void;     // Callback when feedback is completed
  reportParameters: {      // Parameters used to generate report
    startDate: string;
    endDate: string;
    vectorSearchUsed: boolean;
    searchQuery?: string;
    emailCount: number;
  };
}

export function ReportFeedback({ 
  reportId, 
  clientId, 
  onClose,
  reportParameters
}: ReportFeedbackProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionsTaken, setActionsTaken] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Animation timer
  // Initially start expanded
  useEffect(() => {
    setIsCollapsed(false);
  }, []);
  
  // Setup animation for the tab when collapsed
  useEffect(() => {
    if (isCollapsed && !submitted) {
      // Setup animation interval to nudge the panel periodically
      const animationInterval = setInterval(() => {
        setShouldAnimate(true);
        // Reset animation after 800ms to allow it to play again later
        setTimeout(() => setShouldAnimate(false), 800);
      }, 10000); // Run every 10 seconds
      
      return () => clearInterval(animationInterval);
    }
  }, [isCollapsed, submitted]);

  // Handle checkbox changes
  const toggleAction = (action: string) => {
    setActionsTaken(prev => 
      prev.includes(action) 
        ? prev.filter(a => a !== action) 
        : [...prev, action]
    );
  };

  // Submit feedback to API
  const handleSubmit = async () => {
    if (rating === null) return;
    
    setLoading(true);
    
    try {
      // Get the authentication token
      const token = getUserAccessToken();
      
      if (!token) {
        console.error('Authentication required. Please sign in again.');
        setError('Authentication required. Please sign in again.');
        setLoading(false);
        return;
      }
      
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reportId,
          clientId,
          rating,
          feedbackText,
          actionsTaken,
          reportParameters,
          timestamp: new Date().toISOString(),
        }),
      });
      
      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // Log the response status
        console.error(`Error submitting feedback: ${response.status} ${response.statusText}`);
        
        // Try to get response text instead of JSON
        try {
          const errorText = await response.text();
          if (errorText) {
            console.error('Error response:', errorText);
            // Try to parse as JSON if it looks like JSON
            if (errorText.startsWith('{') || errorText.startsWith('[')) {
              try {
                const errorData = JSON.parse(errorText);
                console.error('Parsed error data:', errorData);
              } catch (e) {
                // Not valid JSON, already logged as text
              }
            }
          }
        } catch (textError) {
          console.error('Could not read error response');
        }
        
        alert('There was an error submitting your feedback. We still appreciate your input!');
        // Still mark as submitted so user doesn't get stuck
        setSubmitted(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  // Skip feedback
  const handleSkip = () => {
    // Get the authentication token
    const token = getUserAccessToken();
    
    if (!token) {
      console.error('Authentication required. Please sign in again.');
      setError('Authentication required. Please sign in again.');
      return;
    }
    
    // Still log that feedback was skipped
    fetch('/api/feedback/skip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        reportId,
        clientId,
        reportParameters,
        timestamp: new Date().toISOString(),
      }),
    }).catch(error => {
      console.error('Error logging skipped feedback:', error);
    });
    
    onClose();
  };

  return (
    <div className={`fixed right-0 top-1/2 transform -translate-y-1/2 z-50 flex transition-all duration-300 ease-in-out ${
      shouldAnimate ? 'animate-pulse' : ''
    }`}>
      {/* Tab to expand/collapse */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="bg-blue-600 text-white p-2 rounded-l-md self-center focus:outline-none hover:bg-blue-700 transition-colors"
        aria-label={isCollapsed ? "Expand feedback panel" : "Collapse feedback panel"}
      >
        {isCollapsed ? <ChevronLeftIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
      </button>
      
      {/* Main feedback panel */}
      <div 
        className={`bg-white dark:bg-gray-800 shadow-lg p-5 border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-0 opacity-0 p-0 border-0 invisible' : 'w-80 opacity-100 visible'
        }`}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium dark:text-white">Feedback</h3>
          <button 
            onClick={handleSkip}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        
        {submitted ? (
          <div className="text-center py-4">
            <p className="text-green-600 dark:text-green-400 font-medium mb-1">
              Thank you for your feedback!
            </p>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Your input helps us improve our report generation.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                <p className="text-sm">{error}</p>
                <p className="text-xs mt-1">Please try refreshing the page and signing in again.</p>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                How helpful was this report?
              </label>
              <div className="flex justify-between space-x-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`flex-1 py-1.5 border rounded-md text-sm ${
                      rating === value
                        ? 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:border-blue-400 dark:text-blue-300'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">
                <span>Not helpful</span>
                <span>Very helpful</span>
              </div>
            </div>
            
            <div className="mb-4">
              <details className="text-sm">
                <summary className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                  How did you use this report? (Optional)
                </summary>
                <div className="mt-2 pl-1 space-y-1.5">
                  {[
                    'Copied to clipboard',
                    'Sent to client',
                    'Edited further',
                    'Used in email',
                    'Used in a meeting',
                    'Saved for reference'
                  ].map((action) => (
                    <label key={action} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={actionsTaken.includes(action)}
                        onChange={() => toggleAction(action)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{action}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Additional comments (Optional)
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                placeholder="What worked well? What could be improved?"
              />
            </div>
            
            <div className="flex justify-between">
              <button
                type="button"
                onClick={handleSkip}
                className="px-3 py-1.5 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 text-sm"
              >
                Later
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={rating === null || loading}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 text-sm"
              >
                {loading ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}