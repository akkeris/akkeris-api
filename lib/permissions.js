
module.exports = {
  isAllowed(groups) {
    if (!groups) {
      return false;
    }
    return process.env.BASIC_ACCESS
      .split(';')
      .map((z) => z.trim().toLowerCase())
      .filter((x) => groups.map((y) => y.trim().toLowerCase()).includes(x))
      .length !== 0;
  },
  isElevated(groups) {
    if (!groups) {
      return false;
    }
    return process.env.ELEVATED_ACCESS
      .split(';')
      .map((z) => z.trim().toLowerCase())
      .filter((x) => groups.map((y) => y.trim().toLowerCase()).includes(x))
      .length !== 0;
  },
};
