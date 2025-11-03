import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

export function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center text-center py-12 px-4 sm:px-6 lg:px-8">
      <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
      <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
        Page Not Found
      </h1>
      <p className="mt-4 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <div className="mt-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
