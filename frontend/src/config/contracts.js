// -----------------------------------------------------------------------
// Fill these in after you deploy the two contracts (see README.md).
// Everything else in the app reads from this one file.
// -----------------------------------------------------------------------

// Address of the deployed ENGN.sol token on Sepolia
export const ENGN_ADDRESS = '0xF8e3898d7fb752563fAD9CD7E18268Dca3e0BDd4';

// Address of the deployed EProcurementPro.sol contract on Sepolia
export const PROCUREMENT_ADDRESS = '0x86a3F7c42Fbee44432558819091953D51fdc7955';

// Sepolia testnet chain id (11155111 in decimal, 0xaa36a7 in hex)
export const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';
export const SEPOLIA_CHAIN_ID_DEC = 11155111;

export const SEPOLIA_NETWORK_PARAMS = {
  chainId: SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Sepolia Test Network',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

export const TENDER_STATUS_LABELS = ['Open', 'Closed', 'Awarded', 'Completed', 'Cancelled'];

export const TOKEN_DECIMALS = 18;
export const TOKEN_SYMBOL = 'eNGN';
