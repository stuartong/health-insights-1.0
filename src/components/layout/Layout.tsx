import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useEffect } from 'react';
import { useHealthStore } from '@/stores/healthStore';
import { useChatStore } from '@/stores/chatStore';

export function Layout() {
  const { refreshData } = useHealthStore();
  const { loadMessages } = useChatStore();

  useEffect(() => {
    // Load initial data
    refreshData();
    loadMessages();
  }, [refreshData, loadMessages]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-64 transition-all duration-300">
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
