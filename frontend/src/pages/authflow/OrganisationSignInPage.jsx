import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { authenticateOrganisation } from '../../mockdata';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function OrganisationSignInPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ companyId: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      const user = authenticateOrganisation(formData.companyId, formData.email, formData.password);
      alert(`Success! Logged in as ${user.ownerName} (Owner)`);
      // navigate('/owner-dashboard'); // Redirect to placeholder dashboard
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
        
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Organisation Sign In</h2>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Company ID</label>
            <input 
              type="text" 
              required
              className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              placeholder="e.g. TXF-123456"
              value={formData.companyId}
              onChange={e => setFormData({...formData, companyId: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Organisation Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              placeholder="owner@company.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-3 text-sm outline-none transition-colors pr-10"
                placeholder="••••••••"
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
            <div className="mt-2 text-right">
              <Link to="/forgot-password" state={{ type: 'Organisation' }} className="text-xs text-[#2448D8] hover:underline font-medium">
                Forgot Password?
              </Link>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#2448D8] hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors mt-2 disabled:opacity-70"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <div className="mt-8 text-center text-sm text-gray-600">
          Don't have an organisation?{' '}
          <Link to="/org-register" className="text-[#2448D8] hover:underline font-semibold">
            Register New
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
