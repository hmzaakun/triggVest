// Types et interfaces pour TriggVest
export interface SavedWallet {
  id: string;
  address: string;
  blockchain: string;
  walletSetId: string;
  accountType: string;
  createDate: string;
}

export interface SavedWalletData {
  walletSetId: string;
  walletSetName: string;
  wallets: SavedWallet[];
  lastUpdated: string;
}

export interface WalletCollection {
  [name: string]: SavedWalletData;
}

export interface FaucetInfo {
  name: string;
  url: string;
  token: string;
  amount: string;
}

export interface CCTPContractConfig {
  domain: number;
  usdc: string;
  tokenMessenger: string;
  messageTransmitter: string;
}

export interface CCTPResult {
  status: string;
  transferId: string;
  burnTransactionId: string;
  burnTransactionHash?: string;
  mintTransactionId?: string;
  sourceChain: string;
  destinationChain: string;
  destinationAddress: string;
  amount: string;
  transferType: "standard" | "fast";
  estimatedTime: number;
  message: string;
  nextStep?: string;
  attestation?: {
    message: string;
    signature: string;
  };
  error?: string;
}

export interface TransactionData {
  id: string;
  state: string;
  operation?: string;
  createDate: string;
  txHash?: string;
  transactionHash?: string;
  amounts?: string[];
  blockchain?: string;
}

export interface WalletWithBalance {
  id: string;
  address: string;
  blockchain: string;
  usdcAmount?: string;
  gasAmount?: string;
  gasSymbol?: string;
  balances?: any[];
} 