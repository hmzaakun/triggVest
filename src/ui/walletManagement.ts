import inquirer from 'inquirer';
import { Blockchain } from '@circle-fin/developer-controlled-wallets';
import { 
  getSavedWalletSets, 
  getWalletSetByName, 
  getWalletSetBalances,
  checkBridgeReadiness,
  getWalletSetStatistics,
  formatBalanceDisplay 
} from '../services/wallet';
import { createWalletSet, createWallet, setupEncryptedEntitySecret } from '../services/circle';
import { FAUCET_INFO } from '../config/constants';
import { SavedWalletData } from '../types';
import { showBridgeInterface } from './bridge';

// Show wallet management
export const showWalletManagement = async () => {
  const walletSets = getSavedWalletSets();
  
  if (walletSets.length === 0) {
    console.log(`\n📭 No wallet sets found. Create one first!`);
    return;
  }

  const choices = walletSets.map(ws => ({
    name: `${ws.walletSetName} (${ws.wallets.length} wallets)`,
    value: ws.walletSetName
  }));

  const { selectedSet } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedSet",
      message: "Select a wallet set:",
      choices: choices
    }
  ]);

  await showWalletSetMenu(selectedSet);
};

// Wallet set menu
const showWalletSetMenu = async (walletSetName: string) => {
  const walletSet = getWalletSetByName(walletSetName);
  if (!walletSet) return;

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: `What would you like to do with "${walletSetName}"?`,
      choices: [
        { name: "👀 View wallet details", value: "details" },
        { name: "💰 Check balances", value: "balances" },
        { name: "🚀 Quick bridge readiness check", value: "readiness" },
        { name: "💧 Get testnet funds (Faucets)", value: "faucets" },
        { name: "🌉 Bridge funds between chains", value: "bridge" },
        { name: "🔙 Back to main menu", value: "back" }
      ]
    }
  ]);

  switch (action) {
    case "details":
      await showWalletDetails(walletSet);
      await continueOrReturn(walletSetName);
      break;
    case "balances":
      await showWalletBalances(walletSet);
      await continueOrReturn(walletSetName);
      break;
    case "readiness":
      await showBridgeReadinessCheck(walletSetName);
      await continueOrReturn(walletSetName);
      break;
    case "faucets":
      await showFaucetInfo(walletSet);
      await continueOrReturn(walletSetName);
      break;
    case "bridge":
      await showBridgeInterface(walletSetName);
      await continueOrReturn(walletSetName);
      break;
    case "back":
      return;
  }
};

// Show wallet details
const showWalletDetails = async (walletSet: SavedWalletData) => {
  console.log(`\n📋 Wallet Set: ${walletSet.walletSetName}`);
  console.log(`🆔 ID: ${walletSet.walletSetId}`);
  console.log(`🕐 Last Updated: ${walletSet.lastUpdated}`);
  console.log(`📊 Wallets (${walletSet.wallets.length}):`);
  
  walletSet.wallets.forEach((wallet, index) => {
    console.log(`   ${index + 1}. ${wallet.address} (${wallet.blockchain})`);
  });
};

// Show wallet balances
const showWalletBalances = async (walletSet: SavedWalletData) => {
  console.log(`\n💰 Checking balances for "${walletSet.walletSetName}"...`);
  
  const walletsWithBalances = await getWalletSetBalances(walletSet.wallets);
  const stats = await getWalletSetStatistics(walletSet);
  
  console.log(`\n📊 Balance Summary:`);
  console.log(`   💰 Total USDC: ${stats.totalUsdcBalance}`);
  console.log(`   ✅ Wallets with USDC: ${stats.walletsWithUsdc}/${stats.totalWallets}`);
  console.log(`   ⛽ Wallets with gas: ${stats.walletsWithGas}/${stats.totalWallets}`);
  
  console.log(`\n📋 Individual Balances:`);
  for (const wallet of walletsWithBalances) {
    console.log(`\n   🌐 ${wallet.blockchain}:`);
    console.log(`      📍 ${wallet.address}`);
    
    if (wallet.balances && wallet.balances.length > 0) {
      wallet.balances.forEach(balance => {
        console.log(`      💰 ${formatBalanceDisplay(balance)}`);
      });
    } else {
      console.log(`      💰 No tokens found`);
    }
  }
};

// Show bridge readiness check
const showBridgeReadinessCheck = async (walletSetName: string) => {
  const { sourceChain, amount } = await inquirer.prompt([
    {
      type: "list",
      name: "sourceChain",
      message: "Select source chain:",
      choices: ["ETH-SEPOLIA", "MATIC-AMOY", "AVAX-FUJI", "ARB-SEPOLIA", "BASE-SEPOLIA", "OP-SEPOLIA"]
    },
    {
      type: "input",
      name: "amount",
      message: "Enter USDC amount to bridge:",
      default: "1",
      validate: (input) => !isNaN(parseFloat(input)) && parseFloat(input) > 0 || "Please enter a valid amount"
    }
  ]);

  console.log(`\n🚀 Bridge Readiness Check:`);
  const readiness = await checkBridgeReadiness(walletSetName, sourceChain, amount);
  
  readiness.readinessDetails.forEach(detail => {
    console.log(`   ${detail}`);
  });
  
  if (!readiness.ready) {
    console.log(`\n💡 To get ready for bridging:`);
    console.log(`   1. Use "Get testnet funds (Faucets)" option`);
    console.log(`   2. Get native tokens first, then USDC`);
    console.log(`   3. Wait 2-5 minutes for funds to arrive`);
    console.log(`   4. Run this check again`);
  }
};

// Show faucet information
const showFaucetInfo = async (walletSet: SavedWalletData) => {
  console.log(`\n💧 Testnet Faucet Information`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const blockchains = Array.from(new Set(walletSet.wallets.map(w => w.blockchain)));
  
  for (const blockchain of blockchains) {
    const wallet = walletSet.wallets.find(w => w.blockchain === blockchain);
    if (!wallet) continue;
    
    console.log(`\n🌐 ${blockchain}:`);
    console.log(`   📍 Address: ${wallet.address}`);
    
    const faucets = FAUCET_INFO[blockchain] || [];
    if (faucets.length > 0) {
      console.log(`   💧 Native Token Faucets:`);
      faucets.forEach(faucet => {
        console.log(`      • ${faucet.name}: ${faucet.url}`);
        console.log(`        Token: ${faucet.token}, Amount: ${faucet.amount}`);
      });
    }
    
    console.log(`   💰 USDC Faucet:`);
    console.log(`      • Circle USDC Faucet: https://faucet.circle.com/`);
    console.log(`        Token: USDC, Amount: 10 USDC/request`);
  }
  
  console.log(`\n💡 Funding Steps:`);
  console.log(`   1. Get native tokens (ETH, AVAX, MATIC) for gas fees`);
  console.log(`   2. Get USDC tokens for bridging`);
  console.log(`   3. Wait 2-5 minutes for confirmation`);
  console.log(`   4. Check balances to verify funds arrived`);
};

// Wallet creation flow
export const showWalletCreationFlow = async () => {
  console.log(`\n🆕 Create New Wallet Set`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  const { walletSetName, blockchains } = await inquirer.prompt([
    {
      type: "input",
      name: "walletSetName",
      message: "Enter wallet set name:",
      validate: (input) => input.trim().length > 0 || "Name cannot be empty"
    },
    {
      type: "checkbox",
      name: "blockchains",
      message: "Select blockchains to create wallets for:",
      choices: [
        { name: "Ethereum Sepolia", value: Blockchain.EthSepolia },
        { name: "Polygon Amoy", value: Blockchain.MaticAmoy },
        { name: "Avalanche Fuji", value: Blockchain.AvaxFuji },
        { name: "Arbitrum Sepolia", value: Blockchain.ArbSepolia },
        { name: "Base Sepolia", value: Blockchain.BaseSepolia },
        { name: "Optimism Sepolia", value: Blockchain.OpSepolia }
      ],
      validate: (choices) => choices.length > 0 || "Select at least one blockchain"
    }
  ]);

  try {
    console.log(`\n🔐 Setting up encrypted entity secret...`);
    await setupEncryptedEntitySecret(walletSetName);
    
    console.log(`\n🆕 Creating wallet set "${walletSetName}"...`);
    const walletSet = await createWalletSet(walletSetName);
    
    if (!walletSet) {
      throw new Error("Failed to create wallet set");
    }
    
    console.log(`✅ Wallet set created: ${walletSet.id}`);
    
    console.log(`\n🔨 Creating wallets for ${blockchains.length} blockchains...`);
    const createdWallets = await createWallet(walletSet.id, blockchains);
    
    if (createdWallets && createdWallets.length > 0) {
      console.log(`✅ Created ${createdWallets.length} wallets successfully!`);
      
      // Save to file
      const { saveWalletsToFile } = await import('../services/wallet');
      await saveWalletsToFile({
        walletSetId: walletSet.id,
        walletSetName: walletSetName,
        wallets: createdWallets,
        lastUpdated: new Date().toISOString()
      });
      
      console.log(`✅ Wallets saved to file.`);
    }
    
  } catch (error) {
    console.error(`❌ Error creating wallet set:`, error);
  }
};

// Continue or return helper
const continueOrReturn = async (walletSetName: string) => {
  const { continue: shouldContinue } = await inquirer.prompt([
    {
      type: "confirm",
      name: "continue",
      message: "Do you want to perform another action?",
      default: true
    }
  ]);
  
  if (shouldContinue) {
    await showWalletSetMenu(walletSetName);
  }
}; 