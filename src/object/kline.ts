export class Kline {
	S: number = 0
	T: string = ''
	channel: string = ''
	interval: string = ''
	startTime: number = 0
	endTime: number = 0
	amount: string = ''
	close: string = ''
	open: string = ''
	high: string = ''
	low: string = ''
	firstTradeId: number = 0
	lastTradeId: number = 0
	volume: string = ''
	symbol: string = ''
	instrumentId: number = 0

	constructor() {}

	set(o: any) {
		for (let key in o) {
			// @ts-ignore
			this[key] = o[key];
			// Use `key` and `value`
		}
	}
}
