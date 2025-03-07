import { NextResponse } from "next/server";
import { env } from "~/lib/env";
import { getUserAccessToken } from "~/lib/auth/microsoft";

export async function GET(request: Request) {
  try {
    // Authentication check
    const authHeader = request.headers.get('Authorization');
    let accessToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    if (!accessToken) {
      accessToken = getUserAccessToken();
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { 
          error: "Authentication required",
          message: "Please sign in with your Microsoft account to access this feature"
        },
        { status: 401 }
      );
    }
    
    // Check if OpenAI API key is available
    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          status: "error",
          message: "OpenAI API key is missing in environment variables"
        },
        { status: 500 }
      );
    }
    
    // Mask the API key for security
    const maskedKey = `${env.OPENAI_API_KEY.substring(0, 5)}...${env.OPENAI_API_KEY.substring(env.OPENAI_API_KEY.length - 5)}`;
    
    // Check if the API key is valid by making a request to the OpenAI API
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Get the available models (just the first 5 for brevity)
        const models = data.data.slice(0, 5).map(model => model.id);
        
        return NextResponse.json({
          status: "success",
          message: "OpenAI API key is valid",
          key: maskedKey,
          models: models,
          reportModel: env.OPENAI_REPORT_MODEL,
          summaryModel: env.OPENAI_SUMMARY_MODEL,
          embeddingModel: env.OPENAI_EMBEDDING_MODEL
        });
      } else {
        const errorData = await response.json();
        
        return NextResponse.json({
          status: "error",
          message: "OpenAI API key is invalid",
          key: maskedKey,
          error: errorData.error || "Unknown error",
          statusCode: response.status
        }, { status: 500 });
      }
    } catch (error) {
      return NextResponse.json({
        status: "error",
        message: "Failed to check OpenAI API key",
        key: maskedKey,
        error: error.message || "Unknown error"
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: "An unexpected error occurred",
      error: error.message || "Unknown error"
    }, { status: 500 });
  }
} 