import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { UPLOADS_DIR } from '../db/index.js';
import { scrapeUrl } from '../services/scraper.js';
import { sanitizeSvg, resolveImageExtension } from '../services/svg.js';

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
    let filePath: string | null = null;
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // The stored extension comes from the validated MIME type or safe fallback, never arbitrary extensions
      const ext = resolveImageExtension(data.mimetype, data.filename);
      if (!ext) {
        data.file.resume();
        return reply.code(400).send({ error: 'Invalid file type. Only images are allowed.' });
      }

      await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

      const filename = `${crypto.randomUUID()}${ext}`;
      filePath = path.join(UPLOADS_DIR, filename);

      if (ext === '.svg') {
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk as Buffer);
        }
        if (data.file.truncated) {
          return reply.code(413).send({ error: 'File is too large (50 MB limit)' });
        }
        await fs.promises.writeFile(filePath, sanitizeSvg(Buffer.concat(chunks).toString('utf8')));
      } else {
        await pipeline(data.file, fs.createWriteStream(filePath));
      }

      if (data.file.truncated) {
        if (filePath) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
        return reply.code(413).send({ error: 'File is too large (50 MB limit)' });
      }

      return {
        url: `/uploads/${filename}`,
        name: data.filename,
        size: (await fs.promises.stat(filePath)).size
      };
    } catch (err: any) {
      if (filePath) {
        await fs.promises.unlink(filePath).catch(() => {});
      }
      if (err.code === 'FST_REQ_FILE_TOO_LARGE' || err.statusCode === 413) {
        return reply.code(413).send({ error: 'File is too large (50 MB limit)' });
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to store uploaded image' });
    }
  });

  // Upload base64 image (useful for signature pad & clipboard pastes)
  fastify.post('/api/upload-base64', async (request, reply) => {
    let filePath: string | null = null;
    try {
      const { base64Data, filename: originalName } = (request.body || {}) as {
        base64Data?: string;
        filename?: string;
      };

      if (!base64Data || typeof base64Data !== 'string') {
        return reply.code(400).send({ error: 'base64Data is required' });
      }

      const matches = base64Data.match(/^data:([^;,]+)(?:;[^;,]*)?;base64,(.*)$/s);
      let ext: string | null = null;
      let rawBase64: string;

      if (matches) {
        ext = resolveImageExtension(matches[1], originalName);
        if (!ext) {
          return reply.code(400).send({ error: 'Invalid file type. Only images are allowed.' });
        }
        rawBase64 = matches[2];
      } else if (base64Data.startsWith('data:')) {
        return reply.code(400).send({ error: 'Invalid file type. Only images are allowed.' });
      } else {
        ext = resolveImageExtension(null, originalName) || '.png';
        rawBase64 = base64Data;
      }

      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.length === 0) {
        return reply.code(400).send({ error: 'Invalid or empty image data' });
      }

      let fileBuffer = buffer;
      if (ext === '.svg') {
        fileBuffer = Buffer.from(sanitizeSvg(buffer.toString('utf8')), 'utf8');
      }

      await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });

      const filename = `${crypto.randomUUID()}${ext}`;
      filePath = path.join(UPLOADS_DIR, filename);

      await fs.promises.writeFile(filePath, fileBuffer);

      return {
        url: `/uploads/${filename}`,
        name: originalName || filename,
        size: fileBuffer.length
      };
    } catch (err: any) {
      if (filePath) {
        await fs.promises.unlink(filePath).catch(() => {});
      }
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to store uploaded image' });
    }
  });
}
