import { useEffect, useMemo, useState } from 'react';

const storyTypes = ['Architecture', 'Local Food', "People's Memories", 'Official History'];

const initialPosts = [
  { id: 1, kind: 'tourist', era: 'MODERN', place: 'Western Market', author: 'Mia · Visitor', text: 'Rain made the red bricks look freshly painted.', image: 'https://images.unsplash.com/photo-1536599018102-9f803c140fc1?auto=format&fit=crop&w=700&q=80' },
  { id: 2, kind: 'local', era: 'ARCHIVAL', place: 'Des Voeux Road', author: 'Uncle Ming · Local voice', text: 'My father took this tram to work every morning in 1968.', image: 'https://images.unsplash.com/photo-1531219572328-a0171b4448a3?auto=format&fit=crop&w=700&q=80' },
  { id: 3, kind: 'tourist', era: 'MODERN', place: 'Sheung Wan', author: 'Kai · Visitor', text: 'The dried seafood shops have their own rhythm.', image: 'https://images.unsplash.com/photo-1506970845246-18f21d533b20?auto=format&fit=crop&w=700&q=80' },
  { id: 4, kind: 'local', era: 'ARCHIVAL', place: 'Wan Chai', author: 'Mrs. Lee · Resident', text: 'Before the towers, neighbours gathered here for evening tea.', image: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=700&q=80' },
];

function Onboarding({ onFinish }) {
  const [identity, setIdentity] = useState('Tourist');
  const [interests, setInterests] = useState(['Architecture', 'Official History']);

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
          {['Tourist', 'Local Resident', 'Family'].map((item) => <button key={item} className={identity === item ? 'chip active' : 'chip'} onClick={() => setIdentity(item)}>{item}</button>)}
        </div>
      </section>

      <section className="quiz-card">
        <div className="question-number">02</div>
        <h2>What stories are you looking for?</h2>
        <div className="chips">
          {storyTypes.map((item) => <button key={item} className={interests.includes(item) ? 'chip active' : 'chip'} onClick={() => toggle(item)}>{item}</button>)}
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

function MapPin({ className, src, count }) {
  return <button className={`map-pin ${className}`} aria-label="Community memory"><img src={src} alt="" />{count && <b>{count}</b>}</button>;
}

function PlayerSheet({ onClose }) {
  const [mode, setMode] = useState('official');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(34);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setProgress((value) => value >= 100 ? 0 : value + 1), 350);
    return () => window.clearInterval(timer);
  }, [playing]);

  return <div className={`player-sheet ${mode}`}>
    <div className="sheet-handle" />
    <button className="close" onClick={onClose}>×</button>
    <span className="eyebrow">TRAM ROUTE · SHEUNG WAN → WAN CHAI</span>
    <h2>{mode === 'official' ? 'Western Market: A Living Landmark' : 'The Bell That Marked Supper Time'}</h2>
    <div className="mode-toggle">
      <button className={mode === 'official' ? 'active' : ''} onClick={() => setMode('official')}>Official Heritage</button>
      <button className={mode === 'civilian' ? 'active' : ''} onClick={() => setMode('civilian')}>Civilian Voices</button>
    </div>
    <div className="source-line">{mode === 'official' ? '✓ Source-grounded · Antiquities & Monuments Office' : '✦ AI curated from 8 approved community stories'}</div>
    <div className="player-row">
      <button className="play" onClick={() => setPlaying((value) => !value)}>{playing ? 'Ⅱ' : '▶'}</button>
      <div className="progress-wrap"><div className="progress"><span style={{ width: `${progress}%` }} /></div><div className="time"><span>Approaching Western Market</span><span>2:18</span></div></div>
    </div>
    <div className="stops"><span className="done">Sheung Wan</span><span className="current">Western Market</span><span>Central</span><span>Wan Chai</span></div>
  </div>;
}

function MapScreen() {
  const [destination, setDestination] = useState('');
  const [routeReady, setRouteReady] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    if (!destination.trim()) setDestination('Wan Chai');
    setRouteReady(true);
  };

  return <section className="screen map-screen page-enter">
    <div className="map-canvas">
      <div className="water"><span>VICTORIA HARBOUR</span></div>
      <div className="road road-one"/><div className="road road-two"/><div className="tram-line"/>
      <span className="district central">CENTRAL</span><span className="district sheungwan">SHEUNG WAN</span><span className="district wanchai">WAN CHAI</span>
      <MapPin className="pin-one" src={initialPosts[0].image} count="3" />
      <MapPin className="pin-two" src={initialPosts[1].image} />
      <MapPin className="pin-three" src={initialPosts[2].image} count="6" />
      <button className="location-dot" title="Your location" />
    </div>
    <header className="floating-header"><span className="brand-mark">LR</span><div><b>Living Routes</b><small>Hong Kong · 香港</small></div><button className="avatar">JJ</button></header>
    <form className="route-search" onSubmit={submit}><span>⌕</span><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Enter destination…"/><button type="submit">Route</button></form>
    {!routeReady && <div className="map-hint"><b>Stories live on every street.</b><span>Search a destination to generate your route.</span></div>}
    {routeReady && !playerOpen && <div className="route-card page-enter">
      <div className="sheet-handle"/><span className="eyebrow">AI STORY TRACK READY</span><h2>Sheung Wan → {destination || 'Wan Chai'}</h2>
      <div className="route-stats"><div><b>24 min</b><span>Journey</span></div><div><b>4</b><span>Heritage stops</span></div><div><b>6</b><span>Local voices</span></div></div>
      <p>Story length is adapted to your travel time and interests.</p>
      <button className="primary wide" onClick={() => setPlayerOpen(true)}>Begin Route <span>▶</span></button>
    </div>}
    {playerOpen && <PlayerSheet onClose={() => setPlayerOpen(false)} />}
  </section>;
}

function CommunityScreen() {
  const [filter, setFilter] = useState('all');
  const [posts, setPosts] = useState(initialPosts);
  const [composer, setComposer] = useState(false);
  const visiblePosts = filter === 'all' ? posts : posts.filter((post) => post.kind === filter);

  const addPost = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPosts((current) => [{ id: Date.now(), kind: 'tourist', era: 'MODERN', place: form.get('place') || 'Current location', author: 'You · Visitor', text: form.get('memory') || 'A new memory on the city map.', image: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=700&q=80' }, ...current]);
    setComposer(false);
  };

  return <section className="screen community-screen page-enter">
    <header className="section-header"><span className="eyebrow">THE CITY REMEMBERS</span><h1>Community</h1><p>New footsteps meet stories passed down through generations.</p></header>
    <div className="segmented"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All stories</button><button className={filter === 'tourist' ? 'active' : ''} onClick={() => setFilter('tourist')}>Tourist Footprints</button><button className={filter === 'local' ? 'active' : ''} onClick={() => setFilter('local')}>Local Legends</button></div>
    <div className="post-grid">{visiblePosts.map((post) => <article className="post-card" key={post.id}><div className="post-image"><img src={post.image} alt={post.place}/><span>{post.era}</span></div><div className="post-copy"><small>⌖ {post.place}</small><p>{post.text}</p><b>{post.author}</b></div></article>)}</div>
    <button className="fab" onClick={() => setComposer(true)}>＋</button>
    {composer && <div className="modal-backdrop"><form className="compose-card" onSubmit={addPost}><button type="button" className="close" onClick={() => setComposer(false)}>×</button><span className="eyebrow">LEAVE A TRACE</span><h2>Add to the city’s memory</h2><label>Place<input name="place" placeholder="e.g. Western Market"/></label><label>Your story<textarea name="memory" placeholder="What happened here?"/></label><label className="upload">＋ Add a photo <input type="file" accept="image/*"/></label><button className="primary wide">Post to Community</button></form></div>}
  </section>;
}

function JournalScreen() {
  const [memories, setMemories] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  const addMemory = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('photo');
    setMemories((current) => [...current, { id: Date.now(), place: form.get('place') || 'Sheung Wan', text: form.get('text') || 'A quiet moment between tram bells.', image: file?.size ? URL.createObjectURL(file) : null }]);
    event.currentTarget.reset();
  };

  const generate = () => {
    setLoading(true); setGenerated(false);
    window.setTimeout(() => { setLoading(false); setGenerated(true); }, 1200);
  };

  return <section className="screen journal-screen page-enter">
    <div className="private-banner">▣ <b>Private · Only you can see this</b></div>
    <header className="section-header"><span className="eyebrow">YOUR TIME-WOVEN JOURNEY</span><h1>Private Journal</h1><p>Gather fragments now. Let AI weave them into a story when the journey ends.</p></header>
    <form className="memory-form" onSubmit={addMemory}><label className="upload large">＋<b>Add a journey photo</b><small>Private by default</small><input type="file" name="photo" accept="image/*"/></label><div className="form-row"><input name="place" placeholder="Place"/><textarea name="text" placeholder="What did this moment feel like?"/></div><button className="secondary">Save Memory</button></form>
    {memories.length > 0 && <div className="memory-list">{memories.map((memory, index) => <article key={memory.id}>{memory.image ? <img src={memory.image} alt=""/> : <div className="memory-placeholder">{String(index + 1).padStart(2, '0')}</div>}<div><small>{memory.place}</small><p>{memory.text}</p></div></article>)}</div>}
    <button className="generate-button" onClick={generate} disabled={loading}>✦ {loading ? 'Weaving your memories…' : 'Generate AI Journey Log'}</button>
    {generated && <div className="generated-log page-enter"><span className="eyebrow">GENERATED FROM YOUR ROUTE + MEMORIES</span><h2>Between Tram Bells and Rain</h2><div className="chapter"><i>01</i><div><small>SHEUNG WAN · 10:42</small><h3>The Morning Finds Its Rhythm</h3><p>The city arrived first as sound: a tram bell, shop shutters rising, and a story carried from another generation.</p></div></div><div className="chapter"><i>02</i><div><small>WESTERN MARKET · 11:18</small><h3>Red Brick, New Footsteps</h3><p>Your route crossed an old landmark, where today’s rain briefly made history feel newly painted.</p></div></div><button className="secondary wide">Export Memory Story</button></div>}
  </section>;
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState('map');
  const content = useMemo(() => ({ map: <MapScreen />, community: <CommunityScreen />, journal: <JournalScreen /> })[active], [active]);

  if (!profile) return <Onboarding onFinish={setProfile} />;
  return <div className="app-shell">{content}<BottomNav active={active} setActive={setActive}/></div>;
}
