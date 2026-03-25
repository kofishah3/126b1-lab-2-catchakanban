const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const pool = require('./db');
const authMiddleware = require('./middleware/authMiddleware');

const app = express();
const PORT = 3000;
const SECRET = "SECRET_KEY"; // use env variable in real apps

app.use(cors());
app.use(express.json());

/* =========================
   REGISTER
========================= */
app.post('/register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password) {
    return res.status(400).send('INVALID'); // match frontend expectation
  }

  try {
    // check if user exists
    const existing = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).send('INVALID'); // user already exists
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // insert user
    await pool.query(
      `INSERT INTO users (email, password, first_name, last_name)
       VALUES ($1, $2, $3, $4)`,
      [email, hashed, firstName, lastName]
    );

    res.send('SUCCESS');

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).send('ERROR');
  }
});

/* =========================
   LOGIN
========================= */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.send('INVALID');
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.send('INVALID'); // user not found
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.send('INVALID'); // wrong password
    }

    // create JWT (optional for frontend, not needed for redirect)
    const token = jwt.sign(
      { id: user.id, email: user.email },
      SECRET,
      { expiresIn: '1h' }
    );

    // return success string (frontend expects this)
    res.send('SUCCESS');

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('ERROR');
  }
});

/* =========================
   PROTECTED ROUTE
========================= */
app.get('/dashboard', authMiddleware, (req, res) => {
  res.json({
    message: 'Welcome to dashboard!',
    user: req.user
  });
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});