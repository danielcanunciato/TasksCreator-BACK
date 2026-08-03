require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const db = require("./db");

const API = express();
const PORT = process.env.PORT || 4000;
const JWT_TOKEN = process.env.JWT_TOKEN || "JWTTKN";

const COMMIT_NAME = "COMMIT_#02:57AM";

// =====================================================
// CORS Configuration - Add this before your routes
// =====================================================
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://taskcreator.clooverlandstudios.com",
  "https://tc-api.clooverlandstudios.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Allow all in development
    if (process.env.NODE_ENV === "development") {
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

API.use(cors(corsOptions));
API.use(express.json());

API.options("*", cors(corsOptions));

API.get("/", (req, res) => {
  res.send(`API is running :: ${COMMIT_NAME}`);
});

const SERVER_ERROR_DEFAULT = (err, res) => {
    return res.status(500).json({error: "Internal server error.", details: err.message});
}

// ##########################################################
// AUTH METHODS
// ##########################################################

function authorizeRole(...allowedRoles) {
    return (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'Access denied' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, JWT_TOKEN, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }

        req.user = user;
        next();
    });
}

function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
        },  
        JWT_TOKEN,
        { expiresIn: '8h' }
    );
}

// ##########################################################
// REGISTER/LOGIN METHODS
// ##########################################################

API.post("/login", async (req,res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({error: "Missing credentials."})
        }

        const [rows] = await db.query(
            `
                SELECT * FROM bd_users WHERE username = ?
            `,
            [username]
        );

        const user = rows[0];

        if (!user) {
            return res.status(404).json({error: "User not found."});
        }

        const compare = await bcrypt.compare(password, user.password);

        if (!compare) {
            return res.status(401).json({error: "Wrong credentials."})
        }

        const token = createToken(user);
        const [userTasks] = await db.query(
            `
                SELECT * FROM bd_tasks WHERE userId = ?
            `,
            [user.id]
        )

        return res.status(200).json({
            token,
            user: user,
            userTasks: userTasks
        })
        
    } catch(err) {
        SERVER_ERROR_DEFAULT(err, res)
    }
})

API.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({error: "Missing credentials."})
        }

        const hashed = await bcrypt.hash(password, 10);

        const [userExists] = await db.query(
            `
                SELECT id, username
                FROM bd_users 
                WHERE username = ?
            `, [username]
        )

        if (userExists.length > 0) {
            return res.status(409).json({error: "User already exists."})
        }

        const [result] = await db.query(
            `
                INSERT INTO bd_users(username, password)
                VALUES (?, ?)
            `,
            [username, hashed]
        )

        return res.status(201).json({
            message: "User created successfully.",
            details: {
                id: result.insertId,
                username: username
            }
        })

    } catch(err) {
        SERVER_ERROR_DEFAULT(err, res);
    }
})

// ##########################################################
// TASKS METHODS
// ##########################################################

API.get("/tasks", authenticateToken, async (req, res) => {
    try {
        const [getTasks] = await db.query(
            `SELECT * FROM bd_tasks WHERE userid = ? ORDER BY id DESC`,
            [req.user.id]
        );

        return res.status(200).json(getTasks);
    } catch (err) {
        SERVER_ERROR_DEFAULT(err, res);
    }
});

API.post("/tasks", authenticateToken, async (req, res) => {
    try {
        const { title, desc, completed } = req.body;

        if (!title || !desc) {
            return res.status(400).json({ error: "Missing info." });
        }

        const [result] = await db.query(
            `INSERT INTO bd_tasks (userid, title, description, completed)
            VALUES (?, ?, ?, ?)`,
            [req.user.id, title, desc, Boolean(completed)]
        );

        return res.status(201).json({
            id: result.insertId,
            title,
            desc,
            completed: Boolean(completed),
            message: "Created a new task successfully."
        });
    } catch (err) {
        SERVER_ERROR_DEFAULT(err, res);
    }
});

API.patch("/tasks/:id", authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { completed } = req.body;

        if (typeof completed !== 'boolean') {
            return res.status(400).json({ error: "Missing completed state." });
        }

        const [result] = await db.query(
            `UPDATE bd_tasks SET completed = ? WHERE id = ? AND userid = ?`,
            [completed, id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Task not found." });
        }

        return res.status(200).json({
            id: Number(id),
            completed
        });
    } catch (err) {
        SERVER_ERROR_DEFAULT(err, res);
    }
});

// ##########################################################
// USERS METHODS
// ##########################################################

API.get("/users", async (req, res) => {
    try {

        const [users] = await db.query(
            `SELECT id, username FROM users`
        )

        return res.status(200).json(users)

    } catch(err) {
        SERVER_ERROR_DEFAULT(err, res);
    }
})

API.get("/users/:id", async (req,res) => {
    try {
        const { id } = req.params.id;

        const [user] = await db.query(
            `SELECT id, username FROM users WHERE id = ?`
            ,[id]
        )

        if (user.length === 0) {
            return res.status(404).json({error: "User not found."});
        }

        return res.status(200).json(user);

    } catch(err) {
        SERVER_ERROR_DEFAULT(err,res);
    }
})

// ##########################################################
// RUN SERVER ON PORT
// ##########################################################

const MACHINEIP = process.env.MACHINE_IP

API.listen(PORT, MACHINEIP, () => {
    console.log(`Server is running on port http://${MACHINEIP}:${PORT}`);
});