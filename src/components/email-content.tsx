'use client';

import React, { useEffect, useState } from 'react';

interface EmailContentProps {
  body: string;
}

export function EmailContent({ body }: EmailContentProps) {
  const [emailChunks, setEmailChunks] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    if (!body) return;
    
    // Patterns that typically indicate a new message in a thread
    const patterns = [
      // Common email client formats
      /\bOn.*wrote:/, // "On [date/time], [someone] wrote:"
      /\bFrom:.*?(?=\bTo:|\bSent:|\bDate:|\bSubject:)/, // Email headers
      /-{3,}Original Message-{3,}/, // "-----Original Message-----"
      /-{3,}Forwarded message-{3,}/, // "-----Forwarded message-----"
      /&gt; On .+?wrote:/, // HTML encoded version
      /&lt;.+@.+&gt;/, // Email addresses in angle brackets
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b wrote:/, // Email pattern followed by wrote:
    ];

    // Find all potential split points
    const splitPoints: number[] = [];
    
    patterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'g');
      let match;
      
      while ((match = regex.exec(body)) !== null) {
        // Don't add duplicate split points close to each other
        const isDuplicate = splitPoints.some(point => 
          Math.abs(point - match.index) < 20
        );
        
        if (!isDuplicate && match.index > 0) { // Ensure it's not at the start
          splitPoints.push(match.index);
        }
      }
    });
    
    // Sort split points by position
    splitPoints.sort((a, b) => a - b);
    
    // Split the email into chunks
    const chunks: React.ReactNode[] = [];
    let lastIndex = 0;
    
    splitPoints.forEach((point, i) => {
      // Add the content before this split point
      chunks.push(
        <div key={`chunk-${i}`} className="mb-4">
          {body.substring(lastIndex, point)}
        </div>
      );
      
      // Add separator
      chunks.push(
        <div key={`sep-${i}`} className="flex items-center my-6">
          <hr className="flex-grow border-t-2 border-gray-300" />
          <span className="px-3 py-1 mx-2 text-sm bg-gray-100 text-gray-500 rounded-full">Previous message</span>
          <hr className="flex-grow border-t-2 border-gray-300" />
        </div>
      );
      
      lastIndex = point;
    });
    
    // Add the final part
    if (lastIndex < body.length) {
      chunks.push(
        <div key="chunk-final" className="mb-4">
          {body.substring(lastIndex)}
        </div>
      );
    }
    
    // If we found no split points, just show the whole email
    if (chunks.length === 0) {
      chunks.push(<div key="whole">{body}</div>);
    }
    
    setEmailChunks(chunks);
  }, [body]);

  return (
    <div className="email-content whitespace-pre-wrap">
      {emailChunks.length > 0 ? emailChunks : body}
    </div>
  );
}