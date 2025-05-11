import React from 'react';

function TokenCard({ token, isV1, onApprove, onUpgrade, loading, inscribedContract }) {
    // Determine the block explorer URL based on whether it's a $PXLPP or $iPXLPP token
    const contractAddress = isV1
        ? "0x22af27d00c53C0Fba14446958864DB7e3fe0852c" // $PXLPP contract address
        : "0x8137879e89eF12eb0E90F1A3d197835b5C06D232"; // $iPXLPP contract address
    const explorerUrl = `https://explorer.bf1337.org/token/${contractAddress}/instance/${token.tokenId}`;

    return (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <div className="token-card">
                <style>
                    {`
                        .token-card {
                            width: 150px;
                            padding: 8px;
                            background-color: rgba(0, 0, 0, 0.8);
                            border: 1px solid #00ff00;
                            border-radius: 5px;
                            box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
                            text-align: center;
                            color: #00ff00;
                            font-family: "Press Start 2P", cursive;
                            font-size: 10px;
                            transition: transform 0.1s, box-shadow 0.2s;
                        }

                        .token-card:hover {
                            transform: scale(1.03); /* Reduced from 1.05 to 1.03 for a subtler effect */
                            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
                        }

                        .token-image {
                            width: 100%;
                            height: auto;
                            border-radius: 3px;
                            margin-bottom: 5px;
                        }

                        .token-id {
                            margin: 5px 0;
                            font-size: 8px;
                            text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                        }

                        .action-button {
                            padding: 5px 10px;
                            background-color: #000;
                            color: #00ff00;
                            border: 1px solid #00ff00;
                            border-radius: 3px;
                            font-family: "Press Start 2P", cursive;
                            font-size: 8px;
                            cursor: pointer;
                            box-shadow: 0 0 5px rgba(0, 255, 0, 0.3);
                            margin: 2px;
                            transition: box-shadow 0.2s;
                        }

                        .action-button:hover {
                            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
                        }

                        .action-button:active {
                            box-shadow: 0 0 20px rgba(0, 255, 0, 0.9);
                        }

                        .action-button:disabled {
                            cursor: not-allowed;
                            opacity: 0.6;
                        }

                        .inscribe-button {
                            padding: 8px 20px; /* Larger size, matching .approve-all-button */
                            font-size: 12px;
                            background-color: #00ff00; /* Bright green background */
                            color: #000; /* Black text */
                            border: 1px solid #00ff00;
                            border-radius: 3px;
                            font-family: "Press Start 2P", cursive;
                            cursor: pointer;
                            box-shadow: 0 0 5px rgba(0, 255, 0, 0.3);
                            margin: 2px;
                            transition: box-shadow 0.2s;
                        }

                        .inscribe-button:hover {
                            box-shadow: 0 0 15px rgba(0, 255, 0, 0.9); /* More intense, less transparent glow */
                        }

                        .inscribe-button:active {
                            box-shadow: 0 0 20px rgba(0, 255, 0, 0.9);
                        }

                        .inscribe-button:disabled {
                            cursor: not-allowed;
                            opacity: 0.6;
                        }
                    `}
                </style>
                {token.imageUrl && (
                    <img src={token.imageUrl} alt={`Token ${token.tokenId}`} className="token-image" />
                )}
                <p className="token-id">Token ID: {token.tokenId}</p>
                {isV1 && (
                    <div>
                        {token.isApproved ? (
                            <button
                                className="inscribe-button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onUpgrade(token.tokenId);
                                }}
                                disabled={loading}
                            >
                                INSCRIBE
                            </button>
                        ) : (
                            <button
                                className="action-button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onApprove(token.tokenId);
                                }}
                                disabled={loading || !inscribedContract}
                            >
                                APPROVE
                            </button>
                        )}
                    </div>
                )}
            </div>
        </a>
    );
}

export default TokenCard;
