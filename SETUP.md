# Setting Up the Email Agent with Microsoft OAuth Integration

This guide helps you set up the Email Agent with secure Microsoft OAuth authentication, enabling users to access their own emails without administrator access to all email accounts.

## Prerequisites

- Microsoft 365 account
- Azure account with permissions to register apps
- OpenAI API key

## Step 1: Setup Local Environment

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/email-agent-workshop.git
   cd email-agent-workshop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```
   # SQLite
   SQLITE_DB_PATH=./data/email_agent.db

   # OpenAI
   OPENAI_API_KEY=your_openai_api_key

   # Microsoft Graph API (OAuth)
   CLIENT_ID=your_client_id
   TENANT_ID=your_tenant_id
   REDIRECT_URI=http://localhost:3000/api/auth/callback
   
   # Webhook
   WEBHOOK_SECRET=some-random-string
   ```

## Step 2: Register an App in Azure AD for OAuth

1. Go to the [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App registrations > New registration
3. Enter a name for your application (e.g., "Email Agent")
4. Under "Supported account types", select "Accounts in this organizational directory only"
5. Under "Redirect URI", select "Web" and enter: `http://localhost:3000/api/auth/callback`
6. Click "Register"
7. On the app overview page, note these values:
   - Application (client) ID - copy to CLIENT_ID in .env
   - Directory (tenant) ID - copy to TENANT_ID in .env

## Step 3: Configure API Permissions for Delegated Access

1. In your app registration, go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph" > "Delegated permissions"
4. Add the following permissions:
   - Mail.Read (under Mail category)
   - Mail.ReadBasic (under Mail category)
   - User.Read (under User category)
5. Click "Add permissions"
6. For testing, you can click "Grant admin consent for [your organization]"
   - This pre-approves the permissions for all users in your organization
   - Without this, each user will need to consent when they first sign in

## Step 4: Authentication Settings

1. In your app registration, go to "Authentication"
2. Under "Implicit grant and hybrid flows", enable:
   - Access tokens
   - ID tokens
3. Under "Advanced settings", set "Allow public client flows" to Yes
4. Click "Save"

## Step 5: Run the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Click "Sign in with Microsoft" to authenticate with your Microsoft 365 account

4. After signing in, click the sync button to fetch emails from your mailbox

## Usage

- Each user signs in with their own Microsoft 365 account
- Users can only access their own emails (enforced by Microsoft's OAuth)
- Emails are processed with OpenAI and stored only in the local SQLite database
- The app never has access to emails beyond what the logged-in user can access

## Troubleshooting

- If you can't sign in, verify your Azure app registration settings
- If permission errors occur, check that you've added the correct delegated permissions
- For database issues, check that the SQLite database path is correctly set and writable