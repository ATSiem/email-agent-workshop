# Email Agent Optimization Roadmap

## Current Implementation (02/26/2025)

Our current solution uses a two-tier approach to balance completeness with token limitations:

1. **Metadata Analysis** - For all emails in the date range:
   - Email distribution by date
   - Most active discussion threads
   - Total counts and basic statistics

2. **Detailed Content Analysis** - For most recent 15 emails:
   - Full content analysis (with bodies truncated to 800 chars)
   - Sorted by recency (newest first)
   - Complete headers and metadata

This approach works well for up to ~100 emails but has limitations for larger datasets.

The goal is to maximize local compute usage and operate within the bounds of the maximum context length of 128,000 tokens.

## Better Email Storage Architecture

### 1. Vector Database Implementation

**Advantages of a Vector DB for emails:**
- Index emails by semantic content, not just keywords
- Enable similarity-based search (find emails about similar topics)
- Support efficient retrieval patterns for RAG (retrieval augmented generation)

**Implementation options:**
- Self-hosted options: Qdrant, Weaviate, or Milvus
- Managed options: Pinecone, Chroma, or Supabase with pgvector

### 2. Email Processing Pipeline

1. **Email Ingestion**
   - Continue capturing emails via Microsoft Graph API
   - Pre-process emails (clean HTML, extract attachments)
   - Generate embeddings for each email using an embedding model (e.g., OpenAI ada-002)

2. **Embedding & Storage**
   - Store raw email data in SQL database (maintain your current schema)
   - Store embeddings in vector database with metadata (date, sender, recipient, subject)
   - Create indexes on important fields for fast filtering

3. **Chunking Strategy**
   - For longer emails, split into smaller chunks (e.g., 500 tokens)
   - Maintain relationships between chunks and parent emails
   - Generate embeddings for each chunk

## Smarter Report Generation

### 1. Two-Tier Generation Approach

**For smaller requests (few emails):**
- Use current direct approach (send all email content to AI)
- Maintain simple workflow for quick responses

**For larger requests (many emails/months):**
- **Tier 1 - Local Summarization**: Generate summaries for each week/topic cluster
- **Tier 2 - Meta Summary**: Send these summaries to AI for final report generation

### 2. Parallel Processing

- Process email batches in parallel (e.g., by week)
- Generate mini-summaries for each batch
- Send meta-information and mini-summaries to final LLM call

### 3. Hierarchical Summarization

For very large datasets (e.g., an entire year):
1. Daily summaries 
2. Weekly summaries (from daily)
3. Monthly summaries (from weekly)
4. Final report (from monthly)

## Implementation Roadmap

### Phase 1: Optimize Current System
- [x] Implement email truncation and limit number of emails sent to AI
- [x] Add metadata analysis for all emails to provide context
- [x] Create a two-tier approach for large requests (metadata + detailed)
- [ ] Add caching for common queries and summaries

### Phase 2: Vector Database Integration
- [x] Set up vector DB alongside existing SQL database
- [x] Add embedding generation at email ingestion
- [x] Update query system to leverage semantic search

### Phase 3: Advanced Features
- [x] Implement topic clustering to organize emails by theme
- [x] Add advanced filtering by semantic similarity
- [ ] Create a dashboard to visualize communication patterns

## Technical Requirements

- **Embedding model**: OpenAI ada-002 or local alternative like BERT/SentenceTransformers
- **Vector database**: Qdrant (self-hosted) or Pinecone (managed)
- **Processing pipeline**: Background jobs for email processing and embedding
- **Local compute**: For batch processing, summarization, and embedding generation

## Lessons Learned

- **API Challenges**: Microsoft Graph API OData filters need careful handling - the any() operator requires a complete boolean expression
- **Token Management**: Token limits are a significant constraint - our hybrid approach (metadata + limited detailed analysis) works well
- **Date Handling**: Database date comparisons need to be consistent across the entire pipeline (UTC is key)
- **Error Handling**: Consistent error handling with graceful degradation is essential