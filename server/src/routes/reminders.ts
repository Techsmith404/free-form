import { FastifyInstance } from 'fastify';
import {
  getAllReminders,
  getReminderById,
  createReminder,
  updateReminder,
  completeReminder,
  dismissReminder,
  snoozeReminder,
  deleteReminder
} from '../services/realtime.js';

export async function reminderRoutes(fastify: FastifyInstance) {
  // Get all reminders
  fastify.get('/api/reminders', async () => {
    return getAllReminders();
  });

  // Get single reminder
  fastify.get('/api/reminders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const reminder = getReminderById(id);
    if (!reminder) {
      return reply.code(404).send({ error: 'Reminder not found' });
    }
    return reminder;
  });

  // Create reminder
  fastify.post('/api/reminders', async (request, reply) => {
    const body = request.body as any;
    if (!body || !body.title?.trim() || !body.due_date) {
      return reply.code(400).send({ error: 'Title and valid due_date are required' });
    }

    const reminder = createReminder({
      title: body.title.trim(),
      notes: body.notes?.trim() || '',
      due_date: new Date(body.due_date).toISOString(),
      priority: body.priority || 'normal',
      notebook_id: body.notebook_id || null
    });

    return reply.code(201).send(reminder);
  });

  // Update reminder
  fastify.patch('/api/reminders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const reminder = updateReminder(id, body);
    if (!reminder) {
      return reply.code(404).send({ error: 'Reminder not found' });
    }
    return reminder;
  });

  // Complete reminder
  fastify.post('/api/reminders/:id/complete', async (request, reply) => {
    const { id } = request.params as { id: string };
    const reminder = completeReminder(id);
    if (!reminder) {
      return reply.code(404).send({ error: 'Reminder not found' });
    }
    return reminder;
  });

  // Dismiss reminder alert
  fastify.post('/api/reminders/:id/dismiss', async (request, reply) => {
    const { id } = request.params as { id: string };
    const reminder = dismissReminder(id);
    if (!reminder) {
      return reply.code(404).send({ error: 'Reminder not found' });
    }
    return reminder;
  });

  // Snooze reminder
  fastify.post('/api/reminders/:id/snooze', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const minutes = Number(body?.minutes) || 5;
    const reminder = snoozeReminder(id, minutes);
    if (!reminder) {
      return reply.code(404).send({ error: 'Reminder not found' });
    }
    return reminder;
  });

  // Delete reminder
  fastify.delete('/api/reminders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const success = deleteReminder(id);
    if (!success) {
      return reply.code(404).send({ error: 'Reminder not found' });
    }
    return { success: true };
  });
}
