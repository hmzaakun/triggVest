import fs from 'fs';
import path from 'path';
import { WalletCollection, SavedWalletData, SavedWallet, WalletWithBalance } from '../types';
import { GAS_TOKENS } from '../config/constants';
import { getWalletBalance } from './circle';

const WALLETS_FILE = path.join(__dirname, '../../wallets.json');

// Save wallets to file
export const saveWalletsToFile = async (walletData: SavedWalletData): Promise<void> => {
  try {
    let existingData: WalletCollection = {};
    
    // Read existing data
    if (fs.existsSync(WALLETS_FILE)) {
      const fileContent = fs.readFileSync(WALLETS_FILE, 'utf8');
      existingData = JSON.parse(fileContent);
    }
    
    // Add/update the wallet set
    existingData[walletData.walletSetName] = walletData;
    
    // Write back to file
    fs.writeFileSync(WALLETS_FILE, JSON.stringify(existingData, null, 2));
  } catch (error) {
    console.error('Error saving wallets to file:', error);
    throw error;
  }
};

// Load wallets from file
export const loadWalletsFromFile = (): WalletCollection => {
  try {
    if (!fs.existsSync(WALLETS_FILE)) {
      return {};
    }
    
    const fileContent = fs.readFileSync(WALLETS_FILE, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Error loading wallets from file:', error);
    return {};
  }
};

// Get all saved wallet sets
export const getSavedWalletSets = (): SavedWalletData[] => {
  const data = loadWalletsFromFile();
  return Object.values(data);
};

// Get wallet set by name
export const getWalletSetByName = (name: string): SavedWalletData | null => {
  const data = loadWalletsFromFile();
  return data[name] || null;
};

// Delete wallet set
export const deleteWalletSet = (name: string): boolean => {
  try {
    const data = loadWalletsFromFile();
    if (data[name]) {
      delete data[name];
      fs.writeFileSync(WALLETS_FILE, JSON.stringify(data, null, 2));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting wallet set:', error);
    return false;
  }
};

// Get balance for all wallets with caching
const balanceCache = new Map<string, { balance: any[], timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

export const getWalletBalanceWithCache = async (walletId: string) => {
  const now = Date.now();
  const cached = balanceCache.get(walletId);
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.balance;
  }
  
  try {
    const balance = await getWalletBalance(walletId);
    if (balance) {
      balanceCache.set(walletId, { balance, timestamp: now });
    }
    return balance;
  } catch (error) {
    console.error(`Error getting balance for wallet ${walletId}:`, error);
    return null;
  }
};

// Get balances for all wallets in a set
export const getWalletSetBalances = async (wallets: SavedWallet[]): Promise<WalletWithBalance[]> => {
  const walletsWithBalances: WalletWithBalance[] = [];
  
  for (const wallet of wallets) {
    try {
      const balances = await getWalletBalanceWithCache(wallet.id);
      const walletWithBalance: WalletWithBalance = {
        ...wallet,
        balances: balances || []
      };
      
      // Parse USDC and gas tokens
      if (balances) {
        for (const balance of balances) {
          if (balance.token.symbol === 'USDC') {
            walletWithBalance.usdcAmount = balance.amount;
          } else {
            // Check if this is a gas token for this blockchain
            const gasTokenSymbols = GAS_TOKENS[wallet.blockchain as keyof typeof GAS_TOKENS] || [];
            if (gasTokenSymbols.includes(balance.token.symbol)) {
              walletWithBalance.gasAmount = balance.amount;
              walletWithBalance.gasSymbol = balance.token.symbol;
            }
          }
        }
      }
      
      walletsWithBalances.push(walletWithBalance);
    } catch (error) {
      console.error(`Error getting balance for wallet ${wallet.id}:`, error);
      walletsWithBalances.push({
        ...wallet,
        balances: []
      });
    }
  }
  
  return walletsWithBalances;
};

// Check if wallet has sufficient funds for bridging
export const checkWalletBridgeReadiness = (wallet: WalletWithBalance, amount: string): {
  ready: boolean;
  hasUsdc: boolean;
  hasGas: boolean;
  usdcBalance: string;
  gasBalance: string;
  gasSymbol: string;
} => {
  const requiredUsdc = parseFloat(amount);
  const availableUsdc = parseFloat(wallet.usdcAmount || "0");
  const availableGas = parseFloat(wallet.gasAmount || "0");
  
  const hasUsdc = availableUsdc >= requiredUsdc;
  const hasGas = availableGas > 0; // Any amount of gas should be sufficient for testnet
  
  return {
    ready: hasUsdc && hasGas,
    hasUsdc,
    hasGas,
    usdcBalance: wallet.usdcAmount || "0",
    gasBalance: wallet.gasAmount || "0",
    gasSymbol: wallet.gasSymbol || "Unknown"
  };
};

// Check bridge readiness for all wallets
export const checkBridgeReadiness = async (
  walletSetName: string,
  sourceChain: string,
  amount: string
): Promise<{
  ready: boolean;
  sourceWallet?: WalletWithBalance;
  readinessDetails: string[];
}> => {
  const walletSet = getWalletSetByName(walletSetName);
  if (!walletSet) {
    return {
      ready: false,
      readinessDetails: ["❌ Wallet set not found"]
    };
  }

  const walletsWithBalances = await getWalletSetBalances(walletSet.wallets);
  const sourceWallet = walletsWithBalances.find(w => w.blockchain === sourceChain);
  
  if (!sourceWallet) {
    return {
      ready: false,
      readinessDetails: [`❌ No wallet found for ${sourceChain}`]
    };
  }

  const readiness = checkWalletBridgeReadiness(sourceWallet, amount);
  const details: string[] = [];
  
  if (readiness.ready) {
    details.push(`✅ ${sourceChain}: Ready for bridging`);
    details.push(`   • USDC: ${readiness.usdcBalance} (need ${amount})`);
    details.push(`   • ${readiness.gasSymbol}: ${readiness.gasBalance}`);
  } else {
    details.push(`❌ ${sourceChain}: Not ready for bridging`);
    
    if (!readiness.hasUsdc) {
      details.push(`   • ❌ USDC: ${readiness.usdcBalance} (need ${amount})`);
      details.push(`   • 💡 Get USDC from: https://faucet.circle.com/`);
    } else {
      details.push(`   • ✅ USDC: ${readiness.usdcBalance}`);
    }
    
    if (!readiness.hasGas) {
      details.push(`   • ❌ ${readiness.gasSymbol}: ${readiness.gasBalance} (need some for gas)`);
      details.push(`   • 💡 Get gas tokens from network-specific faucets`);
    } else {
      details.push(`   • ✅ ${readiness.gasSymbol}: ${readiness.gasBalance}`);
    }
  }
  
  return {
    ready: readiness.ready,
    sourceWallet: readiness.ready ? sourceWallet : undefined,
    readinessDetails: details
  };
};

// Find wallets by blockchain
export const findWalletsByBlockchain = (
  walletSet: SavedWalletData,
  blockchain: string
): SavedWallet[] => {
  return walletSet.wallets.filter(w => w.blockchain === blockchain);
};

// Get available blockchains in wallet set
export const getAvailableBlockchains = (walletSet: SavedWalletData): string[] => {
  const blockchains = new Set<string>();
  for (const wallet of walletSet.wallets) {
    blockchains.add(wallet.blockchain);
  }
  return Array.from(blockchains).sort();
};

// Format wallet display information
export const formatWalletDisplay = (wallet: SavedWallet): string => {
  return `${wallet.address} (${wallet.blockchain})`;
};

// Format balance display
export const formatBalanceDisplay = (balance: any): string => {
  const amount = parseFloat(balance.amount);
  if (amount === 0) {
    return `0 ${balance.token.symbol}`;
  }
  
  // Format based on token type
  if (balance.token.symbol === 'USDC') {
    return `${amount.toFixed(2)} ${balance.token.symbol}`;
  } else {
    return `${amount.toFixed(4)} ${balance.token.symbol}`;
  }
};

// Get wallet statistics
export const getWalletSetStatistics = async (walletSet: SavedWalletData) => {
  const walletsWithBalances = await getWalletSetBalances(walletSet.wallets);
  
  let totalUsdcBalance = 0;
  let walletsWithUsdc = 0;
  let walletsWithGas = 0;
  const blockchainStats: Record<string, { count: number; usdc: number; gas: number }> = {};
  
  for (const wallet of walletsWithBalances) {
    const blockchain = wallet.blockchain;
    if (!blockchainStats[blockchain]) {
      blockchainStats[blockchain] = { count: 0, usdc: 0, gas: 0 };
    }
    
    blockchainStats[blockchain].count++;
    
    const usdcAmount = parseFloat(wallet.usdcAmount || "0");
    const gasAmount = parseFloat(wallet.gasAmount || "0");
    
    if (usdcAmount > 0) {
      totalUsdcBalance += usdcAmount;
      walletsWithUsdc++;
      blockchainStats[blockchain].usdc += usdcAmount;
    }
    
    if (gasAmount > 0) {
      walletsWithGas++;
      blockchainStats[blockchain].gas += gasAmount;
    }
  }
  
  return {
    totalWallets: walletSet.wallets.length,
    totalUsdcBalance: totalUsdcBalance.toFixed(2),
    walletsWithUsdc,
    walletsWithGas,
    blockchainStats
  };
}; 