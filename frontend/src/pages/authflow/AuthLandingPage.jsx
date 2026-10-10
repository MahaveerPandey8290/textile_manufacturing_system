import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Building2, Users } from 'lucide-react';

export default function AuthLandingPage() {
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <div className="max-w-sm mx-auto w-full text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">Welcome</h2>
        <p className="text-gray-500 mb-8 text-sm">Please select your account type to continue.</p>

        <div className="space-y-4">
          <button 
            onClick={() => navigate('/org-signin')}
            className="w-full flex items-center p-4 border border-gray-200 rounded-xl hover:border-[#2448D8] hover:bg-[#F6F7F9] transition-all group text-left"
          >
            <div className="w-12 h-12 bg-blue-50 text-[#2448D8] rounded-full flex items-center justify-center mr-4 group-hover:bg-[#2448D8] group-hover:text-white transition-colors">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Organisation Sign In</h3>
              <p className="text-xs text-gray-500 mt-1">For company owners and administrators</p>
            </div>
          </button>

          <button 
            onClick={() => navigate('/staff-signin')}
            className="w-full flex items-center p-4 border border-gray-200 rounded-xl hover:border-[#2448D8] hover:bg-[#F6F7F9] transition-all group text-left"
          >
            <div className="w-12 h-12 bg-blue-50 text-[#2448D8] rounded-full flex items-center justify-center mr-4 group-hover:bg-[#2448D8] group-hover:text-white transition-colors">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Staff / Employee Sign In</h3>
              <p className="text-xs text-gray-500 mt-1">For employees, staff, and buyers</p>
            </div>
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
