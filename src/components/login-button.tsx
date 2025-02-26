'use client';

import { useAuth } from './auth-provider';

export function LoginButton() {
  const { isAuthenticated, isLoading, login, logout, user } = useAuth();

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
          onClick={logout}
          className="bg-red-500 hover:bg-red-600 text-white rounded-md px-4 py-2 transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={login}
      className="bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2 transition-colors"
    >
      Sign in with Microsoft
    </button>
  );
}