const ioredis = require('ioredis');
const redis = new ioredis();
redis.set('verify', 'alive').then(() => redis.get('verify')).then(v => console.log('Redis:', v)).catch(() => console.log('Redis not available'));
process.exit();
