import * as cheerio from 'cheerio';

export interface ScrapedMetadata {
  url: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  siteName: string;
}

export async function scrapeUrl(targetUrl: string): Promise<ScrapedMetadata> {
  // Ensure valid URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
  } catch {
    throw new Error('Invalid URL provided');
  }

  const cleanUrl = parsedUrl.toString();
  const domain = parsedUrl.hostname;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return {
        url: cleanUrl,
        title: domain,
        description: '',
        image: null,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        siteName: domain
      };
    }

    // Only the <head> matters, so cap the body (the abort timer above also covers this read).
    const html = await readTextCapped(response, MAX_SCRAPE_BYTES);
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text().trim() ||
      domain;

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      '';

    let image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      null;

    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, cleanUrl).toString();
      } catch {
        image = null;
      }
    }

    let favicon =
      $('link[rel="apple-touch-icon"]').attr('href') ||
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      null;

    if (favicon && !favicon.startsWith('http')) {
      try {
        favicon = new URL(favicon, cleanUrl).toString();
      } catch {
        favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      }
    } else if (!favicon) {
      favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }

    const siteName =
      $('meta[property="og:site_name"]').attr('content') ||
      domain;

    return {
      url: cleanUrl,
      title: title.trim(),
      description: description.trim(),
      image,
      favicon,
      siteName
    };
  } catch (err) {
    // If scraping fails (e.g. network/CORS or bot block), return graceful fallback
    return {
      url: cleanUrl,
      title: domain,
      description: '',
      image: null,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      siteName: domain
    };
  } finally {
    clearTimeout(timeout);
  }
}

const MAX_SCRAPE_BYTES = 1024 * 1024; // 1 MB is plenty to reach <head> metadata

async function readTextCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString('utf8');
}
