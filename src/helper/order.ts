import axios from 'axios'
import { url } from './environments'
import { Transaction } from '../object/order'
import { clearAndLog, getRandomInt, precision } from './common'
import { isArray } from 'util'

export function generateOrder(amountUsdt: any, minToken: number, maxToken: number, floor: number, ceiling: number): Array<{ amount: number, at: number }> {

	// Calculate price precision.
	const bottomExp = precision(floor)
	const topExp = precision(ceiling)
	const e = bottomExp > topExp ? bottomExp : topExp

	// Define the edge of the price
	const priceBottom = parseInt(floor * Math.pow(10, e) + '')
	const priceTop = parseInt(ceiling * Math.pow(10, e) + '')

	// Calculate amount precision.
	const bottomExpAmount = precision(minToken)
	const topExpAmount = precision(maxToken)
	const eAmount = bottomExpAmount > topExpAmount ? bottomExpAmount : topExpAmount

	// Define the edge of the amount
	let amountBottom = parseInt(minToken * Math.pow(10, eAmount) + '')
	const amountTop = parseInt(maxToken * Math.pow(10, eAmount) + '')

	// There is nothing to generate if minimum amount is bigger than maximum amount
	if (amountBottom > amountTop || priceBottom > priceTop) {
		return []
	}

	// Initiate remaining usdt
	let usdtRemain = amountUsdt

	// Start generation.
	const orders = []
	while (true) {

		// Generate random.
		const gAt = getRandomInt(priceBottom, priceTop) / Math.pow(10, e)
		const gAmount = getRandomInt(amountBottom, amountTop) / Math.pow(10, eAmount)
		const usdtNeeded = gAmount * gAt
		clearAndLog('REMAINING: ' + usdtRemain.toFixed(20) + ' ' + usdtNeeded.toFixed(20))

		// Use all of the remaining amount if it can't cover the generated amount.
		// Bottom used to get bigger amount
		if (usdtRemain < usdtNeeded) {
			const lastAt = priceBottom / Math.pow(10, e)
			orders.push({
				amount: (usdtRemain) / lastAt,
				at: lastAt,
			})
			break
		}

		// Execute if there are still a lot of amount remains.
		usdtRemain -= usdtNeeded
		orders.push({
			amount: gAmount,
			at: gAt,
		})

		clearAndLog('FINAL GENERATED: ' + usdtRemain + ' ' + gAmount + ' ' + gAt)
	}

	console.log(orders)
	return orders
}

export async function allBalance() {
	try {
		const rs = await axios.get(url(), {params: {method: 'POST', path: '/spot/accountList', data: JSON.stringify({})}})
		return rs.data
	} catch (e) {
		console.error(e)
		return false
	}
}

export async function getActiveOrders(): Promise<Array<Transaction>> {
	try {
		const rs = await axios.get(url(), {params: {method: 'GET', path: '/trade/order/active', data: JSON.stringify({})}})
		clearAndLog('Active Orders: ' + rs.data.data.length)
		const data: Array<Transaction> = rs.data.data
		return data
	} catch (e) {
		console.error(e)
		return []
	}
}

export async function cancelAllOrders() {
	try {
		const rs = await axios.get(url(), {
			params: {
				method: 'POST',
				path: '/trade/order/cancelAll',
				data: JSON.stringify({}),
			},
		})
		return rs.data
	} catch (e) {
		console.error(e)
		return false
	}
}

export async function batchCancelOrder(symbol: string, orders: Array<number>) {
	try {
		const data: any = {
			symbol: symbol,
			orderIds: orders,
		}

		const rs = await axios.get(url(), {
			params: {
				method: 'POST',
				path: '/trade/order/cancelBatch',
				data: JSON.stringify(data),
			},
		})
		return rs.data
	} catch (e) {
		console.error(e)
		return false
	}
}

export async function batchLimitOrder(symbol: string, orders: Array<{ price: any, qty: any, side: 'BUY' | 'SELL' | string }>) {
	const rs: Array<any> = []
	try {
		const data: any = {
			symbol: symbol,
			orders: [],
		}

		let i = 0
		let usdt = 0
		for (let o of orders) {
			usdt += o.price * o.qty
			data.orders.push({
				side: o.side,
				ordType: 'LIMIT',
				ordPrice: o.price,
				ordQty: o.qty,
			})

			i++
			if (i >= 50) {
				clearAndLog('USDT REMAINING: ' + usdt.toFixed(20))
				const result = await batchOrder(data)
				Array.prototype.push.apply(rs, result)
				data.orders = []
				i = 0
			}
		}

		clearAndLog('USDT REMAINING: ' + usdt.toFixed(20))
		const result = await batchOrder(data)
		Array.prototype.push.apply(rs, result)
		clearAndLog('RESULT LIMIT BATCH: ' + rs.length)
		return rs
	} catch (e) {
		console.error(e)
		return false
	}
}

async function batchOrder(data: any) {
	try {
		const rs: any = await axios.get(url(), {
			params: {
				method: 'POST',
				path: '/trade/order/placeBatch',
				data: JSON.stringify(data),
			},
		})

		if (!!rs.data && !!rs.data.data && isArray(rs.data.data)) {
			return rs.data.data
		} else {
			console.error(rs.data)
			return []
		}
	} catch (e) {
		console.error(e)
		return []
	}
}

async function createOrderBatch(data: any) {
	try {
		const rs: any = await axios.get(url(), {
			params: {
				method: 'POST',
				path: '/trade/order/place',
				data,
			},
		})

		if (!!rs.data && !!rs.data.data && isArray(rs.data.data)) {
			return rs.data.data
		} else {
			console.error(rs.data)
			return []
		}
	} catch (e) {
		console.error(e)
		return []
	}
}

async function createOrder(data: any) {
	try {
		const rs: any = await axios.get(url(), {
			params: {
				method: 'POST',
				path: '/trade/order/place',
				data,
			},
		})

		if (!!rs.data && !!rs.data.data) {
			return rs.data.data
		} else {
			console.error(rs.data)
			return {}
		}
	} catch (e) {
		console.error(e)
		return {}
	}
}

export async function marketOrder(o: { amount: any, side: 'BUY' | 'SELL' | string, symbol: string }) {
	return createOrder({
		ordType: 'MARKET',
		ordAmt: o.amount,
		side: o.side,
		symbol: o.symbol
	})
}

export async function limitOrder(o: { price: number, qty: any, side: 'BUY' | 'SELL' | string, symbol: string }) {
	return createOrder({
		ordType: 'LIMIT',
		ordQty: o.qty,
		ordPrice: o.price,
		side: o.side,
		symbol: o.symbol
	})
}

export async function spread(orders: Array<Transaction>, type: 'BUY' | 'SELL', minTokenAmount: number, maxTokenAmount: number, amount: number, ceiling: number, floor: number) {
	clearAndLog('SPREAD:' + type + ' MIN:' + minTokenAmount + ' MAX:' + maxTokenAmount + ' AMOUNT:' + amount + ' CEILING:' + ceiling + ' FLOOR:' + floor)
	const generated = generateOrder(amount, minTokenAmount, maxTokenAmount, floor, ceiling)
	const symbol = process.env.TOKEN + 'USDT'
	const orderData = []

	if (generated.length <= 0) {
		return
	}

	for (let d of generated) {
		orderData.push({
			price: d.at,
			qty: Math.round(d.amount) + '',
			side: type,
		})
	}

	await batchLimitOrder(symbol, orderData)
}
