import { WebSocket } from 'ws'
import { Kline } from '../object/kline'
import { Depth } from '../object/depth'
import { biggerNum, clearAndLog, getRandomInt, nextTime, sleep, smallerNum, starxPrecision, timeAge } from './common'
import { Timer } from './timer'
import { addHour, getLastHour } from './db'

export class Websocket {

	private isClosed: boolean = true
	private timeInit: number = 0
	private url: string = 'wss://ws.coinstore.com/s/ws'
	private wss: any
	public nextUpdateStartEnd: number = 0
	public nextUpdateMinuteTarget: number = 0
	private minuteTargetLowest: number = 0
	private minuteTargetHighest: number = 0
	public start: number = 0
	public end: number = 0
	public kline: Kline = new Kline()
	public kline1h: Kline = new Kline()
	public depth: Depth = {
		nearestAskPrice: 0,
		nearestAskQty: 0,
		nearestBidPrice: 0,
		nearestBidQty: 0,
		ask: '',
		bid: '',
		data: {},
	}

	constructor(public timer: Timer, public onMessage: any) {
		this.init()
		this.initHourly().then()
	}

	public get allowedTop() {
		if (!this.start) {
			return smallerNum(this.depth.nearestAskPrice, 8)
		}

		const biggest = this.start > this.end ? this.start : this.end
		const edge = smallerNum(this.depth.nearestAskPrice, 8)
		return edge < biggest ? edge : biggest
	}

	public get allowedBottom() {
		if (!this.end) {
			return biggerNum(this.depth.nearestBidPrice, 8)
		}

		const lowest = this.start < this.end ? this.start : this.end
		const edge = biggerNum(this.depth.nearestBidPrice, 8)
		return edge > lowest ? edge : lowest
	}

	public get allowedMinuteTop() {
		if (!this.minuteTargetHighest) {
			return smallerNum(this.depth.nearestAskPrice, 8)
		}

		const biggest = this.minuteTargetHighest
		const edge = smallerNum(this.depth.nearestAskPrice, 8)
		return edge < biggest ? edge : biggest
	}

	public get allowedMinuteBottom() {
		if (!this.minuteTargetLowest) {
			return biggerNum(this.depth.nearestBidPrice, 8)
		}

		const lowest = this.minuteTargetLowest
		const edge = biggerNum(this.depth.nearestBidPrice, 8)
		return edge > lowest ? edge : lowest
	}

	init() {
		if (this.isClosed) {
			this.wss = new WebSocket(this.url)

			this.wss.onopen = async () => {
				this.wss.send(JSON.stringify({ op: 'SUB', channel: [process.env.CHANNEL_DEPTH], id: 1 }))
				this.wss.send(JSON.stringify({ op: 'SUB', channel: [process.env.CHANNEL_KLINE], id: 1 }))
				this.wss.send(JSON.stringify({ op: 'SUB', channel: [process.env.CHANNEL_KLINE_1H], id: 1 }))

				clearAndLog('Websocket connected')
				this.timeInit = this.timer.time

				this.wss.onmessage = (e: any) => {
					const data = JSON.parse(e.data)
					switch (data.channel) {
						case process.env.CHANNEL_KLINE:
							if (!!data && !!data.close) {
								this.kline.set(data)
							}
							break
						case process.env.CHANNEL_KLINE_1H:
							if (!!data && !!data.close) {
								this.kline1h.set(data)
							}
							break
						case process.env.CHANNEL_DEPTH:
							if (!!data && !!data.a && !!data.a[ 0 ] && !!data.a[ 0 ][ 0 ]) {
								this.depth.ask = data.a[ 0 ][ 0 ] + '|' + data.a[ 0 ][ 1 ]
								this.depth.bid = data.b[ 0 ][ 0 ] + '|' + data.b[ 0 ][ 1 ]
								this.depth.nearestAskPrice = Number(data.a[ 0 ][ 0 ])
								this.depth.nearestAskQty = Number(data.a[ 0 ][ 1 ])
								this.depth.nearestBidPrice = Number(data.b[ 0 ][ 0 ])
								this.depth.nearestBidQty = Number(data.b[ 0 ][ 1 ])
								this.depth.data = data
							}
							break
					}

					this.onMessage()
				}


				this.isClosed = false
				this.wss.onerror = async (error: any) => {
					console.error(`WebSocket error:`, error)
					await sleep(5000)
					this.wss.close()
					this.isClosed = true
				}

				this.reload().then()
			}
		}
	}

	async initHourly() {
		const h = await getLastHour()
		this.start = starxPrecision(h.start)
		this.end = starxPrecision(h.end)
		this.nextUpdateStartEnd = h.timestamp
		clearAndLog('Gap Restored: ' + this.start + ' ' + this.end + ' ' + this.nextUpdateStartEnd)
	}

	async reload() {
		await sleep(1000)
		const age = Math.round((this.timer.time - this.timeInit) / 1000)
		if (!this.isClosed && age > 3600) {
			this.isClosed = true
			this.wss.close()
			clearAndLog('Reactivating Websocket')
			await sleep(5000)
			this.init()
		}

		this.reload().then()
	}

	getGapEnd() {

		const top = this.allowedTop
		const bottom = this.allowedBottom
		const close = Number(this.kline.close)

		if (!this.end) {
			const gapTop = Math.abs(close - top)
			const gapBottom = Math.abs(close - bottom)
			if (gapTop < gapBottom) {
				return bottom
			} else {
				return top
			}
		}

		if (this.end > this.allowedTop) {
			return this.allowedTop
		}

		if (this.end < this.allowedBottom) {
			return this.allowedBottom
		}

		return this.end
	}

	// Requirement to draw beautiful chart
	async calculateGap() {
		if (!this.kline1h.open) {
			clearAndLog('Gap Calculation Skipped.')
			return
		}

		if (timeAge(this.nextUpdateStartEnd) > 0 || !this.start || !this.end) {
			this.nextUpdateStartEnd = nextTime(this.timer.timeLeftHour)
			let start = Number(this.kline1h.open)
			const bottom = biggerNum(this.depth.nearestBidPrice)
			const top = smallerNum(this.depth.nearestAskPrice)
			const bottomPercentage = Math.abs((bottom - start) / start * 100)
			const topPercentage = Math.abs((top - start) / start * 100)
			const min = 1
			const max = Math.round((bottomPercentage > topPercentage ? bottomPercentage : topPercentage) * 100)
			const randPercentage = getRandomInt(min, max) / 100
			let rand = start * randPercentage / 100
			while (rand > 0.01) {
				rand -= 0.001
			}

			this.start = start
			if (start + rand < top) {
				this.end = start + rand
			} else {
				this.end = start - rand
			}

			await addHour(this.start, this.end, this.nextUpdateStartEnd)
			clearAndLog('Gap Calculation ' + this.start + ' | ' + this.end)
			return
		}

	}

	// Requirement to draw beautiful chart
	calculateMinuteTarget() {
		if (!this.kline.close || !this.start || !this.end) {
			return
		}

		if (!!this.nextUpdateMinuteTarget && timeAge(this.nextUpdateMinuteTarget) < 0) {
			return
		}

		this.nextUpdateMinuteTarget = nextTime(this.timer.timeLeft + 6)
		const start = Number(this.kline.close)
		const bottom = this.allowedBottom
		const top = this.allowedTop
		const bottomPercentage = Math.abs((bottom - start) / start * 100)
		const topPercentage = Math.abs((top - start) / start * 100)
		const min = 1
		const max = Math.round((bottomPercentage > topPercentage ? bottomPercentage : topPercentage) * 100)
		const randPercentage = getRandomInt(min, max) / 100
		const rand = start * randPercentage / 100
		if (top >= start + rand) {
			this.minuteTargetLowest = starxPrecision(start)
			this.minuteTargetHighest = starxPrecision(start + rand)
		} else {
			this.minuteTargetLowest = starxPrecision(start - rand)
			this.minuteTargetHighest = starxPrecision(start)
		}

		clearAndLog('Minute Target ' + this.minuteTargetLowest + ' | ' + this.minuteTargetHighest)
		return
	}
}
