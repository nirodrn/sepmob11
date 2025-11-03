import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/Auth/LoginForm';
import { ErrorMessage } from '../components/Common/ErrorMessage';

export function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = () => {
    navigate('/dashboard');
  };

  const handleError = (err: any) => {
    setError(err.message || 'An unexpected error occurred. Please try again.');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
        {error && <div className="mt-4 mx-auto max-w-sm"><ErrorMessage message={error}/></div>}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <LoginForm onSuccess={handleSuccess} onError={handleError} />
        </div>
      </div>
    </div>
  );
}
