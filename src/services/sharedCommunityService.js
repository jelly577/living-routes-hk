import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const sharedCommunityEnabled = Boolean(url && key);
const client = sharedCommunityEnabled ? createClient(url, key) : null;
export function createSharedCommunityBackend(client) {
let sessionPromise;

async function ownerSession() {
  if (!client) throw new Error('Shared Community is not connected yet. Save privately for now.');
  if (!sessionPromise) sessionPromise = (async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    const result = await client.auth.signInAnonymously();
    if (result.error) throw result.error;
    return result.data.session;
  })().finally(() => { sessionPromise = null; });
  return sessionPromise;
}

async function readSharedPosts() {
  if (!client) return [];
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const ownerId = session.session?.user.id;
  const { data, error } = await client.from('community_posts')
    .select('id,payload,owner_id').order('created_at', { ascending: false }).limit(200);
  if (error) throw new Error(`Community could not load: ${error.message}`);
  return data.map((row) => ({ ...row.payload, id: row.id, shared: true, canDelete: row.owner_id === ownerId }));
}

async function publishSharedPost(post) {
  if (post.visibility !== 'community') throw new Error('Private journals cannot be published by this operation.');
  const session = await ownerSession();
  // A retry after a successful upload must not create duplicates or overwrite files.
  const existing = await client.from('community_posts').select('payload,owner_id').eq('id', post.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (existing.data.owner_id !== session.user.id) throw new Error('This post belongs to another publisher.');
    return { ...existing.data.payload, id: post.id, shared: true, canDelete: true };
  }
  let image = post.image;
  let imagePath = null;
  if (image?.startsWith('data:')) {
    const blob = await (await fetch(image)).blob();
    imagePath = `${session.user.id}/${post.id}.jpg`;
    const { error } = await client.storage.from('community-photos').upload(imagePath, blob, {
      contentType: 'image/jpeg', upsert: false,
    });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    image = client.storage.from('community-photos').getPublicUrl(imagePath).data.publicUrl;
  }
  const payload = { ...post, image, imagePath, shared: true, visibility: 'community' };
  delete payload.canDelete;
  const { error } = await client.from('community_posts').insert({
    id: post.id, owner_id: session.user.id, payload,
  });
  if (error) {
    if (imagePath) await client.storage.from('community-photos').remove([imagePath]);
    throw new Error(`Post was not published: ${error.message}`);
  }
  return { ...payload, canDelete: true };
}

async function removeSharedPost(id) {
  await ownerSession();
  const { data, error } = await client.from('community_posts').delete().eq('id', id).select('payload');
  if (error) throw error;
  if (!data.length) throw new Error('This browser does not own the post.');
  const path = data[0].payload.imagePath;
  if (path) await client.storage.from('community-photos').remove([path]);
}
return { readSharedPosts, publishSharedPost, removeSharedPost };
}

export const { readSharedPosts, publishSharedPost, removeSharedPost } = createSharedCommunityBackend(client);
