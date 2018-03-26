const {
    expect,
    expectAsyncThrow,
    expectNoAsyncThrow,
    expectThrow,
    balance,
    toBN,
    fromWei,
    toWei,
    solcJSON,
    ganacheWeb3,
    ZERO_ADDR,
    logAccounts,
    now,
    send,
    call,
    buy
} = require('./helpers')
const solcInput = require('../solc-input.json')
const deploy = require('./deploy')

describe('Contract', function () {
    const earlyBirdsSupply = toWei('48000000', 'ether')
    const icoStartDate = new Date(1515405600/* seconds */ * 1000) // Jan 8th 2018, 18:00, GMT+8
    let web3, snaps
    let accounts, DEPLOYER, WALLET, TEAM, BIZ
    let INVESTOR1, INVESTOR2, INVESTOR3, ANGEL1, ANGEL2
    let FOUNDATION
    let vtb, vtbCrowdfund

    before(async () => {
        // Instantiate clients to an empty in-memory blockchain
        web3 = ganacheWeb3({time: icoStartDate, total_accounts: 20})
        snaps = []

        // Provide synchronous access to test accounts
        ;[
            DEPLOYER,
            WALLET,
            TEAM,
            BIZ,
            INVESTOR1,
            INVESTOR2,
            INVESTOR3,
            ANGEL1,
            ANGEL2,
            SOME_RANDOM_GUY,
            SOME_RANDOM_ADDRESS
        ] = accounts = await web3.eth.getAccounts()

        // Deploy contracts
        ;({vtb, vtbCrowdfund} = await deploy.base(web3, solcJSON(solcInput), accounts))
        FOUNDATION = await call(vtb, 'foundationAddress')
    })

    beforeEach(async () => {
        snaps.push(await web3.evm.snapshot())
    })

    afterEach(async () => {
        await web3.evm.revert(snaps.pop())
    })

    describe('Crowfund', () => {
        it('deployment does NOT cost more than 100 USD for the deployer', async () => {
            // Source: https://coinmarketcap.com/currencies/ethereum/
            USD_PER_ETH = toBN(1068)
            const initial = toWei(toBN(100 /* ether */))
            const current = await balance(web3, DEPLOYER)
            const spent = initial.sub(toBN(current))
            const deploymentCost = (fromWei(spent)) * USD_PER_ETH
            console.log(`        (deployment cost: ${deploymentCost} USD)`)
            expect(deploymentCost).to.be.below(100 /* USD */)
        })

        it('contract is deployed', async () => {
            expect(await call(vtbCrowdfund, 'VTB')).equal(vtb.options.address)
        })

        it('VTB token is deployed', async () => {
            expect(await call(vtb, 'symbol')).equal('VTB')
        })

        it('blockchain time is roughly the ICO start time', async () => {
            icoStart /* seconds */ = icoStartDate.getTime() / 1000
            expect(await now(web3)).within(icoStart, icoStart + 3)
        })

        it('wallet can be changed by DEPLOYER', async () => {
            await expectNoAsyncThrow(async () =>
                await send(vtbCrowdfund, DEPLOYER, 'changeWalletAddress', SOME_RANDOM_ADDRESS))
            expect(await call(vtbCrowdfund, 'wallet')).eq(SOME_RANDOM_ADDRESS)
        })

        it('wallet can NOT be changed by other than the DEPLOYER', async () => {
            const NOT_THE_DEPLOYER = SOME_RANDOM_GUY
            await expectThrow(async () =>
                send(vtbCrowdfund, NOT_THE_DEPLOYER, 'changeWalletAddress', SOME_RANDOM_ADDRESS))
        })
    })
})
