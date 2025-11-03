import React from 'react';
import { Header } from './Header';
import { Navigation } from './Navigation';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        {/* --- Desktop Sidebar --- */}
        <div className="hidden md:flex md:flex-shrink-0">
          <Navigation />
        </div>
        
        {/* --- Main Content --- */}
        <main className="flex-1 p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* --- Mobile Bottom Navigation --- */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <Navigation />
      </div>
    </div>
  );
}
