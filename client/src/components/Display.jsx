import { useState } from "react";

const Display = ({ contract, account }) => {
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);

  // Debug function to test contract
  const debugContract = async () => {
    try {
      console.log("=== Contract Debug Info ===");
      console.log("Current account:", account);
      console.log("Contract address:", await contract.getAddress());
      
      // Test if you can view your own images
      console.log("Testing display with own account...");
      const myImages = await contract.display(account);
      console.log("My images:", myImages);
      console.log("Images count:", myImages.length);
      
      alert(`Debug: Found ${myImages.length} images for your account`);
      
    } catch (error) {
      console.error("Debug failed:", error);
      console.error("Error reason:", error.reason);
      alert("Debug failed: " + (error.reason || error.message));
    }
  };

  const getdata = async () => {
    const otherAddress = document.querySelector(".address")?.value?.trim();
    
    if (otherAddress && !/^0x[a-fA-F0-9]{40}$/.test(otherAddress)) {
      alert("Please enter a valid Ethereum address");
      return;
    }

    setLoading(true);

    try {
      const addressToQuery = otherAddress || account;
      console.log("Querying address:", addressToQuery);
      console.log("Current user (msg.sender):", account);
      
      const dataArray = await contract.display(addressToQuery);
      console.log("Contract returned:", dataArray);
      console.log("Array length:", dataArray.length);

      if (!dataArray || dataArray.length === 0) {
        alert("No images to display");
        setData("");
        return;
      }

      const images = dataArray.map((item, i) => (
        <div key={i} className="group relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/30 transition-all duration-300">
          <a href={item} target="_blank" rel="noopener noreferrer" className="block">
            <div className="aspect-square overflow-hidden rounded-2xl">
              <img
                src={item}
                alt={`Image ${i + 1}`}
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                onError={(e) => {
                  console.error(`Failed to load image: ${item}`);
                  e.target.style.display = 'none';
                }}
                loading="lazy"
              />
            </div>
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-2xl">
              <div className="text-white text-center">
                <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                  <polyline points="14,2 14,8 20,8"/>
                </svg>
                <span className="text-sm font-medium">View Full</span>
              </div>
            </div>
          </a>
        </div>
      ));

      setData(images);

    } catch (error) {
      console.error("Error fetching data:", error);
      console.error("Error reason:", error.reason);
      
      // More specific error handling
      if (error.reason) {
        alert("Access denied: " + error.reason);
      } else if (error.message.includes("You don't have access")) {
        alert("You don't have permission to view this user's images");
      } else {
        alert("Failed to fetch images: " + error.message);
      }
      setData("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">

      {/* Search Controls */}
      <div className="bg-white/40 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-xl">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Wallet Address
            </label>
            <input
              type="text"
              placeholder="Enter Address (leave empty for your images)"
              className="address w-full px-4 py-3 bg-white/60 text-gray-800 border border-gray-300/50 rounded-xl focus:border-gray-500 focus:outline-none focus:ring-4 focus:ring-gray-500/10 disabled:bg-gray-200/50 disabled:text-gray-500 disabled:cursor-not-allowed font-mono text-sm placeholder:text-gray-500 transition-all duration-200"
              disabled={loading}
            />
          </div>
          
          <div className="flex gap-3">
            <button 
              className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={getdata}
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Fetching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                  </svg>
                  Get Images
                </>
              )}
            </button>
            
            {/* Debug button - remove after testing */}
            <button 
              onClick={debugContract}
              className="px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              title="Debug Contract"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5s-.96.06-1.42.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="bg-white/40 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-xl min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-80 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-300 border-t-gray-800 rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <p className="text-gray-700 text-lg font-medium">Loading images...</p>
              <p className="text-gray-500 text-sm">Fetching from blockchain</p>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-800">
                Gallery ({Array.isArray(data) ? data.length : 0} images)
              </h4>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Images loaded</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {data}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-80 space-y-6">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
            <div className="text-center space-y-2">
              <p className="text-gray-600 text-lg font-medium">No images to display</p>
              <p className="text-gray-500 text-sm max-w-md">
                Upload some images or enter an address to view shared images from the blockchain
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Display;
