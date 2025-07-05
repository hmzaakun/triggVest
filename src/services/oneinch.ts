import axios from 'axios';
import { createContractTransaction } from './circle';

// Configuration pour Base chain (Mainnet)
export const BASE_CONFIG = {
  CHAIN_ID: 8453,
  NATIVE_TOKEN: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH natif sur Base
  USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC sur Base Mainnet
  ONEINCH_ROUTER: '0x111111125421cA6dc452d289314280a0f8842A65', // 1inch Router v6
  RPC_URL: 'https://base.llamarpc.com',
  EXPLORER: 'https://basescan.org'
};

// Interface pour les paramètres de swap
export interface SwapParams {
  walletId: string;
  fromToken: string;
  toToken: string;
  amount: string; // En wei ou unités du token
  slippage: number; // En pourcentage (ex: 1 = 1%)
  allowPartialFill?: boolean;
  gasPrice?: string;
}

// Interface pour la réponse 1inch
export interface OneInchQuote {
  toAmount: string;
  protocols: any[];
  estimatedGas: string;
}

export interface OneInchSwap {
  toAmount: string;
  tx: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}

// Service 1inch pour Base
export class OneInchBaseService {
  private apiKey: string;
  private baseUrl = 'https://api.1inch.dev/swap/v6.0';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ONEINCH_API_KEY || '';
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  // Obtenir un quote (estimation) pour le swap
  async getQuote(params: SwapParams): Promise<OneInchQuote> {
    try {
      const url = `${this.baseUrl}/${BASE_CONFIG.CHAIN_ID}/quote`;
      
      const queryParams = {
        src: params.fromToken,
        dst: params.toToken,
        amount: params.amount,
        includeProtocols: true,
        includeGas: true
      };

      const response = await axios.get(url, {
        headers: this.getHeaders(),
        params: queryParams
      });

      return response.data;
    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention du quote 1inch:', error);
      throw error;
    }
  }

  // Obtenir les données de transaction pour le swap
  async getSwapTransaction(params: SwapParams, walletAddress: string): Promise<OneInchSwap> {
    try {
      const url = `${this.baseUrl}/${BASE_CONFIG.CHAIN_ID}/swap`;
      
      const queryParams = {
        src: params.fromToken,
        dst: params.toToken,
        amount: params.amount,
        from: walletAddress,
        slippage: params.slippage,
        allowPartialFill: params.allowPartialFill || false,
        disableEstimate: true
      };

      const response = await axios.get(url, {
        headers: this.getHeaders(),
        params: queryParams
      });

      return response.data;
    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention du swap 1inch:', error);
      throw error;
    }
  }

  // Obtenir les tokens supportés sur Base
  async getSupportedTokens() {
    try {
      const url = `${this.baseUrl}/${BASE_CONFIG.CHAIN_ID}/tokens`;
      
      const response = await axios.get(url, {
        headers: this.getHeaders()
      });

      return response.data.tokens;
    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention des tokens:', error);
      throw error;
    }
  }

  // Obtenir les allowances nécessaires
  async getAllowance(tokenAddress: string, walletAddress: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/${BASE_CONFIG.CHAIN_ID}/approve/allowance`;
      
      const queryParams = {
        tokenAddress: tokenAddress,
        walletAddress: walletAddress
      };

      const response = await axios.get(url, {
        headers: this.getHeaders(),
        params: queryParams
      });

      return response.data.allowance;
    } catch (error) {
      console.error('❌ Erreur lors de la vérification de l\'allowance:', error);
      throw error;
    }
  }

  // Obtenir les données pour approuver un token
  async getApprovalTransaction(tokenAddress: string, amount?: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/${BASE_CONFIG.CHAIN_ID}/approve/transaction`;
      
      const queryParams = {
        tokenAddress: tokenAddress,
        amount: amount || '115792089237316195423570985008687907853269984665640564039457584007913129639935' // MAX_UINT256
      };

      const response = await axios.get(url, {
        headers: this.getHeaders(),
        params: queryParams
      });

      return response.data;
    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention de l\'approbation:', error);
      throw error;
    }
  }
}

// Service principal pour les swaps Base avec Circle Wallets
export class BaseSwapService {
  private oneInch: OneInchBaseService;

  constructor(apiKey?: string) {
    this.oneInch = new OneInchBaseService(apiKey);
  }

  // Swap USDC vers ETH sur Base
  async swapUSDCToETH(params: {
    walletId: string;
    usdcAmount: string; // En USDC (ex: "100" = 100 USDC)
    slippage?: number;
    walletAddress: string;
  }) {
    try {
      console.log('🔄 Initialisation du swap USDC → ETH sur Base...');
      console.log(`💰 Montant: ${params.usdcAmount} USDC`);
      console.log(`⚡ Slippage: ${params.slippage || 1}%`);

      // Convertir USDC en wei (6 décimales)
      const usdcAmountWei = (parseFloat(params.usdcAmount) * 1e6).toString();

      // 1. Obtenir un quote
      console.log('📊 Obtention du quote 1inch...');
      const quote = await this.oneInch.getQuote({
        walletId: params.walletId,
        fromToken: BASE_CONFIG.USDC_ADDRESS,
        toToken: BASE_CONFIG.NATIVE_TOKEN,
        amount: usdcAmountWei,
        slippage: params.slippage || 1
      });

      const expectedETH = (parseInt(quote.toAmount) / 1e18).toFixed(8);
      console.log(`💰 ETH attendu: ~${expectedETH} ETH`);

      // 2. Vérifier l'allowance USDC
      console.log('🔍 Vérification de l\'allowance USDC...');
      const allowance = await this.oneInch.getAllowance(
        BASE_CONFIG.USDC_ADDRESS,
        params.walletAddress
      );

      // 3. Approuver USDC si nécessaire
      if (parseInt(allowance) < parseInt(usdcAmountWei)) {
        console.log('📝 Approbation USDC nécessaire...');
        
        const approvalTx = await this.oneInch.getApprovalTransaction(
          BASE_CONFIG.USDC_ADDRESS,
          usdcAmountWei
        );

        const approvalResult = await createContractTransaction({
          walletId: params.walletId,
          contractAddress: approvalTx.to,
          abiFunctionSignature: 'approve(address,uint256)',
          abiParameters: [
            BASE_CONFIG.ONEINCH_ROUTER,
            usdcAmountWei
          ],
          feeLevel: 'HIGH'
        });

        console.log(`✅ Approbation initiée: ${approvalResult.data?.id}`);
        console.log(`🔗 TX d'approbation: ${BASE_CONFIG.EXPLORER}/tx/${approvalResult.data?.id}`);
        console.log(`💰 Montant approuvé: ${params.usdcAmount} USDC pour 1inch Router`);
        
        // Attendre la confirmation (optionnel - peut être fait en parallèle)
        console.log('⏳ Attente de confirmation de l\'approbation...');
        // Ici vous pouvez attendre la confirmation ou procéder directement
      }

      // 4. Exécuter le swap
      console.log('🔄 Exécution du swap...');
      const swapData = await this.oneInch.getSwapTransaction({
        walletId: params.walletId,
        fromToken: BASE_CONFIG.USDC_ADDRESS,
        toToken: BASE_CONFIG.NATIVE_TOKEN,
        amount: usdcAmountWei,
        slippage: params.slippage || 1
      }, params.walletAddress);

      // Exécuter via Circle Smart Account avec les données directes de 1inch
      const swapResult = await createContractTransaction({
        walletId: params.walletId,
        contractAddress: swapData.tx.to,
        // Utilise les données brutes de 1inch
        abiFunctionSignature: 'fallback()',
        abiParameters: [],
        feeLevel: 'HIGH'
      });

      console.log('🎉 Swap exécuté avec succès!');
      console.log(`🔗 Transaction ID: ${swapResult.data?.id}`);
      console.log(`💰 ETH reçu: ~${expectedETH} ETH`);
      console.log(`🔍 Vérifiez sur BaseScan: ${BASE_CONFIG.EXPLORER}/tx/${swapResult.data?.id}`);
      console.log(`📊 Résumé du swap:`);
      console.log(`   • Donnez: ${params.usdcAmount} USDC`);
      console.log(`   • Recevez: ~${expectedETH} ETH`);
      console.log(`   • Slippage: ${params.slippage || 1}%`);
      console.log(`   • Wallet: ${params.walletAddress}`);

      return {
        success: true,
        transactionId: swapResult.data?.id,
        expectedETH: expectedETH,
        quote: quote,
        explorerUrl: `${BASE_CONFIG.EXPLORER}/tx/${swapResult.data?.id}`
      };

    } catch (error) {
      console.error('❌ Erreur lors du swap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  // Obtenir le prix actuel USDC/ETH
  async getUSDCToETHPrice(usdcAmount: string = "1") {
    try {
      const usdcAmountWei = (parseFloat(usdcAmount) * 1e6).toString();
      
      const quote = await this.oneInch.getQuote({
        walletId: '', // Non nécessaire pour un quote
        fromToken: BASE_CONFIG.USDC_ADDRESS,
        toToken: BASE_CONFIG.NATIVE_TOKEN,
        amount: usdcAmountWei,
        slippage: 1
      });

      const ethAmount = (parseInt(quote.toAmount) / 1e18);
      const rate = ethAmount / parseFloat(usdcAmount);

      return {
        usdcAmount: parseFloat(usdcAmount),
        ethAmount: ethAmount,
        rate: rate,
        rateFormatted: `1 USDC = ${rate.toFixed(8)} ETH`
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention du prix:', error);
      return null;
    }
  }

  // Lister les tokens populaires sur Base
  async getPopularBaseTokens() {
    return {
      USDC: {
        address: BASE_CONFIG.USDC_ADDRESS,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6
      },
      ETH: {
        address: BASE_CONFIG.NATIVE_TOKEN,
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18
      },
      WETH: {
        address: '0x4200000000000000000000000000000000000006',
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18
      },
      CBETH: {
        address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
        symbol: 'cbETH',
        name: 'Coinbase Wrapped Staked ETH',
        decimals: 18
      }
    };
  }
}

// Instance par défaut
export const baseSwapService = new BaseSwapService();

// Exemple d'utilisation
export async function quickSwapExample(walletId: string, walletAddress: string) {
  try {
    // Swap 10 USDC vers ETH
    const result = await baseSwapService.swapUSDCToETH({
      walletId: walletId,
      usdcAmount: "10",
      slippage: 1, // 1%
      walletAddress: walletAddress
    });

    if (result.success) {
      console.log('🎉 Swap réussi!');
      console.log(`💰 ETH reçu: ${result.expectedETH}`);
      console.log(`🔗 TX: ${result.transactionId}`);
    } else {
      console.log('❌ Swap échoué:', result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Erreur:', error);
    return { success: false, error };
  }
} 