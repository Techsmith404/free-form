import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { UPLOADS_DIR } from '../db/index.js';
import { scrapeUrl } from '../services/scraper.js';

export async function uploadRoutes(fastify: FastifyInstance) {
  // Scrape URL metadata for bookmark creation
  fastify.post('/api/scrape', async (request, reply) => {
    const { url } = request.body as { url: string };
    if (!url) {
      return reply.code(400).send({ error: 'URL is required' });
    }

    try {
      const data = await scrapeUrl(url);
      return data;
    } catch (err: any) {
      return reply.code(400).send({ error: err.message || 'Failed to scrape URL' });
    }
  });

  // Upload file via multipart
  fastify.post('/api/upload', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Only images are allowed.' });
    }

    const ext = path.extname(data.filename).toLowerCase();
    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    if (data.mimetype === 'image/svg+xml' || ext === '.svg') {
      let fileContent = '';
      for await (const chunk of data.file) {
        fileContent += chunk;
      }
      const sanitized = fileContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\b(onclick|onerror|onload|onmouseover)\s*=\s*"[^"]*"/gi, '')
        .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '');
      await fs.promises.writeFile(filePath, sanitized);
    } else {
      await pipeline(data.file, fs.createWriteStream(filePath));
    }

    return {
      url: `/uploads/${filename}`,
      name: data.filename,
      size: (await fs.promises.stat(filePath)).size
    };
  });

  // Upload base64 image (useful for signature pad & clipboard pastes)
  fastify.post('/api/upload-base64', async (request, reply) => {
    const { base64Data, filename: originalName } = request.body as {
      base64Data: string;
      filename?: string;
    };

    if (!base64Data) {
      return reply.code(400).send({ error: 'base64Data is required' });
    }

    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let ext = '.png';

    if (matches && matches.length === 3) {
      const mime = matches[1];
      if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
      else if (mime.includes('svg')) ext = '.svg';
      else if (mime.includes('webp')) ext = '.webp';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(base64Data, 'base64');
    }

    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    await fs.promises.writeFile(filePath, buffer);

    return {
      url: `/uploads/${filename}`,
      name: originalName || filename,
      size: buffer.length
    };
  });
}
