
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');


const app = express();
const PORT = 3000;


app.use(express.json());
app.use(express.static(__dirname)); 


const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool;

async function initializeDatabase() {

    for (let i = 0; i < 10; i++) {
        try {
            pool = mysql.createPool(dbConfig);
            const connection = await pool.getConnection();
            console.log("Successfully connected to the database.");

           
            await connection.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log("Table 'messages' is ready.");
            connection.release();
            return; 
        } catch (err) {
            console.log("Database connection failed. Retrying... (" + (i+1) + "/10)");
            await new Promise(res => setTimeout(res, 5000)); 
        }
    }

    console.error("Could not connect to the database after 10 attempts. Exiting.");
    process.exit(1);
}


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


app.get('/messages', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).send("Error fetching messages: " + err.message);
    }
});


app.post('/messages', async (req, res) => {
    const { username, message } = req.body;
    if (!username || !message) {
        return res.status(400).send("Username and message are required.");
    }
    try {
        await pool.query('INSERT INTO messages (username, message) VALUES (?, ?)', [username, message]);
        res.status(201).send("Message added successfully.");
    } catch (err) {
        res.status(500).send("Error adding message: " + err.message);
    }
});

initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
});