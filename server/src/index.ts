import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authMiddleware } from './middleware/auth.js';
import { bookingRoutes } from './routes/bookings.js';
import { petRoutes } from './routes/pets.js';
import { sitterRoutes } from './routes/sitters.js';

const app = Fastify({ logger: true });

// Register CORS for frontend
app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Tenant-Id', 'X-User-Id', 'X-User-Role'],
});

// Auth middleware for all /api routes
app.addHook('onRequest', async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    await authMiddleware(request, reply);
  }
});

// Health check (no auth required)
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register route handlers
bookingRoutes(app);
petRoutes(app);
sitterRoutes(app);

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' });
    console.log('PawTrack API running on http://localhost:3001');
    console.log('Health check: http://localhost:3001/health');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
