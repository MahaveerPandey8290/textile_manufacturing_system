import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { verifyResetOTP } from '../../mockdata';
import { ArrowLeft } from 'lucide-react';

export default function VerifyOTPPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId, email, returnTo } = location.state || {};
  
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!sessionId) {
    return <div className="p-10 text-center">Invalid session. <button onClick={() => navigate('/')}>Go home</button></div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      verifyResetOTP(sessionId, otp);
      navigate('/reset-password', { state: { sessionId, returnTo } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="max-w-sm mx-auto w-full text-center">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 mb-6 flex items-center text-sm">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Verify OTP</h2>
        <p className="text-gray-500 text-sm mb-6">
          We've simulated sending an OTP to <span className="font-semibold text-gray-700">{email}</span>. <br/>
          (Hint: Use mock OTP '123456')
        </p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input 
              type="text" 
              required
              maxLength={6}
              className="w-full bg-[#F6F7F9] border border-transparent focus:bg-white focus:border-[#2448D8] rounded-xl px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono outline-none transition-colors"
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading || otp.length < 6}
            className="w-full bg-[#2448D8] hover:bg-blue-700 text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors mt-2 disabled:opacity-70"
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
