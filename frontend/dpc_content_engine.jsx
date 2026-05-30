import React, { useState } from 'react';

// DPC Content Engine — Digital Plug Co.
// AI-powered content creation and publishing dashboard

const PLATFORMS = ['Instagram', 'Facebook', 'Twitter/X', 'LinkedIn', 'TikTok'];
const CONTENT_TYPES = ['Short-Form Post', 'Long-Form Article', 'Product Promo', 'Cannabis Education', 'Community Update'];

export default function DPCContentEngine() {
  const [platform, setPlatform] = useState('Instagram');
  const [contentType, setContentType] = useState('Short-Form Post');
  const [topic, setTopic] = useState('');
  const [generated, setGenerated] = useState('');
  const [queue, setQueue] = useState([]);

  const generateContent = () => {
    const templates = {
      'Short-Form Post': `🔥 ${topic} | Digital Plug Co. bringing you the best in the game. Drop a comment if you want in. #DigitalPlug #AXIOM #Cannabis`,
      'Long-Form Article': `## ${topic}\n\nAt Digital Plug Co., we believe in building systems that work while you sleep. Our AXIOM AI stack handles lead gen, content, and closing — so you don't have to.\n\n### Key Takeaways\n- Automated lead pipeline\n- AI content generation\n- Real-time revenue routing`,
      'Product Promo': `🌱 NEW DROP: ${topic} | Premium quality, fast shipping. DM us to order or visit our store. Limited supply. #DPC #MerchDrop`,
      'Cannabis Education': `🌿 Did you know? ${topic} is one of the most misunderstood topics in the cannabis space. Here's what the research says... #CannabisEducation #DPC`,
      'Community Update': `📣 COMMUNITY UPDATE: ${topic} | We're building something real here at DPC. Stay locked in. #DigitalPlugCo #Community`
    };
    setGenerated(templates[contentType] || `Generated content for: ${topic}`);
  };

  const addToQueue = () => {
    if (generated) {
      setQueue(prev => [...prev, { platform, contentType, content: generated, status: 'queued' }]);
      setGenerated('');
      setTopic('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff', fontFamily: 'Inter, sans-serif', padding: 32 }}>
      <h1 style={{ color: '#00b894', letterSpacing: 2, marginBottom: 4 }}>DPC CONTENT ENGINE</h1>
      <p style={{ color: '#636e72', marginBottom: 32 }}>AI-Powered Content Creation — Digital Plug Co.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div>
          <label style={{ color: '#a29bfe', display: 'block', marginBottom: 8 }}>Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)}
            style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: '1px solid #16213e', borderRadius: 8, padding: 10 }}>
            {PLATFORMS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: '#a29bfe', display: 'block', marginBottom: 8 }}>Content Type</label>
          <select value={contentType} onChange={e => setContentType(e.target.value)}
            style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: '1px solid #16213e', borderRadius: 8, padding: 10 }}>
            {CONTENT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ color: '#a29bfe', display: 'block', marginBottom: 8 }}>Topic / Product / Subject</label>
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. New merch drop, cannabis benefits, lead gen tips"
          style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: '1px solid #16213e', borderRadius: 8, padding: 10, boxSizing: 'border-box' }} />
      </div>

      <button onClick={generateContent}
        style={{ background: '#00b894', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 700, marginRight: 12 }}>
        Generate Content
      </button>

      {generated && (
        <div style={{ background: '#1a1a2e', border: '1px solid #00b894', borderRadius: 8, padding: 16, marginTop: 24 }}>
          <h3 style={{ color: '#00b894', marginTop: 0 }}>Generated Content</h3>
          <pre style={{ color: '#dfe6e9', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{generated}</pre>
          <button onClick={addToQueue}
            style={{ background: '#a29bfe', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 700 }}>
            Add to Publish Queue
          </button>
        </div>
      )}

      {queue.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ color: '#a29bfe' }}>Publish Queue ({queue.length})</h2>
          {queue.map((item, i) => (
            <div key={i} style={{ background: '#1a1a2e', border: '1px solid #16213e', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <span style={{ color: '#00b894', fontWeight: 700 }}>{item.platform}</span>
              <span style={{ color: '#636e72', marginLeft: 12 }}>{item.contentType}</span>
              <p style={{ color: '#dfe6e9', margin: '8px 0 0', fontSize: 14 }}>{item.content.substring(0, 100)}...</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
