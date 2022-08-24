// @ts-ignore
import Moment from 'moment'
import { sleep } from './common'

export class Timer {

	private change: any
	public time: number = 0
	public timeLeft: number = 0
	public timeLeftHour: number = 0
	public timeTxt: string = ''

	constructor() {
		this.init().then()
	}

	async init() {
		this.time = (new Date()).getTime()
		this.timeLeft = Math.round((60000 - (this.time % 60000)) / 1000)
		this.timeLeftHour = Math.round((3600000 - (this.time % 3600000)) / 1000)
		this.timeTxt = Moment(this.time).format('hh:mm:ss')

		if (!!this.change) {
			this.change({ time: this.time, timeLeft: this.timeLeft, timeTxt: this.timeTxt })
		}

		await sleep(1000)
		this.init().then()
	}

	onChange(a: any) {
		this.change = a
	}

}
