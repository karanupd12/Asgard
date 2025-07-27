import { Link } from "react-router-dom";
import { useState } from "react";

const Header = ({ account }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="bg-gray-900 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Lock Icon */}
          <Link 
            to="/" 
            className="flex items-center space-x-3 group flex-shrink-0"
            onClick={closeMobileMenu}
          >
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200">
              <svg className="w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-medium text-white">Asgard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Decentralized storage</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/explore" 
              className="px-4 py-2 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              Explore
            </Link>
            
            {account ? (
              <div className="bg-green-100 px-3 py-1.5 rounded-lg border border-green-400">
                <span className="text-xs text-green-600 font-medium">Connected</span>
                <p className="text-xs font-mono text-gray-900">{account.slice(0, 6)}...{account.slice(-4)}</p>
              </div>
            ) : (
              <button className="bg-white rounded-lg px-4 py-2 text-gray-900 text-sm font-medium hover:bg-gray-100 transition-colors cursor-pointer">
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button 
              onClick={toggleMobileMenu}
              className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors duration-200"
              aria-label="Toggle mobile menu"
            >
              <svg 
                className={`h-6 w-6 transform transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-90' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'max-h-96 pb-4' : 'max-h-0'
        }`}>
          <div className="space-y-3 pt-4 border-t border-gray-700/50">
            {/* Mobile Logo Text (for very small screens) */}
            <div className="sm:hidden mb-4">
              <h1 className="text-lg font-medium text-white">Asgard</h1>
              <p className="text-xs text-gray-400">Decentralized storage</p>
            </div>

            {/* Mobile Navigation Links */}
            <Link 
              to="/explore" 
              onClick={closeMobileMenu}
              className="block w-full text-left px-4 py-3 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Explore</span>
              </div>
            </Link>
            
            {/* Mobile Account Status */}
            {account ? (
              <div className="bg-green-100 px-4 py-3 rounded-lg border border-green-400">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600 font-medium">Connected</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
                <p className="text-sm font-mono text-gray-900 mt-1 break-all">{account}</p>
              </div>
            ) : (
              <button className="w-full bg-white rounded-lg px-4 py-3 text-gray-900 text-sm font-medium hover:bg-gray-100 transition-colors cursor-pointer text-left">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Connect Wallet</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={closeMobileMenu}
        ></div>
      )}
    </nav>
  );
};

export default Header;
