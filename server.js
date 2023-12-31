/* eslint-disable no-undef */
const express = require('express')
const http = require('http')
let cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const path = require("path") // récuperer l'id de la room
const bcrypt = require('bcrypt');
let xss = require("xss")

let server = http.createServer(app)
let io = require('socket.io')(server, {
	cors: {
		origin: "http://localhost:8000",
		methods: ["GET", "POST"]
	}
});

app.use(cors())
app.use(bodyParser.json())

if (process.env.NODE_ENV === 'production') {
	app.use(express.static(__dirname + "/build"))
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname + "/build/index.html"))
	})
}
app.set('port', (process.env.PORT || 4001))

sanitizeString = (str) => {
	return xss(str)  // cette bibliotheque protege des faille xss
}

connections = {}
messages = {}
let roomUsers = {};

io.on('connection', (socket) => {

	socket.on('joinCall', (path, username, email) => {

		socket.username = username;
		console.log(` ${username} a rejoin avec l'ID: ${socket.id} dans la room : ${path}`);
		io.to(socket.id).emit('update-user-list', roomUsers[path]);

		if (connections[path] === undefined) { // sinon il m'enquiquine
			connections[path] = [];
		}

		connections[path].push(socket.id); // je stock des sockets id dans la room . connections va contenir la room et la liste des socket id qui sont dans la room


		if (!roomUsers[path]) { // si pas d'users  dans la room -> tableau des users dans la room vide
			roomUsers[path] = [];
		}
		roomUsers[path].push({ id: socket.id, username, email });// roomUsers va contenir socket id et usernames (en gros les username présents dans la room)

		// emit de la liste des users dans la room
		io.to(path).emit('update-user-list', roomUsers[path]);
		for (let i = 0; i < connections[path].length; i++) {
			// j'envoie le socket actuel, la liste des sockets id  dans la room et l'username
			io.to(connections[path][i]).emit("user-joined", socket.id, connections[path], username, email);
		}
		if (messages[path] !== undefined) {
			for (let i = 0; i < messages[path].length; i++) {
				io.to(socket.id).emit("chat-message", messages[path][i]['data'],
					messages[path][i]['sender'], messages[path][i]['socket-id-sender'])
			}
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
			if (connections[key].includes(socket.id)) {

				messages[key] = messages[key] || [];

				messages[key].push({ sender, data, 'socket-id-sender': socket.id });
				connections[key].forEach((key) => {
					io.to(key).emit("chat-message", data, sender, socket.id);
				});
				break;
			}
		}
	});



	socket.on('disconnect', () => {
		const updatedConnections = {};

		for (const key in connections) {
			const remainingSockets = connections[key].filter(socketId => socketId !== socket.id);

			if (remainingSockets.length > 0) {
				updatedConnections[key] = remainingSockets;

				remainingSockets.forEach((recipient) => {
					io.to(recipient).emit("userLeft", socket.id);
				});
			} else {
				console.log(`Tous les utilisateurs ont quitté la salle : ${key}`);
			}
		}

		connections = updatedConnections;

		for (let path in roomUsers) {
			// contient tableau de tous les users dont l'id n'est pas égal au socket id, du coup ça contient les users de la room actuelle
			roomUsers[path] = roomUsers[path].filter(user => user.id !== socket.id);
			// MAJ de la liste des utilisateurs pour tous les clients de la room
			io.to(path).emit('update-user-list', roomUsers[path]);
		}
	});
})


// DDB //

const mysql = require('mysql2');

const connection = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: '',
	database: 'hdmeet'
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
				//Si un pti malin a réussi je n'sais comment a injecter du code dans la bdd bah je nettoie ça avant d'envoyer au client
				email: sanitizeString(user.email),
				password : sanitizeString(user.password)
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
		queryParams = [newRole,hashedPassword, email];

			console.log("email  " + email )
			console.log( "newRole " + newRole)
			console.log( "newPassword "+ newPassword)	
			console.log("queryParams " + queryParams)
			console.log('query ' + query)
			
			// à ce stade j'ai  query qui est egal à UPDATE users set role = ? (ce sera newRole) ensuite je concatene ', pasword ?' (ce sera hashedPass)
			// pareil pour email à la fin de la query. C'est pour ça que l'ordre est important dans queryParams
		connection.query(query + ' WHERE email = ?', queryParams , (err, results) => {
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
	  console.log("KOUERY : " +query, "queryPaRAMS : " + queryParams)
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




server.listen(app.get('port'), () => {
	console.log("listening on", app.get('port'))
})