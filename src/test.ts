import { getLastHour } from './helper/db'

getLastHour().then((r) => {
	console.log(r)
})
