const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');
const app = express();

// === MongoDB Connection ===
const MONGO_URI = 'mongodb+srv://jikew32666:nih7jgcq1pkSSyGY@cluster0.jbdxjkc.mongodb.net/autoreplydb';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// === Models ===
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: String,
  password: String,
});
const User = mongoose.model('User', UserSchema);

const CommentSchema = new mongoose.Schema({
  user: String,
  text: String,
  createdAt: Date,
  replies: [{
    user: String,
    text: String,
    createdAt: Date
  }]
});
const Comment = mongoose.model('Comment', CommentSchema);

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'chama-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  cookie: { maxAge: 86400000 } // 1 day
}));

app.use(express.static(path.join(__dirname, 'public')));

// === Auth Middleware ===
const requireLogin = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

// === Routes ===

// Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  const exists = await User.findOne({ username });
  if (exists) return res.status(400).json({ error: 'Username already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ username, email, password: hashedPassword });
  res.json({ message: 'Registered successfully' });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Invalid credentials' });

  req.session.user = { username: user.username };
  res.json({ message: 'Login successful', user: req.session.user });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

// Get current user
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  res.json({ user: req.session.user });
});

// Get comments
app.get('/api/comments', async (req, res) => {
  const comments = await Comment.find().sort({ createdAt: 1 });
  res.json({ comments });
});

// Post comment
app.post('/api/comments', requireLogin, async (req, res) => {
  const { text } = req.body;
  const comment = await Comment.create({
    user: req.session.user.username,
    text,
    createdAt: new Date(),
    replies: []
  });
  res.json({ message: 'Comment posted', comment });
});

// Post reply
app.post('/api/comments/:id/reply', requireLogin, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const comment = await Comment.findById(id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  comment.replies.push({
    user: req.session.user.username,
    text,
    createdAt: new Date()
  });

  await comment.save();
  res.json({ message: 'Reply posted', comment });
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
