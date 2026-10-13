import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { UPLOADS_DIR } from '../db/index.js';
import { scrapeUrl } from '../services/scraper.js';
import { sanitizeSvg, IMAGE_EXTENSIONS } from '../services/svg.js';

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

    // The stored extension comes from the validated MIME type, never from the client-supplied
    // filename (otherwise "x.html" with an image/png part would be stored and served as HTML).
    const ext = IMAGE_EXTENSIONS[data.mimetype];
    if (!ext) {
      return reply.code(400).send({ error: 'Invalid file type. Only images are allowed.' });
    }

    const filename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    if (ext === '.svg') {
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      await fs.promises.writeFile(filePath, sanitizeSvg(Buffer.concat(chunks).toString('utf8')));
    } else {
      await pipeline(data.file, fs.createWriteStream(filePath));
    }

    if (data.file.truncated) {
      await fs.promises.unlink(filePath).catch(() => {});
      return reply.code(413).send({ error: 'File is too large (50 MB limit)' });
    }

    return {
      url: `/uploads/${filename}`,
      name: data.filename,
      size: (await fs.promises.stat(filePath)).size
    };
  });

  // Upload base64 image (useful for signature pad & clipboard pastes)
  fastify.post('/api/upload-base64', async (request, reply) => {
    const { base64Data, filename: originalName } = (request.body || {}) as {
      base64Data?: string;
      filename?: string;
    };

    if (!base64Data || typeof base64Data !== 'string') {
      return reply.code(400).send({ error: 'base64Data is required' });
    }

    const matches = base64Data.match(/^data:([A-Za-z0-9.+\/-]+);base64,(.+)$/s);
    let ext = '.png';
    let buffer: Buffer;

    if (matches) {
      const mime = matches[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : matches[1].toLowerCase();
      const mapped = IMAGE_EXTENSIONS[mime];
      if (!mapped) {
        return reply.code(400).send({ error: 'Invalid file type. Only images are allowed.' });
      }
      ext = mapped;
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(base64Data, 'base64');
    }

    if (ext === '.svg') {
      buffer = Buffer.from(sanitizeSvg(buffer.toString('utf8')), 'utf8');
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
