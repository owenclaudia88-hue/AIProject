import { readSession } from '../../lib/session.js';
import { isActive, getLibraryItem, getGallery, relatedLibraryItems } from '../../lib/db.js';

const assetUrl = (key) => (key ? `/api/library/asset?key=${encodeURIComponent(key)}` : null);

/**
 * GET /api/library/item?id=…  — one item, with everything the reader needs to
 * lay it out: its tags, its kind-specific meta (video url, downloadable file,
 * difficulty…), its gallery tiles if it is an image-prompt collection, and a
 * few related items.
 */
export default async function handler(req, res) {
  const email = readSession(req);
  if (!email) return res.status(401).json({ error: 'not signed in' });
  try {
    if (!(await isActive(email))) return res.status(403).json({ error: 'not active' });

    const id = new URL(req.url, 'http://localhost').searchParams.get('id');
    if (!id) return res.status(400).json({ error: 'missing id' });

    const item = await getLibraryItem(id);
    if (!item) return res.status(404).json({ error: 'not found' });

    const meta = item.meta || {};
    const [tiles, related] = await Promise.all([
      item.kind === 'image_prompt' ? getGallery(id) : Promise.resolve([]),
      relatedLibraryItems(id, item.kind, item.category, 4)
    ]);

    // The file lives in Blob; hand the browser our gated download URL, never the
    // Blob location itself.
    const download = meta.fileKey
      ? { url: `${assetUrl(meta.fileKey)}&download=1`, name: meta.fileName || 'download' }
      : null;
    const { fileKey, ...publicMeta } = meta;

    return res.status(200).json({
      id: item.id, kind: item.kind, course: item.course, category: item.category,
      title: item.title, description: item.description,
      bodyHtml: item.body_html || '',
      tags: item.tags || [],
      meta: publicMeta,
      download,
      gallery: (tiles || []).map((t) => ({ prompt: t.prompt, image: assetUrl(t.asset_key) })),
      related: (related || []).map((r) => ({
        id: r.id, kind: r.kind, category: r.category, title: r.title,
        description: r.description, thumb: assetUrl(r.thumb_key)
      }))
    });
  } catch (err) {
    console.error('[library/item]', err);
    return res.status(500).json({ error: 'server' });
  }
}
