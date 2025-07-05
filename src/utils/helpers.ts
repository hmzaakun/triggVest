// Helper functions for TriggVest
import { format } from 'date-fns';

// Format currency amounts
export const formatCurrency = (amount: string | number, decimals: number = 4): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(num)) return '0';
  
  if (num === 0) return '0';
  
  // For very small amounts, show more decimals
  if (num < 0.0001) {
    return num.toExponential(2);
  }
  
  // For USDC amounts, use 2 decimals
  if (decimals === 2) {
    return num.toFixed(2);
  }
  
  // For other tokens, use 4 decimals
  return num.toFixed(decimals);
};

// Format date/time
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, 'MMM dd, yyyy HH:mm:ss');
  } catch (error) {
    return dateString;
  }
};

// Format transaction ID for display
export const formatTransactionId = (txId: string, maxLength: number = 16): string => {
  if (txId.length <= maxLength) return txId;
  return `${txId.slice(0, 8)}...${txId.slice(-8)}`;
};

// Format blockchain address
export const formatAddress = (address: string, maxLength: number = 16): string => {
  if (address.length <= maxLength) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Validate USDC amount
export const validateUSDCAmount = (amount: string): { valid: boolean; error?: string } => {
  const num = parseFloat(amount);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid number' };
  }
  
  if (num <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }
  
  if (num > 10000) {
    return { valid: false, error: 'Amount too large (max 10,000 USDC)' };
  }
  
  // Check for too many decimal places (USDC has 6 decimals)
  const decimals = amount.split('.')[1];
  if (decimals && decimals.length > 6) {
    return { valid: false, error: 'Too many decimal places (max 6)' };
  }
  
  return { valid: true };
};

// Sleep utility
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Retry with exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i === maxRetries - 1) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
  
  throw lastError!;
};

// Progress indicator
export class ProgressIndicator {
  private interval: NodeJS.Timeout | null = null;
  private dots = '';
  private message: string;
  
  constructor(message: string) {
    this.message = message;
  }
  
  start() {
    this.interval = setInterval(() => {
      process.stdout.write('\r' + this.message + this.dots);
      this.dots = this.dots.length >= 3 ? '' : this.dots + '.';
    }, 500);
  }
  
  stop(finalMessage?: string) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    if (finalMessage) {
      process.stdout.write('\r' + finalMessage + '\n');
    } else {
      process.stdout.write('\n');
    }
  }
}

// Convert Wei to human readable (USDC has 6 decimals)
export const weiToUsdc = (wei: string): string => {
  const num = parseFloat(wei) / 1000000; // 6 decimals for USDC
  return formatCurrency(num, 2);
};

// Convert human readable to Wei (USDC has 6 decimals)
export const usdcToWei = (usdc: string): string => {
  const num = parseFloat(usdc) * 1000000; // 6 decimals for USDC
  return Math.floor(num).toString();
};

// Check if string is valid transaction hash
export const isValidTxHash = (hash: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

// Check if string is valid Circle transaction ID
export const isValidCircleTxId = (id: string): boolean => {
  // Circle transaction IDs are UUIDs
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// Get blockchain display name
export const getBlockchainDisplayName = (blockchain: string): string => {
  const displayNames: Record<string, string> = {
    'ETH-SEPOLIA': 'Ethereum Sepolia',
    'MATIC-AMOY': 'Polygon Amoy',
    'AVAX-FUJI': 'Avalanche Fuji',
    'ARB-SEPOLIA': 'Arbitrum Sepolia',
    'BASE-SEPOLIA': 'Base Sepolia',
    'OP-SEPOLIA': 'Optimism Sepolia',
    'SOL-DEVNET': 'Solana Devnet'
  };
  
  return displayNames[blockchain] || blockchain;
};

// Get blockchain explorer URL
export const getBlockchainExplorer = (blockchain: string, txHash?: string): string => {
  const explorers: Record<string, string> = {
    'ETH-SEPOLIA': 'https://sepolia.etherscan.io',
    'MATIC-AMOY': 'https://amoy.polygonscan.com',
    'AVAX-FUJI': 'https://testnet.snowtrace.io',
    'ARB-SEPOLIA': 'https://sepolia.arbiscan.io',
    'BASE-SEPOLIA': 'https://sepolia.basescan.org',
    'OP-SEPOLIA': 'https://sepolia-optimism.etherscan.io',
  };
  
  const baseUrl = explorers[blockchain];
  if (!baseUrl) return '';
  
  if (txHash) {
    return `${baseUrl}/tx/${txHash}`;
  }
  
  return baseUrl;
};

// Generate unique ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Safe JSON parse
export const safeJsonParse = <T>(jsonString: string, defaultValue: T): T => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
};

// Calculate percentage
export const calculatePercentage = (part: number, total: number): string => {
  if (total === 0) return '0';
  return ((part / total) * 100).toFixed(1);
};

// Check if amount has sufficient balance
export const hasSufficientBalance = (
  balance: string,
  amount: string,
  reserveAmount: string = '0'
): boolean => {
  const balanceNum = parseFloat(balance);
  const amountNum = parseFloat(amount);
  const reserveNum = parseFloat(reserveAmount);
  
  return balanceNum >= (amountNum + reserveNum);
}; 