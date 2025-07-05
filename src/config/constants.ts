import { CCTPContractConfig, FaucetInfo } from "../types";

// Configuration CCTP V2 avec adresses officielles Circle (testnets)
export const CCTP_CONTRACTS: Record<string, CCTPContractConfig> = {
  "ETH-SEPOLIA": {
    domain: 0,
    usdc: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // Official Circle V2
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // Official Circle V2
  },
  "MATIC-AMOY": {
    domain: 7,
    usdc: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // Official Circle V2
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // Official Circle V2
  },
  "AVAX-FUJI": {
    domain: 1,
    usdc: "0x5425890298aed601595a70ab815c96711a31bc65",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // Official Circle V2
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // Official Circle V2
  },
  "ARB-SEPOLIA": {
    domain: 3,
    usdc: "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // Official Circle V2
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // Official Circle V2
  },
  "BASE-SEPOLIA": {
    domain: 6,
    usdc: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // Official Circle V2
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // Official Circle V2
  },
  "OP-SEPOLIA": {
    domain: 2,
    usdc: "0x5fd84259d66cd46123540766be93dfce6c4775b4",
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // Official Circle V2
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // Official Circle V2
  },
  "SOL-DEVNET": {
    domain: 5,
    usdc: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    tokenMessenger: "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe", // TokenMessengerMinterV2
    messageTransmitter: "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC", // MessageTransmitterV2
  },
};

// Informations des faucets pour tous les testnets supportés
export const FAUCET_INFO: Record<string, FaucetInfo[]> = {
  "ETH-SEPOLIA": [
    {
      name: "Sepolia ETH Faucet",
      url: "https://sepoliafaucet.com/",
      token: "ETH",
      amount: "0.5 ETH/day",
    },
    {
      name: "Alchemy Sepolia Faucet",
      url: "https://sepoliafaucet.net/",
      token: "ETH",
      amount: "0.5 ETH/day",
    },
  ],
  "MATIC-AMOY": [
    {
      name: "Polygon Amoy Faucet",
      url: "https://faucet.polygon.technology/",
      token: "MATIC",
      amount: "0.2 MATIC/day",
    },
  ],
  "AVAX-FUJI": [
    {
      name: "Avalanche Fuji Faucet",
      url: "https://faucet.avax.network/",
      token: "AVAX",
      amount: "2 AVAX/day",
    },
  ],
  "ARB-SEPOLIA": [
    {
      name: "Arbitrum Sepolia Faucet",
      url: "https://faucet.arbitrum.io/",
      token: "ETH",
      amount: "0.1 ETH/day",
    },
  ],
  "BASE-SEPOLIA": [
    {
      name: "Base Sepolia Faucet",
      url: "https://faucet.quicknode.com/base/sepolia",
      token: "ETH",
      amount: "0.1 ETH/day",
    },
  ],
  "OP-SEPOLIA": [
    {
      name: "Optimism Sepolia Faucet",
      url: "https://faucet.quicknode.com/optimism/sepolia",
      token: "ETH",
      amount: "0.1 ETH/day",
    },
  ],
};

// Configuration Circle API
export const CIRCLE_CONFIG = {
  SANDBOX_BASE_URL: "https://api-sandbox.circle.com",
  ATTESTATION_API_URL: "https://iris-api-sandbox.circle.com",
  TIMEOUT: {
    TRANSACTION_CONFIRMATION: 10 * 60 * 1000, // 10 minutes
    FAST_TRANSFER_ATTESTATION: 60 * 1000, // 1 minute
    STANDARD_TRANSFER_ATTESTATION: 20 * 60 * 1000, // 20 minutes
  },
};

// Configuration des fees CCTP
export const CCTP_FEES = {
  FAST_TRANSFER: {
    BASE_FEE: 0.01, // USDC
    MAX_FEE_WEI: "1000000", // 1 USDC en wei (6 decimales)
  },
  STANDARD_TRANSFER: {
    BASE_FEE: 0,
    MAX_FEE_WEI: "0",
  },
};

// Configuration des finality thresholds
export const FINALITY_THRESHOLDS = {
  FAST_TRANSFER: 0, // Soft finality
  STANDARD_TRANSFER: 1000, // Hard finality
};

// Configuration des tokens gas
export const GAS_TOKENS = {
  "ETH-SEPOLIA": ["ETH", "ETH-SEPOLIA"],
  "MATIC-AMOY": ["MATIC", "MATIC-AMOY", "POL"],
  "AVAX-FUJI": ["AVAX", "AVAX-FUJI"],
  "ARB-SEPOLIA": ["ETH", "ARB", "ARB-SEPOLIA"],
  "BASE-SEPOLIA": ["ETH", "BASE", "BASE-SEPOLIA"],
  "BASE-MAINNET": ["ETH", "BASE"],
  "OP-SEPOLIA": ["ETH", "OP", "OP-SEPOLIA"],
};

// Configuration pour Base Mainnet (pour les swaps)
export const BASE_MAINNET_CONFIG = {
  CHAIN_ID: 8453,
  NETWORK_NAME: "Base",
  USDC_ADDRESS: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  WETH_ADDRESS: "0x4200000000000000000000000000000000000006",
  NATIVE_TOKEN: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  ONEINCH_ROUTER: "0x111111125421cA6dc452d289314280a0f8842A65",
  RPC_URL: "https://base.llamarpc.com",
  EXPLORER: "https://basescan.org",
  SUPPORTED_BY_CIRCLE: true
};

// Messages d'aide
export const HELP_MESSAGES = {
  BRIDGE_REQUIREMENTS: `
📋 Requirements for CCTP bridge:
   ✅ USDC tokens (for the transfer)
   ✅ Native gas tokens (ETH, AVAX, MATIC for transaction fees)
   
💡 To get ready:
   1. Go back to wallet management
   2. Select "Get testnet funds (Faucets)"
   3. Get native tokens FIRST (ETH, AVAX, etc.)
   4. Then get USDC from Circle faucet
   
🔗 Funding Sources:
   • Native tokens: Use network-specific faucets
   • USDC tokens: https://faucet.circle.com/
   
⚠️  Why both are needed:
   • Native tokens pay for transaction gas fees
   • USDC tokens are what gets transferred via CCTP
  `,

  TIMEOUT_RECOVERY: `
🕐 Transaction Timeout Recovery:
   • Your transaction may still be processing on the blockchain
   • Testnets can be very slow, sometimes taking 15-30 minutes
   • The transaction might complete successfully later
   
🔄 Next steps:
   1. Use the 'Transaction Tracker' to check status
   2. Wait 10-15 more minutes before retrying
   3. Consider using a different source chain
   4. Ensure you have enough gas tokens for fees
   
💡 Pro tip: ETH-SEPOLIA is usually faster than MATIC-AMOY
  `,
};
