// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Names {
    using SafeMath for uint256;

    uint256 public constant MIN_NAME_LENGTH = 3;
    uint256 public constant MAX_NAME_LENGTH = 80;

    uint256 public pricePerChar;
    mapping(bytes32 => bytes32) private secrets;
    mapping(bytes32 => bool) private registered;
    mapping(bytes32 => address) private nameOwner;
    mapping(bytes32 => uint256) private expirity;
    mapping(bytes32 => uint256) private lockedBalance;

    event WithdrawnFunds(address indexed user, uint256 amount, bool ejected);
    event NameReserved(bytes32 indexed _name, address indexed user, uint256 blockAmount);

    /// @notice  does something
    /// @param _pricePerChar uint256 price per name character per block
    constructor(uint256 _pricePerChar) {
        require(_pricePerChar > 0, "invalid price per char");
        pricePerChar = _pricePerChar;
    }

    function _getNameKey(string memory _name) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_name));
    }

    /// @notice gets the registered address for a name
    /// @param _name string name value
    /// @return owner address
    function resolve(string memory _name) public view returns (address owner) {
        bytes32 _nameKey = _getNameKey(_name);
        if (isRegistered(_name)) {
            return nameOwner[_nameKey];
        }
    }

    /// @notice returns the expliration date of a given name
    /// @param _name string value of the name
    /// @return _expirationBlock uint256
    function getExpiration(string memory _name) public view returns (uint256 _expirationBlock) {
        return expirity[_getNameKey(_name)];
    }

    /// @notice returns the locked balance for a given name
    /// @param _name string value of the name
    /// @return _lockedBalance uint256
    function getLockedBalance(string memory _name) public view returns (uint256 _lockedBalance) {
        return lockedBalance[_getNameKey(_name)];
    }

    /// @notice checks if a domain currently registered
    /// @param _name string name to check
    /// @return result
    function isRegistered(string memory _name) public view returns (bool result) {
        bytes32 _nameKey = _getNameKey(_name);
        return expirity[_nameKey] > block.number && registered[_nameKey];
    }

    /// @notice transfers the locked funds to its owner
    /// @dev internal function
    /// @param _nameKey bytes32 name to check
    /// @return _wallet address amount being ejected
    /// @return _balance uint256 amount being ejected
    function _ejectLockedAmount(bytes32 _nameKey)
        internal
        returns (address payable _wallet, uint256 _balance)
    {
        _balance = lockedBalance[_nameKey];
        require(_balance > 0, "Insufficient withdraw balance");

        lockedBalance[_nameKey] = 0;

        _wallet = payable(nameOwner[_nameKey]);
        _wallet.transfer(_balance);
    }

    /// @notice allows owner to withdraw balances once unlocked
    /// @dev emits event WithdrawnFunds
    /// @param _name string name value
    function withdraw(string memory _name) external {
        bytes32 _nameKey = _getNameKey(_name);
        require(msg.sender == nameOwner[_nameKey], "Not the name owner");
        require(expirity[_nameKey] < block.number, "Balance is locked");

        (address _recipient, uint256 _balance) = _ejectLockedAmount(_nameKey);

        registered[_nameKey] = false;
        nameOwner[_nameKey] = address(0);
        expirity[_nameKey] = 0;

        emit WithdrawnFunds(_recipient, _balance, false);
    }

    /// @notice calculates the price for a given name to regitry
    /// @param _name name to calculate the price for
    /// @param _blockCount uint256 amouint of blocks to register
    /// @return price uint256
    function getRegistryPrice(string memory _name, uint256 _blockCount)
        public
        view
        returns (uint256 price)
    {
        uint256 nameLength = bytes(_name).length;
        return nameLength.mul(_blockCount).mul(pricePerChar);
    }

    /// @notice calculte if there is an excess for a registration payment
    /// @dev  internal function
    /// @param _price uint256 price for the registration
    /// @param _lockedBalance uint256 amount to consider to be already locked
    /// @param _value uint256 value payed on the transaction
    /// @param _payee address receiving the excess payment
    function _settlePayment(
        uint256 _price,
        uint256 _lockedBalance,
        uint256 _value,
        address _payee
    ) internal {
        uint256 _balance = _lockedBalance.add(_value);
        require(_balance >= _price, "Payment is insufficient");

        // sends payment excess
        if (_balance > _price) {
            address payable wallet = payable(_payee);
            wallet.transfer(_balance.sub(_price));
        }
    }

    /// @notice renews a registered name
    /// @dev must send required payment in ether
    /// @dev emits NameReserved
    /// @param _name string value of the name
    /// @param _blockCount uint256 amount of blocks to be registred for
    function renew(string memory _name, uint256 _blockCount) external payable {
        bytes32 _nameKey = _getNameKey(_name);
        require(msg.sender == nameOwner[_nameKey], "Not the name owner");

        uint256 _price = getRegistryPrice(_name, _blockCount);
        uint256 _lockedBalance = lockedBalance[_nameKey];

        _settlePayment(_price, _lockedBalance, msg.value, msg.sender);

        expirity[_nameKey] = (block.number).add(_blockCount);

        emit NameReserved(_nameKey, msg.sender, _blockCount);
    }

    /// @notice registers a salted secret to hide the name of the name to register
    /// @param _saltedSecret string vale of the secret format :
    ///          keccak256(abi.encode(bytes32 name, address owner, uint256 value)
    function registerSecret(bytes32 _saltedSecret) external {
        bytes32 _secretHash = keccak256(abi.encodePacked(_saltedSecret));
        secrets[_secretHash] = _saltedSecret;
    }

    /// @notice helper function to build a secret
    /// @dev would probably not be includeda in a contract, consider it
    /// @dev a time constraint savings
    /// @return _hash
    function secretEcondingHelper(
        string memory _name,
        address _owner,
        uint256 _value,
        uint256 _blockCount
    ) public pure returns (bytes32 _hash) {
        _hash = keccak256(abi.encodePacked(_name, _owner, _value, _blockCount));
    }

    /// @notice validates that a secret matches the hashed data
    /// @param _secret bytes32 hashed value
    /// @param _name string value of the name
    /// @param _owner address of the name owner
    /// @param _value uint256 value for the amount submited for payment
    /// @param _blockCount uint256 amount of blocks to registry the name for
    /// @return _isValid bool
    function validateSecret(
        bytes32 _secret,
        string memory _name,
        address _owner,
        uint256 _value,
        uint256 _blockCount
    ) public pure returns (bool _isValid) {
        bytes32 _hash = keccak256(abi.encodePacked(_name, _owner, _value, _blockCount));
        return _hash == _secret;
    }

    /// @notice registers a name to the message sender
    /// @dev must send required payment in ether
    /// @dev emits NameReserved
    /// @param _name string name value
    /// @param _blockCount uint256 amount of blocks to register for
    function register(
        bytes32 _secret,
        string memory _name,
        uint256 _blockCount
    ) public payable {
        uint256 _price = getRegistryPrice(_name, _blockCount);

        require(
            bytes(_name).length <= MAX_NAME_LENGTH && bytes(_name).length >= MIN_NAME_LENGTH,
            "Incorrect name length"
        );

        require(msg.value >= _price, "Payment is insufficient");
        bytes32 _nameKey = _getNameKey(_name);
        require(expirity[_nameKey] < block.number, "Can not register twice");
        require(secrets[keccak256(abi.encodePacked(_secret))] == _secret, "Secret not found");
        require(
            validateSecret(_secret, _name, msg.sender, msg.value, _blockCount),
            "Secret is invalid"
        );

        if (lockedBalance[_nameKey] > 0) {
            (address _recipient, uint256 _balance) = _ejectLockedAmount(_nameKey);
            emit WithdrawnFunds(_recipient, _balance, true);
        }

        registered[_nameKey] = true;
        nameOwner[_nameKey] = msg.sender;
        expirity[_nameKey] = (block.number).add(_blockCount);
        lockedBalance[_nameKey] = _price;

        _settlePayment(_price, 0, msg.value, msg.sender);

        emit NameReserved(_nameKey, msg.sender, _blockCount);
    }
}
