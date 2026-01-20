'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Error:', error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-purple-gradient">
      <div className="text-center p-8 glass rounded-2xl max-w-md">
        <h2 className="text-2xl font-display font-bold text-accent-red mb-4">
          Something went wrong!
        </h2>
        <p className="text-gray-400 mb-6">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="btn btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
