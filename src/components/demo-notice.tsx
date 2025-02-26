'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './auth-provider';

export default function DemoNotice() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, user } = useAuth();
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Don't show demo notice if authenticated
  if (!mounted || isAuthenticated) return null;
  
  return (
    <div className="mb-6 rounded-md bg-yellow-50 p-4 text-yellow-800">
      <h3 className="text-md font-medium">Demo Mode Active</h3>
      <p className="text-sm">
        Running with sample data. Please sign in with Microsoft to access your actual emails.
      </p>
    </div>
  );
}