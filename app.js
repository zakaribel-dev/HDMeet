/* eslint-disable no-undef */
const express = require('express')
const http = require('http')
var cors = require('cors')
const app = express()
const bodyParser = require('body-parser')
const path = require("path")
var xss = require("xss")

var server = http.createServer(app)
var io = require('socket.io')(server)

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
	return xss(str)  // cette bibliotheque proteges des faille xss
}

connections = {}
messages = {}
timeOnline = {}
let roomUsers = {};

io.on('connection', (socket) => {

    socket.on('joinCall', (path, username) => {
        socket.username = username;
		console.log(` ${username} a rejoin avec l'ID: ${socket.id} dans la room : ${path}`);
		io.to(socket.id).emit('update-user-list', roomUsers[path]);

        if (connections[path] === undefined) {
            connections[path] = [];
        }
        connections[path].push(socket.id);

        timeOnline[socket.id] = new Date();

        if (!roomUsers[path]) {
            roomUsers[path] = [];
        }
        roomUsers[path].push({ id: socket.id, username });

        // Retarder légèrement l'envoi de la liste des utilisateurs
		console.log('envoi de la liste des users MAJ', roomUsers[path]);
		io.to(path).emit('update-user-list', roomUsers[path]);
        for (let a = 0; a < connections[path].length; ++a) {
            io.to(connections[path][a]).emit("user-joined", socket.id, connections[path], username);
        }
		if (messages[path] !== undefined) {
			for (let a = 0; a < messages[path].length; ++a) {
				io.to(socket.id).emit("chat-message", messages[path][a]['data'],
					messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
			}
		}

	})

	
	socket.on('speechEvent', ({ username }) => {
		socket.broadcast.emit('speech-requested', { username });
	  });

	socket.on('signal', (toId, message) => { // message contient le SDP généré avec createOffer coté front
		io.to(toId).emit('signal', socket.id, message) // on va emmetre le signal d'un socketId  vers les autres sockets
	})

	socket.on('chat-message', (data, sender) => {
		data = sanitizeString(data);// on rend safe (faille xss)
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
		for (const key in connections) {
			const index = connections[key].indexOf(socket.id);

			if (index !== -1) {
				connections[key].splice(index, 1);

				connections[key].forEach((recipient) => {
					io.to(recipient).emit("userLeft", socket.id);
				});

				console.log(`User vient de quitter : ${socket.username} avec ID: ${socket.id}`);
				console.log('liste MAJ suite à deco du ou des users:', roomUsers[path]);
				if (connections[key].length === 0) {
					delete connections[key];
				}
				break;
			}
		}
		for (let path in roomUsers) {
            roomUsers[path] = roomUsers[path].filter(user => user.id !== socket.id);
            // Mettre à jour la liste des utilisateurs pour tous les clients de la room
            io.to(path).emit('update-user-list', roomUsers[path]);
        }
	});
})

app.get('/test', (req, res) => {
	res.send('Hello World');
  });


server.listen(app.get('port'), () => {
	console.log("listening on", app.get('port'))
})