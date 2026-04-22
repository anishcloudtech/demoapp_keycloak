import React, { useEffect, useState, useCallback } from 'react';
import Keycloak from 'keycloak-js';
import axios from 'axios';
import PublishPost from './PublishPost';
import SubscriberList from './SubscriberList';
import RegisterStaff from './RegisterStaff';

interface Post {
  id: number;
  title: string;
  author: string;
  date: string;
  excerpt: string;
  category: string;
  readTime: string;
}

interface Props {
  keycloak: Keycloak;
}

const BlogList: React.FC<Props> = ({ keycloak }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      await keycloak.updateToken(30);
      const { data } = await axios.get<Post[]>(
        `${import.meta.env.VITE_API_URL}/api/posts`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setPosts(data);
    } catch (err: any) {
      if (!keycloak.authenticated || err?.message?.toLowerCase().includes('token')) {
        keycloak.login(); // session expired — redirect to login
      } else {
        setError('Failed to load posts. Make sure the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  if (loading) return <div className="loading">Loading articles…</div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div className="blog-container">
      <PublishPost keycloak={keycloak} onPublished={fetchPosts} />
      <SubscriberList keycloak={keycloak} />
      <RegisterStaff keycloak={keycloak} />
      <div className="blog-header">
        <h2>Latest Articles</h2>
        <p>{posts.length} articles available</p>
      </div>

      {posts.map((post) => (
        <article key={post.id} className="post-card">
          <div className="post-meta">
            <span className="post-category">{post.category}</span>
            <span className="post-date">{post.date}</span>
            <span className="read-time">⏱ {post.readTime}</span>
          </div>

          <h3 className="post-title">{post.title}</h3>
          <p className="post-excerpt">{post.excerpt}</p>

          <div className="post-footer">
            <div className="post-author">
              <div className="author-avatar">
                {post.author.charAt(0).toUpperCase()}
              </div>
              <span>{post.author}</span>
            </div>
            <button className="btn-read">Read More →</button>
          </div>
        </article>
      ))}
    </div>
  );
};

export default BlogList;
