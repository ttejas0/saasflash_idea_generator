import { useState, useEffect } from 'react';
import { Lightbulb, Check, X, SkipForward, RefreshCw, Zap } from 'lucide-react';

interface Idea {
  id: number;
  title: string;
  idea_type: 'product' | 'content' | 'operations';
  audience: string[];
  news: string;
  attention_point: string;
  angle_1: string;
  angle_2: string;
  tags: string[];
  status: string;
  source_item_ids: string[];
}

function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<string | null>(null);
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchIdeas();
  }, [activeTab]);

  const fetchIdeas = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'today' ? '/api/ideas/today' : `/api/ideas/${activeTab}`;
      console.log(`[frontend] Fetching ideas from: ${endpoint}`);
      const res = await fetch(endpoint);
      const data = await res.json();
      console.log(`[frontend] Response status: ${res.status}, ideas count: ${data.ideas?.length ?? 0}`);

      // Validate data shape
      if (data.ideas?.length > 0) {
        const sample = data.ideas[0];
        console.log('[frontend] Sample idea:', {
          id: sample.id,
          title: sample.title?.slice(0, 50),
          idea_type: sample.idea_type,
          audience_type: typeof sample.audience,
          audience_isArray: Array.isArray(sample.audience),
          audience: sample.audience,
          tags_type: typeof sample.tags,
          tags_isArray: Array.isArray(sample.tags),
          tags: sample.tags,
          news_length: sample.news?.length,
          attention_point_length: sample.attention_point?.length,
          angle_1_length: sample.angle_1?.length,
          angle_2_length: sample.angle_2?.length,
        });
      }

      setIdeas(data.ideas || []);
    } catch (err) {
      console.error('[frontend] Failed to fetch ideas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (ideaId: number, action: 'approved' | 'rejected' | 'skipped') => {
    // Optimistic UI update
    setIdeas(ideas.filter(idea => idea.id !== ideaId));
    
    try {
      await fetch(`/api/ideas/${ideaId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
    } catch (err) {
      console.error('Failed to submit feedback', err);
      // Revert if failed (in a real app)
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      setGenerateStatus('Fetching latest sources...');
      console.log('[frontend] Starting source fetch...');
      const fetchRes = await fetch('/api/admin/fetch-sources', {
        method: 'POST',
      });
      const fetchData = await fetchRes.json();
      console.log('[frontend] Source fetch result:', fetchData);

      setGenerateStatus('Synthesizing ideas...');
      console.log('[frontend] Starting idea generation...');
      const genRes = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 5, runType: 'manual' })
      });
      const genData = await genRes.json();
      console.log('[frontend] Generation result:', genData);

      if (activeTab === 'today') {
        fetchIdeas();
      }
    } catch (err) {
      console.error('[frontend] Failed to generate:', err);
    } finally {
      setGenerating(false);
      setGenerateStatus(null);
    }
  };

  const filteredIdeas = ideas.filter(idea => 
    typeFilter ? idea.idea_type === typeFilter : true
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Lightbulb size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h1>SaaS Flash</h1>
            <p className="date-display" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.2rem' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
        
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'today' ? 'active' : ''}`}
            onClick={() => setActiveTab('today')}
          >
            Today's Ideas
          </button>
          <button 
            className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            Approved
          </button>
          <button 
            className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
            onClick={() => setActiveTab('rejected')}
          >
            Rejected
          </button>
        </div>
        
        <button 
          className="generate-btn"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
          {generating ? (generateStatus || 'Generating...') : 'Generate More'}
        </button>
      </header>
      
      {activeTab === 'today' && (
        <div className="filters">
          <button 
            className={`filter-btn ${typeFilter === null ? 'active' : ''}`}
            onClick={() => setTypeFilter(null)}
          >
            All
          </button>
          <button 
            className={`filter-btn ${typeFilter === 'product' ? 'active' : ''}`}
            onClick={() => setTypeFilter('product')}
          >
            Products
          </button>
          <button 
            className={`filter-btn ${typeFilter === 'content' ? 'active' : ''}`}
            onClick={() => setTypeFilter('content')}
          >
            Content
          </button>
          <button 
            className={`filter-btn ${typeFilter === 'operations' ? 'active' : ''}`}
            onClick={() => setTypeFilter('operations')}
          >
            Operations
          </button>
        </div>
      )}

      {loading ? (
        <div className="state-message">
          <RefreshCw className="animate-spin state-icon" size={32} />
          <p>Loading ideas...</p>
        </div>
      ) : filteredIdeas.length === 0 ? (
        <div className="state-message">
          <Lightbulb className="state-icon" size={32} />
          <p>No ideas found. Try generating some!</p>
        </div>
      ) : (
        <div className="ideas-grid">
          {filteredIdeas.map((idea) => (
            <div key={idea.id} className="idea-card">
              <div className="card-header">
                <h2 className="card-title">{idea.title}</h2>
              </div>
              
              <div className="badges">
                <span className={`badge type-${idea.idea_type}`}>
                  {idea.idea_type}
                </span>
                {idea.audience.map(aud => (
                  <span key={aud} className="badge audience">{aud}</span>
                ))}
              </div>
              
              <div className="card-section">
                <span className="section-label">News</span>
                <p className="section-content">{idea.news}</p>
              </div>
              
              <div className="card-section">
                <span className="section-label">Pay Attention To</span>
                <p className="section-content opportunity-text">{idea.attention_point}</p>
              </div>
              
              <div className="card-section">
                <span className="section-label">Angle 1</span>
                <p className="section-content">{idea.angle_1}</p>
              </div>

              <div className="card-section">
                <span className="section-label">Angle 2</span>
                <p className="section-content">{idea.angle_2}</p>
              </div>
              
              <div className="tags">
                {idea.tags.map(tag => (
                  <span key={tag} className="tag">#{tag}</span>
                ))}
              </div>
              
              {activeTab === 'today' && (
                <div className="card-actions">
                  <button 
                    className="action-btn btn-reject"
                    onClick={() => handleFeedback(idea.id, 'rejected')}
                  >
                    <X size={18} /> Reject
                  </button>
                  <button 
                    className="action-btn btn-skip"
                    onClick={() => handleFeedback(idea.id, 'skipped')}
                  >
                    <SkipForward size={18} /> Skip
                  </button>
                  <button 
                    className="action-btn btn-approve"
                    onClick={() => handleFeedback(idea.id, 'approved')}
                  >
                    <Check size={18} /> Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
