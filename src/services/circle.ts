import { initiateDeveloperControlledWalletsClient, registerEntitySecretCiphertext, Blockchain } from '@circle-fin/developer-controlled-wallets';
import * as forge from 'node-forge';
import { SavedWallet, TransactionData } from '../types';
import { CIRCLE_CONFIG } from '../config/constants';

// Initialize Circle client
export const createCircleClient = () => {
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });
};

// Get public key from Circle
export const getPublicKey = async (): Promise<string | undefined> => {
  const client = createCircleClient();
  const response = await client.getPublicKey();
  return response?.data?.publicKey;
};

// Register entity secret with Circle
export const registerEntitySecret = async (entitySecretCiphertext: string) => {
  const response = await registerEntitySecretCiphertext({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: entitySecretCiphertext,
  });
  return response.data?.recoveryFile;
};

// Create wallet set
export const createWalletSet = async (name: string) => {
  const client = createCircleClient();
  
  try {
    const response = await client.createWalletSet({
      name: name,
    });
    return response.data?.walletSet;
  } catch (error) {
    console.error("Error creating wallet set:", error);
    throw error;
  }
};

// Create wallets
export const createWallet = async (
  walletSetId: string,
  blockchains: Blockchain[],
  refId?: string
): Promise<SavedWallet[] | undefined> => {
  const client = createCircleClient();

  try {
    const response = await client.createWallets({
      blockchains: blockchains,
      count: 1,
      walletSetId: walletSetId,
      accountType: "EOA",
      // refId: refId, // TODO: refId not supported in current Circle API
    });

    // Convert Circle Wallet type to SavedWallet type
    const wallets = response.data?.wallets;
    if (!wallets) return undefined;
    
    return wallets.map(wallet => ({
      ...wallet,
      accountType: "EOA", // Add the missing property
      walletSetId: walletSetId
    }));
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw error;
  }
};

// List existing wallets
export const listExistingWallets = async () => {
  const client = createCircleClient();

  try {
    const response = await client.listWallets({
      pageSize: 50,
    });
    return response.data?.wallets || [];
  } catch (error) {
    console.error("Error listing wallets:", error);
    return [];
  }
};

// Get wallet balance
export const getWalletBalance = async (walletId: string) => {
  const client = createCircleClient();

  try {
    const response = await client.getWalletTokenBalance({
      id: walletId,
    });
    return response.data?.tokenBalances;
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    return null;
  }
};

// Create contract execution transaction
export const createContractTransaction = async (params: {
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: any[];
  feeLevel?: "LOW" | "MEDIUM" | "HIGH";
}) => {
  const client = createCircleClient();
  
  const response = await client.createContractExecutionTransaction({
    walletId: params.walletId,
    contractAddress: params.contractAddress,
    abiFunctionSignature: params.abiFunctionSignature,
    abiParameters: params.abiParameters,
    fee: {
      type: "level",
      config: {
        feeLevel: params.feeLevel || "MEDIUM"
      }
    }
  });

  return response;
};

// Get transaction status
export const getTransactionStatus = async (transactionId: string): Promise<TransactionData> => {
  const client = createCircleClient();

  try {
    const response = await client.getTransaction({
      id: transactionId,
    });
    return response.data as TransactionData;
  } catch (error) {
    console.error("Error getting transaction status:", error);
    throw error;
  }
};

// List recent transactions
export const listRecentTransactions = async (pageSize: number = 10) => {
  const client = createCircleClient();

  try {
    const response = await client.listTransactions({
      pageSize: pageSize,
    });
    return response.data?.transactions || [];
  } catch (error) {
    console.error("Error listing transactions:", error);
    return [];
  }
};

// Wait for transaction confirmation with timeout
export const waitForTransactionConfirmation = async (transactionId: string, timeoutMinutes: number = 10) => {
  const client = createCircleClient();
  const maxAttempts = timeoutMinutes * 12; // 5 second intervals
  let attempts = 0;
  
  console.log(`   ⏳ Waiting for transaction confirmation (up to ${timeoutMinutes} minutes for testnets)...`);
  
  while (attempts < maxAttempts) {
    try {
      const transactionData = await getTransactionStatus(transactionId);
      
      if (attempts % 6 === 0) { // Log every 30 seconds
        const minutes = (attempts * 5 / 60).toFixed(1);
        console.log(`   ⏳ Status: ${transactionData.state} (${attempts}/${maxAttempts}) - ${minutes}min`);
      }
      
      if (transactionData.state === "COMPLETE" || transactionData.state === "CONFIRMED") {
        console.log(`   ✅ Transaction ${transactionData.state.toLowerCase()}!`);
        return transactionData;
      }
      
      if (transactionData.state === "FAILED") {
        throw new Error(`Transaction failed: ${transactionData.id}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      console.error(`Error checking transaction status: ${error}`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log(`\n❌ Transaction timeout after ${timeoutMinutes} minutes`);
  console.log(`\n🔍 Possible reasons:`);
  console.log(`   • Testnet congestion (try again later)`);
  console.log(`   • Low gas price (transaction stuck in mempool)`);
  console.log(`   • Insufficient gas balance for transaction fees`);
  console.log(`\n💡 What to do:`);
  console.log(`   1. Check your transaction on the blockchain explorer`);
  console.log(`   2. Wait longer - testnet can be very slow`);
  console.log(`   3. Ensure you have enough native tokens for gas fees`);
  console.log(`   4. Try again with a different source chain`);
  console.log(`\n🔗 Check transaction: Circle Developer Console`);
  
  throw new Error(`Transaction ${transactionId} confirmation timeout after ${timeoutMinutes} minutes`);
};

// Setup encrypted entity secret for new wallet sets
export const setupEncryptedEntitySecret = async (walletSetName: string) => {
  try {
    const rawPublicKey = await getPublicKey();
    if (!rawPublicKey) {
      throw new Error("Failed to get public key from Circle API");
    }

    const entitySecret = forge.util.hexToBytes(process.env.CIRCLE_ENTITY_SECRET!);
    const publicKey = forge.pki.publicKeyFromPem(rawPublicKey);
    const encryptedData = publicKey.encrypt(entitySecret, "RSA-OAEP", {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() },
    });

    return forge.util.encode64(encryptedData);
  } catch (error) {
    console.error("Error setting up encrypted entity secret:", error);
    throw error;
  }
}; 