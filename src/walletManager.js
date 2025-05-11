import { useEffect } from 'react';
import Web3 from 'web3';
import { BASEDAI_CHAIN_ID, ORIGINAL_CONTRACT_ADDRESS, HELPER_CONTRACT_ADDRESS, INSCRIBED_CONTRACT_ADDRESS } from './config';
import { ORIGINAL_ABI, HELPER_ABI, INSCRIBED_ABI } from './abis';

export const connectWalletAndSetupContracts = (setWeb3, setAccount, setOriginalContract, setInscribedContract, setHelperContract, setMessage) => {
    return async (currentWeb3Instance) => {
        console.log("connectWalletAndSetupContracts called");
        let currentWeb3 = currentWeb3Instance;

        if (!currentWeb3) {
            if (window.ethereum) {
                currentWeb3 = new Web3(window.ethereum);
            } else {
                setMessage("Please install MetaMask to connect your wallet.");
                return { success: false, web3: null, account: null, originalContract: null, inscribedContract: null, helperContract: null };
            }
        }

        try {
            const accounts = await currentWeb3.eth.requestAccounts();
            const userAccount = accounts[0];
            console.log("Accounts fetched:", userAccount);

            const balanceWei = await currentWeb3.eth.getBalance(userAccount);
            const balanceBased = currentWeb3.utils.fromWei(balanceWei, 'ether');
            console.log(`Wallet BASED balance: ${balanceBased} BASED`);

            const chainId = Number(await currentWeb3.eth.getChainId());
            console.log("Current Chain ID:", chainId);
            if (chainId !== BASEDAI_CHAIN_ID) {
                setMessage(`Current network ID is ${chainId}. Switching to BasedAI Network (ID: ${BASEDAI_CHAIN_ID})...`);
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: Web3.utils.toHex(BASEDAI_CHAIN_ID) }],
                    });
                    currentWeb3 = new Web3(window.ethereum);
                    console.log("Switched chain, new web3 instance created.");
                    const newChainId = Number(await currentWeb3.eth.getChainId());
                    if (newChainId !== BASEDAI_CHAIN_ID) {
                        setMessage(`Failed to switch. Wallet on ID ${newChainId}, expected ${BASEDAI_CHAIN_ID}.`);
                        return { success: false, web3: currentWeb3, account: userAccount, originalContract: null, inscribedContract: null, helperContract: null };
                    }
                } catch (switchError) {
                    if (switchError.code === 4902) {
                        setMessage("BasedAI Network not found. Adding it...");
                        try {
                            await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: Web3.utils.toHex(BASEDAI_CHAIN_ID),
                                    chainName: 'BasedAI',
                                    rpcUrls: ['https://mainnet.basedaibridge.com/rpc/'],
                                    nativeCurrency: { name: 'BasedAI Token', symbol: 'BASED', decimals: 18 },
                                }],
                            });
                            currentWeb3 = new Web3(window.ethereum);
                            console.log("Added chain.");
                            const newChainId = Number(await currentWeb3.eth.getChainId());
                            if (newChainId !== BASEDAI_CHAIN_ID) {
                                setMessage(`Added network, but not active. Please switch to BasedAI Network (ID: ${BASEDAI_CHAIN_ID}).`);
                                return { success: false, web3: currentWeb3, account: userAccount, originalContract: null, inscribedContract: null, helperContract: null };
                            }
                        } catch (addError) {
                            setMessage(`Failed to add BasedAI chain: ${addError.message}`);
                            return { success: false, web3: currentWeb3, account: null, originalContract: null, inscribedContract: null, helperContract: null };
                        }
                    } else {
                        setMessage(`Failed to switch to BasedAI chain: ${switchError.message}`);
                        return { success: false, web3: currentWeb3, account: null, originalContract: null, inscribedContract: null, helperContract: null };
                    }
                }
            }

            const originalContractInstance = new currentWeb3.eth.Contract(ORIGINAL_ABI, ORIGINAL_CONTRACT_ADDRESS);
            const helperContractInstance = new currentWeb3.eth.Contract(HELPER_ABI, HELPER_CONTRACT_ADDRESS);
            console.log("Original and Helper contract instances created.");

            let inscribedContractInstance = null;
            if (INSCRIBED_CONTRACT_ADDRESS) {
                inscribedContractInstance = new currentWeb3.eth.Contract(INSCRIBED_ABI, INSCRIBED_CONTRACT_ADDRESS);
                console.log("Inscribed contract instance created.");
            } else {
                console.warn("Inscribed Contract Address is missing.");
            }

            return { success: true, web3: currentWeb3, account: userAccount, originalContract: originalContractInstance, inscribedContract: inscribedContractInstance, helperContract: helperContractInstance };

        } catch (error) {
            if (error.code === 4001) {
                setMessage("Wallet connection request denied by user.");
            } else {
                setMessage(`Error connecting/setting up contracts: ${error.message}`);
            }
            console.error('Error in connectWalletAndSetupContracts:', error);
            return { success: false, web3: currentWeb3, account: null, originalContract: null, inscribedContract: null, helperContract: null };
        }
    };
};

export const useWalletEventListeners = (web3, account, setWeb3, setAccount, setOriginalContract, setInscribedContract, setHelperContract, setOwnedV1Tokens, setOwnedInscribedTokens, setMessage) => {
    useEffect(() => {
        console.log("useWalletEventListeners useEffect triggered. Dependencies:", {
            web3: !!web3,
            account,
        });

        // Only initialize if web3 and account are not already set
        const init = async () => {
            if (web3 && account) {
                console.log("Wallet already initialized, skipping init.");
                return;
            }
            console.log("Initial useEffect running");
            if (window.ethereum) {
                const connectWalletAndSetupContractsFn = connectWalletAndSetupContracts(
                    setWeb3, setAccount, setOriginalContract, setInscribedContract, setHelperContract, setMessage
                );
                const result = await connectWalletAndSetupContractsFn(web3 || new Web3(window.ethereum));
                if (result.success) {
                    setWeb3(result.web3);
                    setAccount(result.account);
                    setOriginalContract(result.originalContract);
                    setInscribedContract(result.inscribedContract);
                    setHelperContract(result.helperContract);
                    setMessage('');
                    console.log("Initialization successful.");
                } else {
                    console.log("Initialization failed.");
                    setAccount(null);
                    setOriginalContract(null);
                    setInscribedContract(null);
                    setHelperContract(null);
                }
            } else {
                setMessage("MetaMask or compatible Web3 extension not found.");
            }
        };
        init();

        const handleAccountsChanged = async (accounts) => {
            console.log("MetaMask accountsChanged event:", accounts);
            if (accounts.length === 0) {
                setMessage("Wallet disconnected. Please connect.");
                setAccount(null);
                setOwnedV1Tokens([]);
                setOwnedInscribedTokens([]);
                setOriginalContract(null);
                setInscribedContract(null);
                setHelperContract(null);
            } else {
                const currentActiveAccount = accounts[0];
                if (account !== currentActiveAccount) {
                    console.log("Account has effectively changed to:", currentActiveAccount);
                    const connectWalletAndSetupContractsFn = connectWalletAndSetupContracts(
                        setWeb3, setAccount, setOriginalContract, setInscribedContract, setHelperContract, setMessage
                    );
                    const result = await connectWalletAndSetupContractsFn(web3 || new Web3(window.ethereum));
                    if (result.success) {
                        setWeb3(result.web3);
                        setAccount(result.account);
                        setOriginalContract(result.originalContract);
                        setInscribedContract(result.inscribedContract);
                        setHelperContract(result.helperContract);
                        setMessage('');
                    } else {
                        setAccount(null);
                        setOriginalContract(null);
                        setInscribedContract(null);
                        setHelperContract(null);
                    }
                }
            }
        };
        const handleChainChanged = () => {
            console.log("MetaMask chainChanged event triggered");
            window.location.reload();
        };

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
        }
        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [
        web3,
        account,
        setWeb3,
        setAccount,
        setOriginalContract,
        setInscribedContract,
        setHelperContract,
        setOwnedV1Tokens,
        setOwnedInscribedTokens,
        setMessage
    ]); // Added all dependencies to satisfy ESLint
};
