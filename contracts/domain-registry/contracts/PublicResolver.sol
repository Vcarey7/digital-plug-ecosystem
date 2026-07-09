// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DomainRegistry.sol";

/**
 * @title PublicResolver
 * @dev A resolver contract that stores various types of records for domains
 * Supports content hashes (IPFS), addresses, and text records
 */
contract PublicResolver {
    DomainRegistry public immutable registry;
    
    // Record types
    mapping(bytes32 => string) public contentHashes;     // Domain hash => IPFS CID
    mapping(bytes32 => address) public addresses;        // Domain hash => ETH address
    mapping(bytes32 => mapping(uint256 => address)) public coinAddresses; // Domain hash => coin type => address
    mapping(bytes32 => mapping(string => string)) public textRecords; // Domain hash => key => value
    
    // Supported coin types (following SLIP-44)
    uint256 public constant COIN_TYPE_ETH = 60;
    uint256 public constant COIN_TYPE_BTC = 0;
    uint256 public constant COIN_TYPE_LTC = 2;
    uint256 public constant COIN_TYPE_DOGE = 3;
    uint256 public constant COIN_TYPE_SOL = 501;
    
    // Events
    event ContentHashChanged(bytes32 indexed domainHash, string indexed newContentHash);
    event AddressChanged(bytes32 indexed domainHash, address indexed newAddress);
    event CoinAddressChanged(bytes32 indexed domainHash, uint256 indexed coinType, address indexed newAddress);
    event TextChanged(bytes32 indexed domainHash, string indexed key, string indexed value);
    
    constructor(address _registry) {
        registry = DomainRegistry(_registry);
    }
    
    modifier onlyDomainOwner(bytes32 _domainHash) {
        (, , address owner, , uint256 expiry, , , ) = registry.domains(_domainHash);
        require(owner == msg.sender, "Only domain owner can update records");
        require(block.timestamp < expiry, "Domain has expired");
        _;
    }
    
    modifier domainExists(bytes32 _domainHash) {
        require(registry.domainExists(_domainHash), "Domain does not exist");
        _;
    }
    
    /**
     * @dev Set IPFS content hash for a domain
     * @param _domainHash The domain hash
     * @param _contentHash The IPFS CID
     */
    function setContentHash(bytes32 _domainHash, string memory _contentHash) 
        external 
        domainExists(_domainHash) 
        onlyDomainOwner(_domainHash) 
    {
        contentHashes[_domainHash] = _contentHash;
        emit ContentHashChanged(_domainHash, _contentHash);
    }
    
    /**
     * @dev Set Ethereum address for a domain
     * @param _domainHash The domain hash
     * @param _address The Ethereum address
     */
    function setAddress(bytes32 _domainHash, address _address) 
        external 
        domainExists(_domainHash) 
        onlyDomainOwner(_domainHash) 
    {
        addresses[_domainHash] = _address;
        coinAddresses[_domainHash][COIN_TYPE_ETH] = _address;
        emit AddressChanged(_domainHash, _address);
        emit CoinAddressChanged(_domainHash, COIN_TYPE_ETH, _address);
    }
    
    /**
     * @dev Set cryptocurrency address for a specific coin type
     * @param _domainHash The domain hash
     * @param _coinType The coin type (SLIP-44)
     * @param _address The cryptocurrency address
     */
    function setCoinAddress(bytes32 _domainHash, uint256 _coinType, address _address) 
        external 
        domainExists(_domainHash) 
        onlyDomainOwner(_domainHash) 
    {
        coinAddresses[_domainHash][_coinType] = _address;
        
        // If setting ETH address, also update the main address mapping
        if (_coinType == COIN_TYPE_ETH) {
            addresses[_domainHash] = _address;
            emit AddressChanged(_domainHash, _address);
        }
        
        emit CoinAddressChanged(_domainHash, _coinType, _address);
    }
    
    /**
     * @dev Set text record for a domain
     * @param _domainHash The domain hash
     * @param _key The record key (e.g., "email", "avatar", "description")
     * @param _value The record value
     */
    function setText(bytes32 _domainHash, string memory _key, string memory _value) 
        external 
        domainExists(_domainHash) 
        onlyDomainOwner(_domainHash) 
    {
        textRecords[_domainHash][_key] = _value;
        emit TextChanged(_domainHash, _key, _value);
    }
    
    /**
     * @dev Batch set multiple text records
     * @param _domainHash The domain hash
     * @param _keys Array of record keys
     * @param _values Array of record values
     */
    function setTextBatch(
        bytes32 _domainHash, 
        string[] memory _keys, 
        string[] memory _values
    ) 
        external 
        domainExists(_domainHash) 
        onlyDomainOwner(_domainHash) 
    {
        require(_keys.length == _values.length, "Keys and values length mismatch");
        
        for (uint256 i = 0; i < _keys.length; i++) {
            textRecords[_domainHash][_keys[i]] = _values[i];
            emit TextChanged(_domainHash, _keys[i], _values[i]);
        }
    }
    
    /**
     * @dev Get IPFS content hash for a domain
     * @param _domainHash The domain hash
     * @return The IPFS CID
     */
    function contentHash(bytes32 _domainHash) external view returns (string memory) {
        return contentHashes[_domainHash];
    }
    
    /**
     * @dev Get Ethereum address for a domain
     * @param _domainHash The domain hash
     * @return The Ethereum address
     */
    function addr(bytes32 _domainHash) external view returns (address) {
        return addresses[_domainHash];
    }
    
    /**
     * @dev Get cryptocurrency address for a specific coin type
     * @param _domainHash The domain hash
     * @param _coinType The coin type (SLIP-44)
     * @return The cryptocurrency address
     */
    function addr(bytes32 _domainHash, uint256 _coinType) external view returns (address) {
        return coinAddresses[_domainHash][_coinType];
    }
    
    /**
     * @dev Get text record for a domain
     * @param _domainHash The domain hash
     * @param _key The record key
     * @return The record value
     */
    function text(bytes32 _domainHash, string memory _key) external view returns (string memory) {
        return textRecords[_domainHash][_key];
    }
    
    /**
     * @dev Check if resolver supports a specific interface
     * @param _interfaceId The interface identifier
     * @return True if supported
     */
    function supportsInterface(bytes4 _interfaceId) external pure returns (bool) {
        return _interfaceId == 0x01ffc9a7 || // ERC-165
               _interfaceId == 0x3b3b57de || // addr(bytes32)
               _interfaceId == 0xf1cb7e06 || // addr(bytes32,uint256)
               _interfaceId == 0x59d1d43c || // text(bytes32,string)
               _interfaceId == 0xbc1c58d1;   // contenthash(bytes32)
    }
    
    /**
     * @dev Get all records for a domain (convenience function)
     * @param _domainHash The domain hash
     * @return contentHashValue The IPFS content hash
     * @return ethAddress The Ethereum address
     * @return email The email text record
     * @return avatar The avatar text record
     * @return description The description text record
     */
    function getAllRecords(bytes32 _domainHash) 
        external 
        view 
        returns (
            string memory contentHashValue,
            address ethAddress,
            string memory email,
            string memory avatar,
            string memory description
        ) 
    {
        contentHashValue = contentHashes[_domainHash];
        ethAddress = addresses[_domainHash];
        email = textRecords[_domainHash]["email"];
        avatar = textRecords[_domainHash]["avatar"];
        description = textRecords[_domainHash]["description"];
    }
    
    /**
     * @dev Clear all records for a domain (only domain owner)
     * @param _domainHash The domain hash
     */
    function clearRecords(bytes32 _domainHash) 
        external 
        domainExists(_domainHash) 
        onlyDomainOwner(_domainHash) 
    {
        delete contentHashes[_domainHash];
        delete addresses[_domainHash];
        delete coinAddresses[_domainHash][COIN_TYPE_ETH];
        delete coinAddresses[_domainHash][COIN_TYPE_BTC];
        delete coinAddresses[_domainHash][COIN_TYPE_LTC];
        delete coinAddresses[_domainHash][COIN_TYPE_DOGE];
        delete coinAddresses[_domainHash][COIN_TYPE_SOL];
        
        // Clear common text records
        delete textRecords[_domainHash]["email"];
        delete textRecords[_domainHash]["avatar"];
        delete textRecords[_domainHash]["description"];
        delete textRecords[_domainHash]["url"];
        delete textRecords[_domainHash]["twitter"];
        delete textRecords[_domainHash]["github"];
        
        emit ContentHashChanged(_domainHash, "");
        emit AddressChanged(_domainHash, address(0));
        emit TextChanged(_domainHash, "email", "");
        emit TextChanged(_domainHash, "avatar", "");
        emit TextChanged(_domainHash, "description", "");
    }
}

