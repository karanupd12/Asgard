import Upload from "./artifacts/contracts/Upload.sol/Upload.json";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FileUpload from "./components/FileUpload";
import Display from "./components/Display";
import Modal from "./components/Modal";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ExplorePage from "./pages/ExplorePage";
import { switchToPolygonAmoy, checkNetwork } from "./utils/network";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [networkSwitching, setNetworkSwitching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProvider = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          setNetworkSwitching(true);
          setError("");

          // Use ethers v5 syntax for better Vite compatibility
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          await provider.send("eth_requestAccounts", []);

          // Check and switch network if needed
          const isCorrectNetwork = await checkNetwork();
          if (!isCorrectNetwork) {
            console.log("Wrong network detected, switching to Polygon Amoy...");
            const switched = await switchToPolygonAmoy();
            if (!switched) {
              setError('Please switch to Polygon Amoy testnet to use Asgard');
              setNetworkSwitching(false);
              return;
            }
            // Wait a bit after network switch
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          // Verify network after any switches
          const network = await provider.getNetwork();
          console.log("Connected to network:", network.name, "Chain ID:", network.chainId);

          if (network.chainId !== 80002) {
            setError('Please ensure you are on Polygon Amoy testnet (Chain ID: 80002)');
            setNetworkSwitching(false);
            return;
          }

          // Set up event listeners
          window.ethereum.on("chainChanged", async (chainId) => {
            console.log("Network changed to:", chainId);
            if (chainId !== '0x13882') {
              console.log("Wrong network, switching back to Polygon Amoy...");
              await switchToPolygonAmoy();
            }
            window.location.reload();
          });

          window.ethereum.on("accountsChanged", () => {
            window.location.reload();
          });

          // Get signer and address
          const signer = provider.getSigner();
          const address = await signer.getAddress();
          setAccount(address);

          // Contract setup
          let contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
          
          if (!contractAddress) {
            setError("Contract address not configured. Please check environment variables.");
            setNetworkSwitching(false);
            return;
          }
          
          if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
            setError("Invalid contract address format. Please use 0x... format, not ENS names.");
            setNetworkSwitching(false);
            return;
          }

          const contract = new ethers.Contract(
            contractAddress,
            Upload.abi,
            signer
          );
          
          setContract(contract);
          setProvider(provider);
          setNetworkSwitching(false);
          
        } catch (error) {
          console.error("Error connecting to wallet:", error);
          setError(`Wallet connection failed: ${error.message}`);
          setNetworkSwitching(false);
        }
      } else {
        setError("MetaMask is not installed. Please install MetaMask to use Asgard.");
        setNetworkSwitching(false);
      }
    };

    loadProvider();
  }, []);

  // Show loading screen while switching networks
  if (networkSwitching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Setting up Polygon Amoy
            </h2>
            <p className="text-gray-600 text-sm">
              Please approve the network switch in MetaMask to continue using Asgard
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error screen if there's an error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connection Error
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              {error}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Your existing dashboard content as a component
  const DashboardContent = () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-300 via-gray-200 to-gray-100 text-[#EEEEEE] relative">
      {/* Subtle background texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:20px_20px] opacity-30"></div>

      {/* Share Button */}
      {!modalOpen && (
        <button
          className="fixed top-20 right-5 z-50 bg-[#212121] hover:bg-[#2a2a2a] text-[#f3efef] px-8 py-3.5 rounded-xl font-medium transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer shadow-lg shadow-black/20 border border-gray-700/50 backdrop-blur-sm"
          onClick={() => setModalOpen(true)}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
            Share
          </span>
        </button>
      )}

      {/* Modal */}
      {modalOpen && <Modal setModalOpen={setModalOpen} contract={contract} />}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center gap-12 p-6 pt-24 pb-24">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-gray-900 tracking-tight leading-none">
            Asgard
          </h1>
          <div className="space-y-3">
            <p className="text-xl text-gray-700 font-medium tracking-wide">
              Realm of True Ownership
            </p>
            <div className="w-28 h-0.5 bg-gradient-to-r from-transparent via-gray-400 to-transparent mx-auto"></div>
          </div>
        </div>

        {/* Account Status */}
        <div className="w-full max-w-xl">
          <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="text-gray-900 font-medium">Account</span>
              {account ? (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                  <span className="font-mono text-xs sm:text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded break-all">
                    {account}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-600 text-sm">Not connected</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Components Section */}
        <div className="w-full max-w-6xl space-y-16">
          {/* File Upload Section */}
          <div className="bg-white/50 backdrop-blur-lg rounded-3xl p-8 border border-white/30 shadow-xl shadow-black/5">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Upload Files
              </h2>
              <p className="text-gray-600">
                Store your files securely on the blockchain
              </p>
            </div>
            <FileUpload
              account={account}
              provider={provider}
              contract={contract}
            />
          </div>

          {/* Display Section */}
          <div className="bg-white/50 backdrop-blur-lg rounded-3xl p-8 border border-white/30 shadow-xl shadow-black/5">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Your Files
              </h2>
              <p className="text-gray-600">View and manage your stored files</p>
            </div>
            <Display contract={contract} account={account} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Router>
      <div className="min-h-screen bg-[#343c47] text-[#EEEEEE]">
        <Header />
        
        <Routes>
          <Route path="/" element={<DashboardContent />} />
          <Route path="/explore" element={<ExplorePage />} />
        </Routes>
        
        <Footer />
      </div>
    </Router>
  );
}

export default App;
