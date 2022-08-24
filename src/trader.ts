import {
	allBalance,
	batchCancelOrder,
	batchLimitOrder,
	getActiveOrders,
	spread,
} from './helper/order'
import {
	clearAndLog,
	customPrecision,
	getRandomFloat,
	getRandomInt,
	nextTime,
	sleep,
	starxPrecision,
	timeAge,
} from './helper/common'
import { Transaction } from './object/order'
import { Timer } from './helper/timer'
import { Websocket } from './helper/websocket'

export class Trader {

	private balanceUsdt: number = 0
	private orderedAmount: number = 999999
	private nextVolume: number = 0
	private nextFiller: number = 0
	private isRunningClosingOpening: boolean = false

	constructor(
		private ws: Websocket,
		private timer: Timer,
	) {
	}

	// -- Filler ---------------------------------------------------------------------------------------------------------

	async filler() {

		if (!!this.nextFiller && timeAge(this.nextFiller) <= 0) {
			return
		}

		this.nextFiller = nextTime(10)
		await this.getBalance()
		if (this.balanceUsdt <= 0) {
			return
		}

		if (this.timer.timeLeft < 6) {
			return
		}

		const orders = await getActiveOrders()
		if (!!orders) {
			await this.fillBid(orders)
			await this.fillAsk(orders)
		}
	}

	async getBalance() {
		const rs = await allBalance()
		for (let d of rs.data) {
			if (d.typeName === 'AVAILABLE' && d.currency === 'USDT') {
				this.balanceUsdt = Number(d.balance)
				clearAndLog('BAL: ' + this.balanceUsdt.toFixed(18))
			}

			if (d.typeName === 'FROZEN' && d.currency === 'USDT') {
				this.orderedAmount = Number(d.balance)
				clearAndLog('ORDERED: ' + this.orderedAmount.toFixed(18))
			}
		}
	}

	async fillBid(orders: Array<Transaction>) {
		const ceiling = Number(process.env.BID_SPREAD_CEILING)
		const floor = Number(process.env.BID_SPREAD_FLOOR)

		let taken = 0
		if (!!orders) {
			for (let o of orders) {
				if (o.side === 'BUY' && o.ordPrice >= floor && o.ordPrice <= ceiling) {
					taken += o.ordPrice * Number(o.ordQty)
				}
			}
		}

		const minQty = Number(process.env.BID_SPREAD_AMOUNT_MINIMUM_TOKEN)
		const maxQty = Number(process.env.BID_SPREAD_AMOUNT_MAXIMUM_TOKEN)
		const amount = Number(process.env.BID_SPREAD_AMOUNT_TOTAL_SPEND) - taken
		if (amount >= minQty * floor) {
			clearAndLog('AMOUNT: ' + amount.toFixed(20) + ' ' + (minQty * floor).toFixed(20))
			await spread(orders, 'BUY', minQty, maxQty, amount, ceiling, floor)
		}
	}

	async fillAsk(orders: Array<Transaction>) {
		const ceiling = Number(process.env.ASK_SPREAD_CEILING)
		const floor = Number(process.env.ASK_SPREAD_FLOOR)

		let taken = 0
		if (!!orders) {
			for (let o of orders) {
				if (o.side === 'SELL' && o.ordPrice >= floor && o.ordPrice <= ceiling) {
					taken += o.ordPrice * Number(o.ordQty)
				}
			}
		}

		const minQty = Number(process.env.ASK_SPREAD_AMOUNT_MINIMUM_TOKEN)
		const maxQty = Number(process.env.ASK_SPREAD_AMOUNT_MAXIMUM_TOKEN)
		const amount = Number(process.env.ASK_SPREAD_AMOUNT_TOTAL_SPEND) - taken
		if (amount >= minQty * floor) {
			clearAndLog('AMOUNT: ' + amount.toFixed(20) + ' ' + (minQty * floor).toFixed(20))
			await spread(orders, 'SELL', minQty, maxQty, amount, ceiling, floor)
		}
	}

	// -- Volume ---------------------------------------------------------------------------------------------------------

	async volume() {

		const isNotReady = !this.ws.allowedTop || !this.ws.allowedBottom || !this.ws.allowedMinuteTop || !this.ws.allowedMinuteBottom
		const isNotRightTime = (!!this.nextVolume && timeAge(this.nextVolume) <= 0)
		const isTimeUp = this.timer.timeLeft < 6 || this.timer.timeLeft > 56 || timeAge(this.ws.nextUpdateStartEnd) > 0
		if (isNotReady || isNotRightTime || isTimeUp) {
			return
		}

		const oldNextVolume = this.nextVolume
		const fastest = Number(process.env.TRADE_VOLUME_TIMER_FASTEST)
		const slowest = Number(process.env.TRADE_VOLUME_TIMER_SLOWEST)
		const timer = getRandomInt(fastest, slowest)
		this.nextVolume = nextTime(timer)
		clearAndLog('Volume triggerred in ' + Math.abs(timeAge(this.nextVolume)))

		if (!oldNextVolume) {
			return
		}

		const minSpend = Number(process.env.TRADE_VOLUME_AMOUNT_MIN_SPEND)
		const maxSpend = Number(process.env.TRADE_VOLUME_AMOUNT_MAX_SPEND)
		const spend = getRandomFloat(minSpend, maxSpend)

		const bottom = this.ws.allowedMinuteBottom
		const top = this.ws.allowedMinuteTop

		if (bottom <= top) {
			const tokenName = process.env.TOKEN + 'USDT'
			const at = starxPrecision(getRandomFloat(bottom, top))
			let qty = Math.round(spend / at * 100) / 100
			const minQty = Number(process.env.TRADE_VOLUME_AMOUNT_MIN_TOKEN)
			if (qty < minQty) {
				qty = minQty
			}

			const orderTmp = [{ price: at, qty: qty, side: 'SELL' }, { price: at, qty: qty, side: 'BUY' }]
			const rand0 = getRandomInt(0, 1)
			const rand1 = rand0 === 0 ? 1 : 0
			const order = []
			order.push(orderTmp[ rand0 ])
			order.push(orderTmp[ rand1 ])


			await batchLimitOrder(tokenName, order)
		}
	}

	// -- Drawer ---------------------------------------------------------------------------------------------------------

	async drawClosingOpening() {

		if (this.timer.timeLeft > 3 || this.isRunningClosingOpening) {
			return
		}

		this.isRunningClosingOpening = true
		const timeout = nextTime(5)

		let at = 0
		if (this.timer.timeLeftHour < 30) {
			at = this.ws.end
		} else {
			const open = Number(this.ws.kline.open)
			let high = Number(this.ws.kline.high)
			let low = Number(this.ws.kline.close)
			if (high === low) {
				high = this.ws.allowedMinuteTop
				low = this.ws.allowedMinuteBottom
			}

			let used = ''
			const highGap = Math.abs(open - high)
			const lowGap = Math.abs(open - low)
			if (highGap > lowGap) {
				at = starxPrecision(this.ws.allowedMinuteTop)
			} else {
				at = starxPrecision(this.ws.allowedMinuteBottom)
			}
		}

		const qty = 5
		const totalAmount = qty * at

		const tokenName = process.env.TOKEN + 'USDT'
		clearAndLog('Executed at price ' + at + ' quantity ' + qty + '(' + totalAmount + ' USDT)')

		let i = 0
		let totalExecuted = 0
		const orderIds = []
		while (timeAge(timeout) < 0 && totalAmount > totalExecuted) {
			if (at > this.ws.depth.nearestAskPrice || at < this.ws.depth.nearestBidPrice) {
				clearAndLog('Spread changed, volume breaking!')
				break
			}

			const trxQty = getRandomFloat(0.01, 0.09)
			let toTrx = customPrecision(trxQty / at, 2)
			const orderTmp = [{ price: at, qty: toTrx, side: 'SELL' }, { price: at, qty: toTrx, side: 'BUY' }]
			const rand0 = getRandomInt(0, 1)
			const rand1 = rand0 === 0 ? 1 : 0
			const order = []
			order.push(orderTmp[ rand0 ])
			order.push(orderTmp[ rand1 ])

			const rs: any = await batchLimitOrder(tokenName, order)
			for(let r of rs) {
				orderIds.push(r.ordId)
			}

			await sleep(350)
			clearAndLog('Draw closing candle at ' + at + ' with amount ' + toTrx + ' USDT')
			i++
		}

		await batchCancelOrder(tokenName, orderIds)

		await sleep(10000)
		this.isRunningClosingOpening = false

	}

	// async drawClosingOpening() {
	// 	if (this.timer.timeLeft > 3) {
	// 		await sleep(1000)
	// 		this.drawClosingOpening().then()
	// 		return
	// 	}
	//
	// 	this.timer.isClosing = true
	//
	// 	// Calculate price precision.
	// 	let bottomExp = precision(this.ws.allowedBottom)
	// 	let topExp = precision(this.ws.allowedTop)
	// 	const e = bottomExp > topExp ? bottomExp : topExp
	//
	// 	// Define the edge of the price
	// 	const priceBottom = Math.round(this.ws.allowedBottom * Math.pow(10, e))
	// 	const priceTop = Math.round(this.ws.allowedTop * Math.pow(10, e))
	// 	let at = getRandomInt(priceBottom, priceTop) / Math.pow(10, e)
	//
	//
	// 	if(this.timer.timeLeftHour < 30) {
	// 		at = this.ws.end
	// 	}
	//
	// 	if (priceBottom !== priceTop && priceBottom < priceTop) {
	// 		const qty = 1
	// 		const tokenName = process.env.TOKEN + 'USDT'
	// 		const limit = await limitOrder({ price: starxPrecision(at), qty: qty, side: 'SELL', symbol: tokenName })
	// 		const executedTime = this.timer.time
	//
	// 		const toBuy = Math.round((at * 0.1) * 100) / 100
	// 		let totalAmount = 0
	// 		clearAndLog('Execute at price ' + at + ' with amount ' + toBuy)
	// 		while (timeAge(executedTime) <= 4 && totalAmount < toBuy * 6) {
	// 			totalAmount += toBuy
	// 			const r = await marketOrder({
	// 				amount: toBuy,
	// 				symbol: tokenName,
	// 				side: 'BUY'
	// 			})
	//
	// 			await sleep(350)
	// 			clearAndLog('Buy Back ' + toBuy + ' USDT')
	// 		}
	//
	// 		await batchCancelOrder(tokenName, [limit[ 'ordId' ]])
	// 	}
	//
	// 	await sleep(10000)
	// 	this.drawClosingOpening().then()
	// }

}
