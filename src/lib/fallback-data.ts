/**
 * Fallback data for when database operations fail
 * This is particularly useful for Render free tier deployments
 */

export const fallbackClients = [
  {
    id: 'f9bfe376-e4b4-4923-bc79-a4dce43fc494',
    name: 'deFacto Global',
    domains: [],
    emails: ['bbedard@defactoglobal.com'],
    created_at: 1740711413,
    updated_at: 1740711413,
    user_id: 'dev@example.com'
  },
  {
    id: '2e3b7c8d-9a1f-4b5e-8c7d-6e5f4d3c2b1a',
    name: 'Acme Corporation',
    domains: ['acme.com'],
    emails: ['contact@acme.com'],
    created_at: 1740711414,
    updated_at: 1740711414,
    user_id: 'dev@example.com'
  },
  {
    id: '3f4g5h6i-7j8k-9l0m-1n2o-3p4q5r6s7t8u',
    name: 'Globex Industries',
    domains: ['globex.com'],
    emails: ['info@globex.com'],
    created_at: 1740711415,
    updated_at: 1740711415,
    user_id: 'dev@example.com'
  }
]; 