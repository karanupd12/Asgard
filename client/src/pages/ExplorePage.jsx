const ExplorePage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Asgard User Guide & Onboarding
          </h1>
          <p className="text-gray-600">
            Complete guide to using decentralized image storage • Last updated: July 2025 • Version 1.0
          </p>
          <div className="w-16 h-px bg-gray-300 mt-6"></div>
        </div>

        {/* Quick Start Flow */}
        <div className="mb-16 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Quick Start Checklist</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-blue-800">Install MetaMask</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-blue-800">Auto network switch</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-blue-800">Get POL tokens</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
              <span className="text-blue-800">Start uploading</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-12">
          
          {/* Section 1: Getting Started */}
          <section>
            <h2 className="text-xl font-medium text-gray-900 mb-6 pb-2 border-b border-gray-200">
              1. Getting Started - First Time Setup
            </h2>
            
            <div className="space-y-8">
              {/* Step 1: MetaMask Installation */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  Install MetaMask Wallet
                </h3>
                <div className="space-y-3 text-gray-700">
                  <p><strong>New to Web3?</strong> MetaMask is your digital wallet for blockchain interactions.</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium text-gray-900 mb-2">Installation Links:</p>
                    <ul className="space-y-1 text-sm">
                      <li>• <strong>Chrome:</strong> chrome.google.com/webstore (search "MetaMask")</li>
                      <li>• <strong>Firefox:</strong> addons.mozilla.org (search "MetaMask")</li>
                      <li>• <strong>Mobile:</strong> Available on iOS App Store & Google Play</li>
                    </ul>
                  </div>
                  <p><strong>Setup:</strong> After installation, create a new wallet and securely store your seed phrase (12 words).</p>
                </div>
              </div>

              {/* Step 2: Automatic Network Setup */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  Network Setup (Automatic)
                </h3>
                <div className="space-y-3 text-gray-700">
                  <p><strong>Don't worry about network configuration!</strong> Asgard automatically handles this for you.</p>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="font-medium text-green-900 mb-2">What happens automatically:</p>
                    <ul className="space-y-1 text-sm text-green-800">
                      <li>• Detects your current network when you visit the site</li>
                      <li>• Prompts you to switch to Polygon Amoy testnet</li>
                      <li>• Adds the network to MetaMask if not present</li>
                      <li>• Switches you back if you accidentally change networks</li>
                    </ul>
                  </div>
                  <p><strong>Network Details:</strong> Polygon Amoy Testnet (Chain ID: 80002) - Fast, free transactions for testing.</p>
                </div>
              </div>

              {/* Step 3: Getting POL Tokens */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  Get POL Tokens (Free)
                </h3>
                <div className="space-y-3 text-gray-700">
                  <p><strong>POL tokens</strong> are needed for blockchain transactions (gas fees). Get them free from faucets:</p>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="font-medium text-purple-900 mb-3">Recommended Faucets:</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span><strong>Official Polygon Faucet:</strong></span>
                        <span className="text-blue-600 font-mono">faucet.polygon.technology</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span><strong>Alchemy Faucet:</strong></span>
                        <span className="text-blue-600 font-mono">alchemy.com/faucets/polygon-amoy</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span><strong>Amount needed:</strong></span>
                        <span className="text-green-600 font-semibold">0.1 POL (covers 20-50 uploads)</span>
                      </div>
                    </div>
                  </div>
                  <p><strong>How to use:</strong> Visit faucet → Connect wallet → Request tokens → Wait 1-2 minutes for delivery.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Using Asgard Platform */}
          <section>
            <h2 className="text-xl font-medium text-gray-900 mb-6 pb-2 border-b border-gray-200">
              2. Using the Asgard Platform
            </h2>

            <div className="space-y-8">
              {/* Upload Images */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">📤</span>
                  Upload Images
                </h3>
                <div className="space-y-4 text-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Step-by-step:</p>
                      <ol className="space-y-1 text-sm list-decimal list-inside">
                        <li>Click "Choose Image" button</li>
                        <li>Select image from your device (PNG, JPG, GIF)</li>
                        <li>Preview appears automatically</li>
                        <li>Click "Upload to Blockchain"</li>
                        <li>Confirm transaction in MetaMask</li>
                        <li>Wait for confirmation (~2 seconds)</li>
                      </ol>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-900 mb-2">Technical Details:</p>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Storage:</strong> IPFS (decentralized)</li>
                        <li>• <strong>Cost:</strong> ~0.002 POL per upload</li>
                        <li>• <strong>Size limit:</strong> 10MB per image</li>
                        <li>• <strong>Permanence:</strong> Stored forever</li>
                        <li>• <strong>Ownership:</strong> Only you control access</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Images */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-sm font-bold">👁️</span>
                  View & Display Images
                </h3>
                <div className="space-y-4 text-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Your Images:</p>
                      <ul className="space-y-1 text-sm">
                        <li>• Leave address field empty</li>
                        <li>• Click "Get Images"</li>
                        <li>• View all your uploaded images</li>
                        <li>• Click images to view full size</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Others' Images:</p>
                      <ul className="space-y-1 text-sm">
                        <li>• Enter wallet address (0x...)</li>
                        <li>• Click "Get Images"</li>
                        <li>• View only if access granted</li>
                        <li>• Error if no permission</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Share Access */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm font-bold">🔗</span>
                  Share Access Control
                </h3>
                <div className="space-y-4 text-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium text-gray-900 mb-2">Grant Access:</p>
                      <ol className="space-y-1 text-sm list-decimal list-inside">
                        <li>Click "Share" button (top right)</li>
                        <li>Enter recipient's wallet address</li>
                        <li>Click "Grant Access"</li>
                        <li>Confirm transaction (~0.001 POL)</li>
                        <li>Recipient can now view your images</li>
                      </ol>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="font-medium text-gray-900 mb-2">Access Management:</p>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Permanent:</strong> Cannot be deleted</li>
                        <li>• <strong>Revokable:</strong> Remove access anytime</li>
                        <li>• <strong>Transparent:</strong> All permissions on blockchain</li>
                        <li>• <strong>Secure:</strong> Only you control permissions</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Platform Features & Benefits */}
          <section>
            <h2 className="text-xl font-medium text-gray-900 mb-6 pb-2 border-b border-gray-200">
              3. Platform Features & Benefits
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">🔒 True Ownership</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Your images are stored on IPFS with blockchain-verified ownership. No central authority can access, delete, or control your content.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">⚡ Lightning Fast</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Polygon Amoy provides 2-second transaction confirmations with virtually zero gas fees for seamless user experience.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">🌐 Decentralized</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    No single point of failure. Your images are distributed across IPFS nodes worldwide, ensuring permanent availability.
                  </p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">🔐 Privacy First</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Zero-knowledge architecture means no personal data collection. Only wallet addresses for access control, nothing more.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">💰 Cost Effective</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Minimal transaction costs (~$0.001 per upload) make decentralized storage accessible to everyone.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">🚀 Web3 Ready</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    Built on cutting-edge blockchain technology with automatic network management for seamless onboarding.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Troubleshooting */}
          <section>
            <h2 className="text-xl font-medium text-gray-900 mb-6 pb-2 border-b border-gray-200">
              4. Troubleshooting & FAQ
            </h2>
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="font-medium text-red-900 mb-4">Common Issues</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-red-800">❌ "Insufficient funds" error</p>
                    <p className="text-red-700">Solution: Get more POL tokens from faucets. You need ~0.002 POL per transaction.</p>
                  </div>
                  <div>
                    <p className="font-medium text-red-800">❌ "Network error" or wrong network</p>
                    <p className="text-red-700">Solution: The app will automatically prompt you to switch. Accept the MetaMask network change.</p>
                  </div>
                  <div>
                    <p className="font-medium text-red-800">❌ "Access denied" when viewing images</p>
                    <p className="text-red-700">Solution: You need permission from the image owner. Ask them to grant access via the Share button.</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-medium text-green-900 mb-4">Best Practices</h3>
                <ul className="space-y-2 text-sm text-green-800">
                  <li>• Keep 0.1 POL in your wallet for smooth transactions</li>
                  <li>• Don't upload sensitive content (it's permanent and public)</li>
                  <li>• Always confirm the recipient address before granting access</li>
                  <li>• Use the Explore page for technical documentation</li>
                  <li>• Bookmark faucet links for easy POL refills</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 5: Technical Information */}
          <section>
            <h2 className="text-xl font-medium text-gray-900 mb-6 pb-2 border-b border-gray-200">
              5. Technical Information
            </h2>
            <div className="bg-gray-100 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Network Details</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>• <strong>Network:</strong> Polygon Amoy Testnet</li>
                    <li>• <strong>Chain ID:</strong> 80002</li>
                    <li>• <strong>Currency:</strong> POL</li>
                    <li>• <strong>Block Time:</strong> ~2 seconds</li>
                    <li>• <strong>Explorer:</strong> amoy.polygonscan.com</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Storage Details</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>• <strong>Protocol:</strong> IPFS (InterPlanetary File System)</li>
                    <li>• <strong>Smart Contract:</strong> Solidity-based access control</li>
                    <li>• <strong>File Limit:</strong> 10MB per image</li>
                    <li>• <strong>Formats:</strong> PNG, JPG, GIF, WebP</li>
                    <li>• <strong>Permanence:</strong> Stored indefinitely</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-gray-200">
            <div className="text-center">
              <div className="text-sm text-gray-500">
                <p>This platform is deployed on Polygon Amoy testnet for demonstration purposes.</p>
                <p>Built with ❤️ for the decentralized web • Asgard - Realm of True Ownership</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorePage;
