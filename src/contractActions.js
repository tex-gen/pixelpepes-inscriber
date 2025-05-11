import axios from 'axios';
import { INSCRIBED_CONTRACT_ADDRESS, BASE64_BASE_URL, METADATA_BASE_URL } from './config';

export const approveInscribedContract = (originalContract, account, web3, setLoading, setMessage, debouncedFetchOwnedTokens) => {
    return async (tokenId) => {
        if (!originalContract || !account || !INSCRIBED_CONTRACT_ADDRESS || !web3) {
            setMessage('Cannot approve: Inscribed contract details not configured or wallet not connected.');
            return;
        }
        setLoading(true);
        setMessage(`Approving Inscribed contract for token ID ${tokenId}...`);
        try {
            console.log(`Approving token ID ${tokenId}, type: ${typeof tokenId}, value: ${tokenId}`);
            const tokenIdStr = tokenId.toString();
            const gasEstimate = await originalContract.methods.approve(INSCRIBED_CONTRACT_ADDRESS, tokenIdStr).estimateGas({ from: account });
            console.log(`Gas estimate for approve, type: ${typeof gasEstimate}, value: ${gasEstimate}`);
            const gasEstimateNum = Number(gasEstimate);
            const gasLimit = Math.floor(gasEstimateNum * 1.2);
            console.log(`Calculated gasLimit: ${gasLimit}`);
            const gasPriceWei = await web3.eth.getGasPrice();
            const totalFeeWei = Number(gasPriceWei) * gasLimit;
            const totalFeeBased = web3.utils.fromWei(totalFeeWei.toString(), 'ether');
            const balanceWei = await web3.eth.getBalance(account);
            const balanceBased = web3.utils.fromWei(balanceWei, 'ether');
            if (Number(balanceBased) < Number(totalFeeBased)) {
                setMessage(`Insufficient BASED for gas fees. Required: ${totalFeeBased} BASED, Available: ${balanceBased} BASED`);
                setLoading(false);
                return;
            }
            await originalContract.methods.approve(INSCRIBED_CONTRACT_ADDRESS, tokenIdStr).send({ from: account, gas: gasLimit, gasPrice: gasPriceWei });
            setMessage(`Successfully approved token ID ${tokenId}! You can now upgrade.`);
            debouncedFetchOwnedTokens();
        } catch (error) {
            setMessage(`Error approving token ID ${tokenId}: ${error.message}`);
            console.error(`Approve error for ${tokenId}:`, error);
        } finally {
            setLoading(false);
        }
    };
};

export const approveAllForInscribed = (originalContract, account, ownedV1Tokens, web3, setLoading, setMessage, setOwnedV1Tokens, debouncedFetchOwnedTokens) => {
    return async () => {
        if (!originalContract || !account || !INSCRIBED_CONTRACT_ADDRESS || !web3) {
            setMessage('Cannot approve all: Inscribed contract details not configured, wallet not connected, or web3 not initialized.');
            return;
        }
        if (ownedV1Tokens.length === 0) {
            setMessage('No $PXLPP tokens available to approve.');
            return;
        }

        setLoading(true);
        setMessage('Checking if Inscribed contract is already approved for all $PXLPP tokens...');

        try {
            const isAlreadyApproved = await originalContract.methods.isApprovedForAll(account, INSCRIBED_CONTRACT_ADDRESS).call();
            console.log(`isApprovedForAll(${account}, ${INSCRIBED_CONTRACT_ADDRESS}): ${isAlreadyApproved}`);
            if (isAlreadyApproved) {
                setMessage('Inscribed contract is already approved for all $PXLPP tokens.');
                const updatedTokens = ownedV1Tokens.map(token => ({
                    ...token,
                    isApproved: true
                }));
                setOwnedV1Tokens(updatedTokens);
                setLoading(false);
                return;
            }

            setMessage('Approving Inscribed contract for all $PXLPP tokens using setApprovalForAll...');
            console.log('Calling setApprovalForAll...');
            const gasEstimate = await originalContract.methods.setApprovalForAll(INSCRIBED_CONTRACT_ADDRESS, true).estimateGas({ from: account });
            console.log(`Gas estimate for setApprovalForAll: ${gasEstimate}`);
            const gasEstimateNum = Number(gasEstimate);
            const gasLimit = Math.floor(gasEstimateNum * 1.5);
            console.log(`Calculated gasLimit for setApprovalForAll: ${gasLimit}`);

            const gasPriceWei = await web3.eth.getGasPrice();
            const totalFeeWei = Number(gasPriceWei) * gasLimit;
            const totalFeeBased = web3.utils.fromWei(totalFeeWei.toString(), 'ether');
            const balanceWei = await web3.eth.getBalance(account);
            const balanceBased = web3.utils.fromWei(balanceWei, 'ether');
            if (Number(balanceBased) < Number(totalFeeBased)) {
                setMessage(`Insufficient BASED for gas fees. Required: ${totalFeeBased} BASED, Available: ${balanceBased} BASED`);
                setLoading(false);
                return;
            }

            await originalContract.methods.setApprovalForAll(INSCRIBED_CONTRACT_ADDRESS, true)
                .send({ from: account, gas: gasLimit, gasPrice: gasPriceWei })
                .on('transactionHash', (hash) => {
                    setMessage(`Transaction sent for setApprovalForAll: ${hash}`);
                })
                .on('receipt', (receipt) => {
                    console.log('setApprovalForAll transaction receipt:', receipt);
                    setMessage('Successfully approved Inscribed contract for all $PXLPP tokens using setApprovalForAll! You can now upgrade them.');
                    debouncedFetchOwnedTokens();
                })
                .on('error', (error) => {
                    console.error('setApprovalForAll transaction error:', error);
                    setMessage(`Error in setApprovalForAll transaction: ${error.message}`);
                    setLoading(false);
                });
        } catch (error) {
            console.error('Error in approveAllForInscribed:', error);
            setMessage(`Error approving all tokens: ${error.message}. Falling back to individual approvals...`);

            let successfulApprovals = 0;
            let failedApprovals = 0;

            for (const token of ownedV1Tokens) {
                if (token.isApproved) {
                    successfulApprovals++;
                    continue;
                }

                try {
                    const tokenId = token.tokenId.toString();
                    setMessage(`Approving token ID ${tokenId} (${successfulApprovals + failedApprovals + 1}/${ownedV1Tokens.length})...`);
                    const gasEstimate = await originalContract.methods.approve(INSCRIBED_CONTRACT_ADDRESS, tokenId).estimateGas({ from: account });
                    const gasEstimateNum = Number(gasEstimate);
                    const gasLimit = Math.floor(gasEstimateNum * 1.2);
                    const gasPriceWei = await web3.eth.getGasPrice();
                    await originalContract.methods.approve(INSCRIBED_CONTRACT_ADDRESS, tokenId).send({ from: account, gas: gasLimit, gasPrice: gasPriceWei });
                    successfulApprovals++;
                } catch (innerError) {
                    console.error(`Error approving token ID ${token.tokenId}:`, innerError);
                    failedApprovals++;
                }
            }

            if (failedApprovals === 0) {
                setMessage(`Successfully approved all ${successfulApprovals} $PXLPP tokens individually! You can now upgrade them.`);
            } else {
                setMessage(`Approved ${successfulApprovals} $PXLPP tokens, but ${failedApprovals} failed. Please try again for the remaining tokens.`);
            }
            debouncedFetchOwnedTokens();
        } finally {
            setLoading(false);
        }
    };
};

export const burnMintAndInscribe = (inscribedContract, account, web3, originalContract, setLoading, setMessage, debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens, metadataCache) => {
    return async (tokenId, metadataId) => {
        if (!inscribedContract || !account || !web3) {
            setMessage('Cannot upgrade: Inscribed contract not ready, account missing, or web3 not initialized.');
            return;
        }
        setLoading(true);
        setMessage(`Upgrading token ID ${tokenId} to $iPXLPP... (Fetching inscription data)`);
        try {
            const approvedAddress = await originalContract.methods.getApproved(tokenId).call();
            const isApprovedForAll = await originalContract.methods.isApprovedForAll(account, INSCRIBED_CONTRACT_ADDRESS).call();
            if (!isApprovedForAll && approvedAddress.toLowerCase() !== INSCRIBED_CONTRACT_ADDRESS.toLowerCase()) {
                setMessage(`Error: Inscribed contract (${INSCRIBED_CONTRACT_ADDRESS}) is not approved for token ID ${tokenId}. Please approve first.`);
                setLoading(false);
                return;
            }

            const tokenIdStr = tokenId.toString();
            const base64FileUrl = `${BASE64_BASE_URL}base64_${metadataId}.txt`;
            let base64Data;
            if (metadataCache.current.has(base64FileUrl)) {
                base64Data = metadataCache.current.get(base64FileUrl);
            } else {
                const base64Response = await axios.get(base64FileUrl, { timeout: 10000 });
                base64Data = base64Response.data;
                metadataCache.current.set(base64FileUrl, base64Data);
            }

            const metadataJsonUrl = `${METADATA_BASE_URL}metadata_${metadataId}.json`;
            let v1Metadata;
            if (metadataCache.current.has(metadataJsonUrl)) {
                v1Metadata = metadataCache.current.get(metadataJsonUrl);
            } else {
                const metadataResponse = await axios.get(metadataJsonUrl, { timeout: 10000 });
                v1Metadata = metadataResponse.data;
                metadataCache.current.set(metadataJsonUrl, v1Metadata);
            }

            console.log(`base64Data length: ${base64Data.length} characters`);
            const name = v1Metadata.name || `Token ${tokenId}`;
            const v1Image = v1Metadata.image || "";
            const attributes = JSON.stringify(v1Metadata.attributes || []);
            console.log(`name length: ${name.length}, v1Image length: ${v1Image.length}, attributes length: ${attributes.length}`);

            setMessage(`Sending transaction to upgrade token ID ${tokenId}...`);

            const transaction = inscribedContract.methods.burnMintAndInscribe(tokenIdStr, base64Data, name, v1Image, attributes);
            let gasEstimate;
            try {
                gasEstimate = await transaction.estimateGas({ from: account });
                console.log(`Gas estimate for burnMintAndInscribe, type: ${typeof gasEstimate}, value: ${gasEstimate}`);
            } catch (estimateError) {
                console.error(`Gas estimation failed for burnMintAndInscribe: ${estimateError.message}`);
                setMessage(`Error estimating gas for token ID ${tokenId}: ${estimateError.message}`);
                setLoading(false);
                return;
            }

            let gasEstimateNum = Number(gasEstimate);
            const maxGasLimit = 31000000;
            if (gasEstimateNum > 10000000) {
                console.warn(`Gas estimate is high: ${gasEstimateNum}. Using fallback gas limit of ${maxGasLimit}.`);
                setMessage(`Warning: Gas estimate for token ID ${tokenId} is high (${gasEstimateNum}). Using fallback gas limit of ${maxGasLimit}.`);
                gasEstimateNum = maxGasLimit;
            }
            const gasLimit = Math.min(Math.floor(gasEstimateNum * 1.2), maxGasLimit);
            console.log(`Calculated gasLimit: ${gasLimit}`);

            if (gasLimit === maxGasLimit) {
                setMessage(`Note: Using maximum gas limit (${maxGasLimit}). If the transaction fails, the block gas limit may be too low. Please try again later.`);
            }

            const gasPriceWei = await web3.eth.getGasPrice();
            const gasPriceGwei = web3.utils.fromWei(gasPriceWei, 'gwei');
            console.log(`Current gas price: ${gasPriceGwei} Gwei (${gasPriceWei} Wei)`);

            const totalFeeWei = Number(gasPriceWei) * gasLimit;
            const totalFeeBased = web3.utils.fromWei(totalFeeWei.toString(), 'ether');
            console.log(`Estimated total fee: ${totalFeeBased} BASED (gasLimit: ${gasLimit}, gasPrice: ${gasPriceGwei} Gwei)`);

            const balanceWei = await web3.eth.getBalance(account);
            const balanceBased = web3.utils.fromWei(balanceWei, 'ether');
            console.log(`Wallet BASED balance before transaction: ${balanceBased} BASED`);
            if (Number(balanceBased) < Number(totalFeeBased)) {
                setMessage(`Insufficient BASED for gas fees. Required: ${totalFeeBased} BASED, Available: ${balanceBased} BASED`);
                setLoading(false);
                return;
            }

            await transaction.send({ from: account, gas: gasLimit, gasPrice: gasPriceWei })
                .on('transactionHash', (hash) => {
                    setMessage(`Transaction sent for token ID ${tokenId}: ${hash}`);
                })
                .on('receipt', (receipt) => {
                    console.log(`Transaction receipt for token ID ${tokenId}:`, receipt);
                    console.log("Receipt events:", receipt.events);
                    const event = receipt.events['V1BurnedAndInscribedMinted'];
                    if (event) {
                        setMessage(`Successfully upgraded token ID ${tokenId} to $iPXLPP! Owner: ${event.returnValues.owner}`);
                    } else {
                        console.log("V1BurnedAndInscribedMinted event not found in receipt.");
                        setMessage(`Upgraded token ID ${tokenId}, but could not confirm event.`);
                    }
                    debouncedFetchOwnedTokens();
                    debouncedFetchOwnedInscribedTokens();
                })
                .on('error', (error) => {
                    console.log("Transaction error details:", error);
                    let revertMessage = error.message;
                    if (error.message.includes('revert')) {
                        if (error.message.includes('PPI: Token already minted in Inscribed')) {
                            revertMessage = 'This token has already been upgraded to $iPXLPP.';
                        } else if (error.message.includes('PPI: This contract is not approved')) {
                            revertMessage = 'The Inscribed contract is not approved to transfer this $PXLPP token. Please approve first.';
                        } else if (error.message.includes('PPI: Token ID out of $PXLPP range')) {
                            revertMessage = 'Token ID is out of the valid range for $PXLPP tokens.';
                        } else if (error.message.includes('PPI: Invalid data sizes')) {
                            revertMessage = 'The provided metadata or image data exceeds size limits.';
                        } else if (error.message.includes('PPI: Token does not exist in $PXLPP')) {
                            revertMessage = 'Token does not exist in the $PXLPP contract.';
                        }
                    }
                    setMessage(`Error upgrading token ID ${tokenId}: ${revertMessage}`);
                    console.error(`Upgrade error for ${tokenId}:`, error);
                    setLoading(false);
                });
        } catch (error) {
            setMessage(`Error upgrading token ID ${tokenId}: ${error.message}`);
            console.error(`Upgrade error for ${tokenId}:`, error);
            setLoading(false);
        }
    };
};

export const refreshTokens = (setMessage, debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens) => {
    return () => {
        setMessage('Refreshing token lists...');
        debouncedFetchOwnedTokens();
        debouncedFetchOwnedInscribedTokens();
    };
};
