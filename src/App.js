import React, { useState } from 'react';
import Login from './components/Login';
import NGODashboard from './components/NGODashboard';
import DonorFeed from './components/DonorFeed';

function App() {
  const [userType, setUserType] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  if (!userType) {
    return <Login onLogin={(type, email) => {
      console.log('Login callback:', type, email);
      setUserType(type);
      setCurrentUserEmail(email || '');
    }} />;
  }

  if (userType === 'authority') {
    return <NGODashboard onLogout={() => setUserType(null)} />;
  }

  console.log('Rendering DonorFeed with email:', currentUserEmail);
  return <DonorFeed onLogout={() => setUserType(null)} currentUserEmail={currentUserEmail} />;
}

export default App;