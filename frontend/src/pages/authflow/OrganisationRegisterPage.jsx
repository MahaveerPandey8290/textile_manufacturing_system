import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { registerOrganisation } from '../../mockdata';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function OrganisationRegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ companyName: '', ownerName: '', ownerEmail: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match.');
    }

    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const newOrg = registerOrganisation({
        companyName: formData.companyName,
        ownerName: formData.ownerName,
        ownerEmail: formData.ownerEmail,
        password: formData.password
      });
      setSuccessData(newOrg);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (successData) {
    return (
      <AuthLayout>
        <div className="max-w-sm mx-auto w-full text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h2>
          <p className="text-gray-600 text-sm mb-6">Your organisation has been registered successfully.</p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">Your Company ID</p>
            <p className="text-2xl font-mono font-bold text-[#2448D8] tracking-widest">{successData.companyId}</p>
            <p className="text-xs text-gray-500 mt-2">Please save this ID and share it with your staff and buyers.</p>
          </div>
          
          <button 
            onClick={() => navigate('/org-signin')}
            className="w-full bg-[#2448D8] hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors"
          >
            Continue to Sign In
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="max-w-sm mx-auto w-full">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 mb-6 flex items-center text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Register Organisation</h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Company Name</label>
              <input 
                type="text" 
                required
                className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
                value={formData.companyName}
                onChange={e => setFormData({...formData, companyName: e.target.value})}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Owner Name</label>
              <input 
                type="text" 
                required
                className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
                value={formData.ownerName}
                onChange={e => setFormData({...formData, ownerName: e.target.value})}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Owner Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
              value={formData.ownerEmail}
              onChange={e => setFormData({...formData, ownerEmail: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required minLength={8}
                className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors pr-10"
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
            <p className="text-[10px] text-gray-500 mt-1">At least 8 characters</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm Password</label>
            <input 
              type={showPassword ? "text" : "password"} 
              required
              className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
              value={formData.confirmPassword}
              onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#2448D8] hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors mt-2 disabled:opacity-70"
          >
            {loading ? 'Creating...' : 'Create Organisation'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/org-signin" className="text-[#2448D8] hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
