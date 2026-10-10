import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { requestPasswordReset } from '../../mockdata';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialType = location.state?.type || 'Organisation';
  const initialRole = location.state?.role || '';
  
  const [formData, setFormData] = useState({ 
    accountType: initialType, 
    role: initialRole, 
    companyId: '', 
    email: '' 
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roles = [
    'Production Manager',
    'Inventory Manager',
    'Quality Inspector',
    'Shipping Staff',
    'Office Staff',
    'Accounts Staff',
    'Buyer'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.accountType === 'Staff' && !formData.role) {
      return setError('Please select your role.');
    }

    setLoading(true);

    try {
      const res = await requestPasswordReset(formData.accountType, formData.companyId, formData.email, formData.role);
      navigate('/verify-otp', { state: { sessionId: res.sessionId, email: formData.email, returnTo: formData.accountType === 'Organisation' ? '/org-signin' : '/staff-signin' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="max-w-sm mx-auto w-full">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 mb-6 flex items-center text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Forgot Password</h2>
        <p className="text-center text-gray-500 text-sm mb-6">Enter your details to receive an OTP.</p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">


          {formData.accountType === 'Staff' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Role</label>
              <select 
                required
                className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-3 text-sm outline-none transition-colors appearance-none"
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value})}
              >
                <option value="" disabled>Select your role...</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Company ID</label>
            <input 
              type="text" 
              required
              className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              value={formData.companyId}
              onChange={e => setFormData({...formData, companyId: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Registered Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#2448D8] hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors mt-2 disabled:opacity-70"
          >
            {loading ? 'Requesting...' : 'Request OTP'}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
