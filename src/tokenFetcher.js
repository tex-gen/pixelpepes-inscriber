import axios from 'axios';
import { INSCRIBED_CONTRACT_ADDRESS, METADATA_BASE_URL } from './config';

export const fetchOwnedTokens = (account, helperContract, originalContract, inscribedContract, setLoading, setMessage, setOwnedV1Tokens, metadataCache) => {
    return async () => {
        console.log("fetchOwnedTokens called. Account:", account, "HelperContract:", !!helperContract);
        if (!helperContract || !originalContract || !account) {
            console.log("fetchOwnedTokens: Prerequisites not met (helperContract, originalContract, or account missing).");
            return;
        }

        setLoading(true);
        setMessage('Fetching your $PXLPP tokens via Helper...');
        setOwnedV1Tokens([]);

        try {
            console.log(`Attempting to call helperContract.tokensOfOwner(${account})`);
            const tokenIdsBigInt = await helperContract.methods.tokensOfOwner(account).call();
            const tokenIds = tokenIdsBigInt.map(id => Number(id));
            console.log(`Helper contract returned ${tokenIds.length} token IDs:`, tokenIds);

            if (tokenIds.length === 0) {
                setMessage('No $PXLPP tokens found for this wallet via Helper contract.');
                setLoading(false);
                return;
            }

            setMessage(`Found ${tokenIds.length} $PXLPP tokens. Retrieving details...`);

            let isApprovedForAll = false;
            if (INSCRIBED_CONTRACT_ADDRESS) {
                isApprovedForAll = await originalContract.methods.isApprovedForAll(account, INSCRIBED_CONTRACT_ADDRESS).call();
                console.log(`isApprovedForAll(${account}, ${INSCRIBED_CONTRACT_ADDRESS}): ${isApprovedForAll}`);
            }

            const tokenPreDataPromises = tokenIds.map(async (tokenId) => {
                try {
                    let isMintedInInscribed = false;
                    if (inscribedContract) {
                        isMintedInInscribed = await inscribedContract.methods.existsInInscribed(tokenId).call();
                        console.log(`Token ID ${tokenId}: existsInInscribed = ${isMintedInInscribed}`);
                    }
                    if (isMintedInInscribed) {
                        console.log(`Token ID ${tokenId} ($PXLPP) already in $iPXLPP. Skipping.`);
                        return null;
                    }

                    let isApproved = isApprovedForAll;
                    if (!isApprovedForAll) {
                        const approvedAddress = await originalContract.methods.getApproved(tokenId).call();
                        isApproved = INSCRIBED_CONTRACT_ADDRESS && approvedAddress.toLowerCase() === INSCRIBED_CONTRACT_ADDRESS.toLowerCase();
                    }

                    const metadataIdBigInt = await originalContract.methods.tokenToMetadataId(tokenId).call();
                    return { tokenId, metadataId: Number(metadataIdBigInt), isApproved, isMintedInInscribed };
                } catch (error) {
                    console.error(`Error fetching pre-data for $PXLPP token ${tokenId}: ${error.message}`);
                    return { tokenId, metadataId: 0, isApproved: false, isMintedInInscribed: false, error: true, errorMessage: error.message };
                }
            });

            const preliminaryTokenData = (await Promise.allSettled(tokenPreDataPromises))
                .filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value);

            if (preliminaryTokenData.length === 0 && tokenIds.length > 0) {
                setMessage('No $PXLPP tokens available for upgrade (e.g., all in $iPXLPP, or errors occurred processing token data).');
                setLoading(false);
                return;
            }
            if (preliminaryTokenData.length === 0 && tokenIds.length === 0) {
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
                        console.error(`Error fetching metadata for token ${tokenData.tokenId} (MetaID ${tokenData.metadataId}) from ${metadataUrl}: ${error.message}`);
                        return { ...tokenData, name: `Token ${tokenData.tokenId} (Meta Err)`, imageUrl: `https://via.placeholder.com/150?text=MetaLoadErr+${tokenData.tokenId}`, traits: [], metadataError: true };
                    }
                }
                return { ...tokenData, name: metadata.name || `Token ${tokenData.tokenId}`, imageUrl: metadata.image ? metadata.image.replace(/^ipfs:\/\//, 'https://ipfs.filebase.io/ipfs/') : `https://via.placeholder.com/150?text=No+Image+${tokenData.tokenId}`, traits: metadata.attributes || [] };
            });

            const finalTokenDetails = (await Promise.allSettled(metadataFetchPromises))
                .filter(r => r.status === 'fulfilled').map(r => r.value);
            setOwnedV1Tokens(finalTokenDetails);

            if (finalTokenDetails.length === 0 && preliminaryTokenData.length > 0) {
                setMessage('Fetched token IDs, but failed to load metadata for all of them.');
            } else if (finalTokenDetails.length === 0 && preliminaryTokenData.length === 0) {
                // Message handled by earlier checks
            } else {
                const errCount = finalTokenDetails.filter(t => t.metadataError || t.error).length;
                if (errCount > 0) setMessage(`Displayed ${finalTokenDetails.length} $PXLPP tokens. Data/Metadata errors for ${errCount}.`);
                else setMessage('');
            }

        } catch (error) {
            setMessage(`Error fetching $PXLPP tokens via Helper: ${error.message}. See console.`);
            console.error('Fetch $PXLPP tokens (Helper) error:', error);
        } finally {
            setLoading(false);
        }
    };
};

export const fetchOwnedInscribedTokens = (account, inscribedContract, originalContract, setLoading, setMessage, setOwnedInscribedTokens, metadataCache) => {
    return async () => {
        console.log("fetchOwnedInscribedTokens called. Account:", account, "InscribedContract:", !!inscribedContract);
        if (!inscribedContract || !account) {
            console.log("fetchOwnedInscribedTokens: Prerequisites not met (inscribedContract or account missing).");
            return;
        }

        setLoading(true);
        setMessage('Fetching your $iPXLPP tokens...');
        setOwnedInscribedTokens([]);

        try {
            const tokenIdsBigInt = await inscribedContract.methods.tokensOfOwner(account).call();
            const tokenIds = tokenIdsBigInt.map(id => Number(id));
            console.log(`Inscribed contract returned ${tokenIds.length} token IDs:`, tokenIds);

            if (tokenIds.length === 0) {
                setMessage('No $iPXLPP tokens found for this wallet.');
                setLoading(false);
                return;
            }

            setMessage(`Found ${tokenIds.length} $iPXLPP tokens. Retrieving details...`);

            const tokenUris = await inscribedContract.methods.getTokenURIs(tokenIds).call();
            console.log(`Fetched ${tokenUris.length} token URIs`);

            const inscribedTokenDetailsPromises = tokenIds.map(async (tokenId, index) => {
                const tokenUri = tokenUris[index];
                try {
                    let metadata = {};
                    let metadataError = false;
                    if (tokenUri) {
                        const cacheKey = `tokenUri_${tokenId}`;
                        if (metadataCache.current.has(cacheKey)) {
                            metadata = metadataCache.current.get(cacheKey);
                        } else {
                            const base64Data = tokenUri.split(',')[1];
                            const jsonString = atob(base64Data);
                            metadata = JSON.parse(jsonString);
                            metadataCache.current.set(cacheKey, metadata);
                        }
                        console.log(`Token ID ${tokenId}: metadata.image = ${metadata.image}`);
                    } else {
                        metadataError = true;
                        const metadataId = await originalContract.methods.tokenToMetadataId(tokenId).call();
                        const v1MetadataUrl = `${METADATA_BASE_URL}metadata_${metadataId}.json`;
                        if (metadataCache.current.has(v1MetadataUrl)) {
                            metadata = metadataCache.current.get(v1MetadataUrl);
                        } else {
                            try {
                                const v1MetadataResponse = await axios.get(v1MetadataUrl, { timeout: 15000 });
                                metadata = v1MetadataResponse.data;
                                metadataCache.current.set(v1MetadataUrl, metadata);
                                console.log(`Token ID ${tokenId}: Fallback to $PXLPP metadata successful`);
                            } catch (v1Error) {
                                console.error(`Error fetching $PXLPP metadata for token ${tokenId}: ${v1Error.message}`);
                                metadata = { name: `Token ${tokenId}`, image: `https://via.placeholder.com/150?text=No+Image+${tokenId}`, attributes: [], v1Image: "" };
                            }
                        }
                    }

                    return {
                        tokenId,
                        name: metadata.name || `Token ${tokenId}`,
                        imageUrl: metadata.image || metadata.v1Image || `https://via.placeholder.com/150?text=No+Image+${tokenId}`,
                        traits: metadata.attributes || [],
                        metadataError
                    };
                } catch (error) {
                    console.error(`Error fetching $iPXLPP token details for ${tokenId}: ${error.message}`);
                    return { tokenId, name: `Token ${tokenId} (Error)`, imageUrl: `https://via.placeholder.com/150?text=Error+${tokenId}`, traits: [], error: true };
                }
            });

            const inscribedTokenDetails = (await Promise.allSettled(inscribedTokenDetailsPromises))
                .filter(r => r.status === 'fulfilled').map(r => r.value);
            setOwnedInscribedTokens(inscribedTokenDetails);

            if (inscribedTokenDetails.length === 0) {
                setMessage('No $iPXLPP tokens found after processing.');
            } else {
                const errCount = inscribedTokenDetails.filter(t => t.error || t.metadataError).length;
                if (errCount > 0) setMessage(`Displayed ${inscribedTokenDetails.length} $iPXLPP tokens. Errors for ${errCount}.`);
                else setMessage('');
            }

        } catch (error) {
            setMessage(`Error fetching $iPXLPP tokens: ${error.message}. See console.`);
            console.error('Fetch $iPXLPP tokens error:', error);
        } finally {
            setLoading(false);
        }
    };
};
