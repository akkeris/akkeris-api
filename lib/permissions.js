
module.exports = {
	isAllowed:function(groups) {
		if (!groups) {
			return false
		} else {
			return process.env.BASIC_ACCESS.split(';').map((z) => z.trim()).filter((x) => groups.map((y) => y.trim()).includes(x)).length !== 0
		}
		
	},
	isElevated:function(groups) {
		if (!groups) {
			return false
		} else {
			return process.env.ELEVATED_ACCESS.split(';').map((z) => z.trim()).filter((x) => groups.map((y) => y.trim()).includes(x)).length !== 0
		}
	}
}