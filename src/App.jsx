import { useEffect, useMemo, useState } from 'react';
import { mockPosts } from './data/mockPosts.js';
import { identityOptions, interestOptions } from './data/options.js';
import { addPost, generateJourneyLog, getPosts, getRoute, getStoryForJourney } from './services/index.js';

function Onboarding({ onFinish }) {
  const [identity, setIdentity] = useState('visitor');
  const [interests, setInterests] = useState(['Architecture', 'Official History']);
  const selectedIdentity = identityOptions.find((item) => item.value === identity);

  const toggle = (value) => setInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  return <main className="onboarding page-enter">
    <div className="hero-photo" />
    <div className="onboarding-content">
      <span className="eyebrow">LIVING ROUTES HK · 城市声线</span>
      <h1>Discover Your<br/><em>Hong Kong</em></h1>
      <p className="intro">Tell us what moves you. We will shape the city’s stories around your journey.</p>

      <section className="quiz-card">
        <div className="question-number">01</div>
        <h2>Who are you?</h2>
        <div className="chips single">
          {identityOptions.map((item) => <button key={item.value} className={identity === item.value ? 'chip active' : 'chip'} onClick={() => setIdentity(item.value)}>{item.label}</button>)}
        </div>
        <p className="choice-note">{selectedIdentity?.description}</p>
      </section>

      <section className="quiz-card">
        <div className="question-number">02</div>
        <h2>What stories are you looking for?</h2>
        <div className="chips">
          {interestOptions.map((item) => <button key={item} className={interests.includes(item) ? 'chip active' : 'chip'} onClick={() => toggle(item)}>{item}</button>)}
        </div>
      </section>

      <button className="primary wide" onClick={() => onFinish({ identity, interests })}>Start Journey <span>→</span></button>
      <p className="privacy-note">Your interests stay on this device for this prototype.</p>
    </div>
  </main>;
}

function BottomNav({ active, setActive }) {
  const tabs = [
    ['map', '⌖', 'Map'],
    ['community', '◫', 'Community'],
    ['journal', '▤', 'Private Journal'],
  ];
  return <nav className="bottom-nav">
    {tabs.map(([id, icon, label]) => <button key={id} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(id)}>
      <span className="nav-icon">{icon}</span><span>{label}</span>
    </button>)}
  </nav>;
}

function MapPin({ className, src, count, label }) {
  return <button className={`map-pin ${className}`} aria-label={`Community memory at ${label}`}>
    {src ? <img src={src} alt="" /> : <span className="map-pin-placeholder">{label?.slice(0, 2).toUpperCase()}</span>}
    {count && <b>{count}</b>}
  </button>;
}

function PlayerSheet({ onClose, profile }) {
  const [mode, setMode] = useState('official');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [storyResult, setStoryResult] = useState(null);
  const [trackNotice, setTrackNotice] = useState('');

  const changeMode = (nextMode) => {
    if (nextMode === mode) return;
    setPlaying(false);
    setProgress(0);
    setTrackNotice(`Switched to ${nextMode === 'official' ? 'Official Heritage' : 'Civilian Voices'} · press play when ready`);
    setMode(nextMode);
  };

  useEffect(() => {
    let cancelled = false;
    getStoryForJourney({
      placeId: 'central-market',
      track: mode,
      remainingTimeSec: 45,
      interests: profile?.interests || [],
      audience: profile?.identity || 'visitor',
    }).then((result) => {
      if (!cancelled) setStoryResult(result);
    });
    return () => { cancelled = true; };
  }, [mode, profile]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setProgress((value) => value >= 100 ? 0 : value + 1), 350);
    return () => window.clearInterval(timer);
  }, [playing]);

  return <div className={`player-sheet ${mode}`}>
    <div className="sheet-handle" />
    <button className="close" onClick={onClose}>×</button>
    <span className="eyebrow">CITYBUS 1 · CENTRAL → HAPPY VALLEY</span>
    <h2>{storyResult?.story.title || 'Loading story…'}</h2>
    <div className="mode-toggle">
      <button className={mode === 'official' ? 'active' : ''} onClick={() => changeMode('official')}>Official Heritage</button>
      <button className={mode === 'civilian' ? 'active' : ''} onClick={() => changeMode('civilian')}>Civilian Voices</button>
    </div>
    <div className="source-line">{mode === 'official' ? '✓ Source-grounded · official source attached' : '✦ Demo civilian sample · not a verified resident submission'}</div>
    <div className="player-row">
      <button className="play" onClick={() => { setTrackNotice(''); setPlaying((value) => !value); }}>{playing ? 'Ⅱ' : '▶'}</button>
      <div className="progress-wrap"><div className="progress"><span style={{ width: `${progress}%` }} /></div><div className="time"><span>{trackNotice || 'Approaching Central Market'}</span><span>{storyResult?.story.durationSec || 30}s story</span></div></div>
    </div>
    <div className="stops"><span className="done">Macao Ferry</span><span className="current">Central Market</span><span>Wan Chai</span><span>Happy Valley</span></div>
  </div>;
}

function MapScreen({ profile }) {
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const requestedDestination = destination.trim() || 'Happy Valley';
    setDestination(requestedDestination);
    setLoading(true);
    const nextRoute = await getRoute({ destination: requestedDestination, mode: 'demo' });
    setRoute(nextRoute);
    setLoading(false);
  };

  return <section className="screen map-screen page-enter">
    <div className="map-canvas">
      <div className="water"><span>VICTORIA HARBOUR</span></div>
      <div className="road road-one"/><div className="road road-two"/><div className="tram-line"/>
      <span className="district central">CENTRAL</span><span className="district sheungwan">SHEUNG WAN</span><span className="district wanchai">WAN CHAI</span>
      <MapPin className="pin-one" src={mockPosts[0].image} label="Central Market" count="3" />
      <MapPin className="pin-two" src={mockPosts[1].image} label="Lee Tung Street" />
      <MapPin className="pin-three" src={mockPosts[2].image} label="Blue House" count="6" />
      <button className="location-dot" title="Your location" />
    </div>
    <header className="floating-header"><span className="brand-mark">LR</span><div><b>Living Routes</b><small>Hong Kong · 香港</small></div><button className="avatar">JJ</button></header>
    <form className="route-search" onSubmit={submit}><span>⌕</span><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Enter destination…"/><button type="submit">Route</button></form>
    {!route && <div className="map-hint"><b>{loading ? 'Preparing Route 1…' : 'Stories live on every street.'}</b><span>Search a destination to generate your route.</span></div>}
    {route && !playerOpen && <div className="route-card page-enter">
      <div className="sheet-handle"/><span className="eyebrow">AI STORY TRACK READY · CITYBUS 1</span><h2>{route.origin} → {route.destination}</h2>
      <div className="route-stats"><div><b>{route.estimatedDurationMin} min</b><span>Journey</span></div><div><b>{route.storyPoints.length}</b><span>Heritage points</span></div><div><b>2</b><span>Story tracks</span></div></div>
      <p>Story length is adapted to your travel time and interests.</p>
      <button className="primary wide" onClick={() => setPlayerOpen(true)}>Begin Route <span>▶</span></button>
    </div>}
    {playerOpen && <PlayerSheet profile={profile} onClose={() => setPlayerOpen(false)} />}
  </section>;
}

function CommunityScreen() {
  const [filter, setFilter] = useState('all');
  const [posts, setPosts] = useState(mockPosts);
  const [composer, setComposer] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPosts({ filter }).then((result) => {
      if (!cancelled) setPosts(result);
    });
    return () => { cancelled = true; };
  }, [filter]);

  const submitPost = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('photo');
    const created = await addPost({
      photo: file?.size ? URL.createObjectURL(file) : undefined,
      text: form.get('memory'),
      location: form.get('place'),
      role: 'tourist',
      consent: form.get('consent') === 'on',
    });
    setPosts((current) => [created, ...current]);
    setComposer(false);
  };

  return <section className="screen community-screen page-enter">
    <header className="section-header"><span className="eyebrow">THE CITY REMEMBERS</span><h1>Community</h1><p>New footsteps meet stories passed down through generations.</p></header>
    <div className="segmented"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All stories</button><button className={filter === 'tourist' ? 'active' : ''} onClick={() => setFilter('tourist')}>Tourist Footprints</button><button className={filter === 'local' ? 'active' : ''} onClick={() => setFilter('local')}>Local Legends</button></div>
    <div className="post-grid">{posts.map((post) => <article className="post-card" key={post.id}><div className={`post-image ${post.image ? '' : 'placeholder'}`}>{post.image ? <img src={post.image} alt={post.place}/> : <div className="post-image-placeholder"><b>{post.place}</b><small>PHOTO NOT PROVIDED</small></div>}<span>{post.era}</span></div><div className="post-copy"><small>⌖ {post.place}</small><p>{post.text}</p><b>{post.author}</b></div></article>)}</div>
    <button className="fab" onClick={() => setComposer(true)}>＋</button>
    {composer && <div className="modal-backdrop"><form className="compose-card" onSubmit={submitPost}><button type="button" className="close" onClick={() => setComposer(false)}>×</button><span className="eyebrow">LEAVE A TRACE</span><h2>Add to the city’s memory</h2><label>Place<input name="place" placeholder="e.g. central-market"/></label><label>Your story<textarea name="memory" required placeholder="What happened here?"/></label><label className="upload">＋ Add a photo <input type="file" name="photo" accept="image/*"/></label><label><input type="checkbox" name="consent"/> Allow this post to be considered for AI curation</label><button className="primary wide">Post to Community</button></form></div>}
  </section>;
}

function JournalScreen() {
  const [memories, setMemories] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [loading, setLoading] = useState(false);

  const addMemory = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('photo');
    setMemories((current) => [...current, { id: Date.now(), place: form.get('place') || 'Central Market', text: form.get('text') || 'A quiet moment between stops.', image: file?.size ? URL.createObjectURL(file) : null }]);
    event.currentTarget.reset();
  };

  const generate = async () => {
    setLoading(true); setGenerated(null);
    const result = await generateJourneyLog({ memories, style: 'reflective', language: 'en' });
    setGenerated(result);
    setLoading(false);
  };

  return <section className="screen journal-screen page-enter">
    <div className="private-banner">▣ <b>Private · Only you can see this</b></div>
    <header className="section-header"><span className="eyebrow">YOUR TIME-WOVEN JOURNEY</span><h1>Private Journal</h1><p>Gather fragments now. Let AI weave them into a story when the journey ends.</p></header>
    <form className="memory-form" onSubmit={addMemory}><label className="upload large">＋<b>Add a journey photo</b><small>Private by default</small><input type="file" name="photo" accept="image/*"/></label><div className="form-row"><input name="place" placeholder="Place"/><textarea name="text" placeholder="What did this moment feel like?"/></div><button className="secondary">Save Memory</button></form>
    {memories.length > 0 && <div className="memory-list">{memories.map((memory, index) => <article key={memory.id}>{memory.image ? <img src={memory.image} alt=""/> : <div className="memory-placeholder">{String(index + 1).padStart(2, '0')}</div>}<div><small>{memory.place}</small><p>{memory.text}</p></div></article>)}</div>}
    <button className="generate-button" onClick={generate} disabled={loading}>✦ {loading ? 'Weaving your memories…' : 'Generate AI Journey Log'}</button>
    {generated && <div className="generated-log page-enter"><span className="eyebrow">GENERATED FROM YOUR ROUTE + MEMORIES</span><h2>{generated.title}</h2>{generated.chapters.map((chapter) => <div className="chapter" key={chapter.id}><i>{String(chapter.order).padStart(2, '0')}</i><div><small>{chapter.place.toUpperCase()} · {chapter.time}</small><h3>{chapter.title}</h3><p>{chapter.text}</p></div></div>)}<button className="secondary wide">Export Memory Story</button></div>}
  </section>;
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState('map');
  const content = useMemo(() => ({ map: <MapScreen profile={profile} />, community: <CommunityScreen />, journal: <JournalScreen /> })[active], [active, profile]);

  if (!profile) return <Onboarding onFinish={setProfile} />;
  return <div className="app-shell">{content}<BottomNav active={active} setActive={setActive}/></div>;
}
