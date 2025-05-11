// src/components/TokenCard.js
import React from 'react';

function TokenCard({ token, isV1, onApprove, onUpgrade, loading, inscribedContract }) {
    const contractAddress = isV1
        ? "0x22af27d00c53C0Fba14446958864DB7e3fe0852c" // $PXLPP V1 contract address
        : "0x8137879e89eF12eb0E90F1A3d197835b5C06D232"; // $iPXLPP Inscriber V2 contract address
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
                            transform: scale(1.03);
                            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
                        }
                        .token-image {
                            width: 100%;
                            height: auto;
                            object-fit: contain;
                            border: 1px solid #00ff00;
                            border-radius: 3px;
                            image-rendering: pixelated;
                            margin-bottom: 5px;
                        }
                        .token-id {
                            margin: 5px 0;
                            font-size: 8px;
                            text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
                        }
                        .action-button { /* For "Approve" */
                            padding: 5px 10px;
                            background-color: #000;
                            color: #00ff00;
                            border: 1px solid #00ff00;
                            border-radius: 3px;
                            font-family: "Press Start 2P", cursive;
                            font-size: 8px;
                            cursor: pointer;
                            box-shadow: 0 0 5px rgba(0, 255, 0, 0.3);
                            margin: 2px 0;
                            transition: box-shadow 0.2s, background-color 0.2s, color 0.2s;
                            width: 100%; 
                            box-sizing: border-box;
                        }
                        .action-button:hover {
                            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
                            background-color: #00ff00;
                            color: #000;
                        }
                        .action-button:active {
                            box-shadow: 0 0 20px rgba(0, 255, 0, 0.9) !important;
                        }
                        .action-button:disabled {
                            cursor: not-allowed;
                            opacity: 0.6;
                            background-color: #000;
                            color: #00ff00;
                        }
                        .inscribe-button { /* For "Inscribe" */
                            padding: 8px 15px;
                            font-size: 10px;
                            background-color: #00ff00; 
                            color: #000; 
                            border: 1px solid #00ff00;
                            border-radius: 3px;
                            font-family: "Press Start 2P", cursive;
                            cursor: pointer;
                            box-shadow: 0 0 5px rgba(0, 255, 0, 0.3);
                            margin: 2px 0;
                            transition: box-shadow 0.2s, background-color 0.2s, color 0.2s;
                            width: 100%; 
                            box-sizing: border-box;
                        }
                        .inscribe-button:hover {
                            box-shadow: 0 0 15px rgba(0, 255, 0, 0.9);
                            background-color: #00cc00;
                            color: #000;
                        }
                        .inscribe-button:active {
                            box-shadow: 0 0 20px rgba(0, 255, 0, 0.9) !important;
                        }
                        .inscribe-button:disabled {
                            cursor: not-allowed;
                            opacity: 0.6;
                            background-color: #00ff00;
                            color: #000;
                        }
                    `}
                </style>
                {token.imageUrl && (
                    <img
                        src={token.imageUrl}
                        alt={`Token ${token.tokenId}`}
                        className="token-image"
                        loading="lazy"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/150?text=ERR'; }}
                    />
                )}
                <p className="token-id">
                    ID: {token.tokenId}
                </p>
                {isV1 && (
                    <div style={{ marginTop: '5px' }}>
                        {token.isApproved ? (
                            <button
                                className="inscribe-button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onUpgrade(token.tokenId, token.metadataId);
                                }}
                                disabled={!inscribedContract || loading} 
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
                                // Corrected: Disable if loading or if inscribedContract (target of approval) is not ready
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
