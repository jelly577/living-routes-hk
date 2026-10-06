import assert from 'node:assert/strict';
import test from 'node:test';
import { createSharedCommunityBackend } from '../src/services/sharedCommunityService.js';
import { addPost, getMyPosts, shareAllSavedCommunityPosts } from '../src/services/communityService.js';

// This is a client contract test, not a substitute for live RLS tests.
function fixture() {
  const rows = [];
  const removed = [];
  let owner = 'publisher';
  let insertError = null;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: owner ? { user: { id: owner } } : null } }),
      signInAnonymously: async () => { owner = 'publisher'; return { data: { session: { user: { id: owner } } } }; },
    },
    from: () => ({
      select: () => ({
        order: () => ({ limit: async () => ({ data: [...rows], error: null }) }),
        eq: (_, id) => ({ maybeSingle: async () => ({ data: rows.find((row) => row.id === id) || null }) }),
      }),
      insert: async (row) => { if (insertError) return { error: insertError }; rows.push(row); return {}; },
      delete: () => ({ eq: (_, id) => ({ select: async () => {
        const index = rows.findIndex((row) => row.id === id && row.owner_id === owner);
        return { data: index < 0 ? [] : rows.splice(index, 1), error: null };
      } }) }),
    }),
    storage: { from: () => ({
      upload: async () => ({}),
      getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.example/${path}` } }),
      remove: async (paths) => { removed.push(...paths); return {}; },
    }) },
  };
  return { backend: createSharedCommunityBackend(client), rows, removed,
    setOwner: (value) => { owner = value; }, failInsert: () => { insertError = { message: 'offline' }; } };
}

const post = { id: 'test-id', text: 'A shared memory', visibility: 'community', image: null };

test('without configuration reading is safe but publishing fails explicitly', async () => {
  const backend = createSharedCommunityBackend(null);
  assert.deepEqual(await backend.readSharedPosts(), []);
  await assert.rejects(backend.publishSharedPost(post), /not connected/);
});

test('private journals never enter the public adapter', async () => {
  const { backend, rows } = fixture();
  await assert.rejects(backend.publishSharedPost({ ...post, visibility: 'private' }), /Private journals/);
  assert.equal(rows.length, 0);
});

test('bulk migration only attempts old public entries and preserves failures locally', async () => {
  const privatePost = await addPost({ text: 'Keep private', visibility: 'private' });
  const publicPost = await addPost({ text: 'Old public entry', visibility: 'community' });
  const result = await shareAllSavedCommunityPosts();
  assert.deepEqual(result.published, []);
  assert.deepEqual(result.failed.map((item) => item.id), [publicPost.id]);
  const saved = await getMyPosts();
  assert.equal(saved.find((item) => item.id === privatePost.id).visibility, 'private');
  assert.equal(saved.find((item) => item.id === publicPost.id).shared, undefined);
});

test('an independent visitor reads posts but cannot delete them', async () => {
  const f = fixture();
  await f.backend.publishSharedPost(post);
  assert.equal((await f.backend.readSharedPosts())[0].canDelete, true);
  f.setOwner(null);
  const visible = await f.backend.readSharedPosts();
  assert.equal(visible[0].text, post.text);
  assert.equal(visible[0].canDelete, false);
  f.setOwner('other-publisher');
  await assert.rejects(f.backend.removeSharedPost(post.id), /does not own/);
  assert.equal(f.rows.length, 1);
});

test('retrying publication does not duplicate the existing post', async () => {
  const f = fixture();
  await f.backend.publishSharedPost(post);
  await f.backend.publishSharedPost(post);
  assert.equal(f.rows.length, 1);
});

test('photos become shared URLs and are removed with the owner post', async () => {
  const f = fixture();
  const result = await f.backend.publishSharedPost({ ...post, image: 'data:image/jpeg;base64,YQ==' });
  assert.equal(result.image, 'https://storage.example/publisher/test-id.jpg');
  assert.equal(result.canDelete, true);
  assert.equal(f.rows[0].payload.canDelete, undefined);
  await f.backend.removeSharedPost(post.id);
  assert.equal(f.rows.length, 0);
  assert.deepEqual(f.removed, ['publisher/test-id.jpg']);
});

test('failed database publication cleans up the uploaded photo', async () => {
  const f = fixture();
  f.failInsert();
  await assert.rejects(f.backend.publishSharedPost({ ...post, image: 'data:image/jpeg;base64,YQ==' }), /not published/);
  assert.equal(f.rows.length, 0);
  assert.deepEqual(f.removed, ['publisher/test-id.jpg']);
});

test('exact photo GPS is never published, capture time is kept', async () => {
  const f = fixture();
  await f.backend.publishSharedPost({ ...post, id: 'gps-post', takenAt: '2026-10-03T06:22:05.000Z', photoGps: { lat: 22.2801, lng: 114.155 } });
  assert.equal(f.rows[0].payload.photoGps, undefined);
  assert.equal(f.rows[0].payload.takenAt, '2026-10-03T06:22:05.000Z');
});
