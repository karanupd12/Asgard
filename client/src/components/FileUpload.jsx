import { useState } from "react";
import axios from "axios";

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_API_SECRET = import.meta.env.VITE_PINATA_API_SECRET;

const FileUpload = ({ contract, account, provider }) => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("No image selected");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      alert("Please select a file first");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const resFile = await axios({
        method: "post",
        url: "https://api.pinata.cloud/pinning/pinFileToIPFS",
        data: formData,
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_API_SECRET,
          "Content-Type": "multipart/form-data",
        },
      });

      const ImgHash = `https://gateway.pinata.cloud/ipfs/${resFile.data.IpfsHash}`;
      
      const transaction = await contract.add(account, ImgHash);
      await transaction.wait();

      alert("Successfully Image Uploaded");
      setFileName("No image selected");
      setFile(null);
      setPreview(null);

    } catch (error) {
      console.error("Upload error:", error);
      alert("Unable to upload image to Pinata");
    } finally {
      setUploading(false);
    }
  };

  const retrieveFile = (e) => {
    const data = e.target.files[0];
    
    if (!data) return;

    // Validate file type
    if (!data.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (data.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setFile(data);
    setFileName(data.name);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
    };
    reader.readAsDataURL(data);

    e.preventDefault();
  };

  const clearFile = () => {
    setFile(null);
    setFileName("No image selected");
    setPreview(null);
    // Reset file input
    const fileInput = document.getElementById("file-upload");
    if (fileInput) fileInput.value = "";
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-6">

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Upload Area */}
        <div className="bg-white/40 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-xl">
          
          {/* File Drop Zone */}
          <div className="space-y-4">
            <label 
              htmlFor="file-upload" 
              className={`relative block w-full border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer group ${
                file 
                  ? 'border-green-400 bg-green-50/50' 
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50/50'
              } ${!account || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="space-y-4">
                {preview ? (
                  <div className="relative mx-auto w-32 h-32 rounded-xl overflow-hidden border-2 border-white/30 shadow-lg">
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                  </div>
                ) : (
                  <div className="mx-auto w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="12" y1="18" x2="12" y2="12"/>
                      <line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                  </div>
                )}
                
                <div>
                  <p className="text-lg font-medium text-gray-800">
                    {file ? 'Change Image' : 'Choose Image'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    PNG, JPG, GIF up to 10MB
                  </p>
                </div>
              </div>
              
              <input
                disabled={!account || uploading}
                type="file"
                id="file-upload"
                name="data"
                onChange={retrieveFile}
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </label>

            {/* File Info */}
            {file && (
              <div className="bg-white/60 rounded-2xl p-4 border border-white/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-sm truncate max-w-48">
                        {fileName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={clearFile}
                    className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-lg flex items-center justify-center text-red-600 transition-colors"
                    disabled={uploading}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Controls */}
        <div className="bg-white/40 backdrop-blur-lg rounded-3xl p-6 border border-white/20 shadow-xl">
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium">Wallet Status</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${account ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`font-medium ${account ? 'text-green-600' : 'text-red-600'}`}>
                  {account ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>

            {/* Upload Button */}
            <button 
              type="submit" 
              className={`w-full px-6 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 ${
                !file || uploading || !account
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-800 hover:bg-gray-700 text-white hover:shadow-lg hover:-translate-y-0.5'
              }`}
              disabled={!file || uploading || !account}
            >
              {uploading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading to IPFS...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  Upload to Blockchain
                </>
              )}
            </button>

            {/* Upload Info */}
            <div className="text-center text-xs text-gray-600 space-y-1">
              <p>Images are stored on IPFS and hashes on Ethereum blockchain</p>
              <p>Gas fees may apply for blockchain transactions</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default FileUpload;
