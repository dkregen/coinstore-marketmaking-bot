export function clearAndLog(o: any) {
	process.stdout.clearLine(0)
	process.stdout.cursorTo(0)
	console.log(o)
}

export function precision(n: number) {
	let a = Number(n)
	if (!isFinite(a)) return 0
	var e = 1, p = 0
	while (Math.round(a * e) / e !== a) {
		e *= 10
		p++
	}
	return p
}

export function getRandomInt(min: number, max: number) {
	min = Math.ceil(min)
	max = Math.floor(max)
	return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getRandomFloat(min: number, max: number) {
	// Calculate precision.
	const eMin = precision(min)
	const eMax = precision(max)
	const e = eMin > eMax ? eMin : eMax

	// Define the edge.
	const bottom = parseInt(min * Math.pow(10, e) + '')
	const top = parseInt(max * Math.pow(10, e) + '')
	const rand = getRandomInt(bottom, top) / Math.pow(10, e)

	return rand
}

export function fixPrecision(a: number) {
	const p = 12
	const currentPrecision = precision(a)
	if(p > currentPrecision) {
		return a / Math.pow(10, p - currentPrecision)
	}

	return a
}

export function customPrecision(n: number, digit: number) {
	const pow = Math.pow(10, digit)
	const rounded = Math.round(n * pow)
	const truncated = rounded / pow
	const split = (truncated + '').split('.')
	if(split.length > 1) {
		return Number(split[0] + '.' + split[1].substring(0, 8))
	} else {
		return truncated
	}
}

export function starxPrecision(n: number) {
	const pow = 100000000
	const rounded = Math.round(n * pow)
	const truncated = rounded / pow
	const split = (truncated + '').split('.')
	if(split.length > 1) {
		return Number(split[0] + '.' + split[1].substring(0, 8))
	} else {
		return truncated
	}
}

export function sleep(ms: number) {
	return new Promise((res) => {
		setTimeout(() => {
			res(true)
		}, ms)
	})
}

export function printCmd(str: string) {
	process.stdout.clearLine(0)
	process.stdout.cursorTo(0)
	process.stdout.write(str)
}

export function timeAge(ms: number) {
	const time = (new Date()).getTime()
	return Math.round((time - ms) / 1000)
}

export function smallerNum(a: number, precise?: number) {
	const n = Number(a)
	const pre = precise || precision(n)
	const aggregator = 1 / Math.pow(10, pre)
	return n - aggregator
}

export function biggerNum(a: number, precise?: number) {
	const n = Number(a)
	const pre = precise || precision(n)
	const aggregator = 1 / Math.pow(10, pre)
	return n + aggregator
}

export function nextTime(addSecond: number) {
	return (new Date()).getTime() + (addSecond * 1000)
}
