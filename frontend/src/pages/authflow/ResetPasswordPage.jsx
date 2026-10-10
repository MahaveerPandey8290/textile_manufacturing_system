import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { resetPassword } from '../../mockdata';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId, returnTo } = location.state || {};
  
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!sessionId) {
    return <div className="p-10 text-center">Invalid session. <button onClick={() => navigate('/')}>Go home</button></div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match.');
    }

    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      resetPassword(sessionId, formData.password);
      alert('Password reset successfully!');
      navigate(returnTo || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="max-w-sm mx-auto w-full">
        
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Set New Password</h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required minLength={8}
                className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-3 text-sm outline-none transition-colors pr-10"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
              />
              <button 
                type="button" 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password</label>
            <input 
              type={showPassword ? "text" : "password"} 
              required
              className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              value={formData.confirmPassword}
              onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#2448D8] hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors mt-2 disabled:opacity-70"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
