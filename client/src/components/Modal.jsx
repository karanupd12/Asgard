import { useEffect, useState } from "react";

const Modal = ({ setModalOpen, contract }) => {
  const [sharing, setSharing] = useState(false);

  const handleSharing = async () => {
    const address = document.querySelector(".modal-address")?.value;
    
    if (!address || address.trim() === "") {
      alert("Please enter a valid address");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      alert("Please enter a valid Ethereum address");
      return;
    }

    setSharing(true);

    try {
      const transaction = await contract.allow(address.trim());
      await transaction.wait();

      alert("Access granted successfully!");
      setModalOpen(false);
    } catch (error) {
      console.error("Sharing error:", error);
      alert("Failed to grant access. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const loadAccessList = async () => {
    try {
      const addressList = await contract.shareAccess();
      const select = document.querySelector("#selectNumber");
      select.innerHTML = '<option>People With Access</option>';

      addressList.forEach(accessItem => {
        const opt = document.createElement("option");
        opt.textContent = `${accessItem.user} (${accessItem.access ? 'Allowed' : 'Denied'})`;
        opt.value = accessItem.user;
        select.appendChild(opt);
      });
    } catch (error) {
      console.error("Error loading access list:", error);
    }
  };

  useEffect(() => {
    if (contract) {
      loadAccessList();
    }
  }, [contract]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setModalOpen(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-200">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Share Access
          </h2>
          <p className="text-gray-600 text-sm">
            Grant viewing permissions to wallet addresses
          </p>
        </div>
        
        <div className="space-y-6">
          {/* Address Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              className="modal-address w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-300 rounded-xl focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:bg-gray-100 disabled:text-gray-500 font-mono text-sm transition-all duration-200"
              placeholder="Enter Address (0x...)"
              disabled={sharing}
            />
          </div>
          
          {/* Access List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Access
            </label>
            <select 
              id="selectNumber"
              className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-300 rounded-xl focus:border-gray-500 focus:outline-none cursor-pointer transition-all duration-200"
            >
              <option>People With Access</option>
            </select>
          </div>
          
          {/* Connection Status */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Blockchain Network</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-600 font-medium">Connected</span>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setModalOpen(false)}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              disabled={sharing}
            >
              Cancel
            </button>
            <button 
              onClick={handleSharing}
              className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              disabled={sharing}
            >
              {sharing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Granting Access...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
                  </svg>
                  Grant Access
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info Text */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Access permissions are stored on the blockchain and cannot be reversed
          </p>
        </div>
      </div>
    </div>
  );
};

export default Modal;
