const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { notifyNewPost } = require('../services/newsletterService');

const router = express.Router();

const posts = [
  {
    id: 1,
    title: 'Getting Started with React and TypeScript',
    author: 'Alice Johnson',
    date: 'March 10, 2026',
    excerpt: 'TypeScript supercharges your React projects with static typing, better autocompletion, and fewer runtime bugs. In this guide we walk through setting up a Vite-powered project from scratch.',
    category: 'Technology',
    readTime: '5 min read',
  },
  {
    id: 2,
    title: 'Understanding Keycloak: A Practical Introduction',
    author: 'Bob Smith',
    date: 'March 12, 2026',
    excerpt: 'Keycloak is an open-source identity and access management solution. Learn how to set up realms, clients, and roles to secure your applications with SSO in minutes.',
    category: 'Security',
    readTime: '8 min read',
  },
  {
    id: 3,
    title: 'Node.js REST API Best Practices in 2026',
    author: 'Carol Davis',
    date: 'March 14, 2026',
    excerpt: 'Building robust REST APIs requires consistent error handling, proper auth middleware, and thoughtful route design. Here are the patterns used by high-traffic production systems.',
    category: 'Backend',
    readTime: '6 min read',
  },
  {
    id: 4,
    title: 'CSS Grid vs Flexbox: When to Use Which',
    author: 'David Lee',
    date: 'March 16, 2026',
    excerpt: 'Both CSS Grid and Flexbox solve layout problems, but each shines in different scenarios. This deep dive will help you confidently choose the right tool for every design challenge.',
    category: 'Design',
    readTime: '4 min read',
  },
  {
    id: 5,
    title: 'JWT Tokens Demystified',
    author: 'Eva Martinez',
    date: 'March 18, 2026',
    excerpt: 'JSON Web Tokens are everywhere — but do you really know what is inside them? We crack open the header, payload, and signature to show you exactly how token-based auth works.',
    category: 'Security',
    readTime: '7 min read',
  },
  {
    id: 6,
    title: 'Building Accessible UIs with React',
    author: 'Frank Chen',
    date: 'March 20, 2026',
    excerpt: 'Accessibility is not an afterthought — it is a core requirement. Discover the ARIA roles, keyboard navigation patterns, and focus management strategies your React app needs today.',
    category: 'Frontend',
    readTime: '6 min read',
  },
];

// GET /api/posts — any authenticated user
router.get('/', verifyToken, (req, res) => {
  res.json(posts);
});

// GET /api/posts/:id — any authenticated user
router.get('/:id', verifyToken, (req, res) => {
  const post = posts.find((p) => p.id === parseInt(req.params.id, 10));
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// POST /api/posts — authors/admins only; triggers M2M newsletter notification
router.post('/', verifyToken, requireRole('author', 'admin'), async (req, res) => {
  const { title, author, excerpt, category, readTime } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: 'title and author are required' });
  }

  const newPost = {
    id: posts.length + 1,
    title,
    author,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    excerpt: excerpt || '',
    category: category || 'General',
    readTime: readTime || '3 min read',
  };
  posts.push(newPost);

  // M2M — notify newsletter service (fire and forget, don't fail the request)
  notifyNewPost({
    postId: newPost.id,
    title: newPost.title,
    author: newPost.author,
    excerpt: newPost.excerpt,
    publishedBy: req.user.preferred_username || req.user.email || req.user.sub,
  })
    .then((result) => console.log('Newsletter notified:', result.message))
    .catch((err) => console.error('Newsletter notify failed (non-fatal):', err.message));

  res.status(201).json(newPost);
});

module.exports = router;
