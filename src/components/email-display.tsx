'use client';

import React from 'react';

interface EmailDisplayProps {
  body: string;
}

/**
 * A simple component that displays email content with thread separators
 */
export function EmailDisplay({ body }: EmailDisplayProps) {
  if (!body) return null;
  
  // Split the email by the separator we added
  const parts = body.split('===EMAIL_SEPARATOR===');
  
  // Render each part with a horizontal rule between them
  return (
    <div className="email-content">
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {/* Add a separator between messages */}
          {index > 0 && (
            <hr className="my-6 border-t-2 border-gray-300 dark:border-gray-600" />
          )}
          
          {/* Render the email content */}
          <div className="whitespace-pre-wrap">
            {/* Just display the part as is - we've already cleaned it during threading */}
            {part}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}