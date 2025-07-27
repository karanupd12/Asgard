export const POLYGON_AMOY_CONFIG = {
  chainId: '0x13882', // 80002 in hex
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: [
    'https://rpc-amoy.polygon.technology/',
    'https://polygon-amoy-bor-rpc.publicnode.com'
  ],
  blockExplorerUrls: ['https://amoy.polygonscan.com/'],
};

export const switchToPolygonAmoy = async () => {
  if (!window.ethereum) {
    alert('MetaMask is not installed. Please install MetaMask to use this application.');
    return false;
  }

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLYGON_AMOY_CONFIG.chainId }],
    });
    return true;
  } catch (switchError) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        // Add the network
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [POLYGON_AMOY_CONFIG],
        });
        return true;
      } catch (addError) {
        console.error('Error adding network:', addError);
        alert('Failed to add Polygon Amoy network. Please add it manually.');
        return false;
      }
    } else {
      console.error('Error switching network:', switchError);
      return false;
    }
  }
};

export const checkNetwork = async () => {
  if (!window.ethereum) return false;
  
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId === POLYGON_AMOY_CONFIG.chainId;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
};
