// src/contractActions.js
import axios from 'axios';
import { INSCRIBED_CONTRACT_ADDRESS, BASE64_BASE_URL, METADATA_BASE_URL } from './config';

// For individual token approval button on V1 tokens
export const approveInscribedContract = (
    originalContract, account, web3,
    setLoading, setMessage, debouncedFetchOwnedTokens
) => async (tokenId) => {
    if (!originalContract || !account || !INSCRIBED_CONTRACT_ADDRESS || !web3) {
        setMessage('Cannot approve: Prerequisites missing.');
        console.error("approveInscribedContract prerequisites not met:", { originalContract: !!originalContract, account, INSCRIBED_CONTRACT_ADDRESS, web3: !!web3 });
        setLoading(false);
        return;
    }
    setLoading(true);
    const tokenIdStr = tokenId.toString();
    setMessage(`Approving Inscriber contract for V1 token ID ${tokenIdStr}...`);
    try {
        console.log(`Approving V1 token ID ${tokenIdStr} for Inscriber: ${INSCRIBED_CONTRACT_ADDRESS}`);
        
        const gasEstimate = await originalContract.methods.approve(INSCRIBED_CONTRACT_ADDRESS, tokenIdStr).estimateGas({ from: account });
        console.log(`Gas estimate for V1 approve: ${gasEstimate}`);
        const gasLimit = Math.floor(Number(gasEstimate) * 1.2) + 20000;
        console.log(`Calculated gasLimit for V1 approve: ${gasLimit}`);

        const gasPriceWei = await web3.eth.getGasPrice();
        const totalFeeWei = Number(gasPriceWei) * Number(gasLimit); // Replace BigInt with Number
        const balanceWei = await web3.eth.getBalance(account);

        if (Number(balanceWei) < totalFeeWei) { // Replace BigInt with Number
            setMessage(`Insufficient BASED for gas fees. Required: ~${web3.utils.fromWei(totalFeeWei.toString(), 'ether')} BASED, Available: ${web3.utils.fromWei(balanceWei.toString(), 'ether')} BASED`);
            setLoading(false);
            return;
        }

        await originalContract.methods.approve(INSCRIBED_CONTRACT_ADDRESS, tokenIdStr)
            .send({ from: account, gas: gasLimit, gasPrice: gasPriceWei })
            .on('transactionHash', (hash) => {
                setMessage(`V1 Approval transaction for token ${tokenIdStr} sent: ${hash}. Waiting for confirmation...`);
            })
            .on('receipt', (receipt) => {
                console.log(`V1 Approve transaction receipt for token ${tokenIdStr}:`, receipt);
                if (receipt.status) {
                    setMessage(`Successfully approved Inscriber contract for V1 token ${tokenIdStr}!`);
                    debouncedFetchOwnedTokens(); 
                } else {
                    setMessage(`V1 Approval transaction for token ${tokenIdStr} failed.`);
                }
                setLoading(false);
            })
            .on('error', (error, receiptOnError) => { 
                console.error(`V1 Approve error for token ${tokenIdStr}:`, error);
                if (receiptOnError) console.error('V1 Approve error receipt:', receiptOnError);
                setMessage(`Error approving V1 token ${tokenIdStr}: ${error.message}`);
                setLoading(false); 
            });

    } catch (error) {
        setMessage(`Error during V1 approval process for token ${tokenIdStr}: ${error.message}`);
        console.error(`V1 Approval process error for token ${tokenIdStr}:`, error);
        setLoading(false);
    }
};

// approveAllForInscribed function is REMOVED.

export const burnMintAndInscribe = (
    inscribedContract, 
    account, 
    web3, 
    originalContract, 
    setLoading, 
    setMessage, 
    debouncedFetchOwnedTokens,
    debouncedFetchOwnedInscribedTokens, 
    metadataCache
) => async (tokenId, v1MetadataIdForDataFetching) => { 
    if (!inscribedContract || !account || !web3 || !originalContract || !INSCRIBED_CONTRACT_ADDRESS) {
        setMessage('Cannot inscribe: Prerequisites missing.'); 
        setLoading(false); 
        return;
    }
    setLoading(true);
    const tokenIdStr = tokenId.toString();
    console.log(`--- Starting inscription process for Token ID: ${tokenIdStr} (V1 MetaID for data: ${v1MetadataIdForDataFetching}) ---`);
    
    try {
        // Step 1: Client-Side V1 Pre-flight Validations 
        setMessage(`Validating V1 token ${tokenIdStr} state & specific approval...`);
        let v1Owner;
        try {
            // Ensure ownerOf is defined in ORIGINAL_ABI in abis.js
            v1Owner = await originalContract.methods.ownerOf(tokenIdStr).call();
            if (v1Owner.toLowerCase() !== account.toLowerCase()) {
                setMessage(`Error: You are not the owner of V1 token ${tokenIdStr}.`); 
                setLoading(false); return;
            }

            const contractV1TokenMetadataId = (await originalContract.methods.tokenToMetadataId(tokenIdStr).call()).toString();
            if (contractV1TokenMetadataId !== v1MetadataIdForDataFetching.toString()) {
                 console.warn(`V1 MetaID mismatch for token ${tokenIdStr}: contract (${contractV1TokenMetadataId}), expected for data files (${v1MetadataIdForDataFetching}). Using ${v1MetadataIdForDataFetching} for IPFS.`);
            }
            
            const approvedForTokenOnV1 = await originalContract.methods.getApproved(tokenIdStr).call();
            if (approvedForTokenOnV1.toLowerCase() !== INSCRIBED_CONTRACT_ADDRESS.toLowerCase()) {
                setMessage(`Error: Token ${tokenIdStr} is not specifically approved for the Inscriber contract. Please use the 'Approve' button for this token first.`);
                setLoading(false); return;
            }
            console.log(`V1 token ${tokenIdStr} state and specific approval checks passed.`);

        } catch (e) {
            setMessage(`Error validating V1 token ${tokenIdStr} state/approval: ${e.message}`); 
            setLoading(false); return;
        }
        
        // Step 2: Fetch Data for Inscription
        setMessage(`Workspaceing inscription data for token ${tokenIdStr}...`);
        const base64FileUrl = `${BASE64_BASE_URL}base64_${v1MetadataIdForDataFetching}.txt`;
        let rawBase64ImageData;
        if (metadataCache.current.has(base64FileUrl)) { 
            rawBase64ImageData = metadataCache.current.get(base64FileUrl);
            console.log(`Retrieved raw base64 data from cache for ${base64FileUrl}.`);
        } else { 
            const r = await axios.get(base64FileUrl, {timeout:20000,transformResponse:[(d)=>d]}); 
            rawBase64ImageData=r.data; 
            if(typeof rawBase64ImageData!=='string') throw new Error('Fetched raw base64 img not string.'); 
            if(rawBase64ImageData.startsWith('data:')) {
                rawBase64ImageData=rawBase64ImageData.substring(rawBase64ImageData.indexOf(',')+1);
                console.log("NOTE: Stripped data URI prefix from fetched base64, sending raw for V2_StorageBased contract.");
            }
            metadataCache.current.set(base64FileUrl,rawBase64ImageData); 
        }

        const metadataJsonUrl = `${METADATA_BASE_URL}metadata_${v1MetadataIdForDataFetching}.json`;
        let v1JsonMetadata;
        if (metadataCache.current.has(metadataJsonUrl)) { 
            v1JsonMetadata = metadataCache.current.get(metadataJsonUrl); 
            console.log(`Retrieved V1 JSON metadata from cache for ${metadataJsonUrl}.`);
        } else { 
            const r = await axios.get(metadataJsonUrl, {timeout:10000}); 
            v1JsonMetadata=r.data; 
            metadataCache.current.set(metadataJsonUrl,v1JsonMetadata); 
        }
        
        const nameParam = v1JsonMetadata.name || `PixelPepe #${tokenId}`;
        const v1ImageParam = v1JsonMetadata.image || ""; 
        const attributesParam = JSON.stringify(v1JsonMetadata.attributes || []);

        console.log(`Parameters for Inscriber contract: TokenID=${tokenIdStr}, Name='${nameParam}', V1Img='${v1ImageParam}', AttrLen=${attributesParam.length}, ImgDataLen=${rawBase64ImageData.length}`);
        const MAX_IMAGE_DATA_BYTES_CONTRACT = 35*1024; 
        const MAX_NAME_BYTES_CONTRACT = 256; 
        const MAX_V1_IMAGE_BYTES_CONTRACT = 256; 
        const MAX_ATTRIBUTES_BYTES_CONTRACT = 2*1024;

        if(!(rawBase64ImageData.length > 0 && rawBase64ImageData.length <= MAX_IMAGE_DATA_BYTES_CONTRACT)) {setMessage(`Image data size error (${rawBase64ImageData.length} vs ${MAX_IMAGE_DATA_BYTES_CONTRACT})`); setLoading(false); return;}
        if(!(nameParam.length <= MAX_NAME_BYTES_CONTRACT)) {setMessage(`Name size error (${nameParam.length} vs ${MAX_NAME_BYTES_CONTRACT})`); setLoading(false); return;}
        if(!(v1ImageParam.length <= MAX_V1_IMAGE_BYTES_CONTRACT)) {setMessage(`V1 Image URL size error (${v1ImageParam.length} vs ${MAX_V1_IMAGE_BYTES_CONTRACT})`); setLoading(false); return;}
        if(!(attributesParam.length <= MAX_ATTRIBUTES_BYTES_CONTRACT)) {setMessage(`Attributes size error (${attributesParam.length} vs ${MAX_ATTRIBUTES_BYTES_CONTRACT})`); setLoading(false); return;}

        // Step 3: Send Inscription Transaction
        setMessage(`Sending inscription transaction for token ${tokenIdStr}...`);
        const transaction = inscribedContract.methods.burnMintAndInscribe(
            tokenIdStr, rawBase64ImageData, nameParam, v1ImageParam, attributesParam
        );
        
        const hardcodedGasLimit = 35000000; 
        const gasPriceWei = await web3.eth.getGasPrice();
        
        const balanceWeiTx = await web3.eth.getBalance(account);
        const totalFeeWeiTx = Number(gasPriceWei) * Number(hardcodedGasLimit); // Replace BigInt with Number
        if (Number(balanceWeiTx) < totalFeeWeiTx) { // Replace BigInt with Number
            setMessage(`Insufficient BASED for inscription gas. Required: ~${web3.utils.fromWei(totalFeeWeiTx.toString(), 'ether')} BASED`);
            setLoading(false); return;
        }

        await transaction.send({ from: account, gas: hardcodedGasLimit, gasPrice: gasPriceWei })
            .on('transactionHash', (hash) => {
                setMessage(`Inscribe transaction for ${tokenIdStr} sent: ${hash}. Waiting...`);
            })
            .on('receipt', (receipt) => {
                console.log(`Inscribe transaction receipt for ${tokenIdStr}:`, receipt);
                if (receipt.status) { 
                    const event = receipt.events && receipt.events['V1BurnedAndInscribedMinted'];
                    setMessage(event ? `Token ${event.returnValues.tokenId} successfully inscribed!` : `Token ${tokenIdStr} inscribed! (Event check needed)`);
                } else {
                     setMessage(`Inscription for ${tokenIdStr} FAILED (reverted). Status: ${receipt.status === false ? '0' : receipt.status}.`);
                }
                debouncedFetchOwnedTokens();
                debouncedFetchOwnedInscribedTokens();
                setLoading(false);
            })
            .on('error', (error, receiptOnError) => {
                console.error(`Inscribe error for token ${tokenIdStr}:`, error);
                let revertMessage = "Transaction failed/reverted."; 
                if (error.message) {
                    if (error.message.includes("PPI: Token ID out of V1 range")) revertMessage = "Token ID is out of the V1 range.";
                    else if (error.message.includes("PPI: Token already minted in Inscribed")) revertMessage = "This token has already been inscribed.";
                    else if (error.message.includes("PPI: Invalid data sizes")) revertMessage = "Data size error (image, name, v1Image, or attributes).";
                    else if (error.message.includes("PPI: Caller is not the owner of the V1 NFT")) revertMessage = "You are not the owner of the V1 token.";
                    else if (error.message.includes("PPI: This contract is not approved to transfer the V1 NFT")) revertMessage = "Inscriber not approved for V1 token. Please approve first.";
                    else if (error.message.includes("PPI: Token does not exist in V1")) revertMessage = "The V1 token does not exist.";
                    else if (error.message.includes("PPI: Failed to check approval for V1 token")) revertMessage = "Could not verify V1 token approval.";
                    else if (error.message.includes("PPI: Failed to fetch metadata ID from V1 contract")) revertMessage = "Could not fetch metadata ID from V1 contract.";
                    else if (error.message.includes("PPI: Failed to burn V1 token")) revertMessage = "Failed to burn the V1 token.";
                    else if (error.message.includes('reverted by the EVM') && !error.message.includes("PPI:")) revertMessage = "Tx reverted by EVM (No specific reason). Could be gas for storage or V1 issue.";
                    else if (error.message.includes("Transaction ran out of gas")) revertMessage = `Tx ran out of gas (limit: ${hardcodedGasLimit}).`;
                    else revertMessage = error.message.split('\n')[0];
                }
                setMessage(`Error inscribing token ${tokenIdStr}: ${revertMessage}`);
                setLoading(false);
            });

    } catch (error) { 
        console.error(`Critical error in inscription process for ${tokenIdStr}:`, error);
        if (axios.isAxiosError(error)) {
            setMessage(`Network/server error fetching data for token ${tokenIdStr}: ${error.message}`);
        } else {
            setMessage(`Critical error for token ${tokenIdStr}: ${error.message}`);
        }
        setLoading(false);
    }
};

export const refreshTokens = (
    setMessage, debouncedFetchOwnedTokens, debouncedFetchOwnedInscribedTokens
) => () => {
    setMessage('Refreshing token lists...');
    if (debouncedFetchOwnedTokens) debouncedFetchOwnedTokens();
    if (debouncedFetchOwnedInscribedTokens) debouncedFetchOwnedInscribedTokens();
};
