# Email Agent Workshop Commands and Guidelines

## Commands
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate database types/migrations
- `npm run db:migrate` - Run database migrations
- `npm run dev:webhook` - Start webhook proxy with smee

## Code Style

### TypeScript
- Use strict type checking - explicit return types on functions
- Use Zod for runtime validation
- Use React server components where possible

### Imports
- Use absolute imports with `~/*` for project files
- Group imports: Next.js, external libraries, then internal

### Error Handling
- Use try/catch blocks with specific error logging
- Return appropriate HTTP status codes in API routes

### Naming
- PascalCase for components
- camelCase for variables, functions and methods
- Use descriptive names for handlers and data processing functions