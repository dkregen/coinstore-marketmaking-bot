export function url(pre?: string) {
	// @ts-ignore
	return process.env.PYTHON_URL + (pre || '')
}
