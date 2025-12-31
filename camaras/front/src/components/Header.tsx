import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, Search, Bell, User, Menu, X } from 'lucide-react';

interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ isSidebarOpen, toggleSidebar }) => {
  return (
    <header className="bg-[#0E0E10] border-b border-gray-800 h-14 flex items-center justify-between px-4 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center gap-6">
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-white lg:hidden"
        >
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        
        <Link to="/" className="flex items-center gap-2">
          <Camera className="text-purple-500" size={24} />
          <span className="text-white text-lg font-bold hidden sm:block">StreamCaster</span>
        </Link>
        
        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/" className="text-white hover:text-purple-400 text-sm font-medium">Following</Link>
          <Link to="/browse" className="text-gray-400 hover:text-purple-400 text-sm font-medium">Browse</Link>
          <Link to="/categories" className="text-gray-400 hover:text-purple-400 text-sm font-medium">Categories</Link>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <input
            type="text"
            placeholder="Search streams..."
            className="bg-gray-800 text-white text-sm rounded-full px-4 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-purple-500 pl-10"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        
        <button className="text-gray-400 hover:text-white">
          <Bell size={20} />
        </button>
        
        <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors">
          <User size={16} />
          <span className="hidden sm:block">Sign In</span>
        </button>
      </div>
    </header>
  );
};

export default Header;