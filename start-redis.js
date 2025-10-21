const RedisServer = require('redis-server');

const server = new RedisServer({
  port: 6379,
  bin: 'redis-server'
});

server.open((err) => {
  if (err) {
    console.error('Failed to start Redis server:', err.message);
    process.exit(1);
  }
  console.log('✅ Redis server started successfully on localhost:6379');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Redis server...');
  server.close(() => {
    console.log('Redis server stopped');
    process.exit(0);
  });
});
