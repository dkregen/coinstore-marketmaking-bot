const ADODB = require('node-adodb')
const conn = ADODB.open('Provider=Microsoft.Jet.OLEDB.4.0;Data Source=db.mdb;')

export async function getLastHour(): Promise<{start: number, end: number, timestamp: number}> {
	try {
		const data: any = await conn.query('SELECT TOP 1 * FROM hourly ORDER BY `id` DESC')

		if (data.length > 0) {
			return {
				start: Number(data[0].start),
				end: Number(data[0].end),
				timestamp: Number(data[0].timestamp),
			}
		}

		return {start: 0, end: 0, timestamp: 0}
	} catch (e) {
		console.error(e)
		return {start: 0, end: 0, timestamp: 0}
	}
}

export async function addHour(start: number, end: number, timestamp: number) {
	try {
		const data = await conn.execute('INSERT INTO hourly (`start`,`end`,`timestamp`) ' + `VALUES  (${ start },${ end },${ timestamp })`)
		return true
	} catch (e) {
		console.error(e)
		return false
	}
}
