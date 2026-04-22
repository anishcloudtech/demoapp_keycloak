import React, { useState } from 'react';
import Keycloak from 'keycloak-js';
import axios from 'axios';

interface Props {
  keycloak: Keycloak;
  onPublished?: () => void; // optional callback to refresh post list
}

interface FormData {
  title: string;
  author: string;
  excerpt: string;
  category: string;
  readTime: string;
}

const PublishPost: React.FC<Props> = ({ keycloak, onPublished }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<FormData>({
    title: '',
    author: '',
    excerpt: '',
    category: 'Technology',
    readTime: '3 min read',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      await keycloak.updateToken(30);
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/posts`,
        form,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setStatus('success');
      setMessage('Post published! Newsletter notification sent to subscribers.');
      setForm({ title: '', author: '', excerpt: '', category: 'Technology', readTime: '3 min read' });
      onPublished?.();
      setTimeout(() => { setOpen(false); setStatus('idle'); setMessage(''); }, 3000);
    } catch (err: any) {
      setStatus('error');
      const serverMsg = err.response?.data?.error;
      setMessage(serverMsg || 'Failed to publish. Check your role permissions.');
    }
  };

  if (!open) {
    return (
      <div className="publish-trigger">
        <button className="btn-publish" onClick={() => setOpen(true)}>
          + Publish New Post
        </button>
      </div>
    );
  }

  return (
    <div className="publish-overlay">
      <div className="publish-modal">
        <div className="publish-modal-header">
          <h2>Publish New Post</h2>
          <button className="btn-close" onClick={() => { setOpen(false); setStatus('idle'); setMessage(''); }}>✕</button>
        </div>

        {status === 'success' ? (
          <p className="publish-success">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="publish-form">
            <label>Title *
              <input name="title" value={form.title} onChange={handleChange} required placeholder="Post title" />
            </label>

            <label>Author *
              <input name="author" value={form.author} onChange={handleChange} required placeholder="Your name" />
            </label>

            <label>Excerpt
              <textarea name="excerpt" value={form.excerpt} onChange={handleChange} rows={3} placeholder="Short description of the post..." />
            </label>

            <div className="publish-form-row">
              <label>Category
                <select name="category" value={form.category} onChange={handleChange}>
                  <option>Technology</option>
                  <option>Security</option>
                  <option>Backend</option>
                  <option>Frontend</option>
                  <option>Design</option>
                  <option>General</option>
                </select>
              </label>

              <label>Read Time
                <input name="readTime" value={form.readTime} onChange={handleChange} placeholder="5 min read" />
              </label>
            </div>

            {status === 'error' && <p className="publish-error">{message}</p>}

            <div className="publish-form-actions">
              <button type="button" className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={status === 'loading'}>
                {status === 'loading' ? 'Publishing…' : 'Publish & Notify Subscribers'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PublishPost;
