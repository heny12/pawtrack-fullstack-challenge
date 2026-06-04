import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthContext } from '../types/index.js';
import { store } from '../store/memory-store.js';

export function petRoutes(app: FastifyInstance): void {
  /**
   * GET /api/pets
   * List all pets for the authenticated tenant.
   */
  app.get('/api/pets', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = (request as any).auth as AuthContext;
    const pets = store.getPets(auth.tenantId);
    return reply.code(200).send({ data: pets });
  });

  /**
   * GET /api/pets/:id
   * Get a single pet by ID.
   */
  app.get('/api/pets/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = (request as any).auth as AuthContext;
    const { id } = request.params as { id: string };
    const pet = store.getPet(auth.tenantId, id);

    if (!pet) {
      return reply.code(404).send({ error: 'Pet not found' });
    }

    return reply.code(200).send({ data: pet });
  });
}
