import { FastifyInstance } from 'fastify';
import {
  getAllTimers,
  getTimerById,
  createTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  dismissTimer,
  deleteTimer
} from '../services/realtime.js';
import { ownerIdOf } from '../services/owner.js';

export async function timerRoutes(fastify: FastifyInstance) {
  // Ownership guard for every `:id` route in this plugin: other users' rows look like 404s.
  fastify.addHook('preHandler', async (request, reply) => {
    const id = (request.params as { id?: string } | undefined)?.id;
    if (!id) return;
    const row = getTimerById(id) as { user_id?: string | null } | undefined | null;
    const me = (request as any).user?.id as string | undefined;
    if (row && row.user_id && me && row.user_id !== me) {
      return reply.code(404).send({ error: 'Timer not found' });
    }
  });

  // Get all timers
  fastify.get('/api/timers', async (request) => {
    const userId = (request as any).user?.id;
    return getAllTimers(userId);
  });

  // Get single timer
  fastify.get('/api/timers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const timer = getTimerById(id);
    if (!timer) {
      return reply.code(404).send({ error: 'Timer not found' });
    }
    return timer;
  });

  // Create timer
  fastify.post('/api/timers', async (request, reply) => {
    const body = request.body as any;
    if (!body || !body.duration_seconds || typeof body.duration_seconds !== 'number' || body.duration_seconds <= 0) {
      return reply.code(400).send({ error: 'Valid duration_seconds is required' });
    }

    const timer = createTimer({
      title: body.title?.trim() || 'Timer',
      duration_seconds: body.duration_seconds,
      notebook_id: body.notebook_id || null,
      auto_start: Boolean(body.auto_start),
      user_id: ownerIdOf(request)
    });

    return reply.code(201).send(timer);
  });

  // Start / Resume timer
  fastify.post('/api/timers/:id/start', async (request, reply) => {
    const { id } = request.params as { id: string };
    const timer = startTimer(id);
    if (!timer) {
      return reply.code(404).send({ error: 'Timer not found' });
    }
    return timer;
  });

  // Pause timer
  fastify.post('/api/timers/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string };
    const timer = pauseTimer(id);
    if (!timer) {
      return reply.code(404).send({ error: 'Timer not found' });
    }
    return timer;
  });

  // Reset timer
  fastify.post('/api/timers/:id/reset', async (request, reply) => {
    const { id } = request.params as { id: string };
    const timer = resetTimer(id);
    if (!timer) {
      return reply.code(404).send({ error: 'Timer not found' });
    }
    return timer;
  });

  // Dismiss / Stop ringing timer
  fastify.post('/api/timers/:id/dismiss', async (request, reply) => {
    const { id } = request.params as { id: string };
    const timer = dismissTimer(id);
    if (!timer) {
      return reply.code(404).send({ error: 'Timer not found' });
    }
    return timer;
  });

  // Delete timer
  fastify.delete('/api/timers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = deleteTimer(id);
    if (!success) {
      return reply.code(404).send({ error: 'Timer not found' });
    }
    return { success: true };
  });
}
