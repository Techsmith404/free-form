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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);

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

    const html = await response.text();
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
  }
}
