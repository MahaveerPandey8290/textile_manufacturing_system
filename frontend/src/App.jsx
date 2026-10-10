import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLandingPage from './pages/authflow/AuthLandingPage';
import OrganisationSignInPage from './pages/authflow/OrganisationSignInPage';
import OrganisationRegisterPage from './pages/authflow/OrganisationRegisterPage';
import StaffSignInPage from './pages/authflow/StaffSignInPage';
import ForgotPasswordPage from './pages/authflow/ForgotPasswordPage';
import VerifyOTPPage from './pages/authflow/VerifyOTPPage';
import ResetPasswordPage from './pages/authflow/ResetPasswordPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthLandingPage />} />
        <Route path="/org-signin" element={<OrganisationSignInPage />} />
        <Route path="/org-register" element={<OrganisationRegisterPage />} />
        <Route path="/staff-signin" element={<StaffSignInPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-otp" element={<VerifyOTPPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
