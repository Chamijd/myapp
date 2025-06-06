const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = 3000;

// MongoDB Atlas URL (ඔයාගේ)
const mongoURL = 'mongodb+srv://yifov84170:5HPjp58UeDrdMMHi@cluster0.sedhk0k.mongodb.net/myappdb?retryWrites=true&w=majority&appName=Cluster0';

// Connect MongoDB
mongoose.connect(mongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  comment: String,
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  date: { type: Date, default: Date.now },
});
const Comment = mongoose.model('Comment', CommentSchema);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'verysecretkey',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: mongoURL }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
}));

// Serve static files (index.html etc)
app.use(express.static(path.join(__dirname)));

// API Routes

// Register
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if(!username || !email || !password) return res.status(400).json({ success: false, message: 'All fields are required' });

  try {
    const existUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existUser) return res.status(400).json({ success: false, message: 'Username or email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashed });
    await newUser.save();

    // Auto login after register
    req.session.userId = newUser._id;
    req.session.username = newUser.username;

    res.json({ success: true, username: newUser.username });
  } catch(err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password) return res.status(400).json({ success: false, message: 'All fields are required' });

  try {
    const user = await User.findOne({ username });
    if(!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if(!match) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    req.session.userId = user._id;
    req.session.username = user.username;

    res.json({ success: true, username: user.username });
  } catch(err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Get current user session
app.get('/me', (req, res) => {
  if(!req.session.userId) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, username: req.session.username });
});

// Get comments with nested replies
app.get('/comments', async (req, res) => {
  const comments = await Comment.find().sort({ date: 1 }).lean();

  const commentMap = {};
  comments.forEach(c => {
    c.replies = [];
    commentMap[c._id] = c;
  });

  const rootComments = [];
  comments.forEach(c => {
    if (c.replyTo) {
      if (commentMap[c.replyTo]) {
        commentMap[c.replyTo].replies.push(c);
      }
    } else {
      rootComments.push(c);
    }
  });

  res.json(rootComments);
});

// Post comment or reply
app.post('/comments', async (req, res) => {
  if(!req.session.userId) return res.status(401).json({ success: false, message: 'Not logged in' });
  const { comment, replyTo } = req.body;
  if(!comment || comment.trim() === '') return res.status(400).json({ success: false, message: 'Empty comment' });

  try {
    const newComment = new Comment({
      userId: req.session.userId,
      username: req.session.username,
      comment,
      replyTo: replyTo || null,
    });
    await newComment.save();
    res.json({ success: true, comment: newComment });
  } catch(err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
