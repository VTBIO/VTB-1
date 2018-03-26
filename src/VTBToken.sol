pragma solidity ^0.4.18;

import "../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol";
import "../node_modules/zeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/zeppelin-solidity/contracts/token/ERC20.sol";

contract VTBToken is ERC20, Ownable {

    using SafeMath for uint;

/*----------------- Token Information -----------------*/

    string public constant name = "Vehicle to Everything Blockchain";
    string public constant symbol = "VTB";

    uint8 public decimals = 18;                            // (ERC20 API) Decimal precision, factor is 1e18

    mapping (address => uint256) accounts;                 // User's accounts table
    mapping (address => mapping (address => uint256)) allowed; // User's allowances table

/*----------------- ICO Information -----------------*/

    uint256 public angelSupply;                            // Angels sale supply
    uint256 public foundationSupply;                       // VTB Foundation/Community supply
    uint256 public teamSupply;                             // VTB team supply

    uint256 public angelAmountRemaining;                   // Amount of private angels tokens remaining at a given time
    uint256 public icoStartsAt;                            // Crowdsale ending timestamp
    uint256 public icoEndsAt;                              // Crowdsale ending timestamp
    uint256 public teamLockingPeriod;                      // Locking period for VTB team's supply

    address public crowdfundAddress;                       // Crowdfunding contract address
    address public teamAddress;                            // VTB team address
    address public foundationAddress;                      // Foundation address

    enum icoStages {
        Ready,                                             // Initial state on contract's creation
        Sale,                                              // Selling state during ICO
        Done                                               // Ending state after ICO
    }
    icoStages stage;                                       // Crowdfunding current state

/*----------------- Events -----------------*/

    event CrowdfundFinalized(uint tokensRemaining);        // Event called when crowdfund is done

/*----------------- Modifiers -----------------*/

    modifier nonZeroAddress(address _to) {                 // Ensures an address is provided
        require(_to != 0x0);
        _;
    }

    modifier nonZeroAmount(uint _amount) {                 // Ensures a non-zero amount
        require(_amount > 0);
        _;
    }

    modifier nonZeroValue() {                              // Ensures a non-zero value is passed
        require(msg.value > 0);
        _;
    }

    modifier onlyDuringCrowdfund(){                       // Ensures actions can only happen after crowdfund ends
        require((now >= icoStartsAt) && (now < icoEndsAt));
        _;
    }

    modifier notBeforeCrowdfundEnds(){                     // Ensures actions can only happen after crowdfund ends
        require(now >= icoEndsAt);
        _;
    }

    modifier checkVTBTeamLockingPeriod() {                 // Ensures locking period is over
        require(now >= teamLockingPeriod);
        _;
    }

    modifier onlyCrowdfund() {                             // Ensures only crowdfund can call the function
        require(msg.sender == crowdfundAddress);
        _;
    }

/*----------------- ERC20 API -----------------*/

    // -------------------------------------------------
    // Transfers amount to address
    // -------------------------------------------------
    function transfer(address _to, uint256 _amount) public returns (bool success) {
        require(accounts[msg.sender] >= _amount);         // check amount of balance can be tranfered
        addToBalance(_to, _amount);
        decrementBalance(msg.sender, _amount);
        Transfer(msg.sender, _to, _amount);
        return true;
    }

    // -------------------------------------------------
    // Transfers from one address to another (need allowance to be called first)
    // -------------------------------------------------
    function transferFrom(address _from, address _to, uint256 _amount) public returns (bool success) {
        require(allowance(_from, msg.sender) >= _amount);
        decrementBalance(_from, _amount);
        addToBalance(_to, _amount);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_amount);
        Transfer(_from, _to, _amount);
        return true;
    }

    // -------------------------------------------------
    // Approves another address a certain amount of VTB
    // -------------------------------------------------
    function approve(address _spender, uint256 _value) public returns (bool success) {
        require((_value == 0) || (allowance(msg.sender, _spender) == 0));
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    // -------------------------------------------------
    // Gets an address's VTB allowance
    // -------------------------------------------------
    function allowance(address _owner, address _spender) public constant returns (uint256 remaining) {
        return allowed[_owner][_spender];
    }

    // -------------------------------------------------
    // Gets the VTB balance of any address
    // -------------------------------------------------
    function balanceOf(address _owner) public constant returns (uint256 balance) {
        return accounts[_owner];
    }


/*----------------- Token API -----------------*/

    // -------------------------------------------------
    // Contract's constructor
    // -------------------------------------------------
    function VTBToken() public {
        totalSupply         = 260000000 * 1e18;            // 100% - 260 million total VTB with 18 decimals

        angelSupply         = 117000000 * 1e18;            // 45% - 117 million VTB for private angels sale
        foundationSupply    =  91000000 * 1e18;            // 35% - 91 million VTB for foundation/incentivising efforts
        teamSupply          =  52000000 * 1e18;            // 20% - 52 million VTB for VTB team

        angelAmountRemaining = angelSupply;                // Decreased over the course of the private angel sale
        teamAddress          = 0x0;                        // VTB Team address
        foundationAddress    = 0x93e3AF42939C163Ee4146F63646Fb4C286CDbFeC;   // Foundation/Community address

        icoStartsAt          = 1522029600;                 // Mar 26th 2018, 10:00, GMT+8
        icoEndsAt            = 1585188000;                 // Mar 26th 2020, 10:00, GMT+8
        teamLockingPeriod = icoEndsAt.add(365 days);       // 12 months locking period

        addToBalance(foundationAddress, foundationSupply);

        stage = icoStages.Ready;                           // Initializes state
    }

    // -------------------------------------------------
    // Opens early birds sale
    // -------------------------------------------------
    function startCrowdfund() external onlyCrowdfund onlyDuringCrowdfund returns(bool) {
        require(stage == icoStages.Ready);
        stage = icoStages.Sale;
        addToBalance(crowdfundAddress, angelSupply);
        return true;
    }

    // -------------------------------------------------
    // Sets the crowdfund address, can only be done once
    // -------------------------------------------------
    function setCrowdfundAddress(address _crowdfundAddress) external onlyOwner nonZeroAddress(_crowdfundAddress) {
        require(crowdfundAddress == 0x0);
        crowdfundAddress = _crowdfundAddress;
    }

    // -------------------------------------------------
    // Function for the Crowdfund to transfer tokens
    // -------------------------------------------------
    function transferFromCrowdfund(address _to, uint256 _amount) external onlyCrowdfund nonZeroAmount(_amount) nonZeroAddress(_to) returns (bool success) {
        require(balanceOf(crowdfundAddress) >= _amount);
        decrementBalance(crowdfundAddress, _amount);
        addToBalance(_to, _amount);
        Transfer(0x0, _to, _amount);
        return true;
    }

    // -------------------------------------------------
    // Releases VTB team supply after locking period is passed
    // -------------------------------------------------
    function releaseVTBTeamTokens() external checkVTBTeamLockingPeriod onlyOwner returns(bool success) {
        require(teamSupply > 0);
        addToBalance(teamAddress, teamSupply);
        Transfer(0x0, teamAddress, teamSupply);
        teamSupply = 0;
        return true;
    }

    // -------------------------------------------------
    // Finalizes crowdfund. If there are leftover VTB, let them overflow to foundation
    // -------------------------------------------------
    function finalizeCrowdfund() external onlyCrowdfund {
        require(stage == icoStages.Sale);
        uint256 amount = balanceOf(crowdfundAddress);
        if (amount > 0) {
            accounts[crowdfundAddress] = 0;
            addToBalance(foundationAddress, amount);
            Transfer(crowdfundAddress, foundationAddress, amount);
        }
        stage = icoStages.Done;
        CrowdfundFinalized(amount);                        // event log
    }

    // -------------------------------------------------
    // Changes VTB Team wallet
    // -------------------------------------------------
    function changeVTBTeamAddress(address _wallet) external onlyOwner {
        teamAddress = _wallet;
    }

    // -------------------------------------------------
    // Adds to balance
    // -------------------------------------------------
    function addToBalance(address _address, uint _amount) internal {
        accounts[_address] = accounts[_address].add(_amount);
    }

    // -------------------------------------------------
    // Removes from balance
    // -------------------------------------------------
    function decrementBalance(address _address, uint _amount) internal {
        accounts[_address] = accounts[_address].sub(_amount);
    }
}
