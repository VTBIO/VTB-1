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
    const angleSupply = toWei('117000000', 'ether')
    const icoStartDate = new Date(1522029600/* seconds */ * 1000) // Mar 26th 2018, 10:00, GMT+8
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
    
        describe('Sale test', () => {
            describe('when closed', () => {
                it('can NOT be opened by other than the DEPLOYER', async () => {
                    await expectThrow(async () =>
                        send(vtbCrowdfund, SOME_RANDOM_GUY, 'openCrowdfund'))
                })

                it('supply is zero', async () => {
                    expect(await balance(vtb, vtbCrowdfund.options.address)).eq(toWei('0'))
                })
            })

            describe('when opened', () => {
                beforeEach(async () => {
                    await send(vtbCrowdfund, DEPLOYER, 'openCrowdfund')
                })
    
                it(`supply is ${fromWei(angleSupply, 'ether')} VTB`, async () => {
                    expect(await balance(vtb, vtbCrowdfund.options.address)).eq(angleSupply)
                })
            })
        })
    })

    describe('Workflow Test', () => {
        it('workflow', async () => {
            // open sale
            await send(vtbCrowdfund, DEPLOYER, 'openCrowdfund')

            // 1 ETH = 2100 VTB
            await buy(web3, INVESTOR1, vtbCrowdfund, '0.5')
            await buy(web3, INVESTOR1, vtbCrowdfund, '0.5')
            // 2100
            expect(await balance(vtb, INVESTOR1)).eq(toWei('2100'))
            expect(await balance(web3, WALLET)).eq(toWei('101'))
            await buy(web3, INVESTOR1, vtbCrowdfund, '1')
            // 2100 + 2100 = 4200
            expect(await balance(vtb, INVESTOR1)).eq(toWei('4200'))
            expect(await balance(web3, WALLET)).eq(toWei('102'))

            // buy 2
            await buy(web3, INVESTOR2, vtbCrowdfund, '2')
            // 2100 * 2 = 4200
            expect(await balance(vtb, INVESTOR2)).eq(toWei('4200'))
            expect(await balance(web3, WALLET)).eq(toWei('104'))

            // buy 3
            await buy(web3, INVESTOR3, vtbCrowdfund, '1')
            expect(await balance(vtb, INVESTOR3)).eq(toWei('2100'))
            expect(await balance(web3, WALLET)).eq(toWei('105'))

            // check balance of the foundation
            expect(await balance(vtb, FOUNDATION)).eq(toWei('91000000'))

            // transfer test
            await send(vtb, INVESTOR2, 'transfer', INVESTOR1, toWei('300'))
            expect(await balance(vtb, INVESTOR1)).eq(toWei('4500'))
            expect(await balance(vtb, INVESTOR2)).eq(toWei('3900'))

            //transferFrom will fail as we didn't do any approve
            await expectThrow(async () =>
                send(vtb, INVESTOR3, 'transferFrom', INVESTOR2, INVESTOR1, toWei('300')))
            expect(await balance(vtb, INVESTOR1)).eq(toWei('4500'))
            expect(await balance(vtb, INVESTOR2)).eq(toWei('3900'))

            // approve
            // investor 2 deposit to investor 1 300 VTB
            await send(vtb, INVESTOR2, 'approve', INVESTOR1, toWei('300'))
            expect(await call(vtb, 'allowance', INVESTOR2, INVESTOR1)).eq(toWei('300'))

            // now transferFrom will success
            // investor 1 send the token to investor 3
            await send(vtb, INVESTOR1, 'transferFrom', INVESTOR2, INVESTOR3, toWei('300'))
            expect(await balance(vtb, INVESTOR1)).eq(toWei('4500'))
            expect(await balance(vtb, INVESTOR2)).eq(toWei('3600'))
            expect(await balance(vtb, INVESTOR3)).eq(toWei('2400'))

            // release VTB Team token
            await web3.evm.increaseTime(86400 * 366)         // andvance 366 days
            await send(vtb, DEPLOYER, 'releaseVTBTeamTokens')
            expect(await balance(vtb, TEAM)).eq(toWei('52000000'))
        })
    })
})
