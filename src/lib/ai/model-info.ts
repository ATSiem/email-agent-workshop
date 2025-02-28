import { openai } from "@ai-sdk/openai";
import { env } from "~/lib/env";

// Model specifications - can be expanded as needed
export interface ModelSpecification {
  name: string;
  contextTokens: number;         // Total context window in tokens
  inputRatio: number;            // Approx ratio of characters to tokens for input 
  outputRatio: number;           // Approx ratio of characters to tokens for output
  embeddingDimension?: number;   // Vector dimension for embedding models
  costPer1KTokens?: {            // Cost in USD per 1K tokens
    input: number;
    output: number;
  };
}

/**
 * Model specifications for common OpenAI models
 * These values are used for dynamic token allocation
 */
export const MODEL_SPECS: Record<string, ModelSpecification> = {
  // GPT-4o models
  "gpt-4o-2024-08-06": {
    name: "GPT-4o (Aug 2024)",
    contextTokens: 128000,
    inputRatio: 4.0,    // ~4 chars per token for English
    outputRatio: 4.0,
    costPer1KTokens: {
      input: 0.005,
      output: 0.015
    }
  },
  "gpt-4o": {
    name: "GPT-4o",
    contextTokens: 128000,
    inputRatio: 4.0,
    outputRatio: 4.0,
    costPer1KTokens: {
      input: 0.005,
      output: 0.015
    }
  },
  
  // GPT-4 models
  "gpt-4-turbo": {
    name: "GPT-4 Turbo",
    contextTokens: 128000,
    inputRatio: 4.0,
    outputRatio: 4.0,
    costPer1KTokens: {
      input: 0.01,
      output: 0.03
    }
  },
  "gpt-4": {
    name: "GPT-4",
    contextTokens: 8192,
    inputRatio: 4.0,
    outputRatio: 4.0,
    costPer1KTokens: {
      input: 0.03,
      output: 0.06
    }
  },
  
  // GPT-3.5 models
  "gpt-3.5-turbo": {
    name: "GPT-3.5 Turbo", 
    contextTokens: 16385,  
    inputRatio: 4.0,
    outputRatio: 4.0,
    costPer1KTokens: {
      input: 0.0005,
      output: 0.0015
    }
  },
  
  // Embedding models
  "text-embedding-3-small": {
    name: "Text Embedding 3 Small",
    contextTokens: 8191,
    inputRatio: 4.0,
    outputRatio: 4.0,
    embeddingDimension: 1536,
    costPer1KTokens: {
      input: 0.0001,
      output: 0
    }
  },
  "text-embedding-3-large": {
    name: "Text Embedding 3 Large",
    contextTokens: 8191,
    inputRatio: 4.0,
    outputRatio: 4.0,
    embeddingDimension: 3072,
    costPer1KTokens: {
      input: 0.00013,
      output: 0
    }
  }
};

/**
 * Get specification for the model currently in use
 * @param modelType The type of model to get info for ('summary', 'report', or 'embedding')
 * @returns The model specification
 */
export function getCurrentModelSpec(modelType: 'summary' | 'report' | 'embedding'): ModelSpecification {
  let modelName: string;
  
  switch (modelType) {
    case 'summary':
      modelName = env.OPENAI_SUMMARY_MODEL || "gpt-3.5-turbo";
      break;
    case 'report':
      modelName = env.OPENAI_REPORT_MODEL || "gpt-4o-2024-08-06";
      break;
    case 'embedding':
      modelName = env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
      break;
  }
  
  // Return the spec if we have it
  if (MODEL_SPECS[modelName]) {
    return MODEL_SPECS[modelName];
  }
  
  // Otherwise return a default based on type
  if (modelType === 'embedding') {
    return MODEL_SPECS["text-embedding-3-small"];
  } else if (modelType === 'summary') {
    return MODEL_SPECS["gpt-3.5-turbo"];
  } else {
    return MODEL_SPECS["gpt-4o-2024-08-06"];
  }
}

/**
 * Calculate the optimal token allocation budget given the current model
 * @param modelType The type of model ('summary', 'report', or 'embedding')
 * @param reserveForOutput Tokens to reserve for output
 * @returns Token and character budgets
 */
export function calculateTokenBudget(modelType: 'summary' | 'report' | 'embedding', reserveForOutput = 0) {
  const modelSpec = getCurrentModelSpec(modelType);
  
  // Calculate available tokens
  const availableTokens = modelSpec.contextTokens - reserveForOutput;
  
  // Calculate safety margin (5% of available tokens)
  const safetyMargin = Math.floor(availableTokens * 0.05);
  
  // Calculate usable tokens (with safety margin)
  const usableTokens = availableTokens - safetyMargin;
  
  // Convert to characters using the model's input ratio
  const usableCharacters = usableTokens * modelSpec.inputRatio;
  
  return {
    modelName: modelSpec.name,
    contextWindow: modelSpec.contextTokens,
    reserveForOutput,
    availableTokens,
    usableTokens,
    usableCharacters,
    safetyMargin
  };
}

/**
 * Calculate the optimal email processing parameters based on the current model
 * @param totalEmails Total number of emails to process
 * @param reserveForOutput Tokens to reserve for model output
 * @returns Optimally calculated parameters
 */
export function calculateEmailProcessingParams(totalEmails: number, reserveForOutput = 4000) {
  // Get budget for the report model (the most constrained one)
  const budget = calculateTokenBudget('report', reserveForOutput);
  
  // Reserve tokens for metadata, instructions, etc. (10% of budget)
  const metadataTokens = Math.floor(budget.usableTokens * 0.1);
  const emailBudgetTokens = budget.usableTokens - metadataTokens;
  
  // Calculate target percentages (adjust these based on priority)
  const percentageForDetailed = 0.6;  // 60% of token budget for detailed emails
  const percentageForSummary = 0.4;   // 40% of token budget for summary emails
  
  // Calculate token budget per detailed email (with full content)
  // and per summary email (with just metadata)
  const averageDetailedEmailTokens = 800;  // Estimated tokens for a detailed email
  const averageSummaryEmailTokens = 150;   // Estimated tokens for a summary-only email
  
  // Calculate how many emails we can process with our budget
  const detailedBudget = emailBudgetTokens * percentageForDetailed;
  const summaryBudget = emailBudgetTokens * percentageForSummary;
  
  // Calculate optimal counts
  const optimalDetailedCount = Math.floor(detailedBudget / averageDetailedEmailTokens);
  const optimalSummaryCount = Math.floor(summaryBudget / averageSummaryEmailTokens);
  
  // Calculate actual counts (scale down if we have fewer emails)
  const detailedCount = Math.min(optimalDetailedCount, totalEmails);
  const remainingEmails = totalEmails - detailedCount;
  const summaryCount = Math.min(optimalSummaryCount, remainingEmails);
  
  // Calculate max body length for detailed emails
  // More emails = shorter per email excerpts
  const maxBodyChars = Math.max(
    Math.min(
      Math.floor((detailedBudget * 4) / (detailedCount || 1)), 
      10000
    ),
    300  // Minimum size to maintain comprehension
  );
  
  return {
    model: budget.modelName,
    contextWindow: budget.contextWindow,
    detailedEmailCount: detailedCount,
    summaryEmailCount: summaryCount,
    maxBodyLength: maxBodyChars,
    totalEmailsProcessed: detailedCount + summaryCount,
    percentageProcessed: Math.min(((detailedCount + summaryCount) / totalEmails) * 100, 100),
    tokenBudget: {
      total: budget.contextWindow,
      available: budget.availableTokens,
      forOutput: reserveForOutput,
      forEmails: emailBudgetTokens,
      forDetailed: detailedBudget,
      forSummary: summaryBudget,
      forMetadata: metadataTokens
    }
  };
}