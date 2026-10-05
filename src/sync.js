/* Family sync, backed by Firebase (Auth + Firestore). Same approach as Reading Quest.
 *
 * Cloud layout, per family account (uid):
 *   families/{uid}/math/meta        { kids: {id: kid}, settings }
 *   families/{uid}/math/s-YYYY-MM   { sessions: {id: session} }   (one doc per month)
 *
 * Every record is written at its own field path, so two devices changing different things at the same time
 * never overwrite each other. localStorage stays the device's working copy; Firestore's offline cache
 * queues writes made offline. */

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const COLLECTION = 'math';
const APP_NAME = 'math-champion'; // its own Firebase app instance, so it never mixes caches with Reading Quest
const cfg = globalThis.MATH_CHAMPION_FIREBASE;
const enabled = !!(cfg && cfg.apiKey && cfg.projectId);
const DELETE = Symbol('delete');

let fb = null;
let hooks = null;
let user = null;
let unsub = null;
let live = false;
let cloud = new Map(); // record key -> { doc, field, json } as last seen in (or sent to) the cloud
let status = enabled ? 'loading' : 'off';
let error = '';

// Stable JSON (sorted keys) so the same record always compares equal, whatever order Firestore returns fields in.
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]]))
  : x));

function setStatus(s, e = '') {
  status = s;
  error = e;
  hooks?.onStatus();
}

async function sdk() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all(['app', 'auth', 'firestore'].map((n) => import(`${SDK}firebase-${n}.js`)));
  const a = app.initializeApp(cfg, APP_NAME);
  const au = auth.getAuth(a);
  let db;
  try {
    db = fs.initializeFirestore(a, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch {
    db = fs.getFirestore(a);
  }
  if (cfg.emulator) {
    auth.connectAuthEmulator(au, `http://${cfg.emulator}:9099`, { disableWarnings: true });
    fs.connectFirestoreEmulator(db, cfg.emulator, 8080);
  }
  fb = { auth, fs, au, db };
  return fb;
}

function rec(doc, field, value) {
  const json = canon(value);
  return { doc, field, json, value: JSON.parse(json) };
}

function localRecords(st) {
  const m = new Map();
  for (const k of st.kids) m.set(`kids/${k.id}`, rec('meta', ['kids', k.id], k));
  for (const s of st.sessions) m.set(`sessions/${s.id}`, rec(`s-${String(s.date || '').slice(0, 7) || 'undated'}`, ['sessions', s.id], s));
  m.set('settings', rec('meta', ['settings'], st.settings || {}));
  return m;
}

function cloudRecords(snap) {
  const m = new Map();
  snap.forEach((d) => {
    const data = d.data();
    if (d.id === 'meta') {
      for (const [id, v] of Object.entries(data.kids || {})) m.set(`kids/${id}`, rec('meta', ['kids', id], v));
      if (data.settings) m.set('settings', rec('meta', ['settings'], data.settings));
    } else if (d.id.startsWith('s-')) {
      for (const [id, v] of Object.entries(data.sessions || {})) m.set(`sessions/${id}`, rec(d.id, ['sessions', id], v));
    }
  });
  return m;
}

function toState(recs) {
  const out = { kids: [], sessions: [], settings: {} };
  for (const [key, r] of recs) {
    if (key === 'settings') out.settings = r.value;
    else out[key.slice(0, key.indexOf('/'))].push(r.value);
  }
  out.kids.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  out.sessions.sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  return out;
}

const sameAsCloud = (local) => local.size === cloud.size && [...local].every(([k, r]) => cloud.get(k)?.json === r.json);

function onSnapshot(snap) {
  // Offline with nothing cached yet: wait for the server rather than treating the family as empty.
  if (!live && snap.empty && snap.metadata.fromCache) return;
  const remote = cloudRecords(snap);
  if (!live) {
    // First contact on this device: keep the family's cloud data and add anything only this device has.
    const merged = new Map(remote);
    for (const [k, r] of localRecords(hooks.get())) {
      if (!merged.has(k) && !(k === 'settings' && r.json === '{}')) merged.set(k, r);
    }
    cloud = remote;
    live = true;
    hooks.apply(toState(merged)); // saving pushes the device-only records up
  } else {
    cloud = remote;
    if (!sameAsCloud(localRecords(hooks.get()))) hooks.apply(toState(remote));
  }
  setStatus(snap.metadata.hasPendingWrites ? 'syncing' : 'synced');
}

/** Send every record that differs from what the cloud has. Called after each local save. */
function push() {
  if (!live || !fb || !user) return;
  const local = localRecords(hooks.get());
  const byDoc = new Map();
  const add = (doc, field, value) => (byDoc.get(doc) || byDoc.set(doc, []).get(doc)).push([field, value]);
  for (const [key, r] of local) {
    const c = cloud.get(key);
    if (c && c.json === r.json && c.doc === r.doc) continue;
    if (c && c.doc !== r.doc) add(c.doc, c.field, DELETE);
    add(r.doc, r.field, r.value);
  }
  for (const [key, c] of cloud) if (!local.has(key)) add(c.doc, c.field, DELETE);
  if (!byDoc.size) return;

  const { fs, db } = fb;
  const batch = fs.writeBatch(db);
  for (const [doc, ops] of byDoc) {
    const ref = fs.doc(db, 'families', user.uid, COLLECTION, doc);
    batch.set(ref, { updatedAt: fs.serverTimestamp() }, { merge: true });
    const [first, ...rest] = ops.flatMap(([field, v]) => [new fs.FieldPath(...field), v === DELETE ? fs.deleteField() : v]);
    batch.update(ref, first, ...rest);
  }
  cloud = local; // what the cloud will hold once this lands; avoids resending
  setStatus('syncing');
  batch.commit().catch((e) => setStatus('error', friendly(e)));
}

function friendly(e) {
  const code = e?.code || '';
  const msgs = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No family account with that email.',
    'auth/email-already-in-use': 'That email already has a family account. Sign in instead.',
    'auth/weak-password': 'Pick a password with at least 6 characters.',
    'auth/invalid-email': "That email address doesn't look right.",
    'auth/missing-password': 'Type a password.',
    'auth/network-request-failed': "Can't reach the internet right now.",
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/operation-not-allowed': 'Email sign-in is not turned on in Firebase (see SYNC-SETUP.md).',
    'auth/unauthorized-domain': 'This website is not on the Firebase "Authorized domains" list (see SYNC-SETUP.md).',
    'permission-denied': 'Firebase blocked this. Check the security rules (see SYNC-SETUP.md).',
  };
  return msgs[code] || e?.message || 'Something went wrong.';
}

async function init(h) {
  hooks = h;
  if (!enabled) return;
  try {
    const { auth, fs, au, db } = await sdk();
    auth.onAuthStateChanged(au, (u) => {
      unsub?.();
      unsub = null;
      live = false;
      cloud = new Map();
      user = u;
      if (!u) { setStatus('signed-out'); return; }
      setStatus('syncing');
      unsub = fs.onSnapshot(fs.collection(db, 'families', u.uid, COLLECTION), onSnapshot, (e) => setStatus('error', friendly(e)));
    });
  } catch {
    setStatus('error', "Couldn't load sync. Are you online?");
  }
}

async function withAuth(fn) {
  const { auth, au } = await sdk();
  try {
    return await fn(auth, au);
  } catch (e) {
    throw new Error(friendly(e));
  }
}

export const Sync = {
  get enabled() { return enabled; },
  get status() { return status; },
  get error() { return error; },
  get email() { return user?.email || ''; },
  init,
  push,
  signIn: (email, pw) => withAuth((a, au) => a.signInWithEmailAndPassword(au, email, pw)),
  signUp: (email, pw) => withAuth((a, au) => a.createUserWithEmailAndPassword(au, email, pw)),
  resetPassword: (email) => withAuth((a, au) => a.sendPasswordResetEmail(au, email)),
  signOut: () => withAuth((a, au) => a.signOut(au)),
};
