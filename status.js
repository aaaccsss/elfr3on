module.exports = async (req, res) => {
  res.json({
    status: 'running',
    uptime: Math.floor(process.uptime()),
    cacheSize: 0, // Cache مش محتفظ بيه بين الـ serverless functions
    timestamp: new Date().toISOString()
  });
};