import { Trader } from './trader'
import { Timer } from './helper/timer'
import { Websocket } from './helper/websocket'
import { printCmd } from './helper/common'

function monitor() {
	printCmd((timer.timeTxt || '-') + ' | ' + (timer.timeLeft || '-') + ' | ' + (timer.timeLeftHour || '-') + ' | O:' + ws.kline.open + ' H:' + ws.kline.high + ' L:' + ws.kline.low + ' C:' + ws.kline.close + ' V:' + ws.kline.volume + ' B:' + ws.depth.bid + ' A:' + ws.depth.ask)
}

async function onTimeout() {
	monitor()
	ws.calculateGap().then()
	ws.calculateMinuteTarget()

	await trader.volume()
	await trader.filler()
	await trader.drawClosingOpening()
}

const timer = new Timer()
const ws = new Websocket(timer, monitor)
const trader = new Trader(ws, timer)
timer.onChange(onTimeout)
