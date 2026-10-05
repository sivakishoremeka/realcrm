const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const SIGNED_URL_TTL_SECONDS = Number(process.env.S3_SIGNED_URL_TTL || 60 * 60 * 6); // 6h

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for S3 image storage`);
  }
  return value;
}

function getS3Config() {
  const bucket = requiredEnv('S3_BUCKET_NAME');
  const region = process.env.AWS_REGION || 'ap-south-1';
  const accessKeyId =
    process.env.AWS_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.AWS_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS_S3_ACCESS_KEY_ID and AWS_S3_SECRET_ACCESS_KEY are required for S3 image storage'
    );
  }

  return { bucket, region, accessKeyId, secretAccessKey };
}

let client;

function getClient() {
  if (client) return client;
  const { region, accessKeyId, secretAccessKey } = getS3Config();
  client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
  return client;
}

/** Canonical stored URL (not publicly readable when Block Public Access is on). */
function publicUrlForKey(key) {
  const { bucket, region } = getS3Config();
  const base = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (base) return `${base}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

function keyFromPublicUrl(url) {
  if (!url) return null;
  const clean = String(url).split('?')[0];
  const base = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (base && clean.startsWith(`${base}/`)) {
    return decodeURIComponent(clean.slice(base.length + 1));
  }

  try {
    const { bucket, region } = getS3Config();
    const parsed = new URL(clean);
    const host = parsed.hostname;

    if (
      host === `${bucket}.s3.${region}.amazonaws.com` ||
      host === `${bucket}.s3.amazonaws.com` ||
      host === `${bucket}.s3.${region}.amazonaws.com`
    ) {
      return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    }

    // Virtual-hosted with dualstack / accelerate variants
    if (host.startsWith(`${bucket}.s3.`) && host.endsWith('.amazonaws.com')) {
      return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    }

    if (
      host === `s3.${region}.amazonaws.com` ||
      host === 's3.amazonaws.com'
    ) {
      const parts = parsed.pathname.replace(/^\//, '').split('/');
      if (parts[0] === bucket) return decodeURIComponent(parts.slice(1).join('/'));
    }
  } catch {
    return null;
  }
  return null;
}

function canonicalImageUrl(urlOrKey) {
  if (!urlOrKey) return '';
  const key = keyFromPublicUrl(urlOrKey);
  if (key) return publicUrlForKey(key);
  // already a bare key
  if (!String(urlOrKey).includes('://')) return publicUrlForKey(urlOrKey);
  return String(urlOrKey).split('?')[0];
}

function imageUrlsEqual(a, b) {
  if (!a || !b) return false;
  const ka = keyFromPublicUrl(a) || String(a).split('?')[0];
  const kb = keyFromPublicUrl(b) || String(b).split('?')[0];
  return ka === kb;
}

function buildListingImageKey({ ownerId, listingId, originalName }) {
  const safe = String(originalName || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `listings/${ownerId}/${listingId}/${Date.now()}-${safe}`;
}

function buildInventoryImageKey({ agentId, propertyId, originalName }) {
  const safe = String(originalName || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `inventory/${agentId}/${propertyId}/${Date.now()}-${safe}`;
}

function buildAvatarKey({ userId, originalName }) {
  const safe = String(originalName || 'avatar.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `avatars/${userId}/${Date.now()}-${safe}`;
}

async function uploadListingImage({ buffer, contentType, key }) {
  const { bucket } = getS3Config();
  const type = contentType && contentType.startsWith('image/')
    ? contentType
    : 'image/jpeg';

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: type,
      CacheControl: 'public, max-age=31536000',
    })
  );
  // Persist canonical URL; clients receive signed URLs via withSignedImages
  return publicUrlForKey(key);
}

async function getSignedDownloadUrl(key) {
  if (!key) return null;
  const { bucket } = getS3Config();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: SIGNED_URL_TTL_SECONDS });
}

async function signStoredImageUrl(url) {
  if (!url) return url;
  const key = keyFromPublicUrl(url);
  if (!key) return url;
  try {
    return await getSignedDownloadUrl(key);
  } catch (err) {
    console.warn('Failed to sign S3 URL:', err.message);
    return url;
  }
}

async function signImageList(urls = []) {
  return Promise.all((urls || []).map((u) => signStoredImageUrl(u)));
}

/** Clone a property/listing doc (or plain object) with signed image URLs for the client. */
async function withSignedImages(doc) {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  obj.images = await signImageList(obj.images || []);
  return obj;
}

async function withSignedImagesMany(docs = []) {
  return Promise.all((docs || []).map((d) => withSignedImages(d)));
}

async function deleteObjectByUrl(url) {
  const key = keyFromPublicUrl(url);
  if (
    !key ||
    !(
      key.startsWith('listings/') ||
      key.startsWith('inventory/') ||
      key.startsWith('avatars/')
    )
  ) {
    return false;
  }
  const { bucket } = getS3Config();
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  return true;
}

async function deleteObjectsByUrls(urls = []) {
  for (const url of urls) {
    try {
      await deleteObjectByUrl(url);
    } catch (err) {
      console.warn('S3 delete failed:', err.message);
    }
  }
}

module.exports = {
  buildListingImageKey,
  buildInventoryImageKey,
  buildAvatarKey,
  uploadListingImage,
  deleteObjectByUrl,
  deleteObjectsByUrls,
  keyFromPublicUrl,
  publicUrlForKey,
  canonicalImageUrl,
  imageUrlsEqual,
  signStoredImageUrl,
  signImageList,
  withSignedImages,
  withSignedImagesMany,
  getSignedDownloadUrl,
};
