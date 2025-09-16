import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, useRef } from 'react';
import './App.css';

// Notes context to manage global state
const NotesContext = createContext();

// PUBLIC_INTERFACE
export function useNotes() {
  /** Hook to access notes, CRUD operations, and UI helpers. */
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used within NotesProvider');
  return ctx;
}

// Storage keys
const STORAGE_KEYS = {
  NOTES: 'notes_manager__notes',
  THEME: 'notes_manager__theme',
};

// Utility: generate ID
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// PUBLIC_INTERFACE
export function NotesProvider({ children }) {
  /** Provides notes state, CRUD ops, theme, search, and sorting to children. */
  const [notes, setNotes] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [theme, setTheme] = useState(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEYS.THEME);
      return t || 'light';
    } catch {
      return 'light';
    }
  });

  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt'); // 'updatedAt' | 'title' | 'createdAt'
  const [selectedId, setSelectedId] = useState(null);

  // Persist notes and theme
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    } catch {}
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {}
  }, [theme]);

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // CRUD operations
  const createNote = useCallback((data = {}) => {
    const now = new Date().toISOString();
    const newNote = {
      id: genId(),
      title: data.title?.trim() || 'Untitled',
      content: data.content || '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      createdAt: now,
      updatedAt: now,
      archived: false,
    };
    setNotes(prev => [newNote, ...prev]);
    setSelectedId(newNote.id);
    return newNote;
  }, []);

  const updateNote = useCallback((id, updates) => {
    setNotes(prev =>
      prev.map(n =>
        n.id === id
          ? { ...n, ...updates, updatedAt: new Date().toISOString() }
          : n
      )
    );
  }, []);

  const toggleArchive = useCallback((id) => {
    setNotes(prev =>
      prev.map(n =>
        n.id === id ? { ...n, archived: !n.archived, updatedAt: new Date().toISOString() } : n
      )
    );
  }, []);

  const deleteNote = useCallback((id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setSelectedId(prev => (prev === id ? null : prev));
  }, []);

  const clearAll = useCallback(() => {
    if (window.confirm('Delete all notes? This cannot be undone.')) {
      setNotes([]);
      setSelectedId(null);
    }
  }, []);

  const filteredSortedNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = notes;
    if (q) {
      arr = notes.filter(n => {
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.tags || []).some(t => t.toLowerCase().includes(q))
        );
      });
    }
    const sorted = [...arr].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'createdAt') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    return sorted;
  }, [notes, query, sortBy]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      notes,
      createNote,
      updateNote,
      deleteNote,
      toggleArchive,
      clearAll,
      query,
      setQuery,
      sortBy,
      setSortBy,
      selectedId,
      setSelectedId,
      filteredSortedNotes,
    }),
    [
      theme,
      notes,
      createNote,
      updateNote,
      deleteNote,
      toggleArchive,
      clearAll,
      query,
      sortBy,
      selectedId,
      filteredSortedNotes,
    ]
  );

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

// UI Components

function Header() {
  const { theme, setTheme, createNote, clearAll } = useNotes();
  const onToggle = () => setTheme(theme === 'light' ? 'dark' : 'light');
  return (
    <header className="navbar">
      <div className="navbar-left">
        <span className="brand">Notes</span>
      </div>
      <div className="navbar-actions">
        <button className="btn" onClick={() => createNote({ title: 'New note' })} aria-label="Create note">+ New</button>
        <button className="btn btn-secondary" onClick={clearAll} aria-label="Clear all notes">Clear</button>
        <button className="btn" onClick={onToggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </div>
    </header>
  );
}

function Toolbar() {
  const { query, setQuery, sortBy, setSortBy } = useNotes();
  return (
    <div className="toolbar">
      <input
        className="input"
        type="search"
        placeholder="Search notes..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search notes"
      />
      <div className="spacer" />
      <label className="select-label">
        Sort by:
        <select
          className="select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort notes"
        >
          <option value="updatedAt">Last updated</option>
          <option value="createdAt">Date created</option>
          <option value="title">Title</option>
        </select>
      </label>
    </div>
  );
}

function NoteList() {
  const { filteredSortedNotes, selectedId, setSelectedId } = useNotes();
  if (!filteredSortedNotes.length) {
    return (
      <div className="empty">
        <p>No notes yet. Click “+ New” to create one.</p>
      </div>
    );
  }
  return (
    <ul className="note-list" role="list">
      {filteredSortedNotes.map(n => (
        <li
          key={n.id}
          className={`note-list-item ${selectedId === n.id ? 'active' : ''}`}
          onClick={() => setSelectedId(n.id)}
          role="button"
          aria-label={`Open note ${n.title}`}
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedId(n.id)}
        >
          <div className="note-list-title">
            <span className="title-text">{n.title || 'Untitled'}</span>
            {n.archived && <span className="badge">Archived</span>}
          </div>
          <div className="note-list-preview">
            {(n.content || '').slice(0, 80) || 'No content'}
          </div>
          <div className="note-list-meta">
            <span>Updated {new Date(n.updatedAt).toLocaleString()}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TagInput({ value, onChange }) {
  const [text, setText] = useState('');
  const addTag = () => {
    const t = text.trim();
    if (!t) return;
    const next = Array.from(new Set([...(value || []), t]));
    onChange(next);
    setText('');
  };
  const removeTag = (t) => {
    onChange((value || []).filter(x => x !== t));
  };
  return (
    <div className="tags">
      {(value || []).map(t => (
        <span className="tag" key={t}>
          {t}
          <button className="tag-remove" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`}>×</button>
        </span>
      ))}
      <div className="tag-input">
        <input
          className="input"
          placeholder="Add tag"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.key === 'Enter' ? addTag() : undefined)}
          aria-label="Add tag"
        />
        <button className="btn btn-secondary" onClick={addTag}>Add</button>
      </div>
    </div>
  );
}

function NoteEditor() {
  const { notes, selectedId, updateNote, deleteNote, toggleArchive } = useNotes();
  const note = notes.find(n => n.id === selectedId);
  const titleRef = useRef(null);

  useEffect(() => {
    if (note && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [selectedId]);

  if (!note) {
    return (
      <div className="empty">
        <p>Select a note to start editing.</p>
      </div>
    );
  }

  const onTitle = (e) => {
    updateNote(note.id, { title: e.target.value });
  };
  const onContent = (e) => {
    updateNote(note.id, { content: e.target.value });
  };
  const onTags = (tags) => {
    updateNote(note.id, { tags });
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <input
          ref={titleRef}
          className="title-input"
          value={note.title}
          onChange={onTitle}
          placeholder="Note title"
          aria-label="Note title"
        />
        <div className="editor-actions">
          <button className="btn btn-secondary" onClick={() => toggleArchive(note.id)}>
            {note.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button className="btn btn-danger" onClick={() => deleteNote(note.id)}>Delete</button>
        </div>
      </div>
      <textarea
        className="content-input"
        value={note.content}
        onChange={onContent}
        placeholder="Write your note here..."
        aria-label="Note content"
      />
      <div className="editor-footer">
        <TagInput value={note.tags} onChange={onTags} />
        <div className="timestamps">
          <span>Created: {new Date(note.createdAt).toLocaleString()}</span>
          <span>Updated: {new Date(note.updatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** Main application shell with header, sidebar (list), and editor pane. */
  return (
    <NotesProvider>
      <div className="app-shell">
        <Header />
        <main className="main">
          <aside className="sidebar">
            <Toolbar />
            <NoteList />
          </aside>
          <section className="pane">
            <NoteEditor />
          </section>
        </main>
      </div>
    </NotesProvider>
  );
}

export default App;
