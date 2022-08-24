export interface Transaction {
	symbol: string
	baseCurrency: string
	quoteCurrency: string
	timestamp: number
	side: string
	timeInForce: string
	accountId: number
	ordPrice: number
	cumAmt: string
	cumQty: string
	leavesQty: string
	clOrdId: string
	ordAmt: string
	ordQty: string
	ordId: string
	ordStatus: string
	ordType: string
}
