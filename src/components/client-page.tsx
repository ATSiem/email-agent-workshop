'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from "~/lib/utils";
import { SyncButton } from "~/components/sync-button";
import DemoNotice from "~/components/demo-notice";
import { LoginButton } from "~/components/login-button";
import { useAuth } from './auth-provider';
import { Moon, Sun } from 'lucide-react';

export default function ClientPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [allLabels, setAllLabels] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const modalRef = useRef(null);
  
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  
  // Set up dark mode with system preference as default
  useEffect(() => {
    // Check if user preference is stored
    const savedMode = localStorage.getItem('darkMode');
    
    if (savedMode !== null) {
      // Use saved preference if available
      setDarkMode(savedMode === 'true');
    } else {
      // Otherwise check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
    }
  }, []);
  
  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save preference to localStorage
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Fetch messages on client side - re-fetch when auth state changes
  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) {
      setLoading(false);
      setMessages([]);
      return;
    }
    
    // Reset loading state when auth changes
    setLoading(true);
    
    // Add a small delay to prevent Safari hydration issues
    const timer = setTimeout(() => {
      async function fetchMessages() {
        try {
          // Get the token from session storage
          const msGraphToken = sessionStorage.getItem('msGraphToken');
          
          const response = await fetch('/api/messages', {
            headers: {
              'Authorization': msGraphToken ? `Bearer ${msGraphToken}` : ''
            }
          });
          const data = await response.json();
          const fetchedMessages = data.messages || [];
          setMessages(fetchedMessages);
          
          // Extract all unique labels from messages
          const labelSet = new Set();
          fetchedMessages.forEach(message => {
            const labels = typeof message.labels === 'string' 
              ? JSON.parse(message.labels) 
              : (Array.isArray(message.labels) ? message.labels : []);
            
            labels.forEach(label => labelSet.add(label));
          });
          
          setAllLabels(Array.from(labelSet).sort());
        } catch (error) {
          console.error('Error fetching messages:', error);
        } finally {
          setLoading(false);
        }
      }

      fetchMessages();
    }, 50); // Small delay

    return () => clearTimeout(timer);
  }, [isAuthenticated]); // Re-fetch when auth changes

  // Handle keyboard navigation and close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setSelectedMessage(null);
      }
    }
    
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        // Close modal on Escape key
        setSelectedMessage(null);
      } else if (selectedMessage && messages.length > 0) {
        // Find current message index
        const currentIndex = messages.findIndex(msg => msg.id === selectedMessage.id);
        
        // Navigate between messages with arrow keys
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          if (currentIndex < messages.length - 1) {
            setSelectedMessage(messages[currentIndex + 1]);
          }
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          if (currentIndex > 0) {
            setSelectedMessage(messages[currentIndex - 1]);
          }
        }
      }
    }
    
    // Add event listeners when the modal is shown
    if (selectedMessage) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedMessage, messages]);

  return (
    <div className="mx-auto mt-10 max-w-screen-lg">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Personal Email Agent</h1>
        <div className="flex items-center gap-4">
          {/* Dark mode toggle */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          {isAuthenticated && (
            <div className="flex items-center gap-2">
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
      
      {/* Email Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div 
            ref={modalRef}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300"
          >
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white dark:bg-gray-900 dark:border-gray-700 z-10">
              <h3 className="font-medium dark:text-white">{selectedMessage.subject}</h3>
              <button 
                onClick={() => setSelectedMessage(null)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 border-b text-sm text-gray-600 dark:text-gray-300 dark:border-gray-700">
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-2 font-medium dark:text-gray-200">From:</div>
                <div className="col-span-10">{selectedMessage.from}</div>
              </div>
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-2 font-medium dark:text-gray-200">To:</div>
                <div className="col-span-10">{selectedMessage.to}</div>
              </div>
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-2 font-medium dark:text-gray-200">Date:</div>
                <div className="col-span-10">{new Date(selectedMessage.date).toLocaleString()}</div>
              </div>
            </div>
            
            <div className="p-4 overflow-auto flex-grow">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {selectedMessage.body}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!isAuthenticated ? (
        <div className="bg-blue-50 dark:bg-blue-950 p-8 rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Sign in to access your emails</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            This application requires you to authenticate with Microsoft to access your emails.
            Your data remains private and is only stored on your local device.
          </p>
          <LoginButton />
        </div>
      ) : (
        <>
          <DemoNotice />
          <SyncButton refreshCallback={() => window.location.reload()} />
          
          {/* Category filters */}
          {allLabels.length > 0 && (
            <div className="mb-6 overflow-x-auto">
              <div className="flex gap-2 items-center py-2">
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by:</span>
                <div className="flex gap-2 flex-wrap">
                  <button
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${activeFilters.length === 0 
                      ? 'bg-blue-600 text-white dark:bg-blue-500 shadow-sm ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                    onClick={() => setActiveFilters([])}
                  >
                    All
                  </button>
                  
                  {allLabels.map(label => (
                    <button
                      key={label}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${activeFilters.includes(label) 
                        ? 'bg-blue-600 text-white dark:bg-blue-500 shadow-sm ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-900' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                      onClick={() => {
                        if (activeFilters.includes(label)) {
                          setActiveFilters(activeFilters.filter(f => f !== label));
                        } else {
                          setActiveFilters([...activeFilters, label]);
                        }
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
      
      {loading ? (
        <div className="flex min-h-screen flex-col items-center justify-center py-10 text-center">
          <p className="text-muted-foreground dark:text-gray-400">Loading messages...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="flex min-h-screen flex-col items-center justify-center py-10 text-center">
          <h2 className="mb-2 text-xl font-semibold dark:text-white">No messages found</h2>
          <p className="text-muted-foreground dark:text-gray-400">
            Use the sync button to load email data.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
          {messages.map((message) => {
            // Parse the labels from string if needed
            const labels = typeof message.labels === 'string' 
              ? JSON.parse(message.labels) 
              : (Array.isArray(message.labels) ? message.labels : []);
              
            // Skip this message if filters are active and message doesn't match
            if (activeFilters.length > 0 && !activeFilters.some(filter => labels.includes(filter))) {
              return null;
            }
            
            // Format date for display
            const messageDate = new Date(message.date);
            const formattedDate = messageDate.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: messageDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
            });
            
            return (
              <div 
                key={message.id}
                className="h-64 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md bg-white dark:bg-gray-800 overflow-hidden cursor-pointer transition-all duration-200"
                onClick={() => setSelectedMessage(message)}
              >
                {/* Simple card content */}
                <div className="p-4 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium truncate flex-1 dark:text-white">{message.subject}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">{formattedDate}</span>
                  </div>
                  
                  <div className="text-muted-foreground dark:text-gray-300 mb-3 text-sm overflow-y-auto flex-grow pr-1">
                    <p>{message.summary || "No summary available"}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label, index) => (
                      <span
                        key={index}
                        className="bg-secondary dark:bg-gray-700 text-secondary-foreground dark:text-gray-200 rounded-md px-2 py-1 text-xs"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}