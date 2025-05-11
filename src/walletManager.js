// src/walletManager.js
import Web3 from 'web3';
import { useEffect } from 'react';
import {
    ORIGINAL_CONTRACT_ADDRESS, HELPER_CONTRACT_ADDRESS, INSCRIBED_CONTRACT_ADDRESS, BASEDAI_CHAIN_ID
} from './config';
import { ORIGINAL_ABI, HELPER_ABI, INSCRIBED_ABI } from './abis';

// Extracted from the original App component's connectWalletAndSetupContracts
export const connectWalletAndSetupContracts = (
    setWeb3Fn, setAccountFn, setOriginalContractFn,
    setInscribedContractFn, setHelperContractFn, setMessageFn
) => async (currentWeb3Instance) => {
    console.log("connectWalletAndSetupContracts called");
    let currentWeb3 = currentWeb3Instance;

    if (!currentWeb3) {
        if (window.ethereum) {
            currentWeb3 = new Web3(window.ethereum);
        } else {
            setMessageFn("Please install MetaMask to connect your wallet.");
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
            setMessageFn(`Current network ID is ${chainId}. Switching to BasedAI Network (ID: ${BASEDAI_CHAIN_ID})...`);
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: Web3.utils.toHex(BASEDAI_CHAIN_ID) }],
                });
                currentWeb3 = new Web3(window.ethereum); // Re-initialize web3 instance after chain switch
                console.log("Switched chain, new web3 instance created.");
                const newChainId = Number(await currentWeb3.eth.getChainId());
                if (newChainId !== BASEDAI_CHAIN_ID) {
                    setMessageFn(`Failed to switch. Wallet on ID ${newChainId}, expected ${BASEDAI_CHAIN_ID}.`);
                    return { success: false, web3: currentWeb3, account: userAccount, originalContract: null, inscribedContract: null, helperContract: null };
                }
            } catch (switchError) {
                if (switchError.code === 4902) {
                    setMessageFn("BasedAI Network not found. Adding it...");
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: Web3.utils.toHex(BASEDAI_CHAIN_ID),
                                chainName: 'BasedAI',
                                rpcUrls: ['https://mainnet.basedaibridge.com/rpc/'], // Make sure this is correct and active
                                nativeCurrency: { name: 'BasedAI Token', symbol: 'BASED', decimals: 18 },
                            }],
                        });
                        currentWeb3 = new Web3(window.ethereum); // Re-initialize after adding chain
                        console.log("Added chain.");
                        const newChainId = Number(await currentWeb3.eth.getChainId());
                        if (newChainId !== BASEDAI_CHAIN_ID) {
                             setMessageFn(`Added network, but not active. Please switch to BasedAI Network (ID: ${BASEDAI_CHAIN_ID}).`);
                             return { success: false, web3: currentWeb3, account: userAccount, originalContract: null, inscribedContract: null, helperContract: null };
                        }
                    } catch (addError) {
                        setMessageFn(`Failed to add BasedAI chain: ${addError.message}`);
                        return { success: false, web3: currentWeb3, account: null, originalContract: null, inscribedContract: null, helperContract: null };
                    }
                } else {
                    setMessageFn(`Failed to switch to BasedAI chain: ${switchError.message}`);
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
        
        // Call setters passed from App.js
        setWeb3Fn(currentWeb3);
        setAccountFn(userAccount);
        setOriginalContractFn(originalContractInstance);
        setInscribedContractFn(inscribedContractInstance);
        setHelperContractFn(helperContractInstance);
        setMessageFn(''); // Clear any previous messages

        return { success: true, web3: currentWeb3, account: userAccount, originalContract: originalContractInstance, inscribedContract: inscribedContractInstance, helperContract: helperContractInstance };

    } catch (error) {
        if (error.code === 4001) { // User rejected the request
            setMessageFn("Wallet connection request denied by user.");
        } else {
            setMessageFn(`Error connecting/setting up contracts: ${error.message}`);
        }
        console.error('Error in connectWalletAndSetupContracts:', error);
        // Reset states if connection fails significantly
        setWeb3Fn(null);
        setAccountFn(null);
        setOriginalContractFn(null);
        setInscribedContractFn(null);
        setHelperContractFn(null);
        return { success: false, web3: currentWeb3, account: null, originalContract: null, inscribedContract: null, helperContract: null };
    }
};


// Extracted from the original App component's useEffect for wallet events
export const useWalletEventListeners = (
    web3, account, setWeb3, setAccount, setOriginalContract,
    setInscribedContract, setHelperContract, setOwnedV1Tokens,
    setOwnedInscribedTokens, setMessage
) => {
    const connectFn = connectWalletAndSetupContracts(setWeb3, setAccount, setOriginalContract, setInscribedContract, setHelperContract, setMessage);

    useEffect(() => {
        const initOrReconnect = async (isReconnect = false) => {
            console.log(isReconnect ? "Reconnecting/Re-initializing due to account/network change" : "Initial useEffect running for wallet setup");
            if (window.ethereum) {
                // Pass the existing web3 instance if available, otherwise create a new one
                const result = await connectFn(web3 || new Web3(window.ethereum));
                if (!result.success && !isReconnect) { // Only set message if it's an initial setup failure
                    // Message is already set by connectFn
                }
            } else if (!isReconnect) { // Only set message if it's an initial setup failure
                setMessage("MetaMask or compatible Web3 extension not found.");
            }
        };

        initOrReconnect(); // Initial call

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
                // Optionally setWeb3(null) if you want to force re-init of Web3 instance on next connect
            } else {
                const currentActiveAccount = accounts[0];
                 // Only re-run full setup if account actually changes
                if (account !== currentActiveAccount) {
                    console.log("Account has effectively changed to:", currentActiveAccount);
                    await initOrReconnect(true); // Pass true for isReconnect
                }
            }
        };

        const handleChainChanged = () => {
            console.log("MetaMask chainChanged event. Reloading or re-initializing...");
            // Option 1: Reload page (simpler)
            // window.location.reload();

            // Option 2: Re-initialize (more seamless UX, but more complex state management)
            setMessage("Network changed. Re-initializing...");
            initOrReconnect(true); // Pass true for isReconnect
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account]); // Key dependency: re-run if `account` state changes externally or to re-attach listeners if component remounts.
    // Removed other dependencies to avoid re-running connectFn unnecessarily from this hook.
    // connectFn itself can be memoized or its setters ensure stable references.
};
