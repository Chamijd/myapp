// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const JWT_SECRET = 'ch@ma-md-key';

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

mongoose.connect('mongodb+srv://jikew32666:nih7jgcq1pkSSyGY@cluster0.jbdxjkc.mongodb.net/autoreplydb');

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String
});
const User = mongoose.model('User', UserSchema);

const ReplySchema = new mongoose.Schema({
  name: String,
  comment: String,
  date: { type: Date, default: Date.now }
});

const CommentSchema = new mongoose.Schema({
  name: String,
  comment: String,
  date: { type: Date, default: Date.now },
  replies: [ReplySchema]
});
const Comment = mongoose.model('Comment', CommentSchema);

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, email, password: hash });
  res.status(201).json({ success: true });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Wrong password' });

  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET);
  res.json({ token, username: user.username });
});

app.get('/comments', async (req, res) => {
  const comments = await Comment.find().sort({ date: -1 });
  res.json(comments);
});

app.post('/comments', async (req, res) => {
  const { name, comment } = req.body;
  if (!name || !comment) return res.status(400).json({ error: 'Missing fields' });
  const newComment = new Comment({ name, comment });
  await newComment.save();
  res.status(201).json(newComment);
});

app.post('/comments/reply', async (req, res) => {
  const { parentId, name, comment } = req.body;
  const parent = await Comment.findById(parentId);
  if (!parent) return res.status(404).json({ error: 'Comment not found' });
  parent.replies.push({ name, comment });
  await parent.save();
  res.status(201).json(parent);
});

app.listen(3000, () => console.log('✅ Server running on http://localhost:3000'));
