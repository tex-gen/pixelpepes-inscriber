// src/App.js
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Web3 from 'web3';
import TokenCard from './components/TokenCard';
import { connectWalletAndSetupContracts, useWalletEventListeners } from './walletManager';
import { fetchOwnedTokens, fetchOwnedInscribedTokens } from './tokenFetcher';
import { approveInscribedContract, burnMintAndInscribe, refreshTokens, mintV1Tokens } from './contractActions'; // Added mintV1Tokens
import { debounce } from './utils';

function App() {
    const [web3, setWeb3] = useState(null);
    const [account, setAccount] = useState(null);
    const [ownedV1Tokens, setOwnedV1Tokens] = useState([]);
    const [ownedInscribedTokens, setOwnedInscribedTokens] = useState([]);
    const [inscribedContract, setInscribedContract] = useState(null);
    const [originalContract, setOriginalContract] = useState(null);
    const [helperContract, setHelperContract] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [mintAmount, setMintAmount] = useState(1); // State for the number of tokens to mint

    const metadataCache = useRef(new Map());
    const hasFetchedV1Tokens = useRef(false);
    const hasFetchedInscribedTokens = useRef(false);

    const fetchOwnedTokensFn = useMemo(() => fetchOwnedTokens(
        account, helperContract, originalContract, inscribedContract,
        setLoading, setMessage, setOwnedV1Tokens, metadataCache
    ), [account, helperContract, originalContract, inscribedContract, metadataCache]);

    const fetchOwnedInscribedTokensFn = useMemo(() => fetchOwnedInscribedTokens(
        account, inscribedContract, originalContract,
        setLoading, setMessage, setOwnedInscribedTokens, metadataCache
    ), [account, inscribedContract, originalContract, metadataCache]);

    const debouncedFetchOwnedTokens = useMemo(() => debounce(fetchOwnedTokensFn, 1000), [fetchOwnedTokensFn]);
    const debouncedFetchOwnedInscribedTokens = useMemo(() => debounce(fetchOwnedInscribedTokensFn, 1000), [fetchOwnedInscribedTokensFn]);

    const approveInscribedContractFn = useMemo(() => approveInscribedContract(
        originalContract, account, web3, setLoading, setMessage, debouncedFetchOwnedTokens
    ), [originalContract, account, web3, debouncedFetchOwnedTokens]);

    const burnMintAndInscribeFn = useMemo(() => burnMintAndInscribe(
        inscribedContract, account, web3, originalContract, setLoading, setMessage,
        debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens, metadataCache
    ), [inscribedContract, account, web3, originalContract, debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens, metadataCache]);

    const refreshTokensFn = useMemo(() => refreshTokens(
        setMessage, debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens
    ), [debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens]);

    const mintV1TokensFn = useMemo(() => mintV1Tokens(
        originalContract, account, web3, setLoading, setMessage, debouncedFetchOwnedTokens
    ), [originalContract, account, web3, debouncedFetchOwnedTokens]);

    useWalletEventListeners(
        web3, account, setWeb3, setAccount, setOriginalContract, setInscribedContract,
        setHelperContract, setOwnedV1Tokens, setOwnedInscribedTokens, setMessage
    );

    useEffect(() => {
        if (account && helperContract && originalContract && !hasFetchedV1Tokens.current) {
            console.log("Calling debouncedFetchOwnedTokens from useEffect (App.js)");
            debouncedFetchOwnedTokens();
            hasFetchedV1Tokens.current = true;
        }
    }, [account, helperContract, originalContract, debouncedFetchOwnedTokens]);

    useEffect(() => {
        if (account && inscribedContract && !hasFetchedInscribedTokens.current) {
            console.log("Calling debouncedFetchOwnedInscribedTokens from useEffect (App.js)");
            debouncedFetchOwnedInscribedTokens();
            hasFetchedInscribedTokens.current = true;
        }
    }, [account, inscribedContract, debouncedFetchOwnedInscribedTokens]);

    useEffect(() => {
        console.log("Account changed in App.js, resetting fetch flags. New account:", account);
        hasFetchedV1Tokens.current = false;
        hasFetchedInscribedTokens.current = false;
        setOwnedV1Tokens([]);
        setOwnedInscribedTokens([]);
    }, [account]);

    const handleConnectWallet = async () => {
        console.log("Connect Wallet button clicked in App.js");
        const currentWeb3Instance = web3 || (window.ethereum ? new Web3(window.ethereum) : null);
        if (!currentWeb3Instance) {
            setMessage("MetaMask not available. Please install it.");
            return;
        }
        const connectFn = connectWalletAndSetupContracts(
            setWeb3, setAccount, setOriginalContract, setInscribedContract, setHelperContract, setMessage
        );
        await connectFn(currentWeb3Instance);
    };

    const handleMint = async () => {
        console.log(`Mint button clicked in App.js with amount: ${mintAmount}`);
        await mintV1TokensFn(mintAmount);
    };

    const handleDecrement = () => {
        setMintAmount(prev => Math.max(1, prev - 1)); // Ensure it doesn't go below 1
    };

    const handleIncrement = () => {
        setMintAmount(prev => Math.min(10, prev + 1)); // Ensure it doesn't go above 10
    };

    return (
        <div className="app-container">
            <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
            <style>
                {`
                    html, body, #root {
                        margin: 0;
                        padding: 0;
                        height: 100%;
                        background-color: transparent !important;
                    }
                    .app-container {
                        min-height: 100vh;
                        background-color: transparent;
                        color: #00ff00;
                        font-family: "Press Start 2P", cursive;
                        text-align: center;
                        position: relative;
                        z-index: 1;
                    }
                    .content-wrapper {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: transparent;
                        position: relative;
                    }
                    .header {
                        padding: 15px 0;
                        border-bottom: 2px solid #00ff00;
                        text-shadow: 0 0 10px rgba(0, 255, 0, 0.7);
                        background-color: transparent;
                        margin-bottom: 15px;
                        position: relative;
                    }
                    .header h1 {
                        font-size: 1.5em;
                        margin: 0;
                    }
                    .description {
                        margin: 15px auto;
                        padding: 15px;
                        font-size: 10px;
                        color: #00ff00;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                        background-color: rgba(0, 0, 0, 0.5);
                        border: 1px solid #00ff00;
                        border-radius: 5px;
                        line-height: 1.5em;
                        max-width: 900px;
                    }
                    .wallet-container {
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        text-align: right;
                    }
                    .wallet-container p {
                        margin: 0 0 5px 0;
                        font-size: 12px;
                        color: #00ff00;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                    }
                    .highlight {
                        color: #00ff00;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                    }
                    .message {
                        margin: 20px auto;
                        padding: 10px;
                        border: 1px solid #00ff00;
                        border-radius: 5px;
                        font-size: 12px;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                        background-color: rgba(0, 0, 0, 0.5);
                        max-width: 900px;
                    }
                    .message.error {
                        background-color: rgba(255, 0, 0, 0.2);
                        color: #ff4444;
                        border-color: #ff4444;
                    }
                    .message.success {
                        background-color: rgba(0, 255, 0, 0.15);
                        color: #33ff33;
                        border-color: #33ff33;
                    }
                    .section-title {
                        font-size: 1.2em;
                        margin: 30px 0 15px 0;
                        border-bottom: 1px dashed #00ff00;
                        text-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
                        padding-bottom: 5px;
                        background-color: transparent;
                    }
                    .warning {
                        color: #ff9900; 
                        margin: 15px auto;
                        background-color: rgba(255, 153, 0, 0.1);
                        border: 1px solid #ff9900;
                        padding: 10px;
                        border-radius: 5px;
                        font-size: 10px;
                        text-shadow: 0 0 5px rgba(255, 153, 0, 0.5);
                        line-height: 1.5em;
                        max-width: 900px;
                    }
                    .token-grid {
                        width: 100%;
                        max-width: 1200px;
                        margin: 10px auto;
                        border: 1px solid #00ff00;
                        border-radius: 5px;
                        padding: 10px;
                        background-color: rgba(0, 0, 0, 0.8);
                        box-shadow: inset 0 0 10px rgba(0, 255, 0, 0.2);
                        max-height: 500px;
                        overflow-y: auto;
                        box-sizing: border-box;
                    }
                    .token-grid-inner {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center;
                        gap: 15px;
                        padding: 0;
                        margin: 0;
                    }
                    .token-card {
                        width: 200px;
                        box-sizing: border-box;
                    }
                    .mint-section {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        margin: 20px 0;
                    }
                    .number-selector {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .number-selector button {
                        padding: 5px 10px;
                        font-size: 12px;
                        min-width: 30px;
                        min-height: 30px;
                    }
                    .number-selector input {
                        width: 40px;
                        text-align: center;
                        background-color: #000;
                        color: #00ff00;
                        border: 1px solid #00ff00;
                        border-radius: 5px;
                        font-family: "Press Start 2P", cursive;
                        font-size: 12px;
                        padding: 5px;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px dashed #00ff00;
                        color: #00ff00;
                        font-size: 10px;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.3);
                        background-color: transparent;
                    }
                    button {
                        padding: 10px 20px;
                        background-color: #000;
                        color: #00ff00;
                        border: 2px solid #00ff00;
                        border-radius: 5px;
                        font-family: "Press Start 2P", cursive;
                        font-size: 14px;
                        cursor: pointer;
                        box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
                        transition: box-shadow 0.2s, background-color 0.2s, color 0.2s;
                    }
                    button:hover {
                        box-shadow: 0 0 20px rgba(0, 255, 0, 0.7);
                        background-color: #00ff00;
                        color: #000;
                    }
                    button:active {
                        box-shadow: 0 0 30px rgba(0, 255, 0, 0.9) !important; 
                    }
                    button:disabled {
                        cursor: not-allowed;
                        opacity: 0.6;
                        background-color: #000;
                        color: #00ff00;
                        box-shadow: 0 0 5px rgba(0, 255, 0, 0.3);
                    }
                    .refresh-button {
                        padding: 5px 15px;
                        font-size: 10px;
                        margin-top: 5px;
                    }
                    .connect-wallet-main-button {
                        margin-top: 30px;
                        padding: 12px 25px;
                        font-size: 16px;
                    }
                    @media (max-width: 768px) {
                        .content-wrapper {
                            padding: 10px;
                        }
                        .header {
                            padding: 15px 0 20px 0;
                        }
                        .header h1 {
                            font-size: 1.2em;
                        }
                        .description {
                            margin: 10px auto;
                            padding: 10px;
                        }
                        .wallet-container {
                            position: static;
                            text-align: center;
                            margin: 5px 0;
                        }
                        .wallet-container p {
                            font-size: 10px;
                        }
                        .refresh-button {
                            margin-top: 8px;
                        }
                        .token-grid {
                            padding: 3px;
                            width: calc(100% - 20px);
                            margin: 10px auto;
                        }
                        .token-grid-inner {
                            gap: 10px;
                            justify-content: center;
                            padding: 0;
                            margin: 0;
                        }
                        .token-card {
                            width: 140px;
                        }
                        .mint-section {
                            flex-direction: column;
                            gap: 15px;
                        }
                        .number-selector button {
                            padding: 5px 8px;
                            font-size: 10px;
                            min-width: 25px;
                            min-height: 25px;
                        }
                        .number-selector input {
                            width: 35px;
                            font-size: 10px;
                            padding: 3px;
                        }
                    }
                `}
            </style>
            <div className="content-wrapper">
                <header className="header">
                    <h1>PIXELPEPES INSCRIBER</h1>
                    <p className="description">
                        Inscribed NFTs, like $iPXLPP, are a new evolution of digital assets where metadata is embedded directly on the blockchain, ensuring permanence and immutability. Unlike traditional NFTs that often store metadata on IPFS—a decentralized but less reliable storage solution—inscribed NFTs eliminate dependency on external systems, enhancing their longevity and value by guaranteeing that the data remains accessible as long as the blockchain exists.
                    </p>
                </header>

                {!account ? (
                    <button
                        className="connect-wallet-main-button"
                        onClick={handleConnectWallet}
                        disabled={loading}
                    >
                        CONNECT WALLET
                    </button>
                ) : (
                    <div className="wallet-container">
                        <p>
                            CONNECTED: <span className="highlight">{account.slice(0, 6)}...{account.slice(-4)}</span>
                        </p>
                        <button className="refresh-button" onClick={() => {
                            console.log("Refresh button clicked, resetting fetch flags");
                            hasFetchedV1Tokens.current = false;
                            hasFetchedInscribedTokens.current = false;
                            refreshTokensFn();
                        }} disabled={loading}>
                            REFRESH
                        </button>
                    </div>
                )}

                {message && (
                    <p className={`message ${message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('denied') || message.toLowerCase().includes('insufficient') || message.toLowerCase().includes('warning') ? 'error' : (message.toLowerCase().includes('success') || message.toLowerCase().includes('approved') || message.toLowerCase().includes('upgraded') || message.toLowerCase().includes('inscribed') ? 'success' : '')}`}>
                        {message}
                    </p>
                )}

                {account && (
                    <div>
                        <p className="warning">
                            Inscribing your $PXLPP transforms it into a unique $iPXLPP forever! Make sure to individually approve the inscriber contract first for each token you wish to upgrade. Note that inscribing artwork to the blockchain may be gas intensive!
                        </p>

                        {/* Mint Section for V1 Pixel Pepes */}
                        <div className="mint-section">
                            <div className="number-selector">
                                <button onClick={handleDecrement} disabled={loading || mintAmount <= 1}>-</button>
                                <input
                                    type="text"
                                    value={mintAmount}
                                    readOnly
                                    disabled={loading}
                                />
                                <button onClick={handleIncrement} disabled={loading || mintAmount >= 10}>+</button>
                            </div>
                            <button onClick={handleMint} disabled={loading}>
                                MINT $PXLPP
                            </button>
                        </div>

                        {/* $PXLPP Tokens Section */}
                        <h2 className="section-title">$PXLPP</h2>
                        {loading && ownedV1Tokens.length > 0 && <p style={{ fontSize: '14px', color: '#00ff00', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>LOADING $PXLPP...</p>}
                        {!loading && ownedV1Tokens.length === 0 && account && (!message || !message.toLowerCase().includes("fetching")) && (
                            <p style={{ fontSize: '14px', color: '#00ff00', marginTop: '14px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
                                NO $PXLPP TOKENS FOUND OR ALL ARE INSCRIBED
                            </p>
                        )}
                        {!loading && ownedV1Tokens.length > 0 && (
                            <div>
                                <div className="token-grid">
                                    <div className="token-grid-inner">
                                        {ownedV1Tokens.map(token => (
                                            <TokenCard
                                                key={`v1-${token.tokenId}`}
                                                token={token}
                                                isV1={true}
                                                onApprove={approveInscribedContractFn}
                                                onUpgrade={burnMintAndInscribeFn}
                                                loading={loading}
                                                inscribedContract={inscribedContract}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* $iPXLPP Tokens Section */}
                        <h2 className="section-title">$iPXLPP</h2>
                        {loading && ownedInscribedTokens.length > 0 && <p style={{ fontSize: '14px', color: '#00ff00', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>LOADING $iPXLPP...</p>}
                        {!loading && ownedInscribedTokens.length === 0 && account && (!message || !message.toLowerCase().includes("fetching")) && (
                            <p style={{ fontSize: '14px', color: '#00ff00', marginTop: '20px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
                                NO $iPXLPP TOKENS FOUND
                            </p>
                        )}
                        {!loading && ownedInscribedTokens.length > 0 && (
                            <div>
                                <div className="token-grid">
                                    <div className="token-grid-inner">
                                        {ownedInscribedTokens.map(token => (
                                            <TokenCard
                                                key={`inscribed-${token.tokenId}`}
                                                token={token}
                                                isV1={false}
                                                loading={loading}
                                                inscribedContract={inscribedContract}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <footer className="footer">
                    <p>© {new Date().getFullYear()} PIXELPEPES UPGRADE MODULE</p>
                </footer>
            </div>
        </div>
    );
}

export default App;
