'use client';

import React from 'react';

interface EmailFormatterProps {
  body: string;
}

export function EmailFormatter({ body }: EmailFormatterProps) {
  if (!body) return null;

  // Split the content by our special separator
  const parts = body.split('===EMAIL_SEPARATOR===');
  
  // If we have multiple parts, render them with horizontal rules
  if (parts.length > 1) {
    return (
      <div>
        {parts.map((part, index) => (
          <div key={index}>
            {index > 0 && <hr className="my-6 border-t-2 border-gray-300 dark:border-gray-600" />}
            <div className="whitespace-pre-wrap">{part}</div>
          </div>
        ))}
      </div>
    );
  }
  
  // If no separators, just render the body
  return <div className="whitespace-pre-wrap">{body}</div>;
}