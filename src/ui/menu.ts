import inquirer from 'inquirer';
import { getSavedWalletSets } from '../services/wallet';
import { quickTransactionCheck } from '../services/transaction';
import { showWalletManagement } from './walletManagement';
import { showBridgeInterface } from './bridge';
import { showBaseSwapInterface } from './baseSwap';
import { showUniswapSwapInterface } from './uniswapSwap';

// Main menu
export const showMainMenu = async (): Promise<void> => {
  console.log(`\n🚀 Welcome to TriggVest Wallet Manager!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const walletSets = getSavedWalletSets();
  const choices = [];

  // Add wallet management options
  if (walletSets.length > 0) {
    choices.push({ name: "📋 Manage existing wallet sets", value: "manage" });
  }

  choices.push(
    { name: "🆕 Create new wallet set", value: "create" },
    { name: "🔄 CCTP Bridge", value: "bridge" },
    { name: "🔷 Base Swap (1inch)", value: "base_swap" },
    { name: "🦄 Uniswap Swap (Base)", value: "uniswap_swap" },
    { name: "🔍 Track transactions", value: "track" },
    { name: "⚡ Check recent CCTP transactions", value: "check_recent_cctp" },
    { name: "🚪 Exit", value: "exit" }
  );

  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: choices,
    },
  ]);

  switch (action) {
    case "manage":
      await showWalletManagement();
      await showMainMenu();
      break;
    case "create":
      await showWalletCreation();
      await showMainMenu();
      break;
    case "bridge":
      await showBridgeMenu();
      await showMainMenu();
      break;
    case "base_swap":
      await showBaseSwapMenu();
      await showMainMenu();
      break;
    case "uniswap_swap":
      await showUniswapSwapMenu();
      await showMainMenu();
      break;
    case "track":
      await showTransactionMenu();
      await showMainMenu();
      break;
    case "check_recent_cctp":
      await checkRecentCCTPTransactions();
      await showMainMenu();
      break;
    case "exit":
      console.log("\n👋 Goodbye!");
      process.exit(0);
      break;
  }
};

// Wallet creation menu
const showWalletCreation = async () => {
  const { showWalletCreationFlow } = await import('./walletManagement');
  await showWalletCreationFlow();
};

// Transaction menu
const showTransactionMenu = async () => {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action", 
      message: "Transaction tracking options:",
      choices: [
        { name: "📊 List recent transactions", value: "list" },
        { name: "🔍 Check specific transaction ID", value: "check_id" },
        { name: "🔄 Monitor transaction progress", value: "monitor" },
        { name: "🔙 Back to main menu", value: "back" }
      ]
    }
  ]);

  if (action === "back") return;

  const { listAndAnalyzeRecentTransactions, monitorTransactionProgress, getTransactionSummary } = await import('../services/transaction');

  switch (action) {
    case "list":
      await listAndAnalyzeRecentTransactions();
      break;
    case "check_id":
      const { transactionId } = await inquirer.prompt([
        {
          type: "input",
          name: "transactionId",
          message: "Enter transaction ID to check:",
          validate: (input) => input.length > 0 || "Transaction ID cannot be empty"
        }
      ]);
      const summary = await getTransactionSummary(transactionId);
      console.log(`\n📊 Transaction Summary:`);
      console.log(`   ID: ${summary.id}`);
      console.log(`   Status: ${summary.status}`);
      console.log(`   Operation: ${summary.operation}`);
      console.log(`   Created: ${summary.created}`);
      if (summary.hash) console.log(`   Hash: ${summary.hash}`);
      break;
    case "monitor":
      const { transactionId: monitorId } = await inquirer.prompt([
        {
          type: "input",
          name: "transactionId",
          message: "Enter transaction ID to monitor:",
          validate: (input) => input.length > 0 || "Transaction ID cannot be empty"
        }
      ]);
      await monitorTransactionProgress(monitorId, 15);
      break;
  }
};

// Bridge menu
const showBridgeMenu = async () => {
  const walletSets = getSavedWalletSets();
  if (walletSets.length === 0) {
    console.log('❌ Aucun wallet set disponible. Créez d\'abord un wallet set.');
    return;
  }

  const { walletSetName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'walletSetName',
      message: 'Sélectionnez un wallet set pour le bridge:',
      choices: walletSets.map(ws => ({ name: ws.walletSetName, value: ws.walletSetName }))
    }
  ]);

  await showBridgeInterface(walletSetName);
};

// Base Swap menu
const showBaseSwapMenu = async () => {
  const walletSets = getSavedWalletSets();
  if (walletSets.length === 0) {
    console.log('❌ Aucun wallet set disponible. Créez d\'abord un wallet set.');
    return;
  }

  const { walletSetName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'walletSetName',
      message: 'Sélectionnez un wallet set pour le swap Base:',
      choices: walletSets.map(ws => ({ name: ws.walletSetName, value: ws.walletSetName }))
    }
  ]);

  await showBaseSwapInterface(walletSetName);
};

// Uniswap Swap menu
const showUniswapSwapMenu = async () => {
  const walletSets = getSavedWalletSets();
  if (walletSets.length === 0) {
    console.log('❌ Aucun wallet set disponible. Créez d\'abord un wallet set.');
    return;
  }

  const { walletSetName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'walletSetName',
      message: 'Sélectionnez un wallet set pour le swap Uniswap:',
      choices: walletSets.map(ws => ({ name: ws.walletSetName, value: ws.walletSetName }))
    }
  ]);

  await showUniswapSwapInterface(walletSetName);
};

// Check recent CCTP transactions
const checkRecentCCTPTransactions = async () => {
  const recentCCTPIds = [
    "7195b723-c1ee-56ed-96a6-f9896fd7d3f5",
    "ca983970-0383-5c91-97f7-e503cd93d0ee"
  ];
  
  console.log(`\n🎯 Checking your recent CCTP transactions...`);
  console.log(`💡 These are the approval transactions that timed out - let's see if they actually succeeded!`);
  
  await quickTransactionCheck(recentCCTPIds);
}; 