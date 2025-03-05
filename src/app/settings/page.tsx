'use client';

import { GraphPermissionsChecker } from '~/components/graph-permissions-checker';
import { ThemeToggle } from '~/components/theme-provider';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <ThemeToggle />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="col-span-1">
          <h2 className="text-xl font-semibold mb-4">Microsoft Graph API</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Verify that your Microsoft account has the necessary permissions to access emails.
            This is required for the application to fetch emails from your account.
          </p>
          
          <GraphPermissionsChecker />
          
          <div className="mt-6 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="text-md font-medium mb-2">Troubleshooting Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <li>Sign out and sign back in to refresh your permissions</li>
              <li>Contact your administrator if you need additional permissions</li>
              <li>Check that your Microsoft 365 license includes email access</li>
              <li>Verify that you haven't revoked permissions for this application</li>
            </ul>
          </div>
        </div>
        
        <div className="col-span-1">
          <h2 className="text-xl font-semibold mb-4">Email Search Settings</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Recent updates to the email search functionality:
          </p>
          
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg mb-4">
            <h3 className="text-md font-medium text-green-800 dark:text-green-200 mb-2">
              ✅ Enhanced Email Matching
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Email matching now includes CC and BCC fields in addition to FROM and TO.
              This helps find more emails related to your clients.
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg mb-4">
            <h3 className="text-md font-medium text-green-800 dark:text-green-200 mb-2">
              ✅ Partial Email Matching
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              The system now supports partial domain matching to find more emails
              that might be related to your clients.
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
            <h3 className="text-md font-medium text-green-800 dark:text-green-200 mb-2">
              ✅ Improved Logging
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Enhanced logging for Graph API calls makes it easier to diagnose issues
              with email retrieval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 