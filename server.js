/* eslint-disable no-undef */
require('dotenv').config();
const express = require('express')
const http = require('http')
let cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const path = require("path") // récuperer l'id de la room
const bcrypt = require('bcrypt');
let xss = require("xss")
const jwt = require('jsonwebtoken');
const session = require('express-session');
const { authenticateToken } = require('./middleware/Auth');

let server = http.createServer(app)
let io = require('socket.io')(server, {
	cors: {
		origin: "http://localhost:8000",
		methods: ["GET", "POST"]
	}
});

app.use(cors({
	origin: "http://localhost:8000",
	methods: ["GET", "POST", "PUT", "DELETE"]
}));

app.use(bodyParser.json())



if (process.env.NODE_ENV === 'production') { // mode prod
	app.use(express.static(__dirname + "/build"))
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname + "/build/index.html"))
	})
}
app.set('port', 4001)

sanitizeString = (str) => {
	return xss(str)  // cette bibliotheque protege des faille xss
}

connections = {}
let roomUsers = {};

io.on('connection', (socket) => {

	socket.on('kick-user', (userId) => {
		// j'emet l'évent spécifiquement à l'user qui doit être kicked
		io.to(userId).emit('user-kicked');

	});
	
	socket.on('joinCall', (path, username, email) => {

		socket.on("refreshingPage", () => {
            // déco de la room si l'user refresh la page
            socket.leave(path);
            socket.emit("redirectToMainPage");
		  });
	
		socket.username = username;
		console.log(` "${username}" a rejoin avec l'ID: ${socket.id} dans la room : ${path}`);

		if (connections[path] === undefined) { // sinon il m'enquiquine
			connections[path] = [];
		}

			connections[path].push(socket.id); // je stock des sockets id dans la room . connections va contenir la room et la liste des socket id qui sont dans la room

		if (!roomUsers[path]) { // si pas d'users  dans la room -> tableau des users dans la room vide
			roomUsers[path] = [];
		}
		
		roomUsers[path].push({ id: socket.id, username, email });// roomUsers va contenir socket id et usernames (en gros les username présents dans la room)

		socket.emit('update-user-list', roomUsers[path]);

		// emit de la liste des users dans la room
		socket.broadcast.to(path).emit('update-user-list', roomUsers[path]);

		for (let i = 0; i < connections[path].length; i++) {
			// j'envoie le socket actuel, la liste des sockets id  dans la room et l'username
			io.to(connections[path][i]).emit("user-joined", socket.id, connections[path], username, email);
		}
	})


	socket.on('speechEvent', ({ username }) => {
		socket.broadcast.emit('speech-requested', { username });
	});

	socket.on('user-speaking', (data) => {
		socket.broadcast.emit('user-speaking', data);
	});

	socket.on('signal', (toId, message) => { // message contient le SDP généré avec createOffer coté front
		io.to(toId).emit('signal', socket.id, message) // j'emit le signal du socket.id (moi)  vers les autres sockets
	})

	socket.on('chat-message', (data, sender) => {
		data = sanitizeString(data);// on rend safe vs failles xss
		sender = sanitizeString(sender); // idem

		for (const key in connections) {
			if (connections[key].includes(socket.id)) { // je vérifie dans quel room mon socket est présent

				connections[key].forEach((key) => { // dans la room de mon socket id j'emit les messages et le sender 
					//ainsi que le socket.id car coté front je vérifie que la personne qui envoie le message n'est pas moi même avant d'emettre la notification et le son de la notif
					io.to(key).emit("chat-message", data, sender, socket.id);
				})
				break; // doit stop la boucle quand je trouve la room 
			}
		}
	});


	socket.on('disconnect', () => {

		console.log(`"${socket.username}" <- disconnected with ID ${socket.id}`);

		let updatedConnections = {};
		let updatedRoomUsers = {};

		for (const key in connections) {
			// filter les id de sockets de la salle actuelle (déterminée par lindex) 
			//pour exclure l'id du socket qui vient de se déco
			const remainingSockets = connections[key].filter(socketId => socketId !== socket.id);

			if (remainingSockets.length > 0) { //je check s'il reste d'autres sockets dans la salle après la déconnexion
				updatedConnections[key] = remainingSockets; // Si oui jmet à jour updatedConnections avec la liste filtrée des sockets restants dans la salle
				updatedRoomUsers[key] = roomUsers[key].filter(user => user.id !== socket.id); // je met à jour la liste des users dansla room apres déco

				remainingSockets.forEach((recipient) => {
					io.to(recipient).emit("userLeft", socket.id); // j'emit aux autres sockets chaque user qui viennent de se deco. 
					//Je traiterai cette emission coté client notamment pour gérer l'affichage des users connectés dans la room
				});
			} else {
				console.log(`All users have left the room: ${key}`);
			}

		}

		connections = updatedConnections; // je met à jour les connections avec la maj en foonction des déco
		roomUsers = updatedRoomUsers;  // je met à jour roomUsers avec la liste mise à jour en fonction des déco

	});


})


// DDB //

const mysql = require('mysql2');

const connection = mysql.createConnection({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_DATABASE
});

connection.connect((err) => {
	if (err) {
		console.error('Erreur de connexion à la base de données MySQL :', err);
	} else {
		console.log('Connecté à la base de données hdmeet');
	}
});


app.get('/users', (req, res) => {
	connection.query('SELECT * FROM users ORDER BY created_At DESC', (err, results) => {
		if (err) {
			console.error('Erreur lors de la récupération des utilisateurs depuis la base de données :', err);
			res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
		} else {
			const sanitizedResults = results.map(user => ({
				...user,
				//Si un pti malin (ou une ptite maline) a réussi je n'sais comment a injecter du code dans la bdd bah je nettoie ça avant d'envoyer au client
				email: sanitizeString(user.email),
				password: sanitizeString(user.password)
			}));
			res.json(sanitizedResults);
		}
	});
});


app.put('/updateRoles', (req, res) => {
	let { email, newRole, newPassword } = req.body;

	email = sanitizeString(email);
	newRole = sanitizeString(newRole);
	newPassword = sanitizeString(newPassword);

	if (!email || !newRole) {
		return res.status(400).json({ error: 'Email et nouveau rôle sont requis.' });
	}

	let query = 'UPDATE users SET role = ?';
	let queryParams = [newRole, email];

	// Si j'ai select "ADMIN" dans le form
	if (newRole === "ADMIN" && newPassword) {

		bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
			if (err) {
				console.error('Erreur lors du hachage du mot de passe :', err);
				return res.status(500).json({ error: 'Erreur lors du hachage du mot de passe.' });
			}

			query += ', password = ?'; // je concatene ", password = ? " à ma query
			queryParams = [newRole, hashedPassword, email];

			console.log("email  " + email)
			console.log("newRole " + newRole)
			console.log("newPassword " + newPassword)
			console.log("queryParams " + queryParams)
			console.log('query ' + query)

			// à ce stade j'ai  query qui est egal à UPDATE users set role = ? (ce sera newRole) ensuite je concatene ', pasword ?' (ce sera hashedPass)
			// pareil pour email à la fin de la query. C'est pour ça que l'ordre est important dans queryParams
			connection.query(query + ' WHERE email = ?', queryParams, (err, results) => {
				if (err) {
					console.error('Erreur lors de la mise à jour du rôle et du mot de passe de l\'utilisateur :', err);
					return res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle et du mot de passe de l\'utilisateur.' });
				}

				if (results.affectedRows === 0) {
					return res.status(404).json({ error: 'Utilisateur non trouvé.' });
				}

				res.json({ message: 'Rôle et mot de passe de l\'utilisateur mis à jour avec succès.' });
			});
		});
	} else {
		// Sinon je met juste à jour son role (si j'ai pas select admin dans le form)
		console.log("KOUERY : " + query, "queryPaRAMS : " + queryParams)
		connection.query(query + ' WHERE email = ?', queryParams, (err, results) => {
			if (err) {
				console.error('Erreur lors de la mise à jour du rôle de l\'utilisateur :', err);
				return res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle de l\'utilisateur.' });
			}

			if (results.affectedRows === 0) {
				return res.status(404).json({ error: 'Utilisateur non trouvé.' });
			}

			res.json({ message: 'Rôle de l\'utilisateur mis à jour avec succès.' });
		});
	}
});



app.post('/insertUser', (req, res) => {
	let { email, role, password } = req.body;
	console.log(email, role)
	email = sanitizeString(email);
	role = sanitizeString(role);
	password = sanitizeString(password)


	if (!email || !role) {
		return res.status(400).json({ error: 'Email et rôle sont requis.' });
	}

	bcrypt.hash(password, 10, (err, hashedPassword) => {
		if (err) {
			console.error('Erreur lors du hachage du mot de passe :', err);
			return res.status(500).json({ error: 'Erreur lors du hachage du mot de passe.' });
		}

		const query = 'INSERT INTO users (email, role, password) VALUES (?, ?, ?)';
		connection.query(query, [email, role, hashedPassword], (dbErr) => {
			if (dbErr) {
				console.error('Erreur lors de l\'insertion de l\'utilisateur :', dbErr);
				return res.status(500).json({ error: 'Erreur lors de l\'insertion de l\'utilisateur.' });
			}

			res.json({ message: 'Utilisateur inséré avec succès!' });
		});
	});
});


app.delete('/deleteUser/:email', (req, res) => {
	const email = sanitizeString(req.params.email);

	if (!email) {
		return res.status(400).json({ error: 'Email de l\'utilisateur à supprimer requis.' });
	}

	const query = 'DELETE FROM users WHERE email = ?';
	connection.query(query, [email], (err, results) => {
		if (err) {
			console.error('Erreur lors de la suppression de l\'utilisateur :', err);
			return res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur.' });
		}


		res.json({ message: 'Utilisateur supprimé avec succès!' });
	});
});



app.post('/login', (req, res) => {
	const { email, password } = req.body;

	app.use(session({
		secret: process.env.JWT_SECRET,
		resave: true,
		saveUninitialized: true,
	}));

	if (!email || !password) {
		return res.status(400).json({ error: 'Email et mot de passe sont requis.' });
	}

	const query = 'SELECT * FROM users WHERE email = ?';
	connection.query(query, [email], (err, results) => {
		if (err) {
			console.error('Erreur lors de la recherche de l\'utilisateur :', err);
			return res.status(500).json({ error: 'Erreur lors de la recherche de l\'utilisateur.' });
		}

		if (results.length === 0) {
			return res.status(401).json({ error: 'Utilisateur non trouvé.' });
		}

		const user = results[0];

		// jcompare le mdp fourni avec celui qui est haché en bdd
		bcrypt.compare(password, user.password, (bcryptErr, passwordMatch) => {
			if (bcryptErr) {
				return res.status(500).json({ error: 'Erreur lors de l\'authentification.' });
			}

			if (passwordMatch) {
				// le password a match alors je genere un token
				const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30m' });
				console.log('Token généré :', token);
				res.json({ token });
			} else {
				res.status(401).json({ error: 'Mot de passe incorrect.' });
			}
		});
	});
});


//verif token
app.use('/adminPanel', authenticateToken); // "/adminPanel" sera dans ma request dans athenticateToken



server.listen(app.get('port'), () => {
	console.log("listening on", app.get('port'))
})