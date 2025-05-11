/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Web3 from 'web3';
import TokenCard from './components/TokenCard';
import { connectWalletAndSetupContracts, useWalletEventListeners } from './walletManager';
import { fetchOwnedTokens, fetchOwnedInscribedTokens } from './tokenFetcher';
import { approveInscribedContract, approveAllForInscribed, burnMintAndInscribe, refreshTokens } from './contractActions';
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

    const metadataCache = useRef(new Map());
    const hasFetchedV1Tokens = useRef(false);
    const hasFetchedInscribedTokens = useRef(false);

    const fetchOwnedTokensFn = fetchOwnedTokens(
        account, helperContract, originalContract, inscribedContract,
        setLoading, setMessage, setOwnedV1Tokens, metadataCache
    );

    const fetchOwnedInscribedTokensFn = fetchOwnedInscribedTokens(
        account, inscribedContract, originalContract,
        setLoading, setMessage, setOwnedInscribedTokens, metadataCache
    );

    const debouncedFetchOwnedTokens = useMemo(() => debounce(fetchOwnedTokensFn, 1000), [fetchOwnedTokensFn]);
    const debouncedFetchOwnedInscribedTokens = useMemo(() => debounce(fetchOwnedInscribedTokensFn, 1000), [fetchOwnedInscribedTokensFn]);

    const approveInscribedContractFn = approveInscribedContract(
        originalContract, account, web3, setLoading, setMessage, debouncedFetchOwnedTokens
    );

    const approveAllForInscribedFn = approveAllForInscribed(
        originalContract, account, ownedV1Tokens, web3, setLoading, setMessage, setOwnedV1Tokens, debouncedFetchOwnedTokens
    );

    const burnMintAndInscribeFn = burnMintAndInscribe(
        inscribedContract, account, web3, originalContract, setLoading, setMessage,
        debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens, metadataCache
    );

    const refreshTokensFn = refreshTokens(
        setMessage, debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens
    );

    useWalletEventListeners(
        web3, account, setWeb3, setAccount, setOriginalContract, setInscribedContract,
        setHelperContract, setOwnedV1Tokens, setOwnedInscribedTokens, setMessage
    );

    useEffect(() => {
        console.log("V1 Token Fetch useEffect triggered. Dependencies:", {
            helperContract: !!helperContract,
            originalContract: !!originalContract,
            account,
            hasFetchedV1Tokens: hasFetchedV1Tokens.current,
        });

        if (!hasFetchedV1Tokens.current && helperContract && originalContract && account) {
            console.log("Calling debouncedFetchOwnedTokens");
            debouncedFetchOwnedTokens();
            hasFetchedV1Tokens.current = true;
        }
    }, [helperContract, originalContract, account, debouncedFetchOwnedTokens]);

    useEffect(() => {
        console.log("Inscribed Token Fetch useEffect triggered. Dependencies:", {
            inscribedContract: !!inscribedContract,
            account,
            hasFetchedInscribedTokens: hasFetchedInscribedTokens.current,
        });

        if (!hasFetchedInscribedTokens.current && inscribedContract && account) {
            console.log("Calling debouncedFetchOwnedInscribedTokens");
            debouncedFetchOwnedInscribedTokens();
            hasFetchedInscribedTokens.current = true;
        }
    }, [inscribedContract, account, debouncedFetchOwnedInscribedTokens]);

    useEffect(() => {
        console.log("Account changed, resetting fetch flags. New account:", account);
        hasFetchedV1Tokens.current = false;
        hasFetchedInscribedTokens.current = false;
    }, [account]);

    console.log("App component rendered. State:", {
        web3: !!web3,
        account,
        ownedV1Tokens: ownedV1Tokens.length,
        ownedInscribedTokens: ownedInscribedTokens.length,
        inscribedContract: !!inscribedContract,
        originalContract: !!originalContract,
        helperContract: !!helperContract,
        loading,
        message,
    });

    return (
        <div className="app-container">
            <title>PixelPepes Inscriber</title>
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
                    }

                    .header h1 {
                        font-size: 1.5em;
                        margin: 0;
                    }

                    .description {
                        margin: 15px 0;
                        padding: 15px;
                        font-size: 10px;
                        color: #00ff00;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                        background-color: rgba(0, 0, 0, 0.5);
                        border: 1px solid #00ff00;
                        border-radius: 5px;
                        line-height: 1.5em;
                    }

                    .wallet-container {
                        position: absolute;
                        top: 10px;
                        right: 20px;
                        text-align: right;
                    }

                    .wallet-container p {
                        margin: 5px 0;
                        font-size: 12px;
                        color: #00ff00;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                    }

                    .highlight {
                        color: #00ff00;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                    }

                    .message {
                        margin: 20px 0;
                        padding: 10px;
                        border: 1px solid #00ff00;
                        border-radius: 5px;
                        font-size: 12px;
                        text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                        background-color: rgba(0, 0, 0, 0.5);
                    }

                    .message.error {
                        background-color: rgba(255, 0, 0, 0.1);
                        color: #ff0000;
                    }

                    .message.success {
                        background-color: rgba(0, 255, 0, 0.1);
                        color: #00ff00;
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
                        margin: 5px 0;
                        background-color: rgba(255, 153, 0, 0.1);
                        border: 1px solid #ff9900;
                        padding: 5px;
                        border-radius: 5px;
                        font-size: 10px;
                        text-shadow: 0 0 5px rgba(255, 153, 0, 0.5);
			line-height: 1.5em;
                    }

                    .token-grid {
                        width: 910px;
                        margin: 10px auto; /* Reduced top margin from 20px to 10px */
                        border: 1px solid #00ff00;
                        border-radius: 5px;
                        padding: 10px;
                        background-color: rgba(0, 0, 0, 0.8);
                        box-shadow: inset 0 0 10px rgba(0, 255, 0, 0.2);
                    }

                    .token-grid-inner {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center;
                        gap: 15px;
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
                        transition: box-shadow 0.2s;
                    }

                    button:hover {
                        box-shadow: 0 0 20px rgba(0, 255, 0, 0.7);
                    }

                    button:active {
                        box-shadow: 0 0 30px rgba(0, 255, 0, 0.9); /* More intense glow on press */
                    }

                    button:disabled {
                        cursor: not-allowed;
                        opacity: 0.6;
                    }

                    .refresh-button {
                        padding: 5px 15px;
                        font-size: 10px;
                        margin-top: 5px;
                    }

                    .approve-all-button {
                        padding: 8px 20px;
                        font-size: 12px;
                        margin-bottom: 10px; /* Reduced from 20px to 10px */
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
                        onClick={async () => {
                            console.log("Connect Wallet button clicked");
                            const currentWeb3Instance = web3 || (window.ethereum ? new Web3(window.ethereum) : null);
                            if (!currentWeb3Instance) {
                                setMessage("MetaMask not available.");
                                return;
                            }
                            const connectWalletAndSetupContractsFn = connectWalletAndSetupContracts(
                                setWeb3, setAccount, setOriginalContract, setInscribedContract, setHelperContract, setMessage
                            );
                            const result = await connectWalletAndSetupContractsFn(currentWeb3Instance);
                            if (result.success) {
                                setWeb3(result.web3);
                                setAccount(result.account);
                                setOriginalContract(result.originalContract);
                                setInscribedContract(result.inscribedContract);
                                setHelperContract(result.helperContract);
                                setMessage('');
                            }
                        }}
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
                        }}>
                            REFRESH
                        </button>
                    </div>
                )}
                {message && (
                    <p className={`message ${message.toLowerCase().includes('error') || message.toLowerCase().includes('failed') || message.toLowerCase().includes('denied') || message.toLowerCase().includes('warning') ? 'error' : 'success'}`}>
                        {message}
                    </p>
                )}
                {account && (
                    <div>
                        <p className="warning">
                            Inscribing your $PXLPP transforms it into a unique $iPXLPP forever! Make sure to approve the inscriber contract first, and note that inscribing artwork to the blockchain may be gas intensive!
                        </p>
                        <h2 className="section-title">$PXLPP</h2>
                        {loading && <p style={{ fontSize: '14px', color: '#00ff00', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>LOADING...</p>}
                        {!loading && ownedV1Tokens.length === 0 && account && (!message || !message.includes("Fetching")) && (
                            <p style={{ fontSize: '14px', color: '#00ff00', marginTop: '14px', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>
                                NO $PXLPP TOKENS FOUND
                            </p>
                        )}
                        {!loading && ownedV1Tokens.length > 0 && (
                            <div>
                                <button className="approve-all-button" onClick={approveAllForInscribedFn} disabled={loading}>
                                    APPROVE ALL
                                </button>
                                <div className="token-grid">
                                    <div className="token-grid-inner">
                                        {ownedV1Tokens.map(token => (
                                            <TokenCard
                                                key={token.tokenId}
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
                        <h2 className="section-title">$iPXLPP</h2>
                        {loading && <p style={{ fontSize: '14px', color: '#00ff00', textShadow: '0 0 5px rgba(0, 255, 0, 0.5)' }}>LOADING...</p>}
                        {!loading && ownedInscribedTokens.length === 0 && account && (!message || !message.includes("Fetching")) && (
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
                                                key={token.tokenId}
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
