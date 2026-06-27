'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    document.cookie = "auth=; path=/; max-age=0";
    router.push('/login');
    router.refresh();
  };

  return (
    <div style={{ marginTop: 'auto', padding: '1rem 1.5rem' }}>
      <button 
        onClick={handleLogout}
        className="btn btn-secondary"
        style={{ 
          width: '100%', 
          color: '#ff4d4d', 
          borderColor: 'rgba(255, 77, 77, 0.2)', 
          backgroundColor: 'rgba(255, 255, 255, 0.05)' 
        }}
      >
        Log Out
      </button>
    </div>
  );
}
