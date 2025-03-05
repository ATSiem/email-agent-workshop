'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export function GraphPermissionsChecker() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const checkPermissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/graph/permissions');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to check permissions');
      }
      
      setResult(data.permissions);
    } catch (err) {
      setError(err.message || 'An error occurred while checking permissions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Microsoft Graph API Permissions</CardTitle>
        <CardDescription>
          Check if your account has the necessary permissions to access emails
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Checking permissions...</span>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              {result.canAccessEmails ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div>
                <h3 className="font-medium">Email Access</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {result.canAccessEmails 
                    ? 'Your account can access emails through Microsoft Graph API' 
                    : 'Your account cannot access emails through Microsoft Graph API'}
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              {result.hasMailReadPermission ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              )}
              <div>
                <h3 className="font-medium">Mail.Read Permission</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {result.hasMailReadPermission 
                    ? 'Your account has the Mail.Read permission' 
                    : 'Your account appears to be missing the Mail.Read permission'}
                </p>
              </div>
            </div>
            
            {result.userPrincipalName && (
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h3 className="font-medium">Authenticated As</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {result.userPrincipalName}
                  </p>
                </div>
              </div>
            )}
            
            {!result.canAccessEmails && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Permission Issues Detected</AlertTitle>
                <AlertDescription>
                  To fix this issue:
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Sign out and sign back in</li>
                    <li>Make sure your administrator has granted the Mail.Read permission</li>
                    <li>Check your Microsoft 365 license includes email access</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            Click the button below to check your Microsoft Graph API permissions
          </p>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={checkPermissions} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            'Check Permissions'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 