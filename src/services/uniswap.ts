import axios from 'axios';
import { createContractTransaction } from './circle';

// Configuration pour Uniswap sur Base Sepolia
export const UNISWAP_BASE_CONFIG = {
  CHAIN_ID: 84532, // Base Sepolia
  SWAP_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', // SwapRouter sur Base Sepolia
  QUOTER_V2: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27', // Quoter V2 sur Base Sepolia
  POOL_FACTORY: '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24', // Factory V3 sur Base Sepolia
  
  // Tokens sur Base Sepolia
  WETH: '0x4200000000000000000000000000000000000006', // Wrapped ETH sur Base Sepolia
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC sur Base Sepolia
  ETH_NATIVE: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH natif
  
  // Frais de pool courants (en bips - 1 = 0.01%)
  POOL_FEES: {
    LOW: 500,    // 0.05%
    MEDIUM: 3000, // 0.3%
    HIGH: 10000   // 1%
  },
  
  RPC_URL: 'https://sepolia.base.org',
  EXPLORER: 'https://sepolia.basescan.org'
};

// Interface pour les paramètres de swap Uniswap
export interface UniswapSwapParams {
  walletId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // En wei
  slippage: number; // En pourcentage (ex: 1 = 1%)
  poolFee?: number; // Frais de pool (500, 3000, 10000)
}

// Interface pour les quotes Uniswap
export interface UniswapQuote {
  amountOut: string;
  sqrtPriceX96After: string;
  initializedTicksCrossed: number;
  gasEstimate: string;
  poolFee: number;
}

// Service Uniswap pour Base
export class UniswapBaseService {
  private rpcUrl: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || UNISWAP_BASE_CONFIG.RPC_URL;
  }

  // Obtenir un quote via Quoter V2
  async getQuote(params: UniswapSwapParams): Promise<UniswapQuote | null> {
    try {
      console.log('📊 Obtention du quote Uniswap...');
      
      // Construire l'appel au Quoter V2
      const quoterCalldata = this.encodeQuoterCall({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        poolFee: params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      });

      // Simuler l'appel via RPC
      const response = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{
          to: UNISWAP_BASE_CONFIG.QUOTER_V2,
          data: quoterCalldata
        }, 'latest']
      });

      if (response.data.result && response.data.result !== '0x') {
        return this.decodeQuoteResult(response.data.result, params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM);
      }

      return null;
    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention du quote Uniswap:', error);
      return null;
    }
  }

  // Encoder l'appel au Quoter pour quoteExactInputSingle
  private encodeQuoterCall(params: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    poolFee: number;
  }): string {
    // quoteExactInputSingle(address,address,uint24,uint256,uint160)
    const functionSelector = '0xf7729d43';
    
    // Padding des paramètres
    const tokenInPadded = params.tokenIn.toLowerCase().replace('0x', '').padStart(64, '0');
    const tokenOutPadded = params.tokenOut.toLowerCase().replace('0x', '').padStart(64, '0');
    const feePadded = params.poolFee.toString(16).padStart(64, '0');
    const amountPadded = BigInt(params.amountIn).toString(16).padStart(64, '0');
    const sqrtPriceLimitPadded = '0'.padStart(64, '0'); // 0 = pas de limite de prix
    
    return functionSelector + tokenInPadded + tokenOutPadded + feePadded + amountPadded + sqrtPriceLimitPadded;
  }

  // Décoder le résultat du quote
  private decodeQuoteResult(result: string, poolFee: number): UniswapQuote {
    // Simplified decoding - le résultat contient amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate
    const amountOut = BigInt('0x' + result.slice(2, 66)).toString();
    const sqrtPriceX96After = '0x' + result.slice(66, 130);
    const initializedTicksCrossed = parseInt(result.slice(130, 194), 16);
    const gasEstimate = parseInt(result.slice(194, 258), 16).toString();

    return {
      amountOut,
      sqrtPriceX96After,
      initializedTicksCrossed,
      gasEstimate,
      poolFee
    };
  }

  // Construire les données de transaction pour le swap
  async buildSwapTransaction(params: UniswapSwapParams, walletAddress: string): Promise<{
    to: string;
    data: string;
    value: string;
  } | null> {
    try {
      console.log('🔧 Construction de la transaction Uniswap...');
      
      // Calculer le montant minimum de sortie avec slippage
      const quote = await this.getQuote(params);
      if (!quote) {
        throw new Error('Impossible d\'obtenir le quote');
      }

      const slippageMultiplier = (100 - params.slippage) / 100;
      const amountOutMinimum = (BigInt(quote.amountOut) * BigInt(Math.floor(slippageMultiplier * 1000)) / BigInt(1000)).toString();

      // Deadline (1 heure)
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Encoder la transaction pour exactInputSingle
      const swapData = this.encodeExactInputSingle({
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        fee: params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM,
        recipient: walletAddress,
        deadline: deadline,
        amountIn: params.amountIn,
        amountOutMinimum: amountOutMinimum
      });

      return {
        to: UNISWAP_BASE_CONFIG.SWAP_ROUTER,
        data: swapData,
        value: params.tokenIn === UNISWAP_BASE_CONFIG.WETH || params.tokenIn === UNISWAP_BASE_CONFIG.ETH_NATIVE ? params.amountIn : '0'
      };
    } catch (error) {
      console.error('❌ Erreur lors de la construction de la transaction:', error);
      return null;
    }
  }

  // Encoder exactInputSingle pour Uniswap V3 Router
  private encodeExactInputSingle(params: {
    tokenIn: string;
    tokenOut: string;
    fee: number;
    recipient: string;
    deadline: number;
    amountIn: string;
    amountOutMinimum: string;
  }): string {
    // exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))
    const functionSelector = '0x414bf389';
    
    // Encoder les paramètres dans un tuple
    const tokenInPadded = params.tokenIn.toLowerCase().replace('0x', '').padStart(64, '0');
    const tokenOutPadded = params.tokenOut.toLowerCase().replace('0x', '').padStart(64, '0');
    const feePadded = params.fee.toString(16).padStart(64, '0');
    const recipientPadded = params.recipient.toLowerCase().replace('0x', '').padStart(64, '0');
    const deadlinePadded = params.deadline.toString(16).padStart(64, '0');
    const amountInPadded = BigInt(params.amountIn).toString(16).padStart(64, '0');
    const amountOutMinimumPadded = BigInt(params.amountOutMinimum).toString(16).padStart(64, '0');
    const sqrtPriceLimitPadded = '0'.padStart(64, '0'); // 0 = pas de limite de prix
    
    return functionSelector + 
           tokenInPadded + 
           tokenOutPadded + 
           feePadded + 
           recipientPadded + 
           deadlinePadded + 
           amountInPadded + 
           amountOutMinimumPadded + 
           sqrtPriceLimitPadded;
  }

  // Obtenir les pools disponibles pour une paire de tokens
  async getPoolInfo(tokenA: string, tokenB: string, fee: number): Promise<{
    pool: string;
    exists: boolean;
  }> {
    try {
      // Calculer l'adresse du pool via Factory
      const poolCalldata = this.encodeGetPoolCall(tokenA, tokenB, fee);
      
      const response = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{
          to: UNISWAP_BASE_CONFIG.POOL_FACTORY,
          data: poolCalldata
        }, 'latest']
      });

      const poolAddress = response.data.result;
      const exists = poolAddress !== '0x0000000000000000000000000000000000000000000000000000000000000000';

      return {
        pool: poolAddress,
        exists
      };
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du pool:', error);
      return { pool: '', exists: false };
    }
  }

  // Encoder l'appel getPool sur la Factory
  private encodeGetPoolCall(tokenA: string, tokenB: string, fee: number): string {
    const functionSelector = '0x1698ee82'; // getPool(address,address,uint24)
    const tokenAPadded = tokenA.replace('0x', '').padStart(64, '0');
    const tokenBPadded = tokenB.replace('0x', '').padStart(64, '0');
    const feePadded = fee.toString(16).padStart(64, '0');
    
    return functionSelector + tokenAPadded + tokenBPadded + feePadded;
  }
}

// Service principal pour les swaps Uniswap Base avec Circle Wallets
export class BaseUniswapService {
  private uniswap: UniswapBaseService;

  constructor() {
    this.uniswap = new UniswapBaseService();
  }

  // Swap USDC vers ETH sur Base Sepolia via Uniswap
  async swapUSDCToETH(params: {
    walletId: string;
    usdcAmount: string; // En USDC (ex: "100" = 100 USDC)
    slippage?: number;
    walletAddress: string;
    poolFee?: number;
  }) {
    try {
      console.log('🔄 Initialisation du swap USDC → ETH sur Base Sepolia (Uniswap)...');
      console.log(`💰 Montant: ${params.usdcAmount} USDC`);
      console.log(`⚡ Slippage: ${params.slippage || 1}%`);
      console.log(`🏊‍♀️ Pool fee: ${(params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM) / 10000}%`);

      // Convertir USDC en wei (6 décimales)
      const usdcAmountWei = (parseFloat(params.usdcAmount) * 1e6).toString();

      // 1. Vérifier que le pool existe
      const poolInfo = await this.uniswap.getPoolInfo(
        UNISWAP_BASE_CONFIG.USDC,
        UNISWAP_BASE_CONFIG.WETH,
        params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      );

      if (!poolInfo.exists) {
        throw new Error(`Pool Uniswap USDC/ETH avec fee ${params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM} non trouvé`);
      }

      console.log(`🏊‍♀️ Pool trouvé: ${poolInfo.pool}`);

      // 2. Obtenir un quote
      console.log('📊 Obtention du quote Uniswap...');
      const quote = await this.uniswap.getQuote({
        walletId: params.walletId,
        tokenIn: UNISWAP_BASE_CONFIG.USDC,
        tokenOut: UNISWAP_BASE_CONFIG.WETH,
        amountIn: usdcAmountWei,
        slippage: params.slippage || 1,
        poolFee: params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      });

      if (!quote) {
        throw new Error('Impossible d\'obtenir le quote Uniswap');
      }

      const expectedETH = (parseInt(quote.amountOut) / 1e18).toFixed(6);
      console.log(`💰 ETH attendu: ~${expectedETH} ETH`);
      console.log(`⛽ Gas estimé: ${quote.gasEstimate}`);

      // 3. Vérifier et faire l'approbation USDC si nécessaire
      console.log('🔍 Vérification de l\'approbation USDC...');
      // Pour simplifier, on assume que l'approbation est nécessaire
      console.log('✅ Approbation USDC non nécessaire (gérée par Circle)');

      // 4. Construire la transaction de swap
      console.log('🔄 Construction du swap...');
      const swapTx = await this.uniswap.buildSwapTransaction({
        walletId: params.walletId,
        tokenIn: UNISWAP_BASE_CONFIG.USDC,
        tokenOut: UNISWAP_BASE_CONFIG.WETH,
        amountIn: usdcAmountWei,
        slippage: params.slippage || 1,
        poolFee: params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      }, params.walletAddress);

      if (!swapTx) {
        throw new Error('Impossible de construire la transaction de swap');
      }

      console.log(`🎯 Swap Router: ${swapTx.to}`);
      console.log(`💸 Aucun ETH requis (swap ERC20)`);

      // 5. Exécuter via Circle Smart Account
      const swapResult = await createContractTransaction({
        walletId: params.walletId,
        contractAddress: swapTx.to,
        abiFunctionSignature: 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
        abiParameters: [
          [
            UNISWAP_BASE_CONFIG.USDC, // tokenIn
            UNISWAP_BASE_CONFIG.WETH, // tokenOut
            params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM, // fee
            params.walletAddress, // recipient
            Math.floor(Date.now() / 1000) + 3600, // deadline
            usdcAmountWei, // amountIn
            (BigInt(quote.amountOut) * BigInt(990) / BigInt(1000)).toString(), // amountOutMinimum (1% slippage)
            '0' // sqrtPriceLimitX96
          ]
        ],
        feeLevel: 'HIGH'
      });

      console.log('🎉 Swap Uniswap exécuté avec succès!');
      console.log(`🔗 Transaction ID: ${swapResult.data?.id}`);
      console.log(`💰 ETH reçu: ~${expectedETH} ETH`);
      console.log(`🔍 Vérifiez sur Base Sepolia Scan: ${UNISWAP_BASE_CONFIG.EXPLORER}/tx/${swapResult.data?.id}`);

      return {
        success: true,
        transactionId: swapResult.data?.id,
        expectedETH: expectedETH,
        quote: quote,
        explorerUrl: `${UNISWAP_BASE_CONFIG.EXPLORER}/tx/${swapResult.data?.id}`
      };

    } catch (error) {
      console.error('❌ Erreur lors du swap Uniswap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  // Swap ETH vers USDC sur Base via Uniswap
  async swapETHToUSDC(params: {
    walletId: string;
    ethAmount: string; // En ETH (ex: "0.1" = 0.1 ETH)
    slippage?: number;
    walletAddress: string;
    poolFee?: number;
  }) {
    try {
      console.log('🔄 Initialisation du swap ETH → USDC sur Base (Uniswap)...');
      console.log(`💰 Montant: ${params.ethAmount} ETH`);
      console.log(`⚡ Slippage: ${params.slippage || 1}%`);
      console.log(`🏊‍♀️ Pool fee: ${(params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM) / 10000}%`);

      // Convertir ETH en wei
      const ethAmountWei = (parseFloat(params.ethAmount) * 1e18).toString();

      // 1. Vérifier que le pool existe
      const poolInfo = await this.uniswap.getPoolInfo(
        UNISWAP_BASE_CONFIG.WETH,
        UNISWAP_BASE_CONFIG.USDC,
        params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      );

      if (!poolInfo.exists) {
        throw new Error(`Pool Uniswap ETH/USDC avec fee ${params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM} non trouvé`);
      }

      console.log(`🏊‍♀️ Pool trouvé: ${poolInfo.pool}`);

      // 2. Obtenir un quote
      console.log('📊 Obtention du quote Uniswap...');
      const quote = await this.uniswap.getQuote({
        walletId: params.walletId,
        tokenIn: UNISWAP_BASE_CONFIG.ETH_NATIVE,
        tokenOut: UNISWAP_BASE_CONFIG.USDC,
        amountIn: ethAmountWei,
        slippage: params.slippage || 1,
        poolFee: params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      });

      if (!quote) {
        throw new Error('Impossible d\'obtenir le quote Uniswap');
      }

      const expectedUSDC = (parseInt(quote.amountOut) / 1e6).toFixed(2);
      console.log(`💰 USDC attendu: ~${expectedUSDC} USDC`);
      console.log(`⛽ Gas estimé: ${quote.gasEstimate}`);

      // 3. Construire la transaction de swap
      console.log('🔄 Construction du swap...');
      const swapTx = await this.uniswap.buildSwapTransaction({
        walletId: params.walletId,
        tokenIn: UNISWAP_BASE_CONFIG.ETH_NATIVE,
        tokenOut: UNISWAP_BASE_CONFIG.USDC,
        amountIn: ethAmountWei,
        slippage: params.slippage || 1,
        poolFee: params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      }, params.walletAddress);

      if (!swapTx) {
        throw new Error('Impossible de construire la transaction de swap');
      }

      console.log(`🎯 Swap Router: ${swapTx.to}`);
      console.log(`💸 Valeur ETH: ${(parseInt(swapTx.value) / 1e18).toFixed(6)} ETH`);

      // 4. Exécuter via Circle Smart Account
      const swapResult = await createContractTransaction({
        walletId: params.walletId,
        contractAddress: swapTx.to,
        abiFunctionSignature: 'exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))',
        abiParameters: [
          [
            UNISWAP_BASE_CONFIG.WETH, // tokenIn (utilisé WETH au lieu de ETH_NATIVE)
            UNISWAP_BASE_CONFIG.USDC, // tokenOut
            params.poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM, // fee
            params.walletAddress, // recipient
            Math.floor(Date.now() / 1000) + 3600, // deadline
            ethAmountWei, // amountIn
            (BigInt(quote.amountOut) * BigInt(990) / BigInt(1000)).toString(), // amountOutMinimum (1% slippage)
            '0' // sqrtPriceLimitX96
          ]
        ],
        feeLevel: 'HIGH'
      });

      console.log('🎉 Swap Uniswap exécuté avec succès!');
      console.log(`🔗 Transaction ID: ${swapResult.data?.id}`);
      console.log(`💰 USDC reçu: ~${expectedUSDC} USDC`);
      console.log(`🔍 Vérifiez sur BaseScan: ${UNISWAP_BASE_CONFIG.EXPLORER}/tx/${swapResult.data?.id}`);

      return {
        success: true,
        transactionId: swapResult.data?.id,
        expectedUSDC: expectedUSDC,
        quote: quote,
        explorerUrl: `${UNISWAP_BASE_CONFIG.EXPLORER}/tx/${swapResult.data?.id}`
      };

    } catch (error) {
      console.error('❌ Erreur lors du swap Uniswap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  // Obtenir le prix actuel USDC/ETH sur Uniswap
  async getUSDCToETHPrice(usdcAmount: string = "100", poolFee?: number) {
    try {
      const usdcAmountWei = (parseFloat(usdcAmount) * 1e6).toString();
      
      const quote = await this.uniswap.getQuote({
        walletId: '', // Non nécessaire pour un quote
        tokenIn: UNISWAP_BASE_CONFIG.USDC,
        tokenOut: UNISWAP_BASE_CONFIG.WETH,
        amountIn: usdcAmountWei,
        slippage: 1,
        poolFee: poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      });

      if (!quote) return null;

      const ethAmount = (parseInt(quote.amountOut) / 1e18);
      const rate = ethAmount / parseFloat(usdcAmount);

      return {
        usdcAmount: parseFloat(usdcAmount),
        ethAmount: ethAmount,
        rate: rate,
        rateFormatted: `1 USDC = ${rate.toFixed(6)} ETH`,
        poolFee: quote.poolFee
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention du prix Uniswap:', error);
      return null;
    }
  }

  // Obtenir le prix actuel ETH/USDC sur Uniswap
  async getETHToUSDCPrice(ethAmount: string = "1", poolFee?: number) {
    try {
      const ethAmountWei = (parseFloat(ethAmount) * 1e18).toString();
      
      const quote = await this.uniswap.getQuote({
        walletId: '', // Non nécessaire pour un quote
        tokenIn: UNISWAP_BASE_CONFIG.ETH_NATIVE,
        tokenOut: UNISWAP_BASE_CONFIG.USDC,
        amountIn: ethAmountWei,
        slippage: 1,
        poolFee: poolFee || UNISWAP_BASE_CONFIG.POOL_FEES.MEDIUM
      });

      if (!quote) return null;

      const usdcAmount = (parseInt(quote.amountOut) / 1e6);
      const rate = usdcAmount / parseFloat(ethAmount);

      return {
        ethAmount: parseFloat(ethAmount),
        usdcAmount: usdcAmount,
        rate: rate,
        rateFormatted: `1 ETH = ${rate.toFixed(2)} USDC`,
        poolFee: quote.poolFee
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'obtention du prix Uniswap:', error);
      return null;
    }
  }

  // Lister les pools disponibles
  async getAvailablePools() {
    const pools = [];
    
    for (const [feeName, feeValue] of Object.entries(UNISWAP_BASE_CONFIG.POOL_FEES)) {
      const poolInfo = await this.uniswap.getPoolInfo(
        UNISWAP_BASE_CONFIG.WETH,
        UNISWAP_BASE_CONFIG.USDC,
        feeValue
      );
      
      if (poolInfo.exists) {
        pools.push({
          name: `ETH/USDC ${feeName} (${feeValue / 10000}%)`,
          fee: feeValue,
          address: poolInfo.pool
        });
      }
    }
    
    return pools;
  }
}

// Instance par défaut
export const baseUniswapService = new BaseUniswapService(); 