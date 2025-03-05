import { getGraphClient } from './microsoft';

/**
 * Verifies that the Microsoft Graph API client has the necessary permissions
 * to access emails. Returns a detailed report of the permissions and any issues.
 */
export async function verifyGraphApiPermissions() {
  try {
    console.log('GraphPermissions - Starting permission verification');
    const client = getGraphClient();
    
    if (!client) {
      return {
        success: false,
        message: 'No Graph client available. User may not be authenticated.',
        permissions: [],
        hasMailReadPermission: false
      };
    }
    
    // First check if we can access the /me endpoint (basic user profile)
    const userResult = await client.api('/me').get();
    console.log('GraphPermissions - User data retrieved:', userResult ? 'Yes' : 'No');
    
    // Try to check our granted permissions
    // This endpoint requires admin consent for some scopes but is worth trying
    let permissions = [];
    let hasMailReadPermission = false;
    
    try {
      // This will only work if delegated permissions for UserAuthenticationMethod.Read.All are granted
      const permissionsResult = await client.api('/me/oauth2PermissionGrants').get();
      permissions = permissionsResult.value || [];
      
      // Check if we have Mail.Read or Mail.ReadBasic permissions
      hasMailReadPermission = permissions.some(p => 
        p.scope && (p.scope.includes('Mail.Read') || p.scope.includes('Mail.ReadBasic'))
      );
      
      console.log('GraphPermissions - Permissions retrieved:', JSON.stringify(permissions));
    } catch (permError) {
      console.log('GraphPermissions - Unable to directly check permissions:', permError);
      // Fall back to testing endpoints
    }
    
    // Verify email access by attempting to get a single message
    let canAccessEmails = false;
    try {
      const testMessages = await client
        .api('/me/messages')
        .top(1)
        .get();
      
      canAccessEmails = !!(testMessages && testMessages.value);
      
      if (canAccessEmails) {
        console.log('GraphPermissions - Can access emails: Yes');
        // If we couldn't get the permissions directly, but can access emails, assume we have the permission
        hasMailReadPermission = true;
      } else {
        console.log('GraphPermissions - Can access emails: No (empty result)');
      }
    } catch (emailError) {
      console.error('GraphPermissions - Error testing email access:', emailError);
      canAccessEmails = false;
    }
    
    return {
      success: true,
      message: canAccessEmails 
        ? 'Microsoft Graph API permissions verified successfully.' 
        : 'Missing required permissions to access emails.',
      userPrincipalName: userResult?.userPrincipalName || userResult?.mail || '',
      canAccessEmails,
      hasMailReadPermission,
      permissions
    };
  } catch (error) {
    console.error('GraphPermissions - Error verifying permissions:', error);
    return {
      success: false,
      message: `Error verifying Microsoft Graph API permissions: ${error.message || error}`,
      permissions: [],
      hasMailReadPermission: false
    };
  }
} 