'use client';

import { useState } from 'react';
import { useAuth } from './auth-provider';

export function LoginButton() {
  const { isAuthenticated, isLoading, login, logout, user, error } = useAuth();
  const [buttonState, setButtonState] = useState<'idle' | 'processing'>('idle');

  if (isLoading) {
    return (
      <button className="bg-gray-200 text-gray-400 rounded-md px-4 py-2" disabled>
        Loading...
      </button>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {user?.username || user?.name || 'Signed in'}
        </span>
        <button 
          onClick={() => {
            setButtonState('processing');
            logout();
          }}
          disabled={buttonState === 'processing'}
          className={`${
            buttonState === 'processing' 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-red-500 hover:bg-red-600 cursor-pointer'
          } text-white rounded-md px-4 py-2 transition-colors`}
        >
          {buttonState === 'processing' ? 'Signing Out...' : 'Sign Out'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button 
        onClick={() => {
          setButtonState('processing');
          login();
        }}
        disabled={buttonState === 'processing'}
        className={`${
          buttonState === 'processing'
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600 cursor-pointer'
        } text-white rounded-md px-4 py-2 transition-colors`}
      >
        {buttonState === 'processing' ? 'Signing in...' : 'Sign in with Microsoft'}
      </button>
      
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 max-w-md mt-2">
          {error}
        </div>
      )}
    </div>
  );
}