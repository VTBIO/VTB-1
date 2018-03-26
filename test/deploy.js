const {send} = require('./helpers')

const base = async (web3, solcOutput, accounts) => {
    const [
        DEPLOYER,
        WALLET,
        TEAM
    ] = accounts

    // Merge all contracts across all files into one registry
    const contractRegistry = Object.assign(...Object.values(solcOutput.contracts))

    // Preserve contract names in compilation output
    Object.keys(contractRegistry)
        .forEach((name) => contractRegistry[name].NAME = name)

    const {
        VTBToken,
        VTBCrowdfund
    } = contractRegistry

    const deploy = async (Contract, ...arguments) => {
        const contractDefaultOptions = {
            from: DEPLOYER,
            gas: 4000000,
            name: Contract.NAME
        }
        return new web3.eth.Contract(Contract.abi, contractDefaultOptions)
            .deploy({data: Contract.evm.bytecode.object, arguments})
            .send()
            // FIXME https://github.com/ethereum/web3.js/issues/1253 workaround
            .then(contract => {
                contract.setProvider(web3.currentProvider)
                return contract
            })
    }

    const vtb = await deploy(VTBToken)
    const vtbCrowdfund = await deploy(VTBCrowdfund, vtb.options.address)

    await send(vtb, DEPLOYER, 'setCrowdfundAddress', vtbCrowdfund.options.address)
    await send(vtb, DEPLOYER, 'changeVTBTeamAddress', TEAM)
    await send(vtbCrowdfund, DEPLOYER, 'changeWalletAddress', WALLET)

    return {vtb, vtbCrowdfund}
}

module.exports = {
    base
}
