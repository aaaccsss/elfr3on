module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // لدعم InfinityFree أو أي دومين خارجي
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
};
