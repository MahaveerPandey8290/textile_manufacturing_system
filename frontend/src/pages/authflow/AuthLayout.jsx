import React from 'react';
import { Layers } from 'lucide-react';

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#202020] flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[1000px] overflow-hidden flex flex-col md:flex-row">
        {/* Left Panel */}
        <div className="w-full md:w-[45%] bg-gradient-to-br from-[#2448D8] to-[#00d2ff] p-10 flex flex-col justify-between text-white hidden md:flex">
          <div>
            <div className="flex items-center gap-2 mb-12">
              <Layers className="w-6 h-6" />
              <span className="font-semibold text-lg tracking-wide">TexFlow</span>
            </div>
            
            <div className="mb-8">
              <span className="inline-block py-1 px-3 rounded-full bg-white/20 text-sm mb-4 backdrop-blur-sm">
                Join Us to Build 🚀
              </span>
              <h1 className="text-4xl font-bold mb-4">Start your Journey</h1>
              <p className="text-blue-100 text-sm">Follow these simple steps to set up your account and manage your textile business.</p>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-white text-gray-800 p-4 rounded-xl flex-1 shadow-lg transform hover:-translate-y-1 transition-transform">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mb-3">1</div>
                <h3 className="font-semibold text-sm">Register your account</h3>
              </div>
              <div className="bg-white/10 p-4 rounded-xl flex-1 backdrop-blur-sm border border-white/20">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold mb-3">2</div>
                <h3 className="font-semibold text-sm text-blue-50">Set up your profile information</h3>
              </div>
              <div className="bg-white/10 p-4 rounded-xl flex-1 backdrop-blur-sm border border-white/20">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold mb-3">3</div>
                <h3 className="font-semibold text-sm text-blue-50">Manage operations efficiently</h3>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-full md:w-[55%] p-8 md:p-12 flex flex-col justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
