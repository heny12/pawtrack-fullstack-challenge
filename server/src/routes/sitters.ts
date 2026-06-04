import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthContext } from '../types/index.js';
import { store } from '../store/memory-store.js';

export function sitterRoutes(app: FastifyInstance): void {
  /**
   * GET /api/sitters
   * List all sitters for the authenticated tenant.
   */
  app.get('/api/sitters', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = (request as any).auth as AuthContext;
    const sitters = store.getSitters(auth.tenantId);
    return reply.code(200).send({ data: sitters });
  });
}
