// src/tokenFetcher.js
import axios from 'axios';
import { METADATA_BASE_URL, INSCRIBED_CONTRACT_ADDRESS } from './config';

export const fetchOwnedTokens = (
    account, helperContract, originalContract, inscribedContract,
    setLoading, setMessage, setOwnedV1Tokens, metadataCache
) => async () => {
    console.log("fetchOwnedTokens called. Account:", account, "HelperContract:", !!helperContract, "OriginalContract:", !!originalContract);
    if (!helperContract || !originalContract || !account) {
        console.log("fetchOwnedTokens: Prerequisites not met (helperContract, originalContract, or account missing).");
        return;
    }

    setLoading(true);
    setMessage('Fetching your $PXLPP tokens...');
    setOwnedV1Tokens([]); 

    try {
        console.log(`Attempting to call helperContract.tokensOfOwner(${account})`);
        const tokenIdsBigInt = await helperContract.methods.tokensOfOwner(account).call();
        const tokenIds = tokenIdsBigInt.map(id => Number(id));
        console.log(`Helper contract returned ${tokenIds.length} $PXLPP token IDs:`, tokenIds);

        if (tokenIds.length === 0) {
            setMessage('No $PXLPP tokens found for this wallet via Helper contract.');
            setLoading(false);
            return;
        }

        setMessage(`Found ${tokenIds.length} $PXLPP tokens. Retrieving details...`);

        const tokenPreDataPromises = tokenIds.map(async (tokenId) => {
            try {
                let isMintedInInscribed = false;
                if (inscribedContract) {
                    isMintedInInscribed = await inscribedContract.methods.existsInInscribed(tokenId).call();
                    // console.log(`Token ID ${tokenId}: existsInInscribed = ${isMintedInInscribed}`); // Optional: less verbose
                }
                if (isMintedInInscribed) {
                    // console.log(`Token ID ${tokenId} ($PXLPP) already in $iPXLPP. Skipping.`); // Optional: less verbose
                    return null; 
                }

                // THIS IS THE CRUCIAL CHANGE: isApproved now solely relies on getApproved()
                let isApproved = false; 
                if (INSCRIBED_CONTRACT_ADDRESS && originalContract) {
                    try {
                        const approvedAddress = await originalContract.methods.getApproved(tokenId).call();
                        if (approvedAddress.toLowerCase() === INSCRIBED_CONTRACT_ADDRESS.toLowerCase()) {
                            isApproved = true;
                        }
                    } catch (e) {
                        console.warn(`Could not get V1 approval status for token ${tokenId} during fetch: ${e.message}`);
                        // isApproved remains false
                    }
                }
                // The isApprovedForAll check is removed from this determination for UI consistency with V2 contract's check

                const metadataIdBigInt = await originalContract.methods.tokenToMetadataId(tokenId).call();
                return { 
                    tokenId, 
                    metadataId: Number(metadataIdBigInt), 
                    isApproved, // This is the flag TokenCard will use
                    isMintedInInscribed 
                };
            } catch (error) {
                console.error(`Error fetching pre-data for $PXLPP token ${tokenId}: ${error.message}`);
                return { tokenId, metadataId: 0, isApproved: false, isMintedInInscribed: false, error: true, errorMessage: error.message };
            }
        });

        const preliminaryTokenData = (await Promise.allSettled(tokenPreDataPromises))
            .filter(r => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value);

        if (preliminaryTokenData.length === 0) {
             if (tokenIds.length > 0) {
                setMessage('No $PXLPP tokens available for upgrade (e.g., all already inscribed, or errors processing token data).');
             }
            setLoading(false);
            return;
        }

        setMessage(`Processing metadata for ${preliminaryTokenData.length} eligible $PXLPP tokens...`);

        const metadataFetchPromises = preliminaryTokenData.map(async (tokenData) => {
            if (tokenData.error) return { ...tokenData, name: `Token ${tokenData.tokenId} (Data Error)`, imageUrl: `https://via.placeholder.com/150?text=DataErr+${tokenData.tokenId}`, traits: [], metadataError: true };
            const metadataUrl = `${METADATA_BASE_URL}metadata_${tokenData.metadataId}.json`;
            let metadata;
            if (metadataCache.current.has(metadataUrl)) {
                metadata = metadataCache.current.get(metadataUrl);
            } else {
                try {
                    const metadataResponse = await axios.get(metadataUrl, { timeout: 15000 });
                    metadata = metadataResponse.data;
                    metadataCache.current.set(metadataUrl, metadata);
                } catch (error) {
                    console.error(`Error fetching $PXLPP metadata for token ${tokenData.tokenId} (MetaID ${tokenData.metadataId}) from ${metadataUrl}: ${error.message}`);
                    return { ...tokenData, name: `Token ${tokenData.tokenId} (Meta Err)`, imageUrl: `https://via.placeholder.com/150?text=MetaLoadErr+${tokenData.tokenId}`, traits: [], metadataError: true };
                }
            }
            // Ensure all fields from tokenData (including isApproved) are spread here
            return { ...tokenData, name: metadata.name || `Token ${tokenData.tokenId}`, imageUrl: metadata.image ? metadata.image.replace(/^ipfs:\/\//, 'https://ipfs.filebase.io/ipfs/') : `https://via.placeholder.com/150?text=No+Image+${tokenData.tokenId}`, traits: metadata.attributes || [] };
        });

        const finalTokenDetails = (await Promise.allSettled(metadataFetchPromises))
            .filter(r => r.status === 'fulfilled').map(r => r.value);
        setOwnedV1Tokens(finalTokenDetails);

        if (finalTokenDetails.length === 0 && preliminaryTokenData.length > 0) {
            setMessage('Fetched $PXLPP token IDs, but failed to load metadata for all of them.');
        } else {
            const errCount = finalTokenDetails.filter(t => t.metadataError || t.error).length;
            if (errCount > 0) setMessage(`Displayed ${finalTokenDetails.length} $PXLPP tokens. Data/Metadata errors for ${errCount}.`);
            else if (finalTokenDetails.length > 0) setMessage('');
        }

    } catch (error) {
        setMessage(`Error fetching $PXLPP tokens via Helper: ${error.message}. See console.`);
        console.error('Fetch $PXLPP tokens (Helper) error:', error);
    } finally {
        setLoading(false);
    }
};

export const fetchOwnedInscribedTokens = (
    account, inscribedContract, originalContract,
    setLoading, setMessage, setOwnedInscribedTokens, metadataCache
) => async () => {
    console.log("fetchOwnedInscribedTokens called. Account:", account, "InscribedContract:", !!inscribedContract);
    if (!inscribedContract || !account) {
        console.log("fetchOwnedInscribedTokens: Prerequisites not met.");
        return;
    }

    setLoading(true);
    setMessage('Fetching your $iPXLPP tokens...');
    setOwnedInscribedTokens([]);

    try {
        const tokenIdsBigInt = await inscribedContract.methods.tokensOfOwner(account).call();
        const tokenIds = tokenIdsBigInt.map(id => Number(id));
        console.log(`Inscribed contract returned ${tokenIds.length} $iPXLPP token IDs:`, tokenIds);

        if (tokenIds.length === 0) {
            setMessage('No $iPXLPP tokens found for this wallet.');
            setLoading(false);
            return;
        }

        setMessage(`Found ${tokenIds.length} $iPXLPP tokens. Retrieving details...`);
        
        // For V2_StorageBased, tokenURI itself constructs the full metadata JSON data URI
        const tokenURIPromises = tokenIds.map(tokenId => 
            inscribedContract.methods.tokenURI(tokenId).call()
                .catch(err => {
                    console.error(`Error fetching tokenURI for $iPXLPP token ${tokenId}:`, err);
                    return ""; // Return empty string or placeholder on error for this specific token
                })
        );
        const tokenDataURIs = await Promise.all(tokenURIPromises);
        console.log(`Workspaceed ${tokenDataURIs.length} token data URIs for $iPXLPP`);

        const inscribedTokenDetailsPromises = tokenIds.map(async (tokenId, index) => {
            const dataUri = tokenDataURIs[index];
            try {
                let metadata = {};
                let metadataError = false;
                if (dataUri && dataUri.startsWith('data:application/json;base64,')) {
                    const cacheKey = `inscribed_token_uri_content_${tokenId}`;
                    if (metadataCache.current.has(cacheKey)) {
                        metadata = metadataCache.current.get(cacheKey);
                    } else {
                        const base64Json = dataUri.split(',')[1];
                        const jsonString = atob(base64Json); 
                        metadata = JSON.parse(jsonString);
                        metadataCache.current.set(cacheKey, metadata);
                    }
                    // The metadata.image within this JSON is expected to be the data:image/png;base64,... string
                    // console.log(`$iPXLPP Token ID ${tokenId}: metadata.image (data URI) = ${metadata.image ? metadata.image.substring(0,60) : 'N/A'}...`);
                } else {
                    metadataError = true;
                    console.warn(`$iPXLPP Token ID ${tokenId} had an invalid or missing data URI: "${dataUri.substring(0,100)}" Attempting fallback to V1 style if originalContract is present.`);
                    if (originalContract) { // Fallback to V1 metadata for display if on-chain URI failed
                        try {
                            const v1MetadataId = Number(await originalContract.methods.tokenToMetadataId(tokenId).call());
                            const v1MetadataUrl = `${METADATA_BASE_URL}metadata_${v1MetadataId}.json`;
                            const v1MetaCacheKey = `v1_metadata_fallback_for_inscribed_${tokenId}`;
                            if(metadataCache.current.has(v1MetaCacheKey)){
                                metadata = metadataCache.current.get(v1MetaCacheKey);
                            } else {
                                const v1Resp = await axios.get(v1MetadataUrl, {timeout: 10000});
                                metadata = v1Resp.data;
                                metadataCache.current.set(v1MetaCacheKey, metadata);
                            }
                        } catch (fallbackErr) {
                             metadata = { name: `Token ${tokenId} (URI/Fallback Err)`, image: `https://via.placeholder.com/150?text=No+Image+${tokenId}`};
                        }
                    } else {
                        metadata = { name: `Token ${tokenId} (URI Err)`, image: `https://via.placeholder.com/150?text=No+Image+${tokenId}`};
                    }
                }

                return {
                    tokenId,
                    name: metadata.name || `Inscribed Token ${tokenId}`,
                    imageUrl: metadata.image || `https://via.placeholder.com/150?text=No+Image+${tokenId}`, // This will be the data:image/png;base64 string from the JSON
                    traits: metadata.attributes || [],
                    metadataError
                };
            } catch (error) {
                console.error(`Error processing $iPXLPP token details for ${tokenId}: ${error.message}`);
                return { tokenId, name: `Token ${tokenId} (Proc. Error)`, imageUrl: `https://via.placeholder.com/150?text=ProcErr+${tokenId}`, traits: [], error: true };
            }
        });

        const inscribedTokenDetails = (await Promise.allSettled(inscribedTokenDetailsPromises))
            .filter(r => r.status === 'fulfilled').map(r => r.value);
        setOwnedInscribedTokens(inscribedTokenDetails);

        if (inscribedTokenDetails.length === 0 && tokenIds.length > 0 ) {
            setMessage('No $iPXLPP tokens found after processing details.');
        } else {
            const errCount = inscribedTokenDetails.filter(t => t.error || t.metadataError).length;
            if (errCount > 0) setMessage(`Displayed ${inscribedTokenDetails.length} $iPXLPP tokens. Errors processing details for ${errCount}.`);
            else if (inscribedTokenDetails.length > 0) setMessage(''); 
        }

    } catch (error) {
        setMessage(`Error fetching $iPXLPP tokens: ${error.message}. See console.`);
        console.error('Fetch $iPXLPP tokens error:', error);
    } finally {
        setLoading(false);
    }
};
