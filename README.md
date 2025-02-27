# Client Communication Reports

This application helps you generate professional client communication reports by analyzing your email communications with clients. It combines Next.js, TypeScript, the Vercel AI SDK, and SQLite to create a powerful AI tool for client communication management.

## Features

### Client Management
- Create and manage clients with their domains and email addresses
- Filter emails by client domains and addresses
- Organize communications by client for better relationship management

### Communication Reports
- Generate detailed client communication reports
- Customizable report formats with placeholders
- Save and reuse report templates
- AI synthesizes emails into structured reports with key topics, action items, and more

### Custom Report Templates
- Create fully customizable report templates
- Use dynamic placeholders like `{summary}`, `{key_topics}`, `{action_items}`
- Add your own custom placeholders (e.g., `{key_technologies}`, `{project_status}`, `{stakeholders}`)
- The AI intelligently generates content for any placeholder you define

## Getting Started

1. Clone this repository
2. Create a `.env` file based on `.env.example` with your:
   - `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com)
   - `WEBHOOK_SECRET` - Random string for webhook security
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`
5. For webhook testing, use `npm run dev:webhook` with [smee.io](https://smee.io)

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: SQLite with Drizzle ORM
- **AI**: OpenAI GPT-4o via Vercel AI SDK
- **Authentication**: Microsoft OAuth

## How It Works

### Email Collection
Emails are received via a webhook endpoint that can be connected to email services like Gmail using Google Apps Script. The system validates, processes, and stores these emails with AI-generated summaries and labels.

### Client Reports
The application analyzes emails related to specific clients and generates comprehensive reports that summarize communications, highlight key topics, identify action items, and more. Reports are fully customizable with templates that support any placeholder fields you define.

### Creating Custom Reports
When creating a report, you can:
1. Select a client to filter relevant emails
2. Choose a date range for the report
3. Use an existing template or create your own format
4. Add custom placeholders for specialized content

The AI will intelligently fill in all placeholders based on your email content, producing a comprehensive client communication report.

## Custom Placeholders
The reporting system supports unlimited custom placeholders. Some examples:
- `{client_name}` - Client's name
- `{date_range}` - Period covered by the report
- `{summary}` - Overall communication summary
- `{key_topics}` - Main topics discussed
- `{action_items}` - Tasks to be completed
- `{next_steps}` - Upcoming actions
- `{key_technologies}` - Technologies mentioned in emails
- `{project_status}` - Overview of project status
- `{stakeholders}` - Key people mentioned
- `{open_questions}` - Questions that need answers
- `{decision_summary}` - Summary of decisions made

You can add any placeholder that makes sense for your reporting needs, and the AI will generate appropriate content by analyzing your email communications.

## License
MIT