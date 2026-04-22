import React, { useState } from 'react';
import axios from 'axios';

const Subscribe: React.FC = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      await axios.post(`${import.meta.env.VITE_NEWSLETTER_API_URL}/api/subscribers`, { email, name });
      setStatus('success');
      setMessage('🎉 You are subscribed! You will receive updates when new posts are published.');
      setEmail('');
      setName('');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.error || 'Subscription failed. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="subscribe-box">
        <p className="subscribe-success">{message}</p>
      </div>
    );
  }

  return (
    <div className="subscribe-box">
      <form onSubmit={handleSubmit} className="subscribe-form">
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Enter your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={status === 'loading'} className="btn-subscribe">
          {status === 'loading' ? 'Subscribing…' : '✉ Subscribe for Free'}
        </button>
      </form>
      {status === 'error' && <p className="subscribe-error">{message}</p>}
    </div>
  );
};

export default Subscribe;
