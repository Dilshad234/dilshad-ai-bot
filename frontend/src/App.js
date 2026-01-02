import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { 
  Send, Plus, MessageSquare, Menu, Mic, 
  Trash2, Search, MoreVertical, Share2, Pin, Edit2 
} from 'lucide-react';

function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('edubuddy_history');
    return saved ? JSON.parse(saved) : [{ id: Date.now(), title: 'New Session', messages: [], pinned: false }];
  });
  
  const [activeId, setActiveId] = useState(sessions[0].id);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null); 
  const scrollRef = useRef(null);

  const activeSession = sessions.find(s => s.id === activeId) || sessions[0];

  useEffect(() => {
    localStorage.setItem('edubuddy_history', JSON.stringify(sessions));
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  useEffect(() => {
    const handleClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const currentInput = input;
    const userMsg = { role: 'user', content: currentInput };
    setInput('');

    setSessions(prev => prev.map(s => {
      if (s.id === activeId) {
        const isFirstMessage = s.messages.length === 0;
        const updatedTitle = isFirstMessage 
          ? (currentInput.length > 20 ? currentInput.substring(0, 20) + "..." : currentInput) 
          : s.title;
        
        return { ...s, title: updatedTitle, messages: [...s.messages, userMsg] };
      }
      return s;
    }));

    try {
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentInput }),
      });
      const data = await response.json();
      setSessions(prev => prev.map(s => 
        s.id === activeId ? { ...s, messages: [...s.messages, { role: 'assistant', content: data.answer }] } : s
      ));
    } catch (error) {
      console.error("Backend error:", error);
    }
  };

  const togglePin = (id) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s));
  };

  const renameSession = (id) => {
    const session = sessions.find(s => s.id === id);
    const newName = prompt("Rename chat:", session.title);
    if (newName) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newName } : s));
    }
  };

  const deleteSession = (id) => {
    if (sessions.length === 1) {
      const fresh = [{ id: Date.now(), title: 'New Session', messages: [], pinned: false }];
      setSessions(fresh);
      setActiveId(fresh[0].id);
    } else {
      const filtered = sessions.filter(s => s.id !== id);
      setSessions(filtered);
      if (activeId === id) setActiveId(filtered[0].id);
    }
  };

  return (
    <div className={`gemini-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <button className="menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu size={20} />
          </button>
          {isSidebarOpen && (
            <button className="sidebar-search-btn">
              <Search size={20} />
            </button>
          )}
        </div>
        
        <button className="new-chat-btn" onClick={() => {
          const newS = { id: Date.now(), title: 'New Session', messages: [], pinned: false };
          setSessions([newS, ...sessions]);
          setActiveId(newS.id);
        }}>
          <Plus size={20} /> {isSidebarOpen && <span>New chat</span>}
        </button>

        {isSidebarOpen && (
          <div className="history-section">
            <p className="section-label">Recent</p>
            {[...sessions].sort((a, b) => b.pinned - a.pinned).map(s => (
              <div 
                key={s.id} 
                className={`history-item ${activeId === s.id ? 'active' : ''}`} 
                onClick={() => setActiveId(s.id)}
              >
                <div className="history-item-left">
                  <MessageSquare size={16} />
                  <span>{s.title}</span>
                </div>

                <div className="item-menu-wrapper">
                  <button className="dots-btn" onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === s.id ? null : s.id);
                  }}>
                    <MoreVertical size={16} />
                  </button>

                  {menuOpenId === s.id && (
                    <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => alert("Link copied!")}><Share2 size={14} /> Share conversation</button>
                      <button onClick={() => togglePin(s.id)}><Pin size={14} /> {s.pinned ? "Unpin" : "Pin"}</button>
                      <button onClick={() => renameSession(s.id)}><Edit2 size={14} /> Rename</button>
                      <button className="delete-opt" onClick={() => deleteSession(s.id)}><Trash2 size={14} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="clear-history-btn" onClick={() => {
          if (window.confirm("Delete all chats?")) {
            const fresh = [{ id: Date.now(), title: 'New Session', messages: [], pinned: false }];
            setSessions(fresh);
            setActiveId(fresh[0].id);
          }
        }}>
          <Trash2 size={16} /> {isSidebarOpen && <span>Clear History</span>}
        </button>
      </aside>

      <main className="main-content">
        <header className="top-nav">
          <div className="branding-container">
            <div className="app-title">Dilshad's AI Bot <span>Professional</span></div>
            <div className="app-subtitle">All unified universities knowledge</div>
          </div>
          <div className="user-profile">DJ</div>
        </header>

        <section className="chat-area">
          {activeSession.messages.length === 0 ? (
            <div className="welcome-screen">
              <h1 className="hero-text">Hello, student.</h1>
              <p className="sub-text">How can I assist your educational journey today?</p>
            </div>
          ) : (
            <div className="message-list">
              {activeSession.messages.map((msg, i) => (
                <div key={i} className={`message-row ${msg.role}`}>
                  <div className="message-bubble">{msg.content}</div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
          )}
        </section>

        <footer className="input-area">
          <div className="input-wrapper">
            <input 
              placeholder="Ask me anything..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <div className="button-group">
              <button className={`icon-button mic ${isListening ? 'active' : ''}`} onClick={() => setIsListening(!isListening)}>
                <Mic size={20} />
              </button>
              <button className="icon-button send" onClick={handleSend} disabled={!input.trim()}>
                <Send size={20} />
              </button>
            </div>
          </div>
          <p className="footer-disclaimer">EduBuddy can make mistakes, so double-check it.</p>
        </footer>
      </main>
    </div>
  );
}

export default App;